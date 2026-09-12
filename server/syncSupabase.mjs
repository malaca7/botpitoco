// Script utilitário para sincronizar dados do banco persistente com o Supabase
import { loadDb } from './flowRunner.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cbeiguyvoepbcafmxduy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWlndXl2b2VwYmNhZm14ZHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTk3NywiZXhwIjoyMTA0MzExOTc3fQ.sbB-6Fx4uR61oDin8djrdbpmNSPs2Z8hGdYSoVhIHvw';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase não configurado no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function syncToSupabase(dbOverride) {
  console.log('🔄 [Supabase Sync] Iniciando sincronização completa para o Supabase...');
  const db = dbOverride || loadDb();
  const report = {
    stores: 0,
    categories: 0,
    products: 0,
    clients: 0,
    flows: 0,
    nodes: 0,
    edges: 0,
    tickets: 0,
    appointments: 0,
    users: 0,
    botConfig: 0,
    settings: 0,
    errors: [],
  };

  // 1. Sincronizar Lojas
  if (Array.isArray(db.stores) && db.stores.length > 0) {
    console.log(`📡 Sincronizando ${db.stores.length} lojas...`);
    for (const s of db.stores) {
      try {
        const { error } = await supabase.from('stores').upsert({
          id: s.id,
          name: s.name,
          slug: s.slug,
          address: s.address || '',
          phone: s.phone || '',
          whatsapp_number: s.whatsapp_number || '',
          is_active: s.is_active ?? true,
          business_hours: s.business_hours || 'Seg a Sáb: 09:00 às 19:00',
          city: s.city || 'Recife - PE',
          manager_name: s.manager_name || '',
          monthly_revenue: s.monthly_revenue || 0,
          active_chats: s.active_chats || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) report.errors.push(`stores: ${error.message}`);
        else report.stores++;
      } catch (err) {
        report.errors.push(`stores: ${err.message}`);
      }
    }
  }

  // 2. Sincronizar Categorias
  if (Array.isArray(db.categories) && db.categories.length > 0) {
    console.log(`📡 Sincronizando ${db.categories.length} categorias...`);
    for (const c of db.categories) {
      try {
        const { error } = await supabase.from('categories').upsert({
          id: c.id,
          store_id: c.store_id || null,
          name: c.name,
          slug: c.slug,
          description: c.description || null,
          icon: c.icon || null,
          sort_order: c.sort_order || 0,
          is_active: c.is_active ?? true
        }, { onConflict: 'id' });
        if (error) report.errors.push(`categories: ${error.message}`);
        else report.categories++;
      } catch (err) {
        report.errors.push(`categories: ${err.message}`);
      }
    }
  }

  // 3. Sincronizar Produtos
  if (Array.isArray(db.products) && db.products.length > 0) {
    console.log(`📡 Sincronizando ${db.products.length} produtos...`);
    for (const p of db.products) {
      try {
        const { error } = await supabase.from('products').upsert({
          id: p.id,
          store_id: p.store_id || null,
          category_id: p.category_id,
          category_name: p.category_name || null,
          name: p.name,
          description: p.description || '',
          price: p.price || 0,
          promotional_price: p.promotional_price || null,
          sizes: p.sizes || ['RN', 'P', 'M', 'G'],
          colors: p.colors || ['Branco Puro'],
          image_url: p.image_url || null,
          stock_quantity: p.stock_quantity ?? 50,
          sku: p.sku || null,
          is_featured: p.is_featured ?? false,
          is_active: p.is_active ?? true,
          material: p.material || 'Algodão Suedine 100% Pima',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) report.errors.push(`products: ${error.message}`);
        else report.products++;
      } catch (err) {
        report.errors.push(`products: ${err.message}`);
      }
    }
  }

  // 4. Sincronizar Clientes / Contatos
  if (db.contacts) {
    const contactsList = Object.values(db.contacts);
    console.log(`📡 Sincronizando ${contactsList.length} contatos...`);
    for (const c of contactsList) {
      try {
        const cleanPhone = String(c.phone || '').replace(/\D/g, '');
        if (!cleanPhone) continue;
        const { error } = await supabase.from('clients').upsert({
          id: c.id || `cli-${cleanPhone}`,
          store_id: c.store_id || null,
          store_name: c.store_name || null,
          name: c.name || 'Cliente WhatsApp',
          phone: cleanPhone,
          email: c.email || null,
          address: c.address || null,
          city: c.city || null,
          notes: c.notes || null,
          baby_name: c.baby_name || null,
          due_date: c.due_date || null,
          tags: c.tags || ['Cliente WhatsApp'],
          last_interaction: c.last_interaction || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' });
        if (error) report.errors.push(`clients: ${error.message}`);
        else report.clients++;

        await supabase.from('contacts').upsert({
          id: c.id || `contact-${cleanPhone}`,
          phone: cleanPhone,
          name: c.name || 'Cliente WhatsApp',
          status: c.status || 'active',
          tags: c.tags || ['Cliente WhatsApp'],
          metadata: c.custom_fields || c.metadata || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' }).catch(() => {});
      } catch (err) {
        report.errors.push(`clients: ${err.message}`);
      }
    }
  }

  // 5. Sincronizar Fluxos
  if (Array.isArray(db.flows) && db.flows.length > 0) {
    console.log(`📡 Sincronizando ${db.flows.length} fluxos...`);
    for (const f of db.flows) {
      try {
        const { error } = await supabase.from('flows').upsert({
          id: f.id,
          name: f.name,
          description: f.description || '',
          status: f.status || 'published',
          version: f.version || 1,
          is_active: f.is_active ?? true,
          trigger_type: f.trigger_type || 'Qualquer Mensagem Recebida',
          keywords: f.keywords || '',
          trigger_keywords: f.trigger_keywords || f.keywords || '',
          store_id: f.store_id || null,
          store_name: f.store_name || null,
          node_count: f.node_count || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) report.errors.push(`flows: ${error.message}`);
        else report.flows++;
      } catch (err) {
        report.errors.push(`flows: ${err.message}`);
      }
    }
  }

  // 6. Sincronizar Nós e Arestas dos Fluxos em Lote
  if (db.nodes && typeof db.nodes === 'object') {
    for (const [flowId, nodesList] of Object.entries(db.nodes)) {
      if (Array.isArray(nodesList) && nodesList.length > 0) {
        const batch = nodesList.map(n => ({
          id: n.id,
          flow_id: flowId,
          type: n.type || 'message',
          label: n.data?.label || n.label || 'Nó',
          position: n.position || { x: 0, y: 0 },
          data: n.data || {},
          updated_at: new Date().toISOString()
        }));
        try {
          const { error } = await supabase.from('flow_nodes').upsert(batch, { onConflict: 'id' });
          if (error) report.errors.push(`nodes (${flowId}): ${error.message}`);
          else report.nodes += batch.length;
        } catch (err) {
          report.errors.push(`nodes (${flowId}): ${err.message}`);
        }
      }
    }
  }

  if (db.edges && typeof db.edges === 'object') {
    for (const [flowId, edgesList] of Object.entries(db.edges)) {
      if (Array.isArray(edgesList) && edgesList.length > 0) {
        const batch = edgesList.map(e => ({
          id: e.id,
          flow_id: flowId,
          source: e.source,
          target: e.target,
          source_handle: e.sourceHandle || null,
          target_handle: e.targetHandle || null,
          data: e.data || {},
          updated_at: new Date().toISOString()
        }));
        try {
          const { error } = await supabase.from('flow_edges').upsert(batch, { onConflict: 'id' });
          if (error) report.errors.push(`edges (${flowId}): ${error.message}`);
          else report.edges += batch.length;
        } catch (err) {
          report.errors.push(`edges (${flowId}): ${err.message}`);
        }
      }
    }
  }

  // 7. Sincronizar Consultorias & Agendamentos
  if (Array.isArray(db.appointments) && db.appointments.length > 0) {
    for (const a of db.appointments) {
      try {
        const { error } = await supabase.from('appointments').upsert(a, { onConflict: 'id' });
        if (error) report.errors.push(`appointments: ${error.message}`);
        else report.appointments++;
      } catch (err) {
        report.errors.push(`appointments: ${err.message}`);
      }
    }
  }

  // 8. Sincronizar Usuários e Acessos
  if (Array.isArray(db.systemUsers) && db.systemUsers.length > 0) {
    for (const u of db.systemUsers) {
      try {
        const cleanPhone = String(u.phone || u.username || `user-${u.id}`).replace(/\D/g, '') || '558199999999';
        const { error } = await supabase.from('system_users').upsert({
          id: u.id,
          store_id: u.store_id || null,
          name: u.name || u.username || 'Usuário',
          phone: cleanPhone,
          email: u.email || null,
          password_hash: u.password_hash || u.password || '123456',
          role: u.role || 'attendant',
          panels: u.panels || ['atendimento'],
          permissions: u.permissions || {},
          is_active: u.is_active ?? true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) report.errors.push(`system_users: ${error.message}`);
        else report.users++;
      } catch (err) {
        report.errors.push(`system_users: ${err.message}`);
      }
    }
  }

  // 10. Sincronizar Configurações do Robô
  if (db.botProfile) {
    try {
      const { error } = await supabase.from('bot_config').upsert({
        id: 'default',
        bot_name: db.botProfile.bot_nome || db.botProfile.bot_name || 'Pitoco Bot',
        store_name: db.botProfile.empresa || db.botProfile.store_name || 'Pitoco de Gente',
        welcome_message: db.botProfile.welcome_message || 'Olá! Bem-vindo(a) à Pitoco de Gente!',
        handoff_message: db.botProfile.handoff_message || 'Transferindo para consultora...',
        pix_key: db.botProfile.pix_key || 'financeiro@pitocodegente.com.br',
        pix_name: db.botProfile.pix_name || db.botProfile.pix_owner || 'Pitoco de Gente Artigos Infantis LTDA',
        shipping_motoboy_price: db.botProfile.shipping_motoboy || db.botProfile.shipping_motoboy_price || 15.00,
        shipping_correios_price: db.botProfile.shipping_correios || db.botProfile.shipping_correios_price || 24.90,
        free_shipping_threshold: db.botProfile.free_shipping_min || db.botProfile.free_shipping_threshold || 250.00,
        is_active: db.botProfile.is_active ?? true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) report.errors.push(`bot_config: ${error.message}`);
      else report.botConfig++;
    } catch (err) {
      report.errors.push(`bot_config: ${err.message}`);
    }
  }

  // 11. Sincronizar Settings Gerais
  if (db.settings) {
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'default',
        backend_url: db.settings.backend_url || 'https://pitoco.discloud.app',
        whatsapp_phone_number_id: db.settings.whatsapp_phone_number_id || null,
        whatsapp_business_account_id: db.settings.whatsapp_business_account_id || null,
        webhook_verify_token: db.settings.webhook_verify_token || '7assistente_meta_webhook_token_2026',
        bot_profile: db.settings.bot_profile || {},
        whatsapp_session: db.settings.whatsapp_session || { status: 'disconnected' },
        custom_variables: db.settings.custom_variables || [],
        supabase_url: SUPABASE_URL,
        supabase_anon_key: process.env.SUPABASE_ANON_KEY || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) report.errors.push(`settings: ${error.message}`);
      else report.settings++;
    } catch (err) {
      report.errors.push(`settings: ${err.message}`);
    }
  }

  console.log('✅ [Supabase Sync] Processo de sincronização finalizado:', report);
  return report;
}

if (process.argv[1]?.includes('syncSupabase.mjs')) {
  syncToSupabase().catch(err => {
    console.error('❌ Erro na sincronização:', err);
  });
}
