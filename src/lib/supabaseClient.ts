import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Store, 
  Category, 
  Product, 
  Client, 
  SupportTicket, 
  Message, 
  Conversation, 
  BotConfig,
  FlowNode,
  FlowEdge,
  Flow
} from '../types';

const SUPABASE_URL = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://cbeiguyvoepbcafmxduy.supabase.co';

const SUPABASE_ANON_KEY = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWlndXl2b2VwYmNhZm14ZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzU5NzcsImV4cCI6MjEwNDMxMTk3N30.1XpWL6ns9NlPh4sQ3M8-OJTnKCPH-jf89iFspmBrKxM';

export const isSupabaseReady = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.includes('supabase.co')
);

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ==========================================
// 1. STORES CRUD & QUERIES
// ==========================================
export async function getStores(): Promise<Store[]> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('slug', { ascending: true });
    
    if (error) throw error;
    if (data && data.length > 0) return data as Store[];
  } catch (err) {
    console.warn('[Supabase] getStores fallback:', err);
  }
  return [];
}

export async function getStoreById(id: string): Promise<Store | null> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data as Store | null;
  } catch (err) {
    console.warn('[Supabase] getStoreById fallback:', err);
    return null;
  }
}

export async function updateStore(id: string, updates: Partial<Store>): Promise<Store | null> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data as Store | null;
  } catch (err) {
    console.warn('[Supabase] updateStore error:', err);
    return null;
  }
}

// ==========================================
// 2. CATEGORIES CRUD
// ==========================================
export async function getCategories(storeId?: string): Promise<Category[]> {
  try {
    let query = supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    
    if (storeId) {
      query = query.or(`store_id.is.null,store_id.eq.${storeId}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) return data as Category[];
  } catch (err) {
    console.warn('[Supabase] getCategories fallback:', err);
  }
  return [];
}

export async function createCategory(cat: Omit<Category, 'id'>): Promise<Category | null> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([cat])
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  } catch (err) {
    console.warn('[Supabase] createCategory error:', err);
    return null;
  }
}

// ==========================================
// 3. PRODUCTS CRUD
// ==========================================
export async function getProducts(storeId?: string, categoryId?: string): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (storeId) {
      query = query.or(`store_id.is.null,store_id.eq.${storeId}`);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map((p: any) => ({
        ...p,
        category_name: p.categories?.name || p.category_name,
      })) as Product[];
    }
  } catch (err) {
    console.warn('[Supabase] getProducts fallback:', err);
  }
  return [];
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Product | null;
  } catch (err) {
    console.warn('[Supabase] getProductById error:', err);
    return null;
  }
}

export async function saveProduct(prod: Partial<Product>): Promise<Product | null> {
  try {
    const payload = {
      ...prod,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('products')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  } catch (err) {
    console.warn('[Supabase] saveProduct error:', err);
    return null;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    return !error;
  } catch (err) {
    console.warn('[Supabase] deleteProduct error:', err);
    return false;
  }
}

// ==========================================
// 4. CLIENTS & CRM
// ==========================================
export async function getClients(storeId?: string): Promise<Client[]> {
  try {
    let query = supabase
      .from('clients')
      .select('*')
      .order('last_interaction', { ascending: false });
    
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (data) return data as Client[];
  } catch (err) {
    console.warn('[Supabase] getClients fallback:', err);
  }
  return [];
}

export async function upsertClient(client: Partial<Client>): Promise<Client | null> {
  try {
    const cleanPhone = String(client.phone || '').replace(/\D/g, '');
    const payload = {
      ...client,
      phone: cleanPhone,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('clients')
      .upsert(payload, { onConflict: 'phone' })
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  } catch (err) {
    console.warn('[Supabase] upsertClient error:', err);
    return null;
  }
}

export async function deleteClient(id: string, phone?: string): Promise<boolean> {
  try {
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    let query = supabase.from('clients').delete();
    if (cleanPhone) {
      query = query.or(`id.eq.${id},phone.eq.${cleanPhone},phone.eq.55${cleanPhone}`);
    } else {
      query = query.eq('id', id);
    }
    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteClient error:', err);
    return false;
  }
}

export async function deleteAllClients(): Promise<boolean> {
  try {
    const { error } = await supabase.from('clients').delete().neq('id', '___NEVER_MATCH___');
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteAllClients error:', err);
    return false;
  }
}

// ==========================================
// 5. CHAT MESSAGES & REALTIME
// ==========================================
export async function getChatMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (data) return data as Message[];
  } catch (err) {
    console.warn('[Supabase] getChatMessages fallback:', err);
  }
  return [];
}

export async function insertChatMessage(msg: Partial<Message>): Promise<Message | null> {
  try {
    const payload = {
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      conversation_id: msg.conversation_id,
      store_id: msg.store_id || null,
      direction: msg.direction || 'outbound',
      message_type: msg.message_type || 'text',
      content: msg.content,
      media_url: msg.media_url || null,
      status: msg.status || 'delivered',
      author_name: msg.author_name || 'Pitoco Atendente',
      created_at: msg.created_at || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as Message;
  } catch (err) {
    console.warn('[Supabase] insertChatMessage error:', err);
    return null;
  }
}

export function subscribeToMessages(conversationId: string, onMessage: (msg: Message) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessage(payload.new as Message);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function assignConversationAttendant(
  id: string,
  attendantName: string,
  attendantId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .update({
        assigned_to: attendantName,
        status: 'human',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    return !error;
  } catch (err) {
    console.warn('[Supabase] assignConversationAttendant error:', err);
    return false;
  }
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const cleanPhone = String(id).replace(/\D/g, '');
    let query = supabase.from('conversations').delete();
    if (cleanPhone) {
      query = query.or(`id.eq.${id},id.eq.conv-${cleanPhone},phone.eq.${cleanPhone}`);
    } else {
      query = query.eq('id', id);
    }
    await query.catch(() => {});

    await supabase.from('chat_messages').delete().or(`conversation_id.eq.${id},conversation_id.eq.conv-${cleanPhone}`).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteConversation error:', err);
    return false;
  }
}

export async function clearConversationMessages(id: string): Promise<boolean> {
  try {
    const cleanPhone = String(id).replace(/\D/g, '');
    await supabase.from('chat_messages').delete().or(`conversation_id.eq.${id},conversation_id.eq.conv-${cleanPhone}`).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[Supabase] clearConversationMessages error:', err);
    return false;
  }
}

// ==========================================
// 6. SUPPORT TICKETS
// ==========================================
export async function getSupportTickets(storeId?: string): Promise<SupportTicket[]> {
  try {
    let query = supabase
      .from('support_tickets')
      .select('*, stores(name), clients(name, phone)')
      .order('created_at', { ascending: false });
    
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      return data.map((t: any) => ({
        ...t,
        store_name: t.stores?.name || t.store_name,
        client_name: t.clients?.name || t.client_name,
        client_phone: t.clients?.phone || t.client_phone,
      })) as SupportTicket[];
    }
  } catch (err) {
    console.warn('[Supabase] getSupportTickets fallback:', err);
  }
  return [];
}

export async function createSupportTicket(ticket: Partial<SupportTicket>): Promise<SupportTicket | null> {
  try {
    const protocol = ticket.protocol || `PTC-${Date.now().toString().slice(-6)}`;
    const payload = {
      ...ticket,
      protocol,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as SupportTicket;
  } catch (err) {
    console.warn('[Supabase] createSupportTicket error:', err);
    return null;
  }
}

export async function updateSupportTicketStatus(
  id: string, 
  status: SupportTicket['status'], 
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('support_tickets')
      .update({
        status,
        ...(notes ? { notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    return !error;
  } catch (err) {
    console.warn('[Supabase] updateSupportTicketStatus error:', err);
    return false;
  }
}

// ==========================================
// 7. BOT CONFIG
// ==========================================
export async function getBotConfig(): Promise<BotConfig | null> {
  try {
    const { data, error } = await supabase
      .from('bot_config')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    return data as BotConfig | null;
  } catch (err) {
    console.warn('[Supabase] getBotConfig fallback:', err);
    return null;
  }
}

export async function saveBotConfig(config: Partial<BotConfig>): Promise<BotConfig | null> {
  try {
    const payload = {
      id: 'default',
      ...config,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('bot_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data as BotConfig;
  } catch (err) {
    console.warn('[Supabase] saveBotConfig error:', err);
    return null;
  }
}

// ==========================================
// 8. CONVERSATIONS & MULTI-STORE REALTIME
// ==========================================
export async function getConversations(storeId?: string): Promise<Conversation[]> {
  try {
    let query = supabase
      .from('conversations')
      .select('*, stores(name)')
      .order('last_message_at', { ascending: false });
    
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      return data.map((c: any) => ({
        ...c,
        store_name: c.stores?.name || c.store_name,
      })) as Conversation[];
    }
  } catch (err) {
    console.warn('[Supabase] getConversations fallback:', err);
  }
  return [];
}

export async function updateConversationStatus(
  id: string, 
  status: Conversation['status'], 
  storeId?: string,
  assignedTo?: string | null
): Promise<boolean> {
  try {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (storeId) updates.store_id = storeId;
    if (assignedTo !== undefined) updates.assigned_to = assignedTo;

    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id);
    return !error;
  } catch (err) {
    console.warn('[Supabase] updateConversationStatus error:', err);
    return false;
  }
}

export function subscribeToConversations(onUpdate: (conv: Conversation) => void) {
  const channel = supabase
    .channel('all_conversations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as Conversation);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==========================================
// 8. FLOWS & NODES SYNC (SUPABASE CLOUD)
// ==========================================
export async function getFlows(): Promise<Flow[]> {
  try {
    const [flowsRes, nodesRes] = await Promise.all([
      supabase.from('flows').select('*'),
      supabase.from('flow_nodes').select('id, flow_id'),
    ]);

    if (flowsRes.error) throw flowsRes.error;
    const data = flowsRes.data;

    // Mapear contagem real de nós por fluxo a partir da tabela flow_nodes
    const realNodeCounts = new Map<string, number>();
    if (nodesRes.data && Array.isArray(nodesRes.data)) {
      for (const node of nodesRes.data) {
        if (node.flow_id) {
          realNodeCounts.set(node.flow_id, (realNodeCounts.get(node.flow_id) || 0) + 1);
        }
      }
    }

    if (data && Array.isArray(data)) {
      const mapped = data.map((f: any) => {
        const actualNodeCount = realNodeCounts.has(f.id)
          ? realNodeCounts.get(f.id)!
          : (typeof f.node_count === 'number' && f.node_count > 0 ? f.node_count : (Array.isArray(f.steps) ? f.steps.length : 0));

        return {
          id: f.id,
          name: f.name || 'Fluxo',
          description: f.description || '',
          status: f.status || (f.is_active ? 'published' : 'draft'),
          is_active: f.is_active ?? (f.status === 'published'),
          version: f.version || 1,
          node_count: actualNodeCount,
          trigger_type: f.trigger_type || 'Qualquer Mensagem Recebida',
          store_id: f.store_id || null,
          store_name: f.store_name || null,
          steps: Array.isArray(f.steps) ? f.steps : [],
          color: f.color || '#10b981',
          order_index: typeof f.order_index === 'number' ? f.order_index : undefined,
          created_at: f.created_at || new Date().toISOString(),
          updated_at: f.updated_at || new Date().toISOString(),
        };
      }) as Flow[];

      // Ordenar por order_index estável (preserva ordem dos cards independente de atualizações de texto)
      return mapped.sort((a, b) => {
        const orderA = typeof a.order_index === 'number' ? a.order_index : 9999;
        const orderB = typeof b.order_index === 'number' ? b.order_index : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
  } catch (err) {
    console.warn('[Supabase] getFlows warning:', err);
  }
  return [];
}

export async function saveFlow(flow: Partial<Flow>): Promise<Flow | null> {
  try {
    if (!flow || !flow.id) return null;
    const isPublishing = flow.status === 'published' || flow.is_active === true;

    const payload = {
      id: flow.id,
      name: flow.name || 'Novo Fluxo',
      description: flow.description || '',
      status: flow.status || (flow.is_active ? 'published' : 'draft'),
      is_active: isPublishing,
      version: flow.version || 1,
      trigger_type: flow.trigger_type || 'keyword',
      store_id: flow.store_id || null,
      store_name: flow.store_name || null,
      node_count: flow.node_count || 0,
      steps: flow.steps || [],
      color: flow.color || '#10b981',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('flows')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) throw error;
    console.log('[Supabase] Fluxo gravado com sucesso no banco:', payload.name, `(${payload.id})`);
    return data as Flow;
  } catch (err) {
    console.warn('[Supabase] saveFlow warning:', err);
    return null;
  }
}

export async function deleteFlow(id: string): Promise<boolean> {
  try {
    await Promise.all([
      supabase.from('flow_nodes').delete().eq('flow_id', id),
      supabase.from('flow_edges').delete().eq('flow_id', id),
      supabase.from('flows').delete().eq('id', id),
    ]);
    return true;
  } catch (err) {
    console.warn('[Supabase] deleteFlow error:', err);
    return false;
  }
}

export async function toggleFlowStatus(id: string, isActive: boolean): Promise<boolean> {
  try {
    await supabase
      .from('flows')
      .update({
        status: isActive ? 'published' : 'draft',
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    return true;
  } catch (err) {
    console.warn('[Supabase] toggleFlowStatus warning:', err);
    return false;
  }
}

export async function saveFlowGraph(flowId: string, nodes: FlowNode[], edges: FlowEdge[]): Promise<void> {
  try {
    if (!flowId) return;
    const nodeIds = (nodes || []).map(n => n.id).filter(Boolean);
    const edgeIds = (edges || []).map(e => e.id).filter(Boolean);

    // Remove nós e arestas deletados do fluxo
    if (nodeIds.length > 0) {
      await supabase.from('flow_nodes').delete().eq('flow_id', flowId).not('id', 'in', `(${nodeIds.join(',')})`);
    } else {
      await supabase.from('flow_nodes').delete().eq('flow_id', flowId);
    }

    if (edgeIds.length > 0) {
      await supabase.from('flow_edges').delete().eq('flow_id', flowId).not('id', 'in', `(${edgeIds.join(',')})`);
    } else {
      await supabase.from('flow_edges').delete().eq('flow_id', flowId);
    }

    if (Array.isArray(nodes) && nodes.length > 0) {
      const nodeRecords = nodes.map((n) => ({
        id: n.id,
        flow_id: flowId,
        type: n.type || 'message',
        label: n.data?.label || (n as any).label || 'Nó',
        data: n.data || {},
        position: n.position || { x: 0, y: 0 },
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('flow_nodes').upsert(nodeRecords, { onConflict: 'id' });
    }

    if (Array.isArray(edges) && edges.length > 0) {
      const edgeRecords = edges.map((e) => ({
        id: e.id,
        flow_id: flowId,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle || null,
        target_handle: e.targetHandle || null,
        data: e.data || {},
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('flow_edges').upsert(edgeRecords, { onConflict: 'id' });
    }

    // Sincronizar contagem exata de nós diretamente no registro do fluxo
    await supabase.from('flows').update({
      node_count: Array.isArray(nodes) ? nodes.length : 0,
      updated_at: new Date().toISOString(),
    }).eq('id', flowId);
    console.log('[Supabase] Grafo do fluxo gravado com sucesso no banco:', flowId, `(Nós: ${nodes.length})`);
  } catch (err) {
    console.warn('[Supabase] saveFlowGraph warning:', err);
  }
}

export async function getFlowGraph(flowId: string): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] } | null> {
  try {
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('flow_nodes').select('*').eq('flow_id', flowId),
      supabase.from('flow_edges').select('*').eq('flow_id', flowId),
    ]);
    if (nodesRes.data && nodesRes.data.length > 0) {
      const nodes: FlowNode[] = nodesRes.data.map((r: any) => ({
        id: r.id,
        type: r.type,
        position: r.position || { x: 0, y: 0 },
        data: r.data || { label: r.label, nodeType: r.type, config: {} },
      }));
      const edges: FlowEdge[] = (edgesRes.data || []).map((r: any) => ({
        id: r.id,
        source: r.source,
        target: r.target,
        sourceHandle: r.source_handle || undefined,
        targetHandle: r.target_handle || undefined,
        data: r.data,
      }));
      return { nodes, edges };
    }
  } catch (err) {
    console.warn('[Supabase] getFlowGraph warning:', err);
  }
  return null;
}

export function subscribeToFlows(onUpdate: () => void) {
  const channel = supabase
    .channel('all_flows_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'flows',
      },
      () => {
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'flow_nodes',
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
