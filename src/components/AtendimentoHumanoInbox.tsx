import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Bot, 
  UserCheck, 
  Check, 
  CheckCheck, 
  Clock, 
  User, 
  Phone, 
  Tag, 
  Building2, 
  Filter, 
  RefreshCw, 
  Smile, 
  Paperclip, 
  X, 
  Sparkles, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowRightLeft,
  ArrowUpDown,
  Trash2,
  Download,
  Eraser,
  UserPlus,
  Plus,
  Edit3,
  Lock,
  RotateCcw,
  Eye,
  Layers,
  FileText,
  DollarSign,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Command,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input, Textarea } from './ui/Input';
import { Conversation, Message, Contact, Store, SystemUser, Product } from '../types';
import { StorageService } from '../lib/storage';
import { whatsappService } from '../lib/whatsappService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import * as SupabaseService from '../lib/supabaseClient';

interface AtendimentoHumanoInboxProps {
  initialStoreId?: string | null;
  onNavigate?: (path: string) => void;
  portalMode?: 'admin' | 'gerente' | 'atendimento';
}

// Utilitário de deduplicação estrita de mensagens para evitar clones visuais
const deduplicateMessages = (msgs: Message[]): Message[] => {
  const seenIds = new Set<string>();
  const result: Message[] = [];

  for (const m of msgs) {
    if (m.id && seenIds.has(m.id)) continue;

    // Verificar se já existe mensagem recente com mesmo conteúdo e mesma direção (dentro de 4 segundos)
    const isDuplicateRecent = result.some(prev => {
      if (prev.direction !== m.direction) return false;
      if ((prev.content || '').trim() !== (m.content || '').trim()) return false;
      const tPrev = new Date(prev.created_at || '').getTime();
      const tCurr = new Date(m.created_at || '').getTime();
      if (!isNaN(tPrev) && !isNaN(tCurr) && Math.abs(tCurr - tPrev) < 4000) {
        return true;
      }
      return false;
    });

    if (isDuplicateRecent) continue;

    if (m.id) seenIds.add(m.id);
    result.push(m);
  }
  return result;
};

export const AtendimentoHumanoInbox: React.FC<AtendimentoHumanoInboxProps> = ({ 
  initialStoreId,
  onNavigate,
  portalMode = 'admin',
}) => {
  const { user, isCEO, isManager, hasAdminAccess } = useAuth();
  const { success, warning, error: toastError, info } = useToast();

  // Controle de permissões estrito para os 3 painéis
  const isAdmin = portalMode === 'admin' || isCEO || user?.role === 'admin' || user?.panels?.includes('admin') || Boolean(hasAdminAccess);
  const canAdminDestructive = isCEO || isManager || isAdmin || Boolean(hasAdminAccess) || portalMode === 'admin';
  const isAttendantMode = !canAdminDestructive && (portalMode === 'atendimento' || user?.role === 'attendant');
  const canEditClient = canAdminDestructive;

  const [stores, setStores] = useState<Store[]>([]);
  const [attendants, setAttendants] = useState<SystemUser[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>(initialStoreId || 'all');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactInfo, setContactInfo] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialFilterFromUrl = queryParams?.get('filter') || queryParams?.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState<string>(initialFilterFromUrl);

  const [sortOrder, setSortOrder] = useState<'oldest_first' | 'newest_first'>('oldest_first');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetAttendant, setTransferTargetAttendant] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // 👤 CRM Drawer: Fechado por padrão (só abre quando o atendente/admin clicar para visualizar ou editar)
  const [isCrmOpen, setIsCrmOpen] = useState(false);

  // ⛶ Modo Tela Cheia Imersivo no Navegador
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modal do Catálogo de Peças / Envio no WhatsApp
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState('all');
  const [isSendingProduct, setIsSendingProduct] = useState(false);

  // Notas Internas (Atendimento vs Confidencial Admin)
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteVisibility, setNewNoteVisibility] = useState<'all' | 'admin_only'>('all');
  
  // Modal de Edição de Dados do Cliente CRM
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    baby_name: '',
    due_date: '',
    store_id: '',
    email: '',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Atalhos de Teclado macOS (⌘K para focar busca, Esc para fechar gaveta/fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (isCrmOpen) setIsCrmOpen(false);
        if (isFullscreen) setIsFullscreen(false);
        if (isCatalogModalOpen) setIsCatalogModalOpen(false);
        if (isTransferModalOpen) setIsTransferModalOpen(false);
        if (isEditClientModalOpen) setIsEditClientModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCrmOpen, isFullscreen, isCatalogModalOpen, isTransferModalOpen, isEditClientModalOpen]);

  // Carregar lojas, atendentes e setores cadastrados
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [storesData, usersData] = await Promise.all([
          StorageService.getStores(),
          StorageService.getSystemUsers(),
        ]);
        setStores(storesData);
        setAttendants(usersData.filter(u => u.status !== 'inactive'));
        setSectors(StorageService.getSectors());
      } catch (e) {
        console.error('Error loading initial inbox data:', e);
      }
    }
    loadInitialData();
  }, []);

  // Carregar conversas com filtro de loja
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const filter = selectedStoreFilter === 'all' ? undefined : selectedStoreFilter;
      const data = await StorageService.getConversations(filter);
      setConversations(data);
      if (!activeConv && data.length > 0) {
        const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const targetConvId = qp?.get('convId') || qp?.get('id');
        const matched = targetConvId ? data.find(c => c.id === targetConvId || c.phone === targetConvId || `conv-${c.phone}` === targetConvId) : null;
        const firstValid = matched || data.find(c => !c.is_deleted) || data[0];
        setActiveConv(firstValid);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedStoreFilter, activeConv]);

  const handleSelectConv = (conv: Conversation) => {
    setActiveConv(conv);
    if (typeof window !== 'undefined') {
      const url = `/atendimento?convId=${encodeURIComponent(conv.id)}${statusFilter !== 'all' ? `&filter=${encodeURIComponent(statusFilter)}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  };

  const handleStatusFilterChange = (newFilter: string) => {
    setStatusFilter(newFilter);
    if (typeof window !== 'undefined') {
      const convParam = activeConv ? `convId=${encodeURIComponent(activeConv.id)}&` : '';
      const url = `/atendimento?${convParam}filter=${encodeURIComponent(newFilter)}`;
      window.history.replaceState({}, '', url);
    }
  };

  useEffect(() => {
    fetchConversations(false);
    const interval = setInterval(() => fetchConversations(true), 4000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Carregar mensagens e contato da conversa selecionada
  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      setContactInfo(null);
      return;
    }

    let isMounted = true;
    async function loadConvData() {
      const [msgs, contacts] = await Promise.all([
        StorageService.getMessages(activeConv.id),
        StorageService.getContacts(),
      ]);
      if (isMounted) {
        setMessages(deduplicateMessages(msgs));
        const contact = contacts.find(
          c => c.phone.replace(/\D/g, '') === (activeConv.contact_phone || activeConv.phone || '').replace(/\D/g, '')
        );
        setContactInfo(contact || null);
      }
    }
    loadConvData();

    // Supabase Realtime subscription para a conversa ativa
    const unsubscribe = SupabaseService.subscribeToMessages(activeConv.id, (newMsg) => {
      if (isMounted) {
        setMessages(prev => deduplicateMessages([...prev, newMsg]));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar resposta pelo painel para o WhatsApp do cliente
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConv || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    const targetPhone = activeConv.contact_phone || activeConv.phone || '';
    const authorName = user?.name || (isAttendantMode ? 'Atendente Pitoco' : 'Sofia Consultora VIP');

    // 1. Enviar mensagem de saída via WhatsApp microservice
    const sendResult = await whatsappService.sendMessage({
      phone: targetPhone,
      text: textToSend,
    });

    // 2. Persistir no banco de dados e estado local oficial
    const newMsg = await StorageService.addMessage({
      conversation_id: activeConv.id,
      store_id: activeConv.store_id || null,
      direction: 'outbound',
      content: textToSend,
      author_name: authorName,
      status: sendResult.success ? 'delivered' : 'pending',
    });

    setMessages(prev => deduplicateMessages([...prev, newMsg]));

    // 3. Auto-assumir o atendimento humano se não estiver atribuído
    await StorageService.updateConversationStatus(activeConv.id, 'human', activeConv.store_id || undefined);
    await StorageService.assignAttendant(activeConv.id, authorName);
    setActiveConv(prev => prev ? { ...prev, status: 'human', assigned_to: authorName } : null);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: 'human', assigned_to: authorName } : c));

    // Cooldown de proteção para evitar duplo envio acidental e sinalização anti-spam no WhatsApp
    setTimeout(() => {
      setIsSending(false);
      messageInputRef.current?.focus();
    }, 800);

    if (!sendResult.success) {
      warning('Mensagem salva no painel, mas o envio direto ao WhatsApp falhou. Verifique o QR Code.');
    }
  };

  // Abrir modal do catálogo de peças
  const handleOpenCatalog = async () => {
    setIsCatalogModalOpen(true);
    try {
      const prods = await StorageService.getProducts(activeConv?.store_id || undefined);
      setCatalogProducts(prods.filter(p => p.is_active));
    } catch (e) {
      console.error('Error loading catalog products:', e);
    }
  };

  // Enviar peça do catálogo com foto e detalhes para a conversa do cliente
  const handleSendProductToChat = async (product: Product) => {
    if (!activeConv || isSendingProduct) return;
    setIsSendingProduct(true);
    const targetPhone = activeConv.contact_phone || activeConv.phone || '';
    const authorName = user?.name || (isAttendantMode ? 'Atendente Pitoco' : 'Consultora Pitoco');

    const formattedText = `🛍️ *${product.name}*\n` +
      `💰 *Preço:* R$ ${product.price.toFixed(2)}${product.promotional_price ? ` (Promoção: R$ ${product.promotional_price.toFixed(2)})` : ''}\n` +
      `📏 *Tamanhos disponíveis:* ${(product.sizes || []).join(', ') || 'Sob consulta'}\n` +
      (product.material ? `🧵 *Material:* ${product.material}\n` : '') +
      (product.description ? `📝 *Detalhes:* ${product.description}\n` : '') +
      (product.image_url ? `🖼️ *Foto da peça:* ${product.image_url}` : '');

    try {
      // 1. Enviar via Baileys WhatsApp
      const sendResult = await whatsappService.sendMessage({
        phone: targetPhone,
        text: formattedText,
        mediaUrl: product.image_url,
        caption: `🛍️ *${product.name}* - R$ ${product.price.toFixed(2)}`,
      });

      // 2. Persistir mensagem na conversa
      const newMsg = await StorageService.addMessage({
        conversation_id: activeConv.id,
        store_id: activeConv.store_id || null,
        direction: 'outbound',
        content: formattedText,
        media_url: product.image_url,
        author_name: authorName,
        status: sendResult.success ? 'delivered' : 'pending',
      });

      setMessages(prev => deduplicateMessages([...prev, newMsg]));

      // 3. Auto-assumir o atendimento
      await StorageService.updateConversationStatus(activeConv.id, 'human', activeConv.store_id || undefined);
      await StorageService.assignAttendant(activeConv.id, authorName);
      setActiveConv(prev => prev ? { ...prev, status: 'human', assigned_to: authorName } : null);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: 'human', assigned_to: authorName } : c));

      setIsCatalogModalOpen(false);
      success('Peça enviada com sucesso!', `"${product.name}" enviada para o WhatsApp de ${activeConv.contact_name || activeConv.phone}.`);
    } catch (err: any) {
      toastError('Erro ao enviar peça', err?.message || 'Falha ao enviar produto.');
    } finally {
      setIsSendingProduct(false);
    }
  };

  // Alterar Setor de Atendimento
  const handleSectorChange = async (newSector: string) => {
    if (!activeConv) return;
    await StorageService.updateConversationSector(activeConv.id, newSector);
    setActiveConv(prev => prev ? { ...prev, sector: newSector } : null);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, sector: newSector } : c));
    success('Setor Atualizado', `Conversa direcionada para o setor "${newSector}".`);
  };

  // Transbordo: Devolver para o Robô
  const handleTransferToBot = async () => {
    if (!activeConv) return;
    await StorageService.updateConversationStatus(activeConv.id, 'bot', activeConv.store_id || undefined, null);
    const updated: Conversation = { 
      ...activeConv, 
      status: 'bot', 
      assigned_to: null, 
      assigned_attendant_name: null, 
      assigned_attendant_id: null,
      updated_at: new Date().toISOString() 
    };
    setActiveConv(updated);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updated : c));
    info('Conversa transferida de volta para o Robô Pitoco');
  };

  // Atribuir para mim (Consultora/Atendente/Gerente/Admin)
  const handleAssumeConversation = async (targetConv?: Conversation) => {
    const conv = targetConv || activeConv;
    if (!conv) return;
    const authorName = user?.name || (isCEO ? 'Malaca CEO' : isAdmin ? 'Administrador Geral' : isManager ? 'Gerente' : 'Sofia Consultora VIP');
    const authorId = user?.id || `user-${user?.username || 'attendant'}`;

    await StorageService.updateConversationStatus(conv.id, 'human', conv.store_id || undefined, authorName);
    await StorageService.assignAttendant(conv.id, authorName, authorId);

    const updated: Conversation = { 
      ...conv, 
      status: 'human', 
      assigned_to: authorName, 
      assigned_attendant_name: authorName,
      assigned_attendant_id: authorId,
      updated_at: new Date().toISOString()
    };

    if (!activeConv || activeConv.id === conv.id) {
      setActiveConv(updated);
    }
    setConversations(prev => prev.map(c => c.id === conv.id ? updated : c));
    success('Você assumiu este atendimento humano!', `Operador responsável: ${authorName}`);
  };

  // 1. Apagar Mensagem Individual (Restrito a Admin/Gerente)
  const handleDeleteMessage = async (msgId: string) => {
    if (!activeConv) return;
    if (!canAdminDestructive) {
      warning('Ação Restrita', 'O painel de atendimento não tem permissão para apagar mensagens.');
      return;
    }
    await StorageService.deleteMessage(activeConv.id, msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    info('Mensagem removida da conversa');
  };

  // 2. Limpar Histórico da Conversa (Restrito a Admin/Gerente)
  const handleClearHistory = async () => {
    if (!activeConv) return;
    if (!canAdminDestructive) {
      warning('Ação Restrita', 'O painel de atendimento não tem permissão para limpar o histórico.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja limpar todo o histórico com ${activeConv.contact_name || activeConv.phone}?`)) return;
    await StorageService.clearMessages(activeConv.id);
    setMessages([]);
    success('Histórico de mensagens limpo com sucesso');
  };

  // 3. Apagar Conversa Definitivamente
  const handleDeleteConversation = async (targetConv?: Conversation) => {
    const conv = targetConv || activeConv;
    if (!conv) return;
    if (!canAdminDestructive) {
      warning('Ação Restrita', 'O painel de atendimento requer permissão de administrador para apagar conversas.');
      return;
    }
    const clientName = conv.contact_name || conv.phone || 'Cliente';
    if (!window.confirm(`Tem certeza que deseja apagar a conversa com ${clientName}? Todas as mensagens e histórico serão removidos definitivamente do sistema.`)) return;
    
    const convId = conv.id;
    try {
      await StorageService.purgeConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId && c.phone !== conv.phone && `conv-${c.phone}` !== convId));
      if (activeConv?.id === convId || activeConv?.phone === conv.phone) {
        setActiveConv(null);
        setMessages([]);
      }
      success('Conversa apagada com sucesso!');
    } catch (err: any) {
      toastError('Erro ao apagar conversa', err?.message || 'Falha ao remover.');
    }
  };

  // 4. Restaurar Conversa da Lixeira (Apenas Admin)
  const handleRestoreConversation = async (convId: string) => {
    if (!canAdminDestructive) return;
    await StorageService.restoreConversation(convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_deleted: false, deleted_at: undefined } : c));
    if (activeConv?.id === convId) {
      setActiveConv(prev => prev ? { ...prev, is_deleted: false, deleted_at: undefined } : null);
    }
    success('Conversa restaurada da Lixeira!');
  };

  // 5. Excluir Definitivamente da Lixeira (Apenas Admin)
  const handlePurgeConversation = async (convId: string) => {
    if (!canAdminDestructive) return;
    if (!window.confirm('Atenção: Esta ação é definitiva e removerá permanentemente todos os dados desta conversa. Continuar?')) return;
    try {
      await StorageService.purgeConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId && `conv-${c.phone}` !== convId));
      if (activeConv?.id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
      success('Conversa excluída permanentemente.');
    } catch (err: any) {
      toastError('Erro ao excluir', err?.message || 'Falha ao remover.');
    }
  };

  // 6. Transferir Atendimento para Atendente / Filial / Fila Geral
  const handleTransferConversation = async () => {
    if (!activeConv || !transferTargetAttendant) {
      warning('Selecione um destino para transferir a conversa.');
      return;
    }

    // Caso de liberar para a Fila Geral (sem atendente atribuído)
    if (transferTargetAttendant === '__unassigned__') {
      await StorageService.updateConversationStatus(activeConv.id, 'waiting_human', activeConv.store_id || undefined);
      await StorageService.assignAttendant(activeConv.id, '', '');

      const updated: Conversation = {
        ...activeConv,
        assigned_to: undefined,
        assigned_attendant_name: null,
        assigned_attendant_id: null,
        status: 'waiting_human',
        updated_at: new Date().toISOString()
      };

      setActiveConv(updated);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? updated : c));
      setIsTransferModalOpen(false);
      setTransferTargetAttendant('');
      success('Conversa devolvida para a Fila Geral de Espera!');
      return;
    }

    const attendant = attendants.find(a => a.id === transferTargetAttendant || (a.name || a.username) === transferTargetAttendant);
    const attendantName = attendant ? (attendant.name || attendant.username) : transferTargetAttendant;

    await StorageService.transferConversation(
      activeConv.id,
      attendant?.id || `att-${Date.now()}`,
      attendantName,
      activeConv.store_id || undefined,
      activeConv.store_name
    );

    const updated: Conversation = {
      ...activeConv,
      assigned_to: attendantName,
      assigned_attendant_name: attendantName,
      assigned_attendant_id: attendant?.id || `att-${Date.now()}`,
      status: 'human',
      updated_at: new Date().toISOString()
    };

    setActiveConv(updated);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updated : c));
    setIsTransferModalOpen(false);
    setTransferTargetAttendant('');
    success(`Conversa transferida com sucesso para ${attendantName}`);
  };

  // 7. Salvar / Exportar Transcrição (.txt)
  const handleExportTranscript = () => {
    if (!activeConv) return;
    const lines = [
      '====================================================================',
      'PITOCO DE GENTE — TRANSCRIÇÃO OFICIAL DE ATENDIMENTO WHATSAPP',
      `Cliente: ${activeConv.contact_name || 'Desconhecido'} (${activeConv.contact_phone || activeConv.phone})`,
      `Filial: ${activeConv.store_name || 'Rede Geral'}`,
      `Setor: ${activeConv.sector || 'Vendas & Enxoval'}`,
      `Status: ${activeConv.status}`,
      `Atendente Responsável: ${activeConv.assigned_to || activeConv.assigned_attendant_name || 'Robô Pitoco'}`,
      `Data do Export: ${new Date().toLocaleString('pt-BR')}`,
      '====================================================================\n',
    ];

    messages.forEach(m => {
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00';
      const sender = m.direction === 'inbound' 
        ? (activeConv.contact_name || 'Cliente') 
        : (m.author_name || 'Atendente');
      lines.push(`[${time}] [${sender}]: ${m.content}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${(activeConv.contact_name || activeConv.phone || 'conversa').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    success('Transcrição da conversa baixada com sucesso!');
  };

  // 8. Tags do Cliente (Apenas Admin/Gerente podem editar)
  const handleAddTag = async (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!canEditClient) {
      warning('Ação Restrita', 'O painel de atendimento não tem permissão para gerenciar tags.');
      return;
    }

    const tagClean = newTagInput.trim();
    if (!tagClean || !activeConv) return;

    const currentTags = contactInfo?.tags || [];
    if (!currentTags.includes(tagClean)) {
      const updatedTags = [...currentTags, tagClean];
      try {
        const updatedContact = await StorageService.saveContact({
          id: contactInfo?.id,
          phone: activeConv.contact_phone || activeConv.phone,
          name: activeConv.contact_name || 'Cliente WhatsApp',
          tags: updatedTags,
          store_id: activeConv.store_id,
          store_name: activeConv.store_name,
        });
        setContactInfo(updatedContact);
        success(`Tag "${tagClean}" vinculada ao cliente`);
      } catch (err) {
        console.error('Erro ao salvar tag:', err);
      }
    }
    setNewTagInput('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeConv || !canEditClient) return;
    const currentTags = contactInfo?.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    try {
      const updatedContact = await StorageService.saveContact({
        id: contactInfo?.id,
        phone: activeConv.contact_phone || activeConv.phone,
        name: activeConv.contact_name || 'Cliente WhatsApp',
        tags: updatedTags,
        store_id: activeConv.store_id,
        store_name: activeConv.store_name,
      });
      setContactInfo(updatedContact);
      info(`Tag "${tagToRemove}" removida`);
    } catch (err) {
      console.error('Erro ao remover tag:', err);
    }
  };

  // 9. Notas Internas da Conversa
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeConv) return;
    const text = newNoteText.trim();
    const visibility = (!isAdmin) ? 'all' : newNoteVisibility;
    const authorName = user?.name || (isAttendantMode ? 'Atendente Pitoco' : 'Equipe Pitoco');

    await StorageService.addConversationNote(activeConv.id, text, authorName, visibility);
    const updatedNote = {
      id: `note-${Date.now()}`,
      text,
      author: authorName,
      created_at: new Date().toISOString(),
      visibility,
    };

    const updatedNotes = [...(activeConv.internal_notes || []), updatedNote];
    setActiveConv(prev => prev ? { ...prev, internal_notes: updatedNotes } : null);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, internal_notes: updatedNotes } : c));
    setNewNoteText('');
    success(visibility === 'admin_only' ? 'Nota Confidencial Admin salva!' : 'Nota de Atendimento adicionada!');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeConv || !isAdmin) return;
    await StorageService.deleteConversationNote(activeConv.id, noteId);
    const updatedNotes = (activeConv.internal_notes || []).filter(n => n.id !== noteId);
    setActiveConv(prev => prev ? { ...prev, internal_notes: updatedNotes } : null);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, internal_notes: updatedNotes } : c));
    info('Nota interna removida');
  };

  // 10. Modal de Edição de Dados do Cliente CRM (Apenas Admin/Gerente)
  const handleOpenEditClient = () => {
    if (!activeConv) return;
    if (!canEditClient) {
      warning('Ação Restrita', 'O painel de atendimento é apenas para visualização e não pode alterar o cadastro do cliente.');
      return;
    }
    setClientForm({
      name: activeConv.contact_name || contactInfo?.name || '',
      phone: activeConv.contact_phone || activeConv.phone || contactInfo?.phone || '',
      baby_name: contactInfo?.baby_name || '',
      due_date: contactInfo?.due_date || '',
      store_id: activeConv.store_id || contactInfo?.store_id || '',
      email: contactInfo?.email || '',
    });
    setIsEditClientModalOpen(true);
  };

  const handleSaveClientData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !canEditClient) return;

    const cleanPhone = clientForm.phone.replace(/\D/g, '');
    const selectedStore = stores.find(s => s.id === clientForm.store_id);
    const storeName = selectedStore ? selectedStore.name : activeConv.store_name;

    try {
      const updatedContact = await StorageService.saveContact({
        id: contactInfo?.id,
        name: clientForm.name.trim() || 'Cliente WhatsApp',
        phone: cleanPhone || activeConv.contact_phone || activeConv.phone,
        baby_name: clientForm.baby_name.trim(),
        due_date: clientForm.due_date.trim(),
        store_id: clientForm.store_id || null,
        store_name: storeName,
        email: clientForm.email.trim(),
        tags: contactInfo?.tags || ['Cliente WhatsApp'],
      });

      setContactInfo(updatedContact);

      const updatedConv: Conversation = {
        ...activeConv,
        contact_name: clientForm.name.trim() || activeConv.contact_name,
        contact_phone: cleanPhone || activeConv.contact_phone,
        store_id: clientForm.store_id || activeConv.store_id,
        store_name: storeName || activeConv.store_name,
      };
      setActiveConv(updatedConv);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? updatedConv : c));

      setIsEditClientModalOpen(false);
      success('Dados Atualizados', 'Perfil e CRM do cliente salvos com sucesso.');
    } catch (err: any) {
      toastError('Erro ao salvar', err?.message || 'Falha ao salvar dados do cliente.');
    }
  };

  // Utilitário para formatar tempo de espera relativo
  const getWaitingTime = (dateStr?: string) => {
    if (!dateStr) return null;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return null;
    const diffMs = Date.now() - t;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  // Filtragem estrita de conversas com controle de privacidade e permissões
  const filteredConversations = conversations.filter(conv => {
    // 1. Filtro de Lixeira
    if (statusFilter === 'trash') {
      if (!conv.is_deleted) return false;
    } else {
      if (conv.is_deleted) return false;
    }

    // 2. PRIVACIDADE DE ATENDIMENTO ASSUMIDO:
    const isAssigned = Boolean(
      conv.status === 'human' || 
      conv.assigned_to || 
      conv.assigned_attendant_name || 
      conv.assigned_attendant_id
    );

    if (!isAdmin && isAssigned) {
      const myIdentifiers = [
        user?.name?.toLowerCase().trim(),
        user?.username?.toLowerCase().trim(),
        user?.id?.toLowerCase().trim(),
      ].filter(Boolean) as string[];

      const assignedToName = (conv.assigned_to || conv.assigned_attendant_name || '').toLowerCase().trim();
      const assignedToId = (conv.assigned_attendant_id || '').toLowerCase().trim();

      const isAssignedToMe = myIdentifiers.some(id => 
        (assignedToName && (assignedToName.includes(id) || id.includes(assignedToName))) ||
        (assignedToId && assignedToId === id)
      );

      // Se a conversa foi assumida por OUTRO atendente, este operador NÃO pode ver!
      if (!isAssignedToMe) {
        return false;
      }
    }

    // 3. Busca por texto
    const matchesSearch = 
      (conv.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (conv.contact_phone || conv.phone || '').includes(searchTerm) ||
      (conv.last_message || '').toLowerCase().includes(searchTerm.toLowerCase());

    // 4. Status
    const matchesStatus = statusFilter === 'all' || statusFilter === 'trash' || conv.status === statusFilter;

    // 5. Setor
    const matchesSector = selectedSectorFilter === 'all' || (conv.sector || 'Vendas & Enxoval') === selectedSectorFilter;

    return matchesSearch && matchesStatus && matchesSector;
  });

  // ORDENAÇÃO DA FILA (FIFO vs Recente)
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const timeA = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();

    if (sortOrder === 'oldest_first') {
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    } else {
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    }
  });

  // Garantir que a conversa ativa seja permitida para o atendente atual
  useEffect(() => {
    if (activeConv && !isAdmin) {
      const isStillAllowed = sortedConversations.some(c => c.id === activeConv.id);
      if (!isStillAllowed && sortedConversations.length > 0) {
        setActiveConv(sortedConversations[0]);
      } else if (!isStillAllowed && sortedConversations.length === 0) {
        setActiveConv(null);
      }
    }
  }, [sortedConversations, activeConv, isAdmin]);

  return (
    <div 
      className={`${
        isFullscreen 
          ? 'fixed inset-0 z-50 bg-[#0c1017] p-3 h-screen w-screen flex flex-col gap-2.5' 
          : 'h-[calc(100vh-105px)] flex flex-col gap-3 font-sans'
      } select-none transition-all duration-200`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {/* 🍏 Topbar macOS Nativa (Traffic Lights + Título + Segmented Stores + Fast Controls) */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/75 backdrop-blur-xl border border-white/10 shadow-sm shrink-0">
        <div className="flex items-center gap-3.5">
          {/* macOS Traffic Lights Sutis */}
          <div className="hidden sm:flex items-center gap-1.5 px-1 py-1">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 shadow-sm inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 shadow-sm inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 shadow-sm inline-block" />
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Identidade do Aplicativo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-4 h-4 fill-slate-950 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-white tracking-tight">
                  {isAttendantMode ? 'Central de Atendimento WhatsApp' : 'Central de Atendimento Unificada'}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ao Vivo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {isAttendantMode 
                  ? 'Atenda clientes com rapidez, consulte enxovais e envie produtos do catálogo' 
                  : 'Gestão de filas, transbordo do robô e privacidade de conversas'}
              </p>
            </div>
          </div>
        </div>

        {/* Controles da Barra de Janela */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Métricas macOS Pills */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Fila de Espera: <strong>{conversations.filter(c => c.status === 'waiting_human').length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Com Você: <strong>{conversations.filter(c => (c.assigned_to === user?.name || c.assigned_attendant_name === user?.name)).length}</strong></span>
            </div>
          </div>

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          {/* Segmented Control de Lojas no Estilo Apple */}
          <div className="flex items-center bg-slate-950/70 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setSelectedStoreFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                selectedStoreFilter === 'all'
                  ? 'bg-white/20 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas as Filiais
            </button>
            {stores.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStoreFilter(s.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedStoreFilter === s.id
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.name ? s.name.replace(/^Loja\s+/i, '').slice(0, 10) : s.slug}
              </button>
            ))}
          </div>

          {/* Seletor de Setor */}
          <select
            value={selectedSectorFilter}
            onChange={(e) => setSelectedSectorFilter(e.target.value)}
            className="bg-slate-950/70 border border-white/10 text-xs text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500/60 transition-colors"
          >
            <option value="all">Setores: Todos</option>
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Botão de Tela Cheia / Restaurar */}
          <button
            type="button"
            onClick={() => setIsFullscreen(prev => !prev)}
            className={`p-1.5 rounded-xl border transition-all ${
              isFullscreen 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                : 'bg-slate-950/70 text-slate-300 border-white/10 hover:text-white hover:bg-white/5'
            }`}
            title={isFullscreen ? 'Restaurar Janela (Esc)' : 'Modo Tela Cheia (Imersivo)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 🖥️ Grid Principal Estilo macOS: 3 Colunas Integradas */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* ========================================================= */}
        {/* COLUNA 1: SIDEBAR DE CONVERSAS (macOS Messages Sidebar) */}
        {/* ========================================================= */}
        <div className={`${isCrmOpen ? 'md:col-span-3' : 'md:col-span-4'} flex flex-col h-full rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-300 shadow-sm`}>
          {/* Header da Sidebar com Busca Spotlight */}
          <div className="p-3 border-b border-white/5 space-y-2.5 bg-slate-900/40">
            {/* Campo de Busca macOS com atalho ⌘K */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar conversa ou telefone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-12 py-1.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/60 transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-slate-400 font-semibold pointer-events-none">
                ⌘K
              </span>
            </div>

            {/* Segmented Tabs de Status no padrão Apple */}
            <div className="flex items-center gap-1 p-1 bg-slate-950/70 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'waiting_human', label: 'Aguardando ⏳' },
                { id: 'human', label: 'Atendimento 👩‍💼' },
                { id: 'bot', label: 'Robô 🤖' },
                ...(isAdmin ? [{ id: 'trash', label: 'Lixeira 🗑️' }] : []),
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => handleStatusFilterChange(st.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shrink-0 transition-all ${
                    statusFilter === st.id
                      ? st.id === 'trash'
                        ? 'bg-red-500/20 text-red-300 font-semibold shadow-sm'
                        : 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Banner da Lixeira */}
            {statusFilter === 'trash' && canAdminDestructive && filteredConversations.length > 0 && (
              <div className="p-2 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center justify-between text-xs text-red-300">
                <span>{filteredConversations.length} conversas na lixeira</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Deseja excluir permanentemente todas as conversas da lixeira?')) return;
                    await StorageService.purgeAllTrashConversations();
                    setConversations(prev => prev.filter(c => !c.is_deleted));
                    success('Lixeira esvaziada com sucesso!');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-red-900 hover:bg-red-800 text-white text-[10px] font-bold transition-all"
                >
                  Esvaziar
                </button>
              </div>
            )}

            {/* Controle de Ordenação FIFO */}
            <div className="flex items-center justify-between text-[10.5px] pt-1">
              <span className="text-slate-400 font-medium">Ordem:</span>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'oldest_first' ? 'newest_first' : 'oldest_first')}
                className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
                title="Alternar ordem de exibição"
              >
                <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                <span className="font-semibold text-emerald-300">
                  {sortOrder === 'oldest_first' ? '⏳ Fila por Espera (FIFO)' : '⚡ Mais Recentes'}
                </span>
              </button>
            </div>
          </div>

          {/* Lista Rolável de Chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1.5 space-y-1">
            {sortedConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {statusFilter === 'trash' 
                  ? 'A lixeira está vazia.' 
                  : !isAdmin && statusFilter === 'human'
                  ? 'Você não possui atendimentos assumidos no momento.'
                  : 'Nenhuma conversa encontrada.'}
              </div>
            ) : (
              sortedConversations.map((conv, index) => {
                const isActive = activeConv?.id === conv.id;
                const isWaiting = conv.status === 'waiting_human';
                const isDeleted = conv.is_deleted;
                const waitingTime = getWaitingTime(conv.last_message_at || conv.updated_at || conv.created_at);
                const isAssignedToMe = (conv.assigned_to === user?.name || conv.assigned_attendant_name === user?.name);

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConv(conv)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all relative ${
                      isActive 
                        ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20' 
                        : 'hover:bg-white/[0.04] text-slate-300'
                    } ${isDeleted ? 'opacity-65 bg-red-950/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar macOS */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white text-xs font-bold border border-white/10 shadow-inner">
                            {conv.profile_pic ? (
                              <img src={conv.profile_pic} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (conv.contact_name || 'C')[0]
                            )}
                          </div>
                          {/* Dot de Status Online/Ativo */}
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            isWaiting 
                              ? 'bg-amber-400 animate-pulse' 
                              : conv.status === 'human' 
                              ? 'bg-emerald-400' 
                              : 'bg-slate-500'
                          }`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold text-white truncate max-w-[130px]">
                              {conv.contact_name || 'Cliente WhatsApp'}
                            </h4>
                            {isWaiting && sortOrder === 'oldest_first' && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                #{index + 1}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">
                            {conv.contact_phone || conv.phone}
                          </span>
                        </div>
                      </div>

                      {/* Tempo / Status */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        {isWaiting && waitingTime ? (
                          <span className="text-[10px] font-mono text-amber-300 font-semibold flex items-center gap-0.5">
                            ⏳ {waitingTime}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {conv.last_message_at 
                              ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        )}

                        {isAssignedToMe && (
                          <span className="text-[9px] font-bold text-emerald-400">
                            ✓ Seu Chat
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prévia da Mensagem */}
                    <p className="text-[11px] text-slate-400 truncate mt-1.5 pl-11">
                      {conv.last_message || 'Início da conversa'}
                    </p>

                    {/* Rodapé do Card: Setor e Ação Rápida */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.04] text-[10px] text-slate-400 pl-11">
                      <span className="truncate max-w-[100px] text-slate-400 font-medium">
                        📍 {conv.store_name ? conv.store_name.replace('Loja ', '') : 'Rede'} • {conv.sector || 'Vendas'}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isDeleted && conv.assigned_to !== (user?.name || (isCEO ? 'Malaca CEO' : isAdmin ? 'Administrador Geral' : isManager ? 'Gerente' : 'Sofia Consultora VIP')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssumeConversation(conv);
                            }}
                            className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1"
                          >
                            <UserCheck className="w-2.5 h-2.5" />
                            Assumir
                          </button>
                        )}

                        {canAdminDestructive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/15 transition-all"
                            title="Apagar conversa permanentemente"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUNA 2: ÁREA PRINCIPAL DE CHAT (macOS Message Window) */}
        {/* ========================================================= */}
        <div className={`flex flex-col h-full rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-300 shadow-sm ${isCrmOpen ? 'md:col-span-6' : 'md:col-span-8'}`}>
          {activeConv ? (
            <>
              {/* Header do Chat Ativo */}
              <div className="px-4 py-3 border-b border-white/5 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white text-sm font-bold border border-white/10 shrink-0">
                    {(activeConv.contact_name || 'C')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs md:text-sm font-bold text-white truncate">
                        {activeConv.contact_name || 'Cliente WhatsApp'}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-medium">
                        {activeConv.store_name || 'Rede Geral'}
                      </span>
                    </div>
                    
                    {/* Seletor de Setor no Header */}
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                      <span>Setor:</span>
                      <select
                        value={activeConv.sector || 'Vendas & Enxoval'}
                        onChange={(e) => handleSectorChange(e.target.value)}
                        className="bg-transparent text-emerald-300 font-bold focus:outline-none cursor-pointer hover:underline"
                      >
                        {sectors.map(sec => (
                          <option key={sec} value={sec} className="bg-slate-900 text-white">{sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Ações da Janela de Chat */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Badge Blindado */}
                  {activeConv.status === 'human' && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-semibold" title="Atendimento Humano Ativo">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Blindado</span>
                    </div>
                  )}

                  {/* Alternar Gaveta CRM */}
                  <button
                    type="button"
                    onClick={() => setIsCrmOpen(!isCrmOpen)}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all ${
                      isCrmOpen 
                        ? 'bg-white/20 text-white border-white/30 shadow-sm' 
                        : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-slate-300" />
                    <span>{isCrmOpen ? 'Fechar Dossiê' : 'Dossiê do Cliente'}</span>
                  </button>

                  {/* Assumir / Devolver para o Robô */}
                  {!activeConv.is_deleted && (
                    <>
                      {activeConv.status === 'human' && activeConv.assigned_to === (user?.name || (isCEO ? 'Malaca CEO' : isAdmin ? 'Administrador Geral' : isManager ? 'Gerente' : 'Sofia Consultora VIP')) ? (
                        <button
                          type="button"
                          onClick={handleTransferToBot}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-white/10 text-slate-300 hover:text-white transition-all"
                          title="Devolver para o Robô"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Robô</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAssumeConversation()}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:scale-102 active:scale-98 transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{activeConv.assigned_to ? `Assumir (${activeConv.assigned_to.split(' ')[0]})` : 'Assumir'}</span>
                        </button>
                      )}

                      {/* Transferir */}
                      <button
                        type="button"
                        onClick={() => setIsTransferModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-white/10 text-slate-300 hover:text-white transition-all"
                        title="Transferir para outro operador ou fila"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Transferir</span>
                      </button>

                      {/* Exportar Transcrição */}
                      <button
                        type="button"
                        onClick={handleExportTranscript}
                        className="p-1.5 rounded-xl bg-slate-950/70 border border-white/10 text-slate-400 hover:text-white transition-all"
                        title="Baixar histórico (.txt)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Limpar e Apagar */}
                      {canAdminDestructive && (
                        <>
                          <button
                            type="button"
                            onClick={handleClearHistory}
                            className="p-1.5 rounded-xl bg-slate-950/70 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all"
                            title="Limpar histórico"
                          >
                            <Eraser className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConversation(activeConv)}
                            className="p-1.5 rounded-xl bg-slate-950/70 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                            title="Apagar conversa permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Feed de Mensagens (Estilo macOS / iOS Messages) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0e14]/60">
                {activeConv.is_deleted && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
                    <span>⚠️ Esta conversa está na <strong>Lixeira</strong>. Restaure para responder.</span>
                    {canAdminDestructive && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleRestoreConversation(activeConv.id)}
                          className="text-xs bg-red-800 hover:bg-red-700 text-white h-6 px-2.5 rounded-lg"
                        >
                          Restaurar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePurgeConversation(activeConv.id)}
                          className="text-xs bg-red-950 hover:bg-red-900 text-red-200 border border-red-500/40 h-6 px-2.5 rounded-lg"
                        >
                          Excluir Definitivo
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                    <MessageSquare className="w-8 h-8 text-slate-600" />
                    <span>Nenhuma mensagem nesta conversa ainda.</span>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={`group flex flex-col ${isOutbound ? 'items-end' : 'items-start'} relative`}
                      >
                        <div
                          className={`max-w-[75%] rounded-[18px] px-3.5 py-2.5 text-xs shadow-sm relative group/msg ${
                            isOutbound
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-[4px] font-normal shadow-emerald-950/20'
                              : 'bg-slate-800/90 text-slate-100 border border-white/5 rounded-bl-[4px]'
                          }`}
                        >
                          {/* Ação de Apagar Mensagem no Hover (Admin) */}
                          {canAdminDestructive && !activeConv.is_deleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Deseja apagar esta mensagem individual?')) {
                                  handleDeleteMessage(msg.id);
                                }
                              }}
                              title="Apagar esta mensagem"
                              className="absolute -top-2 -right-2 p-1 rounded-full bg-slate-900 border border-red-500/40 text-red-400 opacity-0 group-hover/msg:opacity-100 hover:bg-red-500/20 transition-all shadow-md z-10"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}

                          {!isOutbound && (
                            <span className="block text-[10px] text-emerald-400 font-bold mb-0.5">
                              {msg.author_name || activeConv.contact_name || 'Cliente'}
                            </span>
                          )}

                          {/* Foto de Produto Anexa */}
                          {msg.media_url && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-w-[220px]">
                              <img 
                                src={msg.media_url} 
                                alt="Anexo de Produto" 
                                className="w-full h-auto object-cover max-h-48" 
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                          )}

                          <p className="whitespace-pre-wrap leading-relaxed select-text">{msg.content}</p>
                          <span
                            className={`block text-[9px] mt-1 text-right font-mono ${
                              isOutbound ? 'text-emerald-100/70' : 'text-slate-400'
                            }`}
                          >
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra Flutuante de Composição de Mensagens (macOS Floating Bar) */}
              <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-900/80 backdrop-blur-md border-t border-white/5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenCatalog}
                  disabled={activeConv.is_deleted}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold transition-all shrink-0"
                  title="Abrir catálogo para enviar peças"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Peças</span>
                </button>

                <div className="flex-1 relative">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={inputText}
                    disabled={activeConv.is_deleted}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={activeConv.is_deleted ? 'Conversa na lixeira.' : 'Escreva uma mensagem para o cliente...'}
                    className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/60 disabled:opacity-50 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending || activeConv.is_deleted}
                  className="p-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 font-bold text-xs transition-all shrink-0 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              Selecione uma conversa ao lado para iniciar o atendimento.
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* COLUNA 3: DOSSIÊ DO CLIENTE / CRM (macOS Inspector Panel) */}
        {/* ========================================================= */}
        {isCrmOpen && (
          <div className="md:col-span-3 flex flex-col h-full rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 overflow-hidden p-3.5 shadow-sm animate-in slide-in-from-right-3 duration-200">
            {/* Header do Dossiê */}
            <div className="border-b border-white/5 pb-2.5 mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Dossiê & CRM
              </h3>
              <div className="flex items-center gap-1">
                {activeConv && canEditClient && (
                  <button
                    type="button"
                    onClick={handleOpenEditClient}
                    className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1"
                    title="Editar dados cadastrais"
                  >
                    <Edit3 className="w-3 h-3" />
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCrmOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Fechar (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {activeConv ? (
              <div className="space-y-3.5 text-xs overflow-y-auto pr-1">
                {/* Cartão de Enxoval */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Dados do Enxoval
                  </span>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Nome do Bebê:</span>
                    <span className="font-semibold text-white">{contactInfo?.baby_name || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Data Prevista (DPP):</span>
                    <span className="font-semibold text-emerald-300">{contactInfo?.due_date || 'Não informada'}</span>
                  </div>
                  {contactInfo?.email && (
                    <div className="flex items-center justify-between text-slate-300">
                      <span>E-mail:</span>
                      <span className="font-medium text-slate-200 truncate max-w-[130px]">{contactInfo.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Filial:</span>
                    <span className="font-medium text-white">{activeConv.store_name || 'Rede'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Operador:</span>
                    <span className="font-semibold text-emerald-400">{activeConv.assigned_to || 'Robô Pitoco'}</span>
                  </div>
                </div>

                {/* Gerenciamento de Tags */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      Tags do Cliente
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {contactInfo?.tags?.length || 0} tag(s)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 min-h-[26px] items-center">
                    {(contactInfo?.tags && contactInfo.tags.length > 0) ? (
                      contactInfo.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-slate-300 border border-white/10"
                        >
                          {tag}
                          {canEditClient && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Sem tags vinculadas</span>
                    )}
                  </div>

                  {canEditClient && (
                    <div className="flex items-center gap-1 pt-1">
                      <input
                        type="text"
                        placeholder="Nova tag..."
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(e);
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleAddTag(e)}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Notas Internas */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      Notas Internas
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {(activeConv.internal_notes || []).filter(n => isAdmin || n.visibility !== 'admin_only').length} nota(s)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(activeConv.internal_notes || [])
                      .filter(n => isAdmin || n.visibility !== 'admin_only')
                      .map(note => {
                        const isConfidential = note.visibility === 'admin_only';
                        return (
                          <div 
                            key={note.id} 
                            className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                              isConfidential 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                                : 'bg-slate-900 border-white/5 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[9px] text-slate-400">
                              <span className="flex items-center gap-1 font-semibold text-white">
                                {isConfidential && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                                {note.author}
                              </span>
                              <div className="flex items-center gap-1">
                                <span>{new Date(note.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap leading-tight">{note.text}</p>
                          </div>
                        );
                      })}
                    {(activeConv.internal_notes || []).filter(n => isAdmin || n.visibility !== 'admin_only').length === 0 && (
                      <p className="text-[10px] text-slate-500 italic">Nenhuma anotação nesta conversa.</p>
                    )}
                  </div>

                  {/* Adicionar Nota */}
                  <form onSubmit={handleAddNote} className="space-y-1.5 pt-1 border-t border-white/5">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Adicionar nota interna..."
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-white/30 resize-none"
                    />
                    
                    <div className="flex items-center justify-between gap-1">
                      {isAdmin ? (
                        <select
                          value={newNoteVisibility}
                          onChange={(e) => setNewNoteVisibility(e.target.value as any)}
                          className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none"
                        >
                          <option value="all">Nota Equipe</option>
                          <option value="admin_only">🔒 Confidencial</option>
                        </select>
                      ) : (
                        <span className="text-[10px] text-slate-400">Nota Equipe</span>
                      )}

                      <button
                        type="submit"
                        disabled={!newNoteText.trim()}
                        className="bg-white text-slate-950 hover:bg-slate-200 text-[10px] font-bold h-6 px-2.5 rounded-lg transition-all"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 text-xs py-8">
                Nenhum contato selecionado.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: Catálogo de Produtos & Peças */}
      {/* ========================================================= */}
      {isCatalogModalOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Catálogo de Peças & Enxovais</h3>
                  <p className="text-xs text-slate-400">Envie foto e detalhes direto no WhatsApp de {activeConv.contact_name || activeConv.phone}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar peça por nome ou referência..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-1">
              {catalogProducts
                .filter(prod => {
                  return prod.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                         (prod.description || '').toLowerCase().includes(catalogSearch.toLowerCase());
                })
                .map(prod => (
                  <div 
                    key={prod.id} 
                    className="p-3 rounded-xl bg-slate-950 border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg bg-slate-900 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                        {prod.image_url ? (
                          <img 
                            src={prod.image_url} 
                            alt={prod.name} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate" title={prod.name}>
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-emerald-400">
                            R$ {prod.price.toFixed(2)}
                          </span>
                          {prod.promotional_price && (
                            <span className="text-[10px] text-slate-400 line-through">
                              R$ {prod.promotional_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          Tamanhos: {(prod.sizes || []).join(', ') || 'Único'}
                        </p>
                      </div>
                    </div>

                    <button
                      disabled={isSendingProduct}
                      onClick={() => handleSendProductToChat(prod)}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold h-8 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar no WhatsApp
                    </button>
                  </div>
                ))}
              {catalogProducts.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
                  Nenhum produto cadastrado no catálogo.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCatalogModalOpen(false)}
                className="border-white/10 text-slate-300 text-xs rounded-xl"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Edição de Dados do Cliente CRM */}
      {/* ========================================================= */}
      {isEditClientModalOpen && activeConv && canEditClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Editar Perfil do Cliente</h3>
                  <p className="text-xs text-slate-400">Atualizar dados do bebê, DPP e contato</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditClientModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClientData} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome Completo:</label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    placeholder="Mariana Silva"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">WhatsApp / Telefone:</label>
                  <input
                    type="text"
                    required
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="5581999999999"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nome do Bebê:</label>
                  <input
                    type="text"
                    value={clientForm.baby_name}
                    onChange={(e) => setClientForm({ ...clientForm, baby_name: e.target.value })}
                    placeholder="Theo / Sofia"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Data Prevista (DPP):</label>
                  <input
                    type="text"
                    value={clientForm.due_date}
                    onChange={(e) => setClientForm({ ...clientForm, due_date: e.target.value })}
                    placeholder="Ex: Dezembro / 2026"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Filial Vinculada:</label>
                  <select
                    value={clientForm.store_id}
                    onChange={(e) => setClientForm({ ...clientForm, store_id: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="">Selecione a filial...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">E-mail (opcional):</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditClientModalOpen(false)}
                  className="border-white/10 hover:bg-white/5 text-slate-300 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Transferência de Atendimento */}
      {/* ========================================================= */}
      {isTransferModalOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Transferir Atendimento</h3>
                  <p className="text-xs text-slate-400">Direcione para outro atendente ou para a fila geral</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Cliente:</label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 text-white font-medium">
                  {activeConv.contact_name || 'Cliente WhatsApp'} ({activeConv.contact_phone || activeConv.phone})
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Destino:</label>
                <select
                  value={transferTargetAttendant}
                  onChange={(e) => setTransferTargetAttendant(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="">Selecione o destino...</option>
                  <option value="__unassigned__" className="text-amber-400 font-bold">
                    🔓 Devolver para a Fila Geral (Qualquer Atendente pode assumir)
                  </option>
                  <optgroup label="Equipe e Atendentes">
                    {attendants.map((att) => (
                      <option key={att.id} value={att.name || att.username}>
                        👤 {att.name || att.username} ({att.role.toUpperCase()})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  {transferTargetAttendant === '__unassigned__' 
                    ? 'A conversa voltará para o status "Aguardando", visível para toda a equipe na fila.'
                    : 'A conversa será atribuída diretamente ao atendente escolhido, garantindo privacidade.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferModalOpen(false)}
                className="border-white/10 hover:bg-white/5 text-slate-300 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <button
                onClick={handleTransferConversation}
                disabled={!transferTargetAttendant}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all shadow-sm"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
