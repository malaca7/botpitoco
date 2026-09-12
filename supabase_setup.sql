-- ==============================================================================
-- PITOCO DE GENTE — SCHEMA OFICIAL SUPABASE & SEED COMPLETO CORRIGIDO
-- Executar no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/cbeiguyvoepbcafmxduy/sql/new
-- ==============================================================================

-- 1. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. LIMPEZA SEGURA DE TABELAS LEGADAS (vazias ou com schema antigo incompatível)
-- Removemos tabelas antigas para evitar erros de tipos incompatíveis (UUID vs TEXT)
-- e colunas faltantes como store_id, label, source, position.
-- ==============================================================================
DROP TABLE IF EXISTS public.flow_edges CASCADE;
DROP TABLE IF EXISTS public.flow_nodes CASCADE;
DROP TABLE IF EXISTS public.flows CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.bot_config CASCADE;
DROP TABLE IF EXISTS public.system_users CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.admin_profiles CASCADE;

-- ==============================================================================
-- 3. FUNÇÃO RPC PARA EXECUÇÃO REMOTA DE SQL (SECURITY DEFINER)
-- Permite que scripts autorizados executem migrações remotamente via Service Role
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
  RETURN json_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO postgres;

-- ==============================================================================
-- 4. TABELA: STORES (MULTI-LOJAS CENTRALIZADO: MATRIZ, BOULEVARD, E-COMMERCE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    business_hours TEXT DEFAULT 'Seg a Sáb: 09:00 às 19:00',
    city TEXT DEFAULT 'Recife - PE',
    manager_name TEXT,
    monthly_revenue NUMERIC(12,2) DEFAULT 0.00,
    active_chats INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. TABELA: CATEGORIES (CATEGORIAS DO CATÁLOGO DE MODA BEBÊ & ENXOVAIS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. TABELA: PRODUCTS (PRODUTOS, TAMANHOS RN A 3 ANOS, CORES E ESTOQUE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    category_name TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    promotional_price NUMERIC(10,2),
    sizes TEXT[] NOT NULL DEFAULT ARRAY['RN', 'P', 'M', 'G', 'GG']::TEXT[],
    colors TEXT[] NOT NULL DEFAULT ARRAY['Branco Puro', 'Azul Bebê', 'Rosa Seco']::TEXT[],
    image_url TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 50,
    sku TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    material TEXT DEFAULT 'Algodão Suedine 100% Pima',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. TABELA: CLIENTS (CRM, HISTÓRICO, BEBÊ, DPP E TAGS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    store_name TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    city TEXT,
    cep TEXT,
    notes TEXT,
    baby_name TEXT,
    due_date TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tags TEXT[] DEFAULT ARRAY['Cliente WhatsApp']::TEXT[],
    last_interaction TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de retrocompatibilidade para contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    profile_picture_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT[] DEFAULT ARRAY['Cliente WhatsApp']::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. TABELA: CONVERSATIONS (ATENDIMENTO MULTI-LOJAS & STATUS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    store_name TEXT,
    phone TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'bot',
    assigned_to TEXT,
    last_message TEXT,
    unread_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 9. TABELA: CHAT_MESSAGES (MENSAGENS EM TEMPO REAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT NOT NULL,
    client_id TEXT,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    direction TEXT NOT NULL DEFAULT 'inbound',
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    text TEXT,
    media_url TEXT,
    media_type TEXT,
    status TEXT NOT NULL DEFAULT 'delivered',
    author_name TEXT,
    sender TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de retrocompatibilidade messages
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT,
    direction TEXT NOT NULL DEFAULT 'inbound',
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    whatsapp_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'delivered',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. TABELAS: FLUXOS VISUAIS (FLOWS, NODES, EDGES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.flows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT false,
    trigger_type TEXT DEFAULT 'keyword',
    keywords TEXT,
    trigger_keywords TEXT,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    store_name TEXT,
    node_count INTEGER DEFAULT 0,
    steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flow_nodes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flow_id TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT,
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}'::jsonb,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flow_edges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flow_id TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 11. TABELA: ORDERS (PEDIDOS DE COMPRA E-COMMERCE & WHATSAPP)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number TEXT NOT NULL UNIQUE,
    client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    shipping_type TEXT DEFAULT 'motoboy',
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    coupon_code TEXT,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT DEFAULT 'pix',
    payment_status TEXT DEFAULT 'pending',
    delivery_status TEXT DEFAULT 'preparing',
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 12. TABELA: SUPPORT_TICKETS (TICKETS DE ATENDIMENTO HUMANO / FILA)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    store_name TEXT,
    client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT,
    client_phone TEXT,
    conversation_id TEXT,
    protocol TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    attendant_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 13. TABELA: BOT_CONFIG (CONFIGURAÇÕES DO BOT PITOCO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bot_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT DEFAULT 'Pitoco Bot',
    bot_name TEXT NOT NULL DEFAULT 'Pitoco Bot',
    store_name TEXT NOT NULL DEFAULT 'Pitoco de Gente',
    welcome_message TEXT NOT NULL DEFAULT 'Olá! Bem-vindo(a) à Pitoco de Gente — Roupas de Bebê, Infantil e Enxovais! 👶✨ Como podemos te encantar hoje?',
    handoff_message TEXT NOT NULL DEFAULT 'Transferindo para uma de nossas consultoras especializadas...',
    fallback_message TEXT NOT NULL DEFAULT 'Não entendi essa opção. Por favor, escolha um dos números do menu abaixo:',
    pix_key TEXT NOT NULL DEFAULT 'financeiro@pitocodegente.com.br',
    pix_name TEXT NOT NULL DEFAULT 'Pitoco de Gente Artigos Infantis LTDA',
    pix_owner TEXT DEFAULT 'Pitoco de Gente Artigos Infantis LTDA',
    pix_city TEXT NOT NULL DEFAULT 'Recife',
    shipping_motoboy_price NUMERIC(10,2) NOT NULL DEFAULT 15.00,
    shipping_correios_price NUMERIC(10,2) NOT NULL DEFAULT 24.90,
    free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    vip_consultation_enabled BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tone TEXT DEFAULT 'Amigável e Acolhedor',
    avatar_url TEXT,
    support_email TEXT DEFAULT 'contato@pitocodegente.com.br',
    support_phone TEXT DEFAULT '81987300915',
    business_hours TEXT DEFAULT '08:00 às 19:00',
    website_url TEXT DEFAULT 'https://pitoco.malaca.com.br',
    company_address TEXT DEFAULT 'R. Vig. João Batista, 93 - Centro, Cabo de Santo Agostinho - PE',
    notify_new_bookings BOOLEAN DEFAULT true,
    notify_phone TEXT DEFAULT '81987300915',
    play_audio_alerts BOOLEAN DEFAULT true,
    custom_variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 14. TABELA: SYSTEM_USERS (USUÁRIOS, PAPÉIS & PERMISSÕES POR PAINEL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    username TEXT,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'attendant',
    panels TEXT[] DEFAULT ARRAY['atendimento']::TEXT[],
    permissions JSONB NOT NULL DEFAULT '{"can_access_admin": true, "can_access_atendimento": true, "can_access_loja": true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 15. TABELA: SETTINGS (CONFIGURAÇÕES GERAIS DA INTEGRAÇÃO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    backend_url TEXT DEFAULT 'https://pitoco.discloud.app',
    whatsapp_phone_number_id TEXT,
    whatsapp_business_account_id TEXT,
    whatsapp_access_token_encrypted TEXT,
    webhook_verify_token TEXT DEFAULT 'pitoco_verify_token_secure',
    bot_profile JSONB DEFAULT '{"name": "Victoria", "gender": "female", "company_name": "Pitoco de Gente"}'::jsonb,
    whatsapp_session JSONB DEFAULT '{"status": "disconnected"}'::jsonb,
    custom_variables JSONB DEFAULT '[]'::jsonb,
    supabase_url TEXT DEFAULT 'https://cbeiguyvoepbcafmxduy.supabase.co',
    supabase_anon_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 16. TABELA: APPOINTMENTS (CONSULTORIAS VIP DE ENXOVAL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT REFERENCES public.stores(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    consultation_type TEXT NOT NULL DEFAULT 'online_whatsapp',
    consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consultation_time TEXT NOT NULL DEFAULT '10:00',
    due_date DATE,
    baby_gender TEXT DEFAULT 'surpresa',
    status TEXT NOT NULL DEFAULT 'confirmed',
    consultant_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 17. TABELAS ADICIONAIS DE SUPORTE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action TEXT NOT NULL,
    performed_by TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID,
    name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 18. GARANTIA ADICIONAL DE COLUNAS (IDEMPOTÊNCIA TOTAL)
-- ==============================================================================
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'bot';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_name TEXT;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS store_name TEXT;

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS store_id TEXT;

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS store_name TEXT;

ALTER TABLE public.flow_nodes ADD COLUMN IF NOT EXISTS flow_id TEXT;
ALTER TABLE public.flow_nodes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.flow_nodes ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.flow_nodes ADD COLUMN IF NOT EXISTS position JSONB DEFAULT '{"x":0,"y":0}'::jsonb;

ALTER TABLE public.flow_edges ADD COLUMN IF NOT EXISTS flow_id TEXT;
ALTER TABLE public.flow_edges ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.flow_edges ADD COLUMN IF NOT EXISTS target TEXT;

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS backend_url TEXT DEFAULT 'https://pitoco.discloud.app';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS supabase_url TEXT DEFAULT 'https://cbeiguyvoepbcafmxduy.supabase.co';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT;

-- ==============================================================================
-- 19. ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_store ON public.conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_store ON public.support_tickets(store_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON public.flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_flow ON public.flow_edges(flow_id);

-- ==============================================================================
-- 20. ROW LEVEL SECURITY (RLS) & POLICIES PERMISSIVAS
-- ==============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao total stores" ON public.stores;
CREATE POLICY "Permissao total stores" ON public.stores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total categories" ON public.categories;
CREATE POLICY "Permissao total categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total products" ON public.products;
CREATE POLICY "Permissao total products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total clients" ON public.clients;
CREATE POLICY "Permissao total clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total contacts" ON public.contacts;
CREATE POLICY "Permissao total contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total conversations" ON public.conversations;
CREATE POLICY "Permissao total conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total chat_messages" ON public.chat_messages;
CREATE POLICY "Permissao total chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total messages" ON public.messages;
CREATE POLICY "Permissao total messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total flows" ON public.flows;
CREATE POLICY "Permissao total flows" ON public.flows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total flow_nodes" ON public.flow_nodes;
CREATE POLICY "Permissao total flow_nodes" ON public.flow_nodes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total flow_edges" ON public.flow_edges;
CREATE POLICY "Permissao total flow_edges" ON public.flow_edges FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total orders" ON public.orders;
CREATE POLICY "Permissao total orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total support_tickets" ON public.support_tickets;
CREATE POLICY "Permissao total support_tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total bot_config" ON public.bot_config;
CREATE POLICY "Permissao total bot_config" ON public.bot_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total system_users" ON public.system_users;
CREATE POLICY "Permissao total system_users" ON public.system_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total settings" ON public.settings;
CREATE POLICY "Permissao total settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total appointments" ON public.appointments;
CREATE POLICY "Permissao total appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao total audit_logs" ON public.audit_logs;
CREATE POLICY "Permissao total audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 21. HABILITAR REALTIME (Seguro contra duplicidade)
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  EXCEPTION WHEN duplicate_object THEN
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;

-- ==============================================================================
-- 22. SEED INICIAL COMPLETO: LOJAS, CATEGORIAS, PRODUTOS, FLUXOS E USUÁRIOS
-- ==============================================================================
-- Lojas Oficiais Pitoco de Gente
INSERT INTO public.stores (id, name, slug, address, phone, whatsapp_number, is_active, business_hours, city, manager_name, monthly_revenue)
VALUES
  ('store-001', 'Loja Matriz — Centro', 'matriz', 'R. Vig. João Batista, 93 - Centro, Cabo de Santo Agostinho - PE, 54505-470', '81987300915', '81987300915', true, 'Seg a Sex: 08:00 às 18:00 | Sáb: 08:00 às 12:00', 'Cabo de Santo Agostinho - PE', 'Juliana Gerente', 48500.00),
  ('store-002', 'Loja Ipojuca — Filial', 'ipojuca', 'R. Cristóvão José da Silva, 114 - Centro, Ipojuca - PE, 54590-000', '81987300915', '81987300915', true, 'Seg a Sex: 08:00 às 18:00 | Sáb: 08:00 às 12:00', 'Ipojuca - PE', 'Carla Gerente', 38200.00),
  ('store-003', 'Atendimento Geral / E-commerce', 'ecommerce', 'Centro de Distribuição Online - Av. Brasil, 1500', '81987300915', '81987300915', true, '24 horas (Robô) | Atendentes: 08:00 às 20:00', 'Digital / Brasil', 'Equipe Digital Pitoco', 95800.00)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  whatsapp_number = EXCLUDED.whatsapp_number;

-- Categorias do Catálogo de Bebês
INSERT INTO public.categories (id, name, slug, description, sort_order, is_active)
VALUES
  ('cat-001', 'Bodies & Roupinhas Básicas', 'bodies-roupinhas', 'Bodies em algodão suedine 100% Pima, mijões e kits essenciais de toque macio', 1, true),
  ('cat-002', 'Macacões com Zíper Duplo', 'macacoes-ziper', 'Macacões práticos com duplo cursor que facilitam a troca de fraldas', 2, true),
  ('cat-003', 'Saídas de Maternidade', 'saidas-maternidade', 'Conjuntos luxo em tricot antialérgico, mantas coordenadas e acabamento realeza', 3, true),
  ('cat-004', 'Kits de Berço & Quarto', 'kits-berco', 'Kits de berço 400 fios, tranças protetoras, ninhos redutores e lençóis premium', 4, true),
  ('cat-005', 'Mala & Acessórios Maternidade', 'malas-acessorios', 'Malas térmicas, bolsas de passeio impermeáveis e organizadores de troca', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- Produtos Selecionados com Fotos de Alta Qualidade
INSERT INTO public.products (id, category_id, name, description, price, promotional_price, sizes, colors, stock_quantity, is_featured, material, image_url)
VALUES
  (
    'prod-001',
    'cat-001',
    'Body Manga Longa Algodão Suedine 100% Pima',
    'Confeccionado em puro algodão suedine 100% egípcio com toque sedoso e gola envelope que não aperta a cabeça do bebê. Proteção térmica ideal para os primeiros meses.',
    49.90,
    39.90,
    ARRAY['RN', 'P', 'M', 'G', 'GG'],
    ARRAY['Branco Puro', 'Azul Bebê', 'Rosa Seco', 'Verde Menta', 'Bege Neutro'],
    120,
    true,
    'Algodão Suedine 100% Pima',
    'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=500&auto=format&fit=crop'
  ),
  (
    'prod-002',
    'cat-002',
    'Macacão Canelado com Zíper Duplo Soft',
    'O queridinho das mamães! Possui zíper com cursor duplo que abre por cima e por baixo, proteção interna de zíper para não tocar na pele do bebê e pezinho reversível.',
    79.90,
    69.90,
    ARRAY['RN', 'P', 'M', 'G', '1 ano'],
    ARRAY['Azul Bebê', 'Rosa Seco', 'Verde Menta', 'Bege Neutro'],
    85,
    true,
    'Algodão Canelado Premium',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&auto=format&fit=crop'
  ),
  (
    'prod-003',
    'cat-003',
    'Saída de Maternidade Tricot Luxo Realeza 4 Peças',
    'Conjunto completo para o momento mais especial: Macacão bordado, manta aconchegante coordenada, touquinha e par de luvinhas. Confeccionado em tricot térmico antialérgico.',
    189.90,
    169.90,
    ARRAY['RN', 'P'],
    ARRAY['Branco Puro', 'Rosa Seco', 'Azul Bebê', 'Amarelo Manteiga'],
    45,
    true,
    'Tricot Luxo 50% Algodão 50% Acrílico Antialérgico',
    'https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?w=500&auto=format&fit=crop'
  ),
  (
    'prod-004',
    'cat-004',
    'Kit Berço Algodão 400 Fios Trança Nuvem',
    'Kit com lateral em trança fofinha, cabeceira nuvem bordada, lençol com elástico 400 fios e fronha delicada. Segurança e aconchego máximo para o quartinho do bebê.',
    289.90,
    259.90,
    ARRAY['RN', 'P', 'M', 'G'],
    ARRAY['Branco Puro', 'Verde Menta', 'Bege Neutro'],
    30,
    true,
    'Algodão Percal 400 Fios Acetinado',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500&auto=format&fit=crop'
  ),
  (
    'prod-005',
    'cat-005',
    'Mala Maternidade Térmica Master Impermeável',
    'Compartimento amplo com divisórias para as roupinhas das primeiras 48h, forro térmico impermeável fácil de higienizar e bolsos laterais para mamadeiras e fraldas.',
    219.90,
    199.90,
    ARRAY['G', 'GG'],
    ARRAY['Bege Neutro', 'Rosa Seco', 'Azul Bebê'],
    40,
    false,
    'Couro Ecológico Impermeável Soft',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop'
  )
ON CONFLICT (id) DO NOTHING;

-- Configurações Oficiais do Robô Pitoco
INSERT INTO public.bot_config (
    id, name, bot_name, store_name, welcome_message, handoff_message, fallback_message,
    pix_key, pix_name, pix_owner, pix_city, shipping_motoboy_price, shipping_correios_price, free_shipping_threshold,
    vip_consultation_enabled, is_active, tone, support_email, support_phone, business_hours, website_url, company_address
) VALUES (
    'default',
    'Pitoco Bot',
    'Pitoco Bot',
    'Pitoco de Gente',
    'Olá! Seja bem-vindo(a) à Pitoco de Gente — Roupas de Bebê, Infantil e Enxovais! 👶💖 Como posso ajudar você hoje?',
    'Transferindo para uma de nossas consultoras especializadas...',
    'Por favor, digite o número da opção desejada no menu:',
    'financeiro@pitocodegente.com.br',
    'Pitoco de Gente Artigos Infantis LTDA',
    'Pitoco de Gente Artigos Infantis LTDA',
    'Cabo de Santo Agostinho',
    15.00,
    24.90,
    250.00,
    true,
    true,
    'Amigável e Acolhedor',
    'contato@pitocodegente.com.br',
    '81987300915',
    'Seg a Sex: 08:00 às 18:00 | Sáb: 08:00 às 12:00',
    'https://pitoco.malaca.com.br',
    'R. Vig. João Batista, 93 - Centro, Cabo de Santo Agostinho - PE'
) ON CONFLICT (id) DO UPDATE SET
    bot_name = EXCLUDED.bot_name,
    store_name = EXCLUDED.store_name,
    welcome_message = EXCLUDED.welcome_message,
    pix_key = EXCLUDED.pix_key;

-- Configurações Gerais do Sistema
INSERT INTO public.settings (
    id, backend_url, webhook_verify_token, supabase_url, supabase_anon_key
) VALUES (
    'default',
    'https://pitoco.discloud.app',
    '7assistente_meta_webhook_token_2026',
    'https://cbeiguyvoepbcafmxduy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWlndXl2b2VwYmNhZm14ZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzU5NzcsImV4cCI6MjEwNDMxMTk3N30.1XpWL6ns9NlPh4sQ3M8-OJTnKCPH-jf89iFspmBrKxM'
) ON CONFLICT (id) DO UPDATE SET
    backend_url = EXCLUDED.backend_url,
    supabase_url = EXCLUDED.supabase_url;

-- Usuários e Acessos aos Painéis
INSERT INTO public.system_users (id, store_id, name, phone, email, password_hash, role, panels)
VALUES
  ('user-ceo', null, 'Malaca CEO', '81996138924', 'ceo@pitocodegente.com.br', 'admin', 'ceo', ARRAY['admin', 'atendimento', 'fluxos', 'catalogo', 'whatsapp', 'acessos', 'lojas']::TEXT[]),
  ('user-mgr-matriz', 'store-001', 'Gerente Matriz Centro', '81999990001', 'gerente.centro@pitocodegente.com.br', '1234', 'manager', ARRAY['atendimento', 'catalogo', 'lojas']::TEXT[]),
  ('user-mgr-ipojuca', 'store-002', 'Gerente Ipojuca Filial', '81999990002', 'gerente.ipojuca@pitocodegente.com.br', '1234', 'manager', ARRAY['atendimento', 'catalogo', 'lojas']::TEXT[]),
  ('user-att-sofia', 'store-001', 'Sofia Consultora Enxoval', '81999990003', 'sofia@pitocodegente.com.br', '1234', 'attendant', ARRAY['atendimento']::TEXT[])
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Fluxo Oficial Principal (WhatsApp Geral Pitoco de Gente)
INSERT INTO public.flows (id, name, description, status, version, is_active, trigger_type, node_count)
VALUES
  ('flow-pitoco-001', 'Atendimento & Vendas Principal (WhatsApp Geral)', 'Fluxo oficial com catálogo de bebês, guia de medidas, consultoria VIP, frete, PIX e transbordo por loja.', 'published', 3, true, 'Qualquer Mensagem Recebida', 9),
  ('flow-pitoco-003', 'Recepção Loja Matriz Centro', 'Atendimento e roteamento direto para a equipe presencial da Loja Matriz Centro.', 'draft', 1, false, 'Filial Centro', 3),
  ('flow-pitoco-004', 'Recepção Loja Ipojuca', 'Atendimento e suporte presencial aos clientes da loja Ipojuca.', 'draft', 1, false, 'Filial Ipojuca', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ==============================================================================
-- FIM DO SCRIPT DE SCHEMA E CONFIGURAÇÃO
-- ==============================================================================
