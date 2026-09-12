import { 
  AdminProfile, 
  Settings, 
  Flow, 
  FlowStep,
  Contact, 
  Conversation, 
  Message, 
  DashboardKPIs, 
  FlowNode, 
  FlowEdge, 
  BotProfile, 
  Store, 
  Product, 
  Category, 
  SupportTicket, 
  VIPConsultation, 
  Appointment,
  AgendaSettings,
  AgendaServiceItem,
  SystemUser, 
  SystemAccessUser,
  UserPermissions, 
  Attendant, 
  CannedReply, 
  AuditLog, 
  WhatsAppSession 
} from '../types';

import { 
  initialStores, 
  initialCategories, 
  initialProducts, 
  initialAdminProfile, 
  initialSettings, 
  sampleFlows, 
  initialFlowNodes, 
  initialFlowEdges, 
  defaultBotProfile, 
  initialAttendants, 
  defaultCannedReplies, 
  sampleContacts, 
  sampleConversations, 
  initialKPIs,
  initialAccessUsers
} from './mockData';

import * as SupabaseService from './supabaseClient';
import { DEFAULT_ROLE_CONFIGS } from './permissions';
import { getWhatsAppBackendUrl } from './whatsappService';

export const getBackendUrl = getWhatsAppBackendUrl;

const API_BASE = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BOT_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) ||
  'https://pitoco.discloud.app';

export const defaultBotConfig: BotConfig = {
  welcome_message: '👶✨ *PITOCO DE GENTE — Roupas de Bebê & Enxovais*\nOlá, *{clientName}*! Bem-vindo(a) à nossa loja oficial! Como podemos te ajudar hoje?',
  pix_key: 'financeiro@pitocodegente.com.br',
  pix_name: 'Pitoco de Gente Artigos Infantis LTDA',
  pix_city: 'Recife',
  shipping_motoboy_price: 15.00,
  shipping_correios_price: 24.90,
  free_shipping_threshold: 250.00,
  is_active: true,
};

const STORAGE_KEYS = {
  STORES: 'pitoco_stores',
  ACTIVE_STORE: 'pitoco_active_store_filter',
  CATEGORIES: 'pitoco_categories',
  PRODUCTS: 'pitoco_products',
  TICKETS: 'pitoco_support_tickets',
  ADMIN: 'pitoco_admin_profile',
  SETTINGS: 'pitoco_settings',
  FLOWS: 'pitoco_flows',
  FLOW_NODES_PREFIX: 'pitoco_nodes_',
  FLOW_EDGES_PREFIX: 'pitoco_edges_',
  CONTACTS: 'pitoco_contacts',
  CONVERSATIONS: 'pitoco_conversations',
  MESSAGES_PREFIX: 'pitoco_msgs_',
  AUTH_TOKEN: 'pitoco_auth_session',
  ATTENDANTS: 'pitoco_attendants',
  CANNED_REPLIES: 'pitoco_canned_replies',
  VIP_CONSULTATIONS: 'pitoco_vip_consultations',
  SYSTEM_USERS: 'pitoco_system_users',
  AUDIT_LOGS: 'pitoco_audit_logs',
};

function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Storage setItem error:', err);
  }
}

export const StorageService = {
  // ==============================================================================
  // 1. MULTI-LOJAS CENTRALIZADO & CRUD
  // ==============================================================================
  async getStores(): Promise<Store[]> {
    try {
      const res = await fetch(`${API_BASE}/api/stores`).catch(() => null);
      if (res && res.ok) {
        const apiStores = await res.json();
        if (Array.isArray(apiStores) && apiStores.length > 0) {
          setItem(STORAGE_KEYS.STORES, apiStores);
          return apiStores;
        }
      }
    } catch (e) {}

    if (SupabaseService.isSupabaseReady) {
      const dbStores = await SupabaseService.getStores();
      if (dbStores.length > 0) {
        setItem(STORAGE_KEYS.STORES, dbStores);
        return dbStores;
      }
    }
    return getItem<Store[]>(STORAGE_KEYS.STORES, initialStores);
  },

  async getStoreById(id: string): Promise<Store | null> {
    const stores = await this.getStores();
    return stores.find(s => s.id === id || s.slug === id) || null;
  },

  async saveStore(store: Partial<Store>): Promise<Store> {
    const updatedStore: Store = {
      id: store.id || `store-${Date.now()}`,
      slug: store.slug || `loja-${Date.now()}`,
      name: store.name || 'Nova Loja',
      address: store.address || '',
      phone: store.phone || '',
      whatsapp_number: store.whatsapp_number || store.phone || '',
      is_active: store.is_active !== false,
      business_hours: store.business_hours || '09:00 às 19:00',
      city: store.city || 'Recife - PE',
      monthly_revenue: store.monthly_revenue || 0,
      active_chats: store.active_chats || 0,
      ...store,
    };

    // 1. Salvar no Backend Discloud (atualiza o bot em tempo real)
    try {
      await fetch(`${API_BASE}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStore),
      }).catch(() => {});
    } catch (e) {}

    // 2. Salvar no Supabase se pronto
    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.updateStore(updatedStore.id, updatedStore);
    }

    // 3. Atualizar armazenamento local
    const local = getItem<Store[]>(STORAGE_KEYS.STORES, initialStores);
    const idx = local.findIndex(s => s.id === updatedStore.id);
    if (idx >= 0) local[idx] = updatedStore;
    else local.push(updatedStore);
    setItem(STORAGE_KEYS.STORES, local);

    return updatedStore;
  },

  async deleteStore(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/stores/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    const local = getItem<Store[]>(STORAGE_KEYS.STORES, initialStores);
    const filtered = local.filter(s => s.id !== id && s.slug !== id);
    setItem(STORAGE_KEYS.STORES, filtered);
    return true;
  },

  getActiveStoreFilter(): string | null {
    return getItem<string | null>(STORAGE_KEYS.ACTIVE_STORE, null);
  },

  setActiveStoreFilter(storeId: string | null): void {
    setItem(STORAGE_KEYS.ACTIVE_STORE, storeId);
  },

  // ==============================================================================
  // 2. CATEGORIAS & PRODUTOS DO CATÁLOGO DE BEBÊ & CRUD
  // ==============================================================================
  async getCategories(storeId?: string): Promise<Category[]> {
    try {
      const url = storeId ? `${API_BASE}/api/categories?store_id=${storeId}` : `${API_BASE}/api/categories`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const apiCats = await res.json();
        if (Array.isArray(apiCats) && apiCats.length > 0) {
          setItem(STORAGE_KEYS.CATEGORIES, apiCats);
          return apiCats;
        }
      }
    } catch (e) {}

    if (SupabaseService.isSupabaseReady) {
      const dbCats = await SupabaseService.getCategories(storeId);
      if (dbCats.length > 0) {
        setItem(STORAGE_KEYS.CATEGORIES, dbCats);
        return dbCats;
      }
    }
    return getItem<Category[]>(STORAGE_KEYS.CATEGORIES, initialCategories);
  },

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    const updatedCat: Category = {
      id: cat.id || `cat-${Date.now()}`,
      name: cat.name || 'Nova Categoria',
      slug: cat.slug || `categoria-${Date.now()}`,
      description: cat.description || '',
      icon: cat.icon || 'tag',
      sort_order: cat.sort_order || 1,
      is_active: cat.is_active !== false,
      ...cat,
    };

    try {
      await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCat),
      }).catch(() => {});
    } catch (e) {}

    const local = getItem<Category[]>(STORAGE_KEYS.CATEGORIES, initialCategories);
    const idx = local.findIndex(c => c.id === updatedCat.id || c.slug === updatedCat.slug);
    if (idx >= 0) local[idx] = updatedCat;
    else local.push(updatedCat);
    setItem(STORAGE_KEYS.CATEGORIES, local);

    return updatedCat;
  },

  async deleteCategory(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/categories/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    const local = getItem<Category[]>(STORAGE_KEYS.CATEGORIES, initialCategories);
    const filtered = local.filter(c => c.id !== id && c.slug !== id);
    setItem(STORAGE_KEYS.CATEGORIES, filtered);
    return true;
  },

  async getProducts(storeId?: string, categoryId?: string): Promise<Product[]> {
    // 1. Tentar buscar dados frescos da API do Bot
    try {
      const res = await fetch(`${API_BASE}/api/products`).catch(() => null);
      if (res && res.ok) {
        const apiProds = await res.json();
        if (Array.isArray(apiProds) && apiProds.length > 0) {
          setItem(STORAGE_KEYS.PRODUCTS, apiProds);
          let filtered = apiProds;
          if (storeId) filtered = filtered.filter((p: any) => !p.store_id || p.store_id === storeId);
          if (categoryId) filtered = filtered.filter((p: any) => p.category_id === categoryId);
          return filtered;
        }
      }
    } catch (e) {}

    if (SupabaseService.isSupabaseReady) {
      const dbProds = await SupabaseService.getProducts(storeId, categoryId);
      if (dbProds.length > 0) {
        setItem(STORAGE_KEYS.PRODUCTS, dbProds);
        return dbProds;
      }
    }
    let prods = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    if (storeId) {
      prods = prods.filter(p => !p.store_id || p.store_id === storeId);
    }
    if (categoryId) {
      prods = prods.filter(p => p.category_id === categoryId);
    }
    return prods;
  },

  async saveProduct(prod: Partial<Product>): Promise<Product> {
    const productRecord: Product = {
      id: prod.id || `prod-${Date.now()}`,
      category_id: prod.category_id || 'cat-001',
      name: prod.name || 'Novo Produto',
      description: prod.description || '',
      price: prod.price || 49.90,
      promotional_price: prod.promotional_price,
      sizes: prod.sizes || ['RN', 'P', 'M'],
      colors: prod.colors || ['Branco Puro', 'Azul Bebê'],
      stock_quantity: prod.stock_quantity ?? 50,
      is_featured: prod.is_featured ?? false,
      is_active: prod.is_active ?? true,
      material: prod.material || 'Algodão Suedine 100%',
      image_url: prod.image_url || '',
      category_name: prod.category_name || 'Roupas & Enxovais',
      ...prod,
    };

    // 1. Sincronizar com Backend Discloud (o Bot usa imediatamente)
    try {
      await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productRecord),
      }).catch(() => {});
    } catch (e) {}

    // 2. Salvar no Supabase
    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.saveProduct(productRecord);
    }

    // 3. Atualizar LocalStorage
    const local = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const existingIndex = local.findIndex(p => p.id === productRecord.id);
    if (existingIndex >= 0) local[existingIndex] = productRecord;
    else local.unshift(productRecord);
    setItem(STORAGE_KEYS.PRODUCTS, local);

    return productRecord;
  },

  async deleteProduct(id: string): Promise<boolean> {
    // 1. Remover do Backend Discloud
    try {
      await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    // 2. Remover do Supabase
    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.deleteProduct(id);
    }

    // 3. Remover do LocalStorage
    const local = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
    const filtered = local.filter(p => p.id !== id);
    setItem(STORAGE_KEYS.PRODUCTS, filtered);
    return true;
  },

  // ==============================================================================
  // 2.1 CONFIGURAÇÕES GLOBAIS DO BOT & WHATSAPP
  // ==============================================================================
  async getBotConfig(): Promise<BotConfig> {
    try {
      const res = await fetch(`${API_BASE}/api/bot-config`).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json.config) {
          setItem(STORAGE_KEYS.SETTINGS + '_bot', json.config);
          return json.config;
        }
      }
    } catch (e) {}
    return getItem<BotConfig>(STORAGE_KEYS.SETTINGS + '_bot', defaultBotConfig);
  },

  async saveBotConfig(config: Partial<BotConfig>): Promise<BotConfig> {
    const current = await this.getBotConfig();
    const updated: BotConfig = { ...current, ...config };

    try {
      await fetch(`${API_BASE}/api/bot-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    } catch (e) {}

    setItem(STORAGE_KEYS.SETTINGS + '_bot', updated);
    return updated;
  },

  // ==============================================================================
  // 3. CONVERSAS & INBOX DE ATENDIMENTO HUMANO
  // ==============================================================================
  async getConversations(storeId?: string): Promise<Conversation[]> {
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItem(STORAGE_KEYS.CONVERSATIONS, data);
          let filtered = data;
          if (storeId) filtered = filtered.filter(c => !c.store_id || c.store_id === storeId);
          return filtered;
        }
      }
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      const dbConvs = await SupabaseService.getConversations(storeId);
      if (Array.isArray(dbConvs)) {
        setItem(STORAGE_KEYS.CONVERSATIONS, dbConvs);
        return dbConvs;
      }
    }
    let convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    if (storeId) {
      convs = convs.filter(c => !c.store_id || c.store_id === storeId);
    }
    return convs;
  },

  async getConversation(id: string): Promise<Conversation | null> {
    const convs = await this.getConversations();
    return convs.find(c => c.id === id || c.contact_id === id) || null;
  },

  async updateConversationStatus(
    id: string, 
    status: Conversation['status'], 
    storeId?: string,
    assignedTo?: string | null
  ): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, store_id: storeId, assigned_to: assignedTo }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.updateConversationStatus(id, status, storeId, assignedTo);
    }
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === id);
    if (target) {
      target.status = status;
      if (storeId) target.store_id = storeId;
      if (assignedTo !== undefined) target.assigned_to = assignedTo;
      target.updated_at = new Date().toISOString();
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  },

  async assignAttendant(conversationId: string, attendantName: string, attendantId?: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendant_name: attendantName, attendant_id: attendantId }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.assignConversationAttendant(conversationId, attendantName, attendantId);
    }

    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === conversationId);
    if (target) {
      target.assigned_to = attendantName;
      target.assigned_attendant_name = attendantName;
      if (attendantId) target.assigned_attendant_id = attendantId;
      target.status = 'human';
      target.updated_at = new Date().toISOString();
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  },

  // ==============================================================================
  // 4. MENSAGENS EM TEMPO REAL
  // ==============================================================================
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, data);
          return data;
        }
      }
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      const dbMsgs = await SupabaseService.getChatMessages(conversationId);
      if (Array.isArray(dbMsgs)) {
        setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, dbMsgs);
        return dbMsgs;
      }
    }
    return getItem<Message[]>(`${STORAGE_KEYS.MESSAGES_PREFIX}${conversationId}`, []);
  },

  async addMessage(msg: Partial<Message>): Promise<Message> {
    const convId = msg.conversation_id || 'conv-default';
    const newMsg: Message = {
      id: msg.id || `msg-${Date.now()}`,
      conversation_id: convId,
      store_id: msg.store_id || null,
      direction: msg.direction || 'outbound',
      message_type: msg.message_type || 'text',
      content: msg.content || '',
      media_url: msg.media_url,
      status: msg.status || 'delivered',
      author_name: msg.author_name || 'Pitoco Atendente',
      created_at: new Date().toISOString(),
      ...msg,
    };

    // 1. Salvar no Backend Discloud
    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      }).catch(() => {});
    } catch {}

    // 2. Salvar no Supabase
    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.insertChatMessage(newMsg);
    }

    // 3. Atualizar LocalStorage
    const msgs = getItem<Message[]>(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, []);
    msgs.push(newMsg);
    setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, msgs);
    return newMsg;
  },

  async deleteMessage(convId: string, msgId: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/messages/${msgId}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}

    const msgs = getItem<Message[]>(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, []);
    const filtered = msgs.filter(m => m.id !== msgId);
    setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, filtered);
    return true;
  },

  async clearMessages(convId: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(convId)}/messages`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.clearConversationMessages(convId).catch(() => {});
    }

    setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, []);
    return true;
  },

  // Apagar conversa do Atendimento (Sincronizado com Servidor e Supabase)
  async deleteConversation(convId: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(convId)}`, {
        method: 'DELETE',
      }).catch(() => {});
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(convId)}/delete`, {
        method: 'POST',
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.deleteConversation(convId).catch(() => {});
    }

    setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, []);
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const filtered = convs.filter(c => c.id !== convId && c.phone !== convId && `conv-${c.phone}` !== convId);
    setItem(STORAGE_KEYS.CONVERSATIONS, filtered);
    return true;
  },

  // Restaurar da Lixeira
  async restoreConversation(convId: string): Promise<boolean> {
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === convId);
    if (target) {
      target.is_deleted = false;
      delete target.deleted_at;
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
    return true;
  },

  // Exclusão Permanente Definitiva
  async purgeConversation(convId: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(convId)}`, {
        method: 'DELETE',
      }).catch(() => {});
      await fetch(`${API_BASE}/api/conversations/${encodeURIComponent(convId)}/delete`, {
        method: 'POST',
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.deleteConversation(convId).catch(() => {});
    }

    setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`, []);
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const filtered = convs.filter(c => c.id !== convId && c.phone !== convId && `conv-${c.phone}` !== convId);
    setItem(STORAGE_KEYS.CONVERSATIONS, filtered);
    return true;
  },

  // Esvaziar todas as conversas da lixeira
  async purgeAllTrashConversations(): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations?trash=true`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}

    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const activeOnes = convs.filter(c => !c.is_deleted);
    setItem(STORAGE_KEYS.CONVERSATIONS, activeOnes);
    return true;
  },

  // Atualizar Setor de Atendimento da Conversa
  async updateConversationSector(convId: string, sector: string): Promise<boolean> {
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === convId);
    if (target) {
      target.sector = sector;
      target.updated_at = new Date().toISOString();
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
    return true;
  },

  // Adicionar Nota à Conversa (com visibilidade: 'all' ou 'admin_only')
  async addConversationNote(
    convId: string, 
    text: string, 
    author: string, 
    visibility: 'all' | 'admin_only' = 'all'
  ): Promise<void> {
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === convId);
    if (target) {
      if (!Array.isArray(target.internal_notes)) target.internal_notes = [];
      target.internal_notes.push({
        id: `note-${Date.now()}`,
        text: text.trim(),
        author: author || 'Equipe',
        created_at: new Date().toISOString(),
        visibility,
      });
      target.updated_at = new Date().toISOString();
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  },

  // Remover Nota da Conversa
  async deleteConversationNote(convId: string, noteId: string): Promise<void> {
    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === convId);
    if (target && Array.isArray(target.internal_notes)) {
      target.internal_notes = target.internal_notes.filter(n => n.id !== noteId);
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  },

  // Gerenciamento de Setores da Loja/Atendimento
  getSectors(): string[] {
    const DEFAULT_SECTORS = [
      'Vendas & Enxoval',
      'Suporte & Dúvidas',
      'Financeiro & PIX',
      'Trocas & Devoluções',
      'Expedição & Retirada'
    ];
    return getItem<string[]>('pitoco_chat_sectors', DEFAULT_SECTORS);
  },

  saveSectors(sectors: string[]): void {
    setItem('pitoco_chat_sectors', sectors);
  },

  async transferConversation(
    convId: string, 
    attendantId: string, 
    attendantName: string, 
    storeId?: string, 
    storeName?: string
  ): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendant_id: attendantId,
          attendant_name: attendantName,
          store_id: storeId,
          store_name: storeName,
        }),
      }).catch(() => {});
    } catch {}

    const convs = getItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const target = convs.find(c => c.id === convId);
    if (target) {
      target.assigned_to = attendantName;
      target.assigned_attendant_id = attendantId;
      target.assigned_attendant_name = attendantName;
      if (storeId) target.store_id = storeId;
      if (storeName) target.store_name = storeName;
      target.status = 'waiting_human';
      target.updated_at = new Date().toISOString();
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
    return true;
  },

  // ==============================================================================
  // 5. CRM & CLIENTES
  // ==============================================================================
  async getContacts(storeId?: string): Promise<Contact[]> {
    // 1. Tentar carregar do Backend Oficial (Discloud)
    try {
      const url = storeId ? `${API_BASE}/api/contacts?store_id=${storeId}` : `${API_BASE}/api/contacts`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItem(STORAGE_KEYS.CONTACTS, data);
          return data;
        }
      }
    } catch {}

    // 2. Tentar carregar do Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        const dbClients = await SupabaseService.getClients(storeId);
        if (Array.isArray(dbClients)) {
          const mapped = dbClients.map(c => ({
            ...c,
            status: 'active' as const,
            tags: c.tags || ['Cliente WhatsApp'],
          }));
          setItem(STORAGE_KEYS.CONTACTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Storage] Supabase getClients error:', err);
      }
    }

    // 3. Fallback apenas para o localStorage sem injetar dados fictícios!
    let contacts = getItem<Contact[]>(STORAGE_KEYS.CONTACTS, []);
    if (storeId && Array.isArray(contacts)) {
      contacts = contacts.filter(c => !c.store_id || c.store_id === storeId);
    }
    return contacts || [];
  },

  async saveContact(contact: Partial<Contact>): Promise<Contact> {
    const cleanPhone = String(contact.phone || '').replace(/\D/g, '');
    const newContact: Contact = {
      id: contact.id || `client-${cleanPhone}`,
      phone: cleanPhone,
      name: contact.name || 'Cliente WhatsApp',
      email: contact.email,
      store_id: contact.store_id,
      store_name: contact.store_name,
      status: contact.status || 'active',
      tags: contact.tags || ['Cliente'],
      baby_name: contact.baby_name,
      due_date: contact.due_date,
      total_orders: contact.total_orders || 0,
      total_spent: contact.total_spent || 0,
      created_at: contact.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...contact,
    };

    // 1. Salvar no Backend Discloud
    try {
      await fetch(`${API_BASE}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      }).catch(() => {});
    } catch {}

    // 2. Salvar no Supabase
    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.upsertClient(newContact);
    }

    // 3. Atualizar LocalStorage
    const contacts = getItem<Contact[]>(STORAGE_KEYS.CONTACTS, []);
    const index = contacts.findIndex(c => c.phone.replace(/\D/g, '') === cleanPhone);
    if (index >= 0) contacts[index] = { ...contacts[index], ...newContact };
    else contacts.unshift(newContact);
    setItem(STORAGE_KEYS.CONTACTS, contacts);
    return newContact;
  },

  // ==============================================================================
  // 6. TICKETS DE ATENDIMENTO HUMANO
  // ==============================================================================
  async getSupportTickets(storeId?: string): Promise<SupportTicket[]> {
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItem(STORAGE_KEYS.TICKETS, data);
          let filtered = data;
          if (storeId) filtered = filtered.filter(t => t.store_id === storeId);
          return filtered;
        }
      }
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      const dbTickets = await SupabaseService.getSupportTickets(storeId);
      if (Array.isArray(dbTickets)) {
        setItem(STORAGE_KEYS.TICKETS, dbTickets);
        return dbTickets;
      }
    }
    let tickets = getItem<SupportTicket[]>(STORAGE_KEYS.TICKETS, []);
    if (storeId) {
      tickets = tickets.filter(t => t.store_id === storeId);
    }
    return tickets;
  },

  async createSupportTicket(ticket: Partial<SupportTicket>): Promise<SupportTicket> {
    const newTicket: SupportTicket = {
      id: ticket.id || `ticket-${Date.now()}`,
      store_id: ticket.store_id || 'store-001',
      client_id: ticket.client_id || `client-${Date.now()}`,
      client_name: ticket.client_name || 'Cliente',
      client_phone: ticket.client_phone || '',
      protocol: ticket.protocol || `PTC-${Date.now().toString().slice(-6)}`,
      subject: ticket.subject || 'Atendimento Solicitado',
      status: ticket.status || 'open',
      priority: ticket.priority || 'normal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...ticket,
    };

    try {
      await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      }).catch(() => {});
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      await SupabaseService.createSupportTicket(newTicket);
    }
    const tickets = getItem<SupportTicket[]>(STORAGE_KEYS.TICKETS, []);
    tickets.unshift(newTicket);
    setItem(STORAGE_KEYS.TICKETS, tickets);
    return newTicket;
  },

  async deleteSupportTicket(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/tickets/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
    const tickets = getItem<SupportTicket[]>(STORAGE_KEYS.TICKETS, []);
    const filtered = tickets.filter(t => t.id !== id);
    setItem(STORAGE_KEYS.TICKETS, filtered);
    return true;
  },

  // ==============================================================================
  // 7. CONSULTORIAS VIP DE ENXOVAL
  // ==============================================================================
  async getVIPConsultations(storeId?: string): Promise<VIPConsultation[]> {
    try {
      const url = storeId ? `${API_BASE}/api/consultations?store_id=${storeId}` : `${API_BASE}/api/consultations`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItem(STORAGE_KEYS.VIP_CONSULTATIONS, data);
          return data;
        }
      }
    } catch {}

    let list = getItem<VIPConsultation[]>(STORAGE_KEYS.VIP_CONSULTATIONS, [
      {
        id: 'cons-1',
        store_id: 'store-001',
        store_name: 'Loja Matriz — Centro',
        client_name: 'Juliana Paes (Mamãe do Bento)',
        client_phone: '81992223344',
        consultation_type: 'presencial_loja',
        consultation_date: '2026-09-12',
        consultation_time: '15:00',
        due_date: '2026-11-20',
        baby_gender: 'menino',
        status: 'confirmed',
        consultant_name: 'Sofia Consultora VIP',
        notes: 'Interesse em Saída de Maternidade Verde Menta e Kit Berço 400 fios',
        created_at: new Date().toISOString(),
      }
    ]);
    if (storeId) {
      list = list.filter(c => c.store_id === storeId);
    }
    return list;
  },

  async saveVIPConsultation(cons: Partial<VIPConsultation>): Promise<VIPConsultation> {
    const newCons: VIPConsultation = {
      id: cons.id || `cons-${Date.now()}`,
      store_id: cons.store_id || 'store-001',
      store_name: cons.store_name || 'Loja Matriz — Centro',
      client_name: cons.client_name || 'Cliente',
      client_phone: cons.client_phone || '',
      consultation_type: cons.consultation_type || 'online_whatsapp',
      consultation_date: cons.consultation_date || new Date().toISOString().split('T')[0],
      consultation_time: cons.consultation_time || '14:00',
      status: cons.status || 'confirmed',
      created_at: new Date().toISOString(),
      ...cons,
    };

    try {
      await fetch(`${API_BASE}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCons),
      }).catch(() => {});
    } catch {}

    const list = getItem<VIPConsultation[]>(STORAGE_KEYS.VIP_CONSULTATIONS, []);
    const idx = list.findIndex(c => c.id === newCons.id);
    if (idx >= 0) list[idx] = newCons;
    else list.unshift(newCons);
    setItem(STORAGE_KEYS.VIP_CONSULTATIONS, list);
    return newCons;
  },

  // Backward compatibility alias for appointments
  async getAppointments(storeId?: string): Promise<Appointment[]> {
    return this.getVIPConsultations(storeId);
  },

  async saveAppointment(apt: Partial<Appointment>): Promise<Appointment> {
    return this.saveVIPConsultation(apt);
  },

  async updateAppointmentStatus(aptId: string, newStatus: string): Promise<Appointment | null> {
    const list = await this.getVIPConsultations();
    const idx = list.findIndex(a => a.id === aptId);
    if (idx >= 0) {
      list[idx].status = newStatus as any;
      list[idx].updated_at = new Date().toISOString();
      await this.saveVIPConsultation(list[idx]);
      return list[idx];
    }
    return null;
  },

  async deleteAppointment(aptId: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/consultations/${aptId}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
    const list = await this.getVIPConsultations();
    const filtered = list.filter(a => a.id !== aptId);
    setItem(STORAGE_KEYS.VIP_CONSULTATIONS, filtered);
    return true;
  },

  // ==============================================================================
  // AGENDA SETTINGS & SERVIÇOS DE CONSULTORIA
  // ==============================================================================
  async getAgendaSettings(): Promise<AgendaSettings> {
    const defaultSettings: AgendaSettings = {
      business_days: ['1', '2', '3', '4', '5', '6'],
      start_time: '08:00',
      end_time: '19:00',
      slot_duration_minutes: 30,
      break_start_time: '12:00',
      break_end_time: '13:00',
      buffer_minutes: 5,
      out_of_hours_message: 'Olá! Nosso horário de expediente é de Segunda a Sábado das 08:00 às 19:00. Deixe sua mensagem ou escolha um horário que responderemos com prioridade!',
      services: [
        {
          id: 'srv-1',
          name: 'Consultoria VIP de Enxoval',
          duration_minutes: 45,
          price: 0,
          category: 'Consultoria',
          description: 'Atendimento personalizado com especialista em montagem de enxoval de bebê completo.',
          is_active: true,
          active: true,
        },
        {
          id: 'srv-2',
          name: 'Guia de Medidas & Escolha de Tamanho',
          duration_minutes: 20,
          price: 0,
          category: 'Atendimento',
          description: 'Ajuda para acertar o tamanho ideal RN a 3 anos (tabela de peso e altura).',
          is_active: true,
          active: true,
        },
        {
          id: 'srv-3',
          name: 'Separação de Pedido para Retirada na Loja',
          duration_minutes: 15,
          price: 0,
          category: 'Retirada',
          description: 'Agendamento de retirada expressa no balcão da filial selecionada.',
          is_active: true,
          active: true,
        }
      ],
      day_schedules: {
        '1': { enabled: true, start_time: '08:00', end_time: '19:00', break_start_time: '12:00', break_end_time: '13:00' },
        '2': { enabled: true, start_time: '08:00', end_time: '19:00', break_start_time: '12:00', break_end_time: '13:00' },
        '3': { enabled: true, start_time: '08:00', end_time: '19:00', break_start_time: '12:00', break_end_time: '13:00' },
        '4': { enabled: true, start_time: '08:00', end_time: '19:00', break_start_time: '12:00', break_end_time: '13:00' },
        '5': { enabled: true, start_time: '08:00', end_time: '19:00', break_start_time: '12:00', break_end_time: '13:00' },
        '6': { enabled: true, start_time: '08:00', end_time: '18:00', break_start_time: '12:00', break_end_time: '13:00' },
        '0': { enabled: false, start_time: '09:00', end_time: '14:00' },
      }
    };

    let settings = getItem<AgendaSettings>('pitoco_agenda_settings', defaultSettings);
    if (!settings || !Array.isArray(settings.business_days)) {
      settings = defaultSettings;
      setItem('pitoco_agenda_settings', settings);
    }
    return settings;
  },

  async updateAgendaSettings(newSettings: Partial<AgendaSettings>): Promise<AgendaSettings> {
    const current = await this.getAgendaSettings();
    const merged: AgendaSettings = {
      ...current,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };
    setItem('pitoco_agenda_settings', merged);
    try {
      await fetch(`${API_BASE}/api/agenda-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
        signal: AbortSignal.timeout(3000),
      });
    } catch {}
    return merged;
  },

  async saveAgendaSettings(newSettings: Partial<AgendaSettings>): Promise<AgendaSettings> {
    return this.updateAgendaSettings(newSettings);
  },

  async saveAgendaServiceItem(item: AgendaServiceItem): Promise<AgendaSettings> {
    const current = await this.getAgendaSettings();
    const services = Array.isArray(current.services) ? [...current.services] : [];
    const idx = services.findIndex(s => s.id === item.id);
    if (idx >= 0) {
      services[idx] = { ...services[idx], ...item };
    } else {
      services.push({
        ...item,
        id: item.id || `srv-${Date.now()}`,
        is_active: item.is_active !== undefined ? item.is_active : (item.active !== undefined ? item.active : true),
      });
    }
    return this.updateAgendaSettings({ ...current, services });
  },

  async deleteAgendaServiceItem(itemId: string): Promise<AgendaSettings> {
    const current = await this.getAgendaSettings();
    const services = (current.services || []).filter(s => s.id !== itemId);
    return this.updateAgendaSettings({ ...current, services });
  },

  // ==============================================================================
  // 8. DASHBOARD KPIS CONSOLIDADOS
  // ==============================================================================
  async getKPIs(storeId?: string): Promise<DashboardKPIs> {
    const [convs, contacts, prods, stores] = await Promise.all([
      this.getConversations(storeId),
      this.getContacts(storeId),
      this.getProducts(storeId),
      this.getStores(),
    ]);

    const waiting = convs.filter(c => c.status === 'waiting_human').length;
    const active = convs.filter(c => c.status === 'bot' || c.status === 'human').length;
    const monthRev = stores.reduce((acc, s) => acc + (s.monthly_revenue || 0), 0);

    return {
      totalContacts: contacts.length > 0 ? contacts.length : initialKPIs.totalContacts,
      totalConversations: convs.length > 0 ? convs.length : initialKPIs.totalConversations,
      activeConversations: active > 0 ? active : initialKPIs.activeConversations,
      activeFlows: 3,
      waitingHuman: waiting > 0 ? waiting : initialKPIs.waitingHuman,
      messagesSentToday: 2490,
      totalProducts: prods.length,
      totalStores: stores.length,
      monthRevenue: monthRev > 0 ? monthRev : 206600,
      totalOrders: 680,
    };
  },

  // ==============================================================================
  // 9. FLOWS & GESTÃO COMPLETA DE FLUXOS
  // ==============================================================================
  async getFlows(): Promise<Flow[]> {
    // 1. Tentar carregar diretamente do Supabase (prioridade máxima)
    if (SupabaseService.isSupabaseReady) {
      try {
        const cloudFlows = await SupabaseService.getFlows();
        if (Array.isArray(cloudFlows) && cloudFlows.length > 0) {
          setItem(STORAGE_KEYS.FLOWS, cloudFlows);
          return cloudFlows;
        }
      } catch (e) {
        console.warn('[StorageService] Falha ao consultar fluxos no Supabase:', e);
      }
    }

    // 2. Tentar carregar do Backend Discloud
    try {
      const res = await fetch(`${API_BASE}/api/flows`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItem(STORAGE_KEYS.FLOWS, data);
          return data;
        }
      }
    } catch {
      // Usar cache local em caso de offline
    }

    return getItem<Flow[]>(STORAGE_KEYS.FLOWS, sampleFlows);
  },

  async getFlow(id: string): Promise<Flow | null> {
    const flows = await this.getFlows();
    return flows.find(f => f.id === id) || null;
  },

  async getFlowById(id: string): Promise<Flow | null> {
    return this.getFlow(id);
  },

  async saveFlow(flow: Partial<Flow>): Promise<Flow> {
    const flows = await this.getFlows();
    const targetId = (flow.id && String(flow.id).trim()) || `flow-${Date.now()}`;
    const existingIndex = flows.findIndex(f => f.id === targetId || f.id === flow.id);
    const existing = existingIndex >= 0 ? flows[existingIndex] : null;
    const updatedFlow: Flow = {
      ...(existing || {}),
      ...flow,
      id: targetId,
      name: flow.name ?? existing?.name ?? 'Novo Fluxo de Atendimento',
      description: flow.description ?? existing?.description ?? '',
      status: flow.status ?? existing?.status ?? (flow.is_active ? 'published' : 'draft'),
      is_active: flow.is_active !== undefined ? flow.is_active : (existing?.is_active ?? (flow.status === 'published')),
      version: flow.version ?? existing?.version ?? 1,
      node_count: typeof flow.node_count === 'number' && flow.node_count > 0 ? flow.node_count : (existing?.node_count ?? (flow.steps && flow.steps.length > 0 ? flow.steps.length : 2)),
      trigger_type: flow.trigger_type ?? existing?.trigger_type ?? 'Qualquer Mensagem Recebida',
      store_id: flow.store_id !== undefined ? flow.store_id : (existing?.store_id ?? null),
      store_name: flow.store_name ?? existing?.store_name ?? (flow.store_id ? 'Filial Específica' : 'Toda a Rede'),
      steps: flow.steps ?? existing?.steps ?? [],
      color: flow.color ?? existing?.color ?? '#10b981',
      order_index: flow.order_index ?? existing?.order_index ?? (existingIndex >= 0 ? existingIndex : flows.length),
      created_at: flow.created_at || existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      flows[existingIndex] = updatedFlow;
    } else {
      flows.push(updatedFlow);
    }
    setItem(STORAGE_KEYS.FLOWS, flows);

    // 1. Sincronizar com o backend Discloud
    try {
      await fetch(`${API_BASE}/api/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFlow),
      });
    } catch {}

    // 2. Sincronizar em tempo real com o banco de dados Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.saveFlow(updatedFlow);
      } catch (e) {
        console.warn('[StorageService] Falha ao sincronizar fluxo no Supabase:', e);
      }
    }

    return updatedFlow;
  },

  async deleteFlow(id: string): Promise<boolean> {
    let flows = getItem<Flow[]>(STORAGE_KEYS.FLOWS, sampleFlows);
    flows = flows.filter(f => f.id !== id);
    setItem(STORAGE_KEYS.FLOWS, flows);

    // 1. Deletar no backend
    try {
      await fetch(`${API_BASE}/api/flows/${id}`, {
        method: 'DELETE',
      });
    } catch {}

    // 2. Deletar no Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.deleteFlow(id);
      } catch (e) {
        console.warn('[StorageService] Falha ao excluir fluxo no Supabase:', e);
      }
    }

    return true;
  },

  async toggleFlowStatus(id: string): Promise<Flow | null> {
    const flows = await this.getFlows();
    const target = flows.find(f => f.id === id);
    if (!target) return null;

    const newActive = !target.is_active || target.status !== 'published';
    target.is_active = newActive;
    target.status = newActive ? 'published' : 'draft';
    target.updated_at = new Date().toISOString();
    setItem(STORAGE_KEYS.FLOWS, flows);

    // 1. Atualizar backend
    try {
      await fetch(`${API_BASE}/api/flows/${id}/toggle`, {
        method: 'PATCH',
      });
    } catch {}

    // 2. Atualizar Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.toggleFlowStatus(id, target.is_active);
      } catch (e) {
        console.warn('[StorageService] Falha ao alternar status do fluxo no Supabase:', e);
      }
    }

    return target;
  },

  async saveFlowsOrder(orderedFlows: Flow[]): Promise<void> {
    const updated = orderedFlows.map((f, idx) => ({ ...f, order_index: idx }));
    setItem(STORAGE_KEYS.FLOWS, updated);
    try {
      localStorage.setItem('pitoco_flows_order', JSON.stringify(updated.map(f => f.id)));
    } catch {}

    // 1. Sincronizar com o backend
    try {
      await fetch(`${API_BASE}/api/whatsapp/sync-flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flows: updated }),
      });
    } catch {}

    // 2. Sincronizar com Supabase se pronto
    if (SupabaseService.isSupabaseReady) {
      for (const flow of updated) {
        SupabaseService.saveFlow(flow).catch(() => {});
      }
    }
  },

  async getFlowNodes(flowId: string): Promise<FlowNode[]> {
    try {
      const res = await fetch(`${API_BASE}/api/flows/${flowId}/graph`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          setItem(`${STORAGE_KEYS.FLOW_NODES_PREFIX}${flowId}`, data.nodes);
          return data.nodes;
        }
      }
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      try {
        const cloudGraph = await SupabaseService.getFlowGraph(flowId);
        if (cloudGraph?.nodes && cloudGraph.nodes.length > 0) {
          setItem(`${STORAGE_KEYS.FLOW_NODES_PREFIX}${flowId}`, cloudGraph.nodes);
          return cloudGraph.nodes;
        }
      } catch {}
    }

    return getItem<FlowNode[]>(`${STORAGE_KEYS.FLOW_NODES_PREFIX}${flowId}`, initialFlowNodes);
  },

  async saveFlowNodes(flowId: string, nodes: FlowNode[]): Promise<void> {
    setItem(`${STORAGE_KEYS.FLOW_NODES_PREFIX}${flowId}`, nodes);
  },

  async getFlowEdges(flowId: string): Promise<FlowEdge[]> {
    try {
      const res = await fetch(`${API_BASE}/api/flows/${flowId}/graph`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.edges) && data.edges.length > 0) {
          setItem(`${STORAGE_KEYS.FLOW_EDGES_PREFIX}${flowId}`, data.edges);
          return data.edges;
        }
      }
    } catch {}

    if (SupabaseService.isSupabaseReady) {
      try {
        const cloudGraph = await SupabaseService.getFlowGraph(flowId);
        if (cloudGraph?.edges && cloudGraph.edges.length > 0) {
          setItem(`${STORAGE_KEYS.FLOW_EDGES_PREFIX}${flowId}`, cloudGraph.edges);
          return cloudGraph.edges;
        }
      } catch {}
    }

    return getItem<FlowEdge[]>(`${STORAGE_KEYS.FLOW_EDGES_PREFIX}${flowId}`, initialFlowEdges);
  },

  async saveFlowEdges(flowId: string, edges: FlowEdge[]): Promise<void> {
    setItem(`${STORAGE_KEYS.FLOW_EDGES_PREFIX}${flowId}`, edges);
  },

  async saveFlowGraph(flowId: string, nodes: FlowNode[], edges: FlowEdge[]): Promise<void> {
    // 1. Salvar no cache local do navegador
    await Promise.all([
      this.saveFlowNodes(flowId, nodes),
      this.saveFlowEdges(flowId, edges),
    ]);

    // Atualizar node_count no cache local de fluxos
    try {
      let flows = getItem<Flow[]>(STORAGE_KEYS.FLOWS, sampleFlows);
      const flowIdx = flows.findIndex(f => f.id === flowId);
      if (flowIdx >= 0) {
        flows[flowIdx].node_count = Array.isArray(nodes) ? nodes.length : 0;
        flows[flowIdx].updated_at = new Date().toISOString();
        setItem(STORAGE_KEYS.FLOWS, flows);
      }
    } catch {}

    // 2. Sincronizar em tempo real com o backend do bot WhatsApp (persistente no servidor)
    try {
      await fetch(`${API_BASE}/api/flows/${flowId}/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
    } catch (e) {
      console.warn('[StorageService] Falha ao sincronizar grafo com backend:', e);
    }

    // 3. Sincronizar com Supabase em nuvem
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.saveFlowGraph(flowId, nodes, edges);
      } catch (e) {
        console.warn('[StorageService] Falha ao sincronizar grafo com Supabase:', e);
      }
    }
  },

  async syncWithDatabase(): Promise<Flow[]> {
    // 1. Sincronizar backend com Supabase
    try {
      await fetch(`${API_BASE}/api/flows/sync-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}

    // 2. Buscar fluxos atualizados diretamente do Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        const cloudFlows = await SupabaseService.getFlows();
        if (Array.isArray(cloudFlows) && cloudFlows.length > 0) {
          setItem(STORAGE_KEYS.FLOWS, cloudFlows);
          return cloudFlows;
        }
      } catch (e) {
        console.warn('[StorageService] Falha ao consultar fluxos no Supabase durante sync:', e);
      }
    }

    return this.getFlows();
  },

  subscribeToFlows(callback: () => void) {
    if (SupabaseService.isSupabaseReady && typeof (SupabaseService as any).subscribeToFlows === 'function') {
      return (SupabaseService as any).subscribeToFlows(callback);
    }
    return () => {};
  },

  // ==============================================================================
  // 10. GESTÃO DE ACESSOS (USUÁRIO APENAS LETRAS / SENHA APENAS NÚMEROS)
  // ==============================================================================
  async getAccessUsers(): Promise<SystemAccessUser[]> {
    let users = getItem<SystemAccessUser[]>(STORAGE_KEYS.SYSTEM_USERS, initialAccessUsers);
    try {
      const res = await fetch(`${API_BASE}/api/users`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          users = data;
          setItem(STORAGE_KEYS.SYSTEM_USERS, users);
        }
      }
    } catch {}
    return users;
  },

  // Alias para retrocompatibilidade
  async getSystemUsers(): Promise<SystemAccessUser[]> {
    return this.getAccessUsers();
  },

  async saveAccessUser(user: Partial<SystemAccessUser>): Promise<SystemAccessUser> {
    const rawUsername = (user.username || '').trim().toLowerCase();
    
    // Regra Obrigatória: Usuário APENAS LETRAS
    if (!rawUsername || !/^[a-zA-Z]+$/.test(rawUsername)) {
      throw new Error('O nome de usuário deve conter exclusivamente letras (sem números, espaços ou símbolos).');
    }

    // Regra Obrigatória: Senha APENAS NÚMEROS (se fornecida)
    let rawPassword = user.password;
    if (rawPassword !== undefined && rawPassword !== '') {
      const cleanPass = String(rawPassword).trim();
      if (!/^[0-9]+$/.test(cleanPass)) {
        throw new Error('A senha de acesso deve conter exclusivamente dígitos numéricos (sem letras ou símbolos).');
      }
      rawPassword = cleanPass;
    }

    const users = getItem<SystemAccessUser[]>(STORAGE_KEYS.SYSTEM_USERS, initialAccessUsers);
    const existingIndex = users.findIndex(u => u.id === user.id || u.username.toLowerCase() === rawUsername);

    const updatedUser: SystemAccessUser = {
      id: user.id || `user-${Date.now()}`,
      name: user.name || rawUsername,
      username: rawUsername,
      password: rawPassword || (existingIndex >= 0 ? users[existingIndex].password : '123456'),
      role: user.role || (user.panels?.includes('admin') ? 'admin' : user.panels?.includes('gerente') ? 'manager' : 'attendant'),
      panels: user.panels || (existingIndex >= 0 && users[existingIndex].panels ? users[existingIndex].panels : ['atendimento']),
      allowed_panels: user.allowed_panels || (user.panels as any) || ['atendimento'],
      store_id: user.store_id || null,
      store_name: user.store_name || (user.store_id ? 'Filial Vinculada' : 'Toda a Rede (Global)'),
      status: user.status || 'active',
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      users[existingIndex] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    setItem(STORAGE_KEYS.SYSTEM_USERS, users);

    try {
      await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
    } catch {}

    return updatedUser;
  },

  async deleteAccessUser(id: string): Promise<boolean> {
    let users = getItem<SystemAccessUser[]>(STORAGE_KEYS.SYSTEM_USERS, initialAccessUsers);
    users = users.filter(u => u.id !== id && u.username !== id);
    setItem(STORAGE_KEYS.SYSTEM_USERS, users);

    try {
      await fetch(`${API_BASE}/api/users/${id}`, {
        method: 'DELETE',
      });
    } catch {}

    return true;
  },

  async toggleAccessUserStatus(id: string): Promise<SystemAccessUser | null> {
    const users = getItem<SystemAccessUser[]>(STORAGE_KEYS.SYSTEM_USERS, initialAccessUsers);
    const target = users.find(u => u.id === id || u.username === id);
    if (!target) return null;

    target.status = target.status === 'active' ? 'inactive' : 'active';
    target.updated_at = new Date().toISOString();
    setItem(STORAGE_KEYS.SYSTEM_USERS, users);

    try {
      await fetch(`${API_BASE}/api/users/${id}/toggle`, {
        method: 'PATCH',
      });
    } catch {}

    return target;
  },

  getRolePermissions() {
    return DEFAULT_ROLE_CONFIGS;
  },

  // ==============================================================================
  // 11. AUTH & SESSÃO (USUÁRIO APENAS LETRAS / SENHA APENAS NÚMEROS)
  // ==============================================================================
  getSession(): { authenticated: boolean; username: string; phone?: string; role?: string; panels?: PanelId[]; allowed_panels?: string[]; name?: string; store_id?: string | null; store_name?: string } | null {
    return getItem(STORAGE_KEYS.AUTH_TOKEN, null);
  },

  setSession(session: { authenticated: boolean; username: string; phone?: string; role?: string; panels?: PanelId[]; allowed_panels?: string[]; name?: string; store_id?: string | null; store_name?: string } | null): void {
    if (session) setItem(STORAGE_KEYS.AUTH_TOKEN, session);
    else if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async getAdminProfile(): Promise<AdminProfile> {
    return getItem<AdminProfile>(STORAGE_KEYS.ADMIN, initialAdminProfile);
  },

  async saveAdminProfile(profile: Partial<AdminProfile>): Promise<AdminProfile> {
    const current = await this.getAdminProfile();
    const updated = { ...current, ...profile, updated_at: new Date().toISOString() };
    setItem(STORAGE_KEYS.ADMIN, updated);
    return updated;
  },

  async verifyUserAccess(
    usernameInput: string, 
    passwordInput: string, 
    _requiredPermission?: keyof UserPermissions
  ): Promise<{ success: boolean; user?: AdminProfile; error?: string }> {
    const cleanUser = String(usernameInput || '').trim().toLowerCase();
    const cleanPass = String(passwordInput || '').trim();

    // 1. Validação estrita: Usuário APENAS LETRAS
    if (!cleanUser || !/^[a-zA-Z]+$/.test(cleanUser)) {
      return {
        success: false,
        error: 'O usuário deve conter apenas letras (sem números, espaços ou caracteres especiais).',
      };
    }

    // 2. Validação estrita: Senha APENAS NÚMEROS
    if (!cleanPass || !/^[0-9]+$/.test(cleanPass)) {
      return {
        success: false,
        error: 'A senha de acesso deve conter apenas números (sem letras ou caracteres especiais).',
      };
    }

    // 3. Verificar na lista de usuários cadastrados
    const users = await this.getAccessUsers();
    const matched = users.find(u => u.username.toLowerCase() === cleanUser);

    if (matched) {
      if (matched.status === 'inactive') {
        return {
          success: false,
          error: 'Acesso bloqueado: Este usuário está inativo no momento. Fale com a administração.',
        };
      }

      if (matched.password === cleanPass) {
        const userPanels: PanelId[] = matched.panels || (
          matched.role === 'ceo' || matched.role === 'admin' 
            ? ['admin', 'gerente', 'atendimento'] 
            : matched.role === 'manager' 
            ? ['gerente'] 
            : ['atendimento']
        );

        const profile: AdminProfile = {
          id: matched.id,
          username: matched.username,
          name: matched.name,
          role: matched.role || (userPanels.includes('admin') ? 'admin' : userPanels.includes('gerente') ? 'manager' : 'attendant'),
          panels: userPanels,
          allowed_panels: matched.allowed_panels || userPanels,
          store_id: matched.store_id || null,
          store_name: matched.store_name,
          created_at: matched.created_at,
          updated_at: new Date().toISOString(),
        };
        await this.saveAdminProfile(profile);
        return { success: true, user: profile };
      } else {
        return {
          success: false,
          error: 'Senha numérica incorreta. Verifique os dígitos digitados.',
        };
      }
    }

    // 4. Credenciais padrão de emergência / Demonstração
    const ALL_PANELS = ['dashboard', 'atendimento', 'produtos', 'lojas', 'clientes', 'fluxos', 'whatsapp', 'bot_config', 'acessos', 'configuracoes', 'logs'];

    // CEO: ceo / 123456
    if ((cleanUser === 'ceo' || cleanUser === 'malaca') && (cleanPass === '123456' || cleanPass === '199425')) {
      const profile: AdminProfile = {
        id: 'admin-ceo',
        username: cleanUser,
        name: 'Malaca CEO',
        role: 'ceo',
        panels: ['admin', 'gerente', 'atendimento'],
        allowed_panels: ALL_PANELS,
        store_id: null,
        store_name: 'Toda a Rede (Global)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.saveAdminProfile(profile);
      return { success: true, user: profile };
    }

    // Administrador: admin / 123456
    if (cleanUser === 'admin' && (cleanPass === '123456' || cleanPass === '1234')) {
      const profile: AdminProfile = {
        id: 'admin-master',
        username: 'admin',
        name: 'Administrador Geral',
        role: 'admin',
        panels: ['admin', 'gerente', 'atendimento'],
        allowed_panels: ALL_PANELS,
        store_id: null,
        store_name: 'Toda a Rede (Global)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.saveAdminProfile(profile);
      return { success: true, user: profile };
    }

    // Gerente: gerente / 123456
    if (cleanUser === 'gerente' && (cleanPass === '123456' || cleanPass === '1234')) {
      const profile: AdminProfile = {
        id: 'user-mgr-1',
        username: 'gerente',
        name: 'Juliana Paes (Gerente Matriz)',
        role: 'manager',
        panels: ['gerente'],
        allowed_panels: ['dashboard', 'atendimento', 'produtos', 'lojas', 'clientes'],
        store_id: 'store-001',
        store_name: 'Loja Matriz — Centro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.saveAdminProfile(profile);
      return { success: true, user: profile };
    }

    // Atendente / Consultora: atendente ou consultora / 123456
    if ((cleanUser === 'atendente' || cleanUser === 'consultora' || cleanUser === 'sofia') && (cleanPass === '123456' || cleanPass === '1234')) {
      const profile: AdminProfile = {
        id: 'user-att-1',
        username: cleanUser,
        name: 'Sofia Alencar (Consultora VIP)',
        role: 'attendant',
        panels: ['atendimento'],
        allowed_panels: ['atendimento', 'produtos', 'clientes'],
        store_id: 'store-001',
        store_name: 'Loja Matriz — Centro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.saveAdminProfile(profile);
      return { success: true, user: profile };
    }

    return {
      success: false,
      error: 'Usuário ou senha inválidos. Certifique-se de que o usuário tem apenas letras e a senha apenas números.',
    };
  },

  // ==============================================================================
  // 11. SETTINGS & BOT PROFILE
  // ==============================================================================
  async getSettings(): Promise<Settings> {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setItem(STORAGE_KEYS.SETTINGS, data);
          return data;
        }
      }
    } catch {}
    return getItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
  },

  async saveSettings(settings: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };
    setItem(STORAGE_KEYS.SETTINGS, updated);

    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    } catch {}

    return updated;
  },

  async getBotProfile(): Promise<BotProfile> {
    try {
      const res = await fetch(`${API_BASE}/api/bot-config`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          const settings = getItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
          settings.bot_profile = { ...(settings.bot_profile || {}), ...data };
          setItem(STORAGE_KEYS.SETTINGS, settings);
          return data;
        }
      }
    } catch {}
    const settings = await this.getSettings();
    return settings.bot_profile || defaultBotProfile;
  },

  async saveBotProfile(profile: Partial<BotProfile>): Promise<BotProfile> {
    const current = await this.getBotProfile();
    const updated = { ...current, ...profile };
    await this.saveSettings({ bot_profile: updated });

    try {
      await fetch(`${API_BASE}/api/bot-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    } catch {}

    return updated;
  },

  // ==============================================================================
  // 12. WHATSAPP SESSION LOCAL CACHE
  // ==============================================================================
  getWhatsAppSession(): WhatsAppSession {
    const settings = getItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
    return settings.whatsapp_session || { status: 'disconnected', phone: '' };
  },

  setWhatsAppSession(session: WhatsAppSession): void {
    const settings = getItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
    settings.whatsapp_session = session;
    setItem(STORAGE_KEYS.SETTINGS, settings);
  },

  // Backward compatibility methods & aliases
  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return this.saveSettings(settings);
  },

  async updateBotProfile(profile: Partial<BotProfile>): Promise<BotProfile> {
    return this.saveBotProfile(profile);
  },

  async updateAdminProfile(profile: Partial<AdminProfile>): Promise<AdminProfile> {
    return this.saveAdminProfile(profile);
  },

  async saveSystemUser(user: any): Promise<any> {
    return this.saveAccessUser(user);
  },

  async getCustomVariables(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/api/custom-variables`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItem('pitoco_custom_variables', data);
          return data;
        }
      }
    } catch {}
    return getItem<any[]>('pitoco_custom_variables', [
      { id: 'var-1', name: 'nome_loja', key: 'nome_loja', value: 'Pitoco de Gente', description: 'Nome fantasia da marca' },
      { id: 'var-2', name: 'cidade_matriz', key: 'cidade_matriz', value: 'Recife/PE', description: 'Sede da matriz' },
      { id: 'var-3', name: 'chave_pix', key: 'chave_pix', value: 'financeiro@pitocodegente.com.br', description: 'Chave PIX oficial' },
      { id: 'var-4', name: 'frete_gratis_valor', key: 'frete_gratis_valor', value: '250.00', description: 'Valor mínimo frete grátis' },
    ]);
  },

  async saveCustomVariable(v: any): Promise<any> {
    const itemToSave = { ...v, id: v.id || `var-${Date.now()}` };
    try {
      await fetch(`${API_BASE}/api/custom-variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemToSave),
      }).catch(() => {});
    } catch {}

    const list = await this.getCustomVariables();
    const idx = list.findIndex(item => item.id === itemToSave.id || item.key === itemToSave.key);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...itemToSave };
    } else {
      list.push(itemToSave);
    }
    setItem('pitoco_custom_variables', list);
    return itemToSave;
  },

  async deleteCustomVariable(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/custom-variables/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
    const list = await this.getCustomVariables();
    const filtered = list.filter(item => item.id !== id);
    setItem('pitoco_custom_variables', filtered);
    return true;
  },

  async getBotVariables(): Promise<Record<string, any>> {
    const custom = await this.getCustomVariables();
    const map: Record<string, any> = {
      empresa: 'Pitoco de Gente',
      marca: 'Pitoco de Gente',
      site: 'https://pitoco.malaca.com.br',
      whatsapp: '(81) 98765-4321',
      chave_pix: 'financeiro@pitocodegente.com.br',
    };
    for (const c of custom) {
      if (c.key) map[c.key] = c.value;
    }
    return map;
  },

  getAttendants(): Attendant[] {
    return getItem<Attendant[]>(STORAGE_KEYS.ATTENDANTS, initialAttendants);
  },

  async fetchAttendants(): Promise<Attendant[]> {
    try {
      const res = await fetch(`${API_BASE}/api/attendants`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItem(STORAGE_KEYS.ATTENDANTS, data);
          return data;
        }
      }
    } catch {}
    return this.getAttendants();
  },

  async saveAttendant(att: any): Promise<any> {
    const newAtt = { ...att, id: att.id || `att-${Date.now()}` };
    try {
      await fetch(`${API_BASE}/api/attendants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAtt),
      }).catch(() => {});
    } catch {}

    const list = getItem<any[]>(STORAGE_KEYS.ATTENDANTS, initialAttendants);
    const idx = list.findIndex(a => a.id === newAtt.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newAtt };
    } else {
      list.push(newAtt);
    }
    setItem(STORAGE_KEYS.ATTENDANTS, list);
    return newAtt;
  },

  async deleteAttendant(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/attendants/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
    const list = getItem<any[]>(STORAGE_KEYS.ATTENDANTS, initialAttendants);
    const filtered = list.filter(a => a.id !== id);
    setItem(STORAGE_KEYS.ATTENDANTS, filtered);
    return true;
  },

  getCannedReplies(): CannedReply[] {
    return getItem<CannedReply[]>(STORAGE_KEYS.CANNED_REPLIES, defaultCannedReplies);
  },

  async fetchCannedReplies(): Promise<CannedReply[]> {
    try {
      const res = await fetch(`${API_BASE}/api/canned-replies`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItem(STORAGE_KEYS.CANNED_REPLIES, data);
          return data;
        }
      }
    } catch {}
    return this.getCannedReplies();
  },

  async saveCannedReply(reply: Partial<CannedReply>): Promise<CannedReply> {
    const newReply = {
      id: reply.id || `canned-${Date.now()}`,
      label: reply.label || 'Nova Resposta',
      cmd: reply.cmd || '/resposta',
      text: reply.text || '',
      category: reply.category || 'Atendimento',
      ...reply,
    };
    try {
      await fetch(`${API_BASE}/api/canned-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReply),
      }).catch(() => {});
    } catch {}

    const list = getItem<CannedReply[]>(STORAGE_KEYS.CANNED_REPLIES, defaultCannedReplies);
    const idx = list.findIndex(r => r.id === newReply.id);
    if (idx >= 0) list[idx] = newReply as CannedReply;
    else list.push(newReply as CannedReply);
    setItem(STORAGE_KEYS.CANNED_REPLIES, list);
    return newReply as CannedReply;
  },

  async deleteCannedReply(id: string): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/api/canned-replies/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
    const list = getItem<CannedReply[]>(STORAGE_KEYS.CANNED_REPLIES, defaultCannedReplies);
    const filtered = list.filter(r => r.id !== id);
    setItem(STORAGE_KEYS.CANNED_REPLIES, filtered);
    return true;
  },

  getAuditLogs(): AuditLog[] {
    return getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },

  async getLogs(): Promise<AuditLog[]> {
    return getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },

  async clearLogs(): Promise<boolean> {
    setItem(STORAGE_KEYS.AUDIT_LOGS, []);
    return true;
  },

  async deleteContact(id: string, phone?: string): Promise<boolean> {
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const cleanId = String(id).replace(/\D/g, '');

    // 1. Excluir do Backend Discloud
    try {
      await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      if (cleanPhone) {
        await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(cleanPhone)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch {}

    // 2. Excluir do Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.deleteClient(id, phone);
      } catch (e) {
        console.warn('[Storage] Supabase deleteClient error:', e);
      }
    }

    // 3. Excluir do LocalStorage imediatamente
    const list = getItem<Contact[]>(STORAGE_KEYS.CONTACTS, []);
    const filtered = list.filter(c => {
      const cPhone = String(c.phone || '').replace(/\D/g, '');
      const isMatch = c.id === id || 
                      (cleanPhone && (cPhone === cleanPhone || cPhone === `55${cleanPhone}` || cleanPhone === `55${cPhone}`)) ||
                      (cleanId && (cPhone === cleanId || cPhone === `55${cleanId}` || cleanId === `55${cPhone}`));
      return !isMatch;
    });
    setItem(STORAGE_KEYS.CONTACTS, filtered);
    try {
      localStorage.removeItem('7assistente_contacts');
    } catch {}

    return true;
  },

  async deleteAllContacts(): Promise<boolean> {
    // 1. Limpar backend
    try {
      await fetch(`${API_BASE}/api/contacts`, { method: 'DELETE' }).catch(() => {});
    } catch {}

    // 2. Limpar Supabase
    if (SupabaseService.isSupabaseReady) {
      try {
        await SupabaseService.deleteAllClients();
      } catch (e) {
        console.warn('[Storage] Supabase deleteAllClients error:', e);
      }
    }

    // 3. Limpar localStorage
    setItem(STORAGE_KEYS.CONTACTS, []);
    try {
      localStorage.removeItem('7assistente_contacts');
      localStorage.removeItem('pitoco_contacts');
    } catch {}

    return true;
  },

  isContactDeleted(c: any): boolean {
    if (!c) return true;
    if (c.is_deleted) return true;
    return false;
  },

  async saveConversation(conv: Partial<Conversation>): Promise<Conversation> {
    const list = await this.getConversations();
    const idx = list.findIndex(c => c.id === conv.id);
    let updated: Conversation;
    if (idx >= 0) {
      updated = { ...list[idx], ...conv, updated_at: new Date().toISOString() };
      list[idx] = updated;
    } else {
      updated = {
        id: conv.id || `conv-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: conv.status || 'bot',
        unread_count: 0,
        ...conv,
      } as Conversation;
      list.unshift(updated);
    }

    try {
      await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    } catch {}

    setItem(STORAGE_KEYS.CONVERSATIONS, list);
    return updated;
  },

  async assignConversation(convId: string, attendantId: string): Promise<Conversation | null> {
    const attendants = this.getAttendants();
    const att = attendants.find(a => a.id === attendantId);
    const attendantName = att?.name || 'Atendente';

    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendant_id: attendantId, attendant_name: attendantName }),
      }).catch(() => {});
    } catch {}

    const convs = await this.getConversations();
    const idx = convs.findIndex(c => c.id === convId);
    if (idx >= 0) {
      convs[idx] = {
        ...convs[idx],
        assigned_attendant_id: attendantId,
        assigned_attendant_name: attendantName,
        status: 'human',
        updated_at: new Date().toISOString(),
      };
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
      return convs[idx];
    }
    return null;
  },

  async sendMessage(convId: string, text: string, type: MessageType = 'text', mediaUrl?: string): Promise<Message> {
    return this.addMessage({
      conversation_id: convId,
      direction: 'outbound',
      message_type: type,
      content: text,
      media_url: mediaUrl,
      status: 'delivered',
      created_at: new Date().toISOString(),
    });
  },

  async sendInternalNote(convId: string, text: string, author: string = 'Atendente'): Promise<Message> {
    return this.addMessage({
      conversation_id: convId,
      direction: 'outbound',
      message_type: 'internal_note',
      content: text,
      author_name: author,
      is_internal: true,
      status: 'delivered',
      created_at: new Date().toISOString(),
    });
  },

  async duplicateFlow(flowId: string): Promise<Flow | null> {
    const flow = await this.getFlow(flowId);
    if (!flow) return null;
    const newId = `flow-${Date.now()}`;
    const duplicated: Flow = {
      ...flow,
      id: newId,
      name: `${flow.name} (Cópia)`,
      is_active: false,
      status: 'draft',
      version: (flow.version || 1) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await this.saveFlow(duplicated);
    const nodes = await this.getFlowNodes(flowId);
    const edges = await this.getFlowEdges(flowId);
    if (nodes && nodes.length > 0) {
      await this.saveFlowGraph(newId, nodes, edges);
    }
    return duplicated;
  },

  async getAvailableSlots(dateStr: string, durationMinutes: number = 30): Promise<string[]> {
    const settings = await this.getAgendaSettings();
    const startTime = settings.start_time || '08:00';
    const endTime = settings.end_time || '19:00';
    const breakStart = settings.break_start_time || '12:00';
    const breakEnd = settings.break_end_time || '13:00';
    const slotDuration = durationMinutes || settings.slot_duration_minutes || 30;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const [breakStartH, breakStartM] = breakStart.split(':').map(Number);
    const [breakEndH, breakEndM] = breakEnd.split(':').map(Number);

    const startTotal = (startH || 8) * 60 + (startM || 0);
    const endTotal = (endH || 19) * 60 + (endM || 0);
    const breakStartTotal = (breakStartH || 12) * 60 + (breakStartM || 0);
    const breakEndTotal = (breakEndH || 13) * 60 + (breakEndM || 0);

    const existingApts = await this.getAppointments();
    const bookedTimes = new Set(
      existingApts
        .filter(a => (a.consultation_date === dateStr || (a as any).date === dateStr) && a.status !== 'cancelled')
        .map(a => a.consultation_time || (a as any).time)
    );

    const slots: string[] = [];
    for (let cur = startTotal; cur + slotDuration <= endTotal; cur += slotDuration) {
      if (cur >= breakStartTotal && cur < breakEndTotal) {
        continue;
      }
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!bookedTimes.has(slotStr)) {
        slots.push(slotStr);
      }
    }
    return slots;
  },

  async getNextAvailableSlot(dateStr: string, timeStr: string, durationMinutes: number = 30): Promise<any> {
    const slots = await this.getAvailableSlots(dateStr, durationMinutes);
    const nextSlot = slots.find(s => s >= timeStr) || slots[0] || '14:00';
    return {
      date: dateStr,
      time: nextSlot,
      formattedDate: dateStr.split('-').reverse().join('/'),
      dayOfWeek: 'Hoje',
      displayFull: `${dateStr} às ${nextSlot}`,
      displayShort: nextSlot,
      isSameDate: true,
    };
  },

  async saveSupportTicket(ticket: Partial<SupportTicket>): Promise<SupportTicket> {
    const list = await this.getSupportTickets();
    const idx = list.findIndex(t => t.id === ticket.id);
    let updated: SupportTicket;
    if (idx >= 0) {
      updated = { ...list[idx], ...ticket, updated_at: new Date().toISOString() };
      list[idx] = updated;
      try {
        await fetch(`${API_BASE}/api/tickets/${updated.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {});
      } catch {}
    } else {
      updated = {
        id: ticket.id || `tkt-${Date.now()}`,
        status: ticket.status || 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...ticket,
      } as SupportTicket;
      list.unshift(updated);
      try {
        await fetch(`${API_BASE}/api/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {});
      } catch {}
    }
    setItem(STORAGE_KEYS.TICKETS, list);
    return updated;
  },

  async syncAllFromBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/db/export`, { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (res && res.ok) {
        const db = await res.json();
        if (db) {
          if (Array.isArray(db.stores) && db.stores.length > 0) setItem(STORAGE_KEYS.STORES, db.stores);
          if (Array.isArray(db.categories) && db.categories.length > 0) setItem(STORAGE_KEYS.CATEGORIES, db.categories);
          if (Array.isArray(db.products) && db.products.length > 0) setItem(STORAGE_KEYS.PRODUCTS, db.products);
          if (Array.isArray(db.flows) && db.flows.length > 0) setItem(STORAGE_KEYS.FLOWS, db.flows);
          if (db.nodes) {
            for (const flowId of Object.keys(db.nodes)) {
              setItem(`${STORAGE_KEYS.FLOW_NODES_PREFIX}${flowId}`, db.nodes[flowId]);
            }
          }
          if (db.edges) {
            for (const flowId of Object.keys(db.edges)) {
              setItem(`${STORAGE_KEYS.FLOW_EDGES_PREFIX}${flowId}`, db.edges[flowId]);
            }
          }
          if (db.contacts) {
            const list = Object.values(db.contacts);
            if (list.length > 0) setItem(STORAGE_KEYS.CONTACTS, list);
          }
          if (db.conversations) {
            const list = Object.values(db.conversations);
            if (list.length > 0) setItem(STORAGE_KEYS.CONVERSATIONS, list);
          }
          if (Array.isArray(db.tickets) && db.tickets.length > 0) setItem(STORAGE_KEYS.TICKETS, db.tickets);
          if (Array.isArray(db.appointments) && db.appointments.length > 0) setItem(STORAGE_KEYS.VIP_CONSULTATIONS, db.appointments);
          if (db.agendaSettings) setItem('pitoco_agenda_settings', db.agendaSettings);
          if (Array.isArray(db.systemUsers) && db.systemUsers.length > 0) setItem(STORAGE_KEYS.SYSTEM_USERS, db.systemUsers);
          if (Array.isArray(db.attendants) && db.attendants.length > 0) setItem(STORAGE_KEYS.ATTENDANTS, db.attendants);
          if (Array.isArray(db.cannedReplies) && db.cannedReplies.length > 0) setItem(STORAGE_KEYS.CANNED_REPLIES, db.cannedReplies);
          if (db.botProfile) {
            const settings = getItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
            settings.bot_profile = { ...(settings.bot_profile || {}), ...db.botProfile };
            setItem(STORAGE_KEYS.SETTINGS, settings);
          }
          if (Array.isArray(db.customVariables) && db.customVariables.length > 0) setItem('pitoco_custom_variables', db.customVariables);
          console.log('[StorageService] 🔄 Sincronização completa do banco de dados realizada com sucesso!');
          return true;
        }
      }
    } catch (err) {
      console.warn('[StorageService] Falha ao sincronizar estado com backend:', err);
    }
    return false;
  },
};

