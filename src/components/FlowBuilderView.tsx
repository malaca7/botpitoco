import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  GitFork, 
  Play, 
  Save, 
  Plus, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Store as StoreIcon, 
  ShoppingBag, 
  Calendar, 
  CreditCard, 
  Truck, 
  Users, 
  MessageSquare,
  ShieldCheck,
  Edit3,
  Trash2,
  Copy,
  Power,
  Search,
  Check,
  X,
  ArrowRight,
  HelpCircle,
  Clock,
  Palette,
  RefreshCw,
  GripVertical
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { FlowEditorPage } from '../pages/flows/FlowEditorPage';
import { StorageService } from '../lib/storage';
import { Flow, FlowStep, NodeTypeEnum, Store, FlowNode, FlowEdge } from '../types';

export const FLOW_COLORS = [
  { id: 'emerald', hex: '#10b981', label: 'Verde Pitoco' },
  { id: 'blue', hex: '#3b82f6', label: 'Azul Safira' },
  { id: 'purple', hex: '#a855f7', label: 'Roxo Neon' },
  { id: 'pink', hex: '#ec4899', label: 'Rosa Bebê' },
  { id: 'amber', hex: '#f59e0b', label: 'Âmbar Sol' },
  { id: 'cyan', hex: '#06b6d4', label: 'Ciano Elétrico' },
  { id: 'slate', hex: '#64748b', label: 'Ardósia / Neutro' },
];

interface FlowBuilderViewProps {
  onNavigate?: (path: string) => void;
}

export const FlowBuilderView: React.FC<FlowBuilderViewProps> = ({ onNavigate }) => {
  const { success, error: toastError, info } = useToast();

  const [flows, setFlows] = useState<Flow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modo de visualização: 'list' (gerenciador tradicional) ou 'studio' (Studio Visual)
  const [viewMode, setViewMode] = useState<'list' | 'studio'>('list');
  const [studioFlowId, setStudioFlowId] = useState<string>('');

  // Modal de Criação / Edição de Fluxo
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowTrigger, setFlowTrigger] = useState('Qualquer Mensagem Recebida');
  const [flowKeywords, setFlowKeywords] = useState('');
  const [flowStoreId, setFlowStoreId] = useState<string>('all');
  const [flowActive, setFlowActive] = useState(true);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [flowColor, setFlowColor] = useState<string>('#10b981');
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);

  // Drag and Drop State para reordenação dos cards
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Carregar dados com suporte a atualização silenciosa em tempo real
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [flowsData, storesData] = await Promise.all([
        StorageService.getFlows(),
        StorageService.getStores(),
      ]);

      // Preservar ordem estável salva (localStorage ou order_index estável)
      let savedOrder: string[] = [];
      try {
        const raw = localStorage.getItem('pitoco_flows_order');
        if (raw) savedOrder = JSON.parse(raw);
      } catch {}

      const sorted = [...flowsData].sort((a, b) => {
        if (savedOrder.length > 0) {
          const idxA = savedOrder.indexOf(a.id);
          const idxB = savedOrder.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
        }
        const oA = typeof a.order_index === 'number' ? a.order_index : 9999;
        const oB = typeof b.order_index === 'number' ? b.order_index : 9999;
        if (oA !== oB) return oA - oB;
        return (a.name || '').localeCompare(b.name || '');
      });

      setFlows(sorted);
      setStores(storesData);
    } catch (err) {
      console.error('Erro ao sincronizar fluxos em tempo real:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Auto-sincronização contínua em segundo plano com o banco de dados e servidor
  const autoSyncWithDatabase = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsSyncing(true);
    try {
      const refreshedFlows = await StorageService.syncWithDatabase();
      
      let savedOrder: string[] = [];
      try {
        const raw = localStorage.getItem('pitoco_flows_order');
        if (raw) savedOrder = JSON.parse(raw);
      } catch {}

      const sorted = [...refreshedFlows].sort((a, b) => {
        if (savedOrder.length > 0) {
          const idxA = savedOrder.indexOf(a.id);
          const idxB = savedOrder.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
        }
        const oA = typeof a.order_index === 'number' ? a.order_index : 9999;
        const oB = typeof b.order_index === 'number' ? b.order_index : 9999;
        if (oA !== oB) return oA - oB;
        return (a.name || '').localeCompare(b.name || '');
      });

      setFlows(sorted);
    } catch (err: any) {
      console.warn('[FlowBuilderView] Auto-sync em segundo plano:', err?.message || err);
    } finally {
      if (showIndicator) setIsSyncing(false);
    }
  }, []);

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...flows];
    const [movedFlow] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedFlow);

    const withOrder = updated.map((f, idx) => ({ ...f, order_index: idx }));
    setFlows(withOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);

    await StorageService.saveFlowsOrder(withOrder);
    success('Ordem Atualizada!', 'A nova ordem dos cards de fluxos foi gravada com sucesso.');
  };

  useEffect(() => {
    loadData(false);
    // Auto-sincronização inicial em segundo plano
    autoSyncWithDatabase(false);

    // 1. Inscrição em tempo real no Supabase (Realtime Postgres Changes)
    const unsubscribeRealtime = StorageService.subscribeToFlows(() => {
      if (!isFlowModalOpen && !isSavingFlow) {
        autoSyncWithDatabase(true);
      }
    });

    // 2. Atualização local contínua a cada 4 segundos
    const syncTimer = setInterval(() => {
      if (!isFlowModalOpen && !isSavingFlow) {
        loadData(true);
      }
    }, 4000);

    // 3. Sincronização periódica profunda com o banco a cada 15 segundos
    const deepSyncTimer = setInterval(() => {
      if (!isFlowModalOpen && !isSavingFlow) {
        autoSyncWithDatabase(false);
      }
    }, 15000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pitoco_flows') {
        loadData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribeRealtime();
      clearInterval(syncTimer);
      clearInterval(deepSyncTimer);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadData, autoSyncWithDatabase, isFlowModalOpen, isSavingFlow]);

  // Atualizar cor do fluxo diretamente pelo card
  const handleUpdateFlowColor = async (flow: Flow, newColor: string) => {
    try {
      await StorageService.saveFlow({ id: flow.id, color: newColor });
      setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, color: newColor } : f));
      success('Cor do Fluxo Atualizada!', `A cor do fluxo "${flow.name}" foi alterada com sucesso.`);
    } catch (err: any) {
      toastError('Erro ao atualizar cor', err.message);
    }
  };

  // Abrir Modal de Criação
  const handleOpenCreateFlow = () => {
    setEditingFlow(null);
    setFlowName('');
    setFlowDescription('');
    setFlowTrigger('Qualquer Mensagem Recebida');
    setFlowKeywords('');
    setFlowStoreId('all');
    setFlowActive(true);
    setFlowColor('#10b981');
    setFlowSteps([
      { id: `step-${Date.now()}-1`, title: 'Gatilho de Mensagem Recebida', type: 'trigger', category: 'Início', description: 'Dispara quando o cliente envia qualquer texto.' },
      { id: `step-${Date.now()}-2`, title: 'Boas-Vindas Pitoco de Gente', type: 'message', category: 'Atendimento', description: 'Saudação com menu de opções de 1 a 7.' },
      { id: `step-${Date.now()}-3`, title: 'Catálogo de Bebês & Enxoval', type: 'show_catalog', category: 'Vendas', description: 'Exibe bodies, macacões e saídas de maternidade.' },
      { id: `step-${Date.now()}-4`, title: 'Transbordo Humano por Filial', type: 'human_handoff', category: 'Multi-Lojas', description: 'Direciona conversa para a equipe da loja física.' },
    ]);
    setIsFlowModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditFlow = (flow: Flow) => {
    setEditingFlow(flow);
    setFlowName(flow.name);
    setFlowDescription(flow.description);
    const trig = flow.trigger_type || 'Qualquer Mensagem Recebida';
    setFlowTrigger(trig);
    const existingKw = (flow as any).keywords || (flow as any).trigger_keywords || '';
    if (trig.toLowerCase().includes('palavra') || trig.toLowerCase().includes('keyword')) {
      setFlowKeywords(Array.isArray(existingKw) ? existingKw.join(', ') : String(existingKw));
    } else {
      setFlowKeywords('');
    }
    setFlowStoreId(flow.store_id || 'all');
    setFlowActive(flow.is_active !== false);
    setFlowColor(flow.color || '#10b981');
    setFlowSteps(flow.steps && flow.steps.length > 0 ? [...flow.steps] : [
      { id: `step-1`, title: 'Gatilho Inicial', type: 'trigger', category: 'Início', description: 'Disparo do fluxo' },
      { id: `step-2`, title: 'Mensagem de Atendimento', type: 'message', category: 'Atendimento', description: 'Apresentação do menu' },
    ]);
    setIsFlowModalOpen(true);
  };

  // Salvar Fluxo (Criar ou Atualizar)
  const handleSaveFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowName.trim()) {
      toastError('Aviso', 'Informe o nome do fluxo.');
      return;
    }

    setIsSavingFlow(true);
    try {
      const assignedStore = stores.find(s => s.id === flowStoreId);
      const storeName = flowStoreId === 'all' ? 'Toda a Rede (Global)' : assignedStore?.name;
      const newFlowId = editingFlow?.id || `flow-${Date.now()}`;
      const isKeywordTrigger = flowTrigger.toLowerCase().includes('palavra') || flowTrigger.toLowerCase().includes('keyword');
      const finalKeywords = isKeywordTrigger ? flowKeywords.trim() : '';

      // Se for criação de novo fluxo, inicializar nós iniciais no Studio imediatamente
      if (!editingFlow) {
        const initialNodes: FlowNode[] = [
          {
            id: `node-trigger-${Date.now()}`,
            type: 'trigger',
            position: { x: 320, y: 100 },
            data: {
              label: 'Gatilho Inicial',
              nodeType: 'trigger',
              description: isKeywordTrigger 
                ? `Dispara com palavras-chave: ${finalKeywords || 'configuradas'}` 
                : 'Dispara quando o cliente envia qualquer mensagem no WhatsApp',
              isConfigured: true,
              config: {
                eventType: isKeywordTrigger ? 'keyword' : 'any_message',
                keywords: finalKeywords,
                matchType: 'contains',
              },
            },
          },
          {
            id: `node-message-${Date.now() + 1}`,
            type: 'message',
            position: { x: 320, y: 320 },
            data: {
              label: 'Boas-Vindas',
              nodeType: 'message',
              description: 'Mensagem de recepção do cliente',
              isConfigured: true,
              config: {
                text: '👶✨ Olá! Seja muito bem-vindo(a) à {{empresa}}!\nComo podemos te ajudar hoje?',
                previewUrl: false,
              },
            },
          },
        ];
        const initialEdges: FlowEdge[] = [
          {
            id: `edge-${Date.now()}`,
            source: initialNodes[0].id,
            target: initialNodes[1].id,
            animated: true,
          },
        ];
        await StorageService.saveFlowGraph(newFlowId, initialNodes, initialEdges);
      } else {
        // Se estiver editando fluxo existente, sincroniza as palavras-chave no nó de gatilho
        try {
          const [nodes, edges] = await StorageService.getFlowGraph(editingFlow.id);
          const triggerNode = nodes.find(n => (n.data?.nodeType || n.type) === 'trigger');
          if (triggerNode) {
            if (!triggerNode.data) triggerNode.data = {} as any;
            if (!triggerNode.data.config) triggerNode.data.config = {};
            triggerNode.data.config.eventType = isKeywordTrigger ? 'keyword' : 'any_message';
            triggerNode.data.config.keywords = finalKeywords;
            triggerNode.data.description = isKeywordTrigger 
              ? `Dispara com palavras-chave: ${finalKeywords || 'configuradas'}` 
              : 'Dispara quando o cliente envia qualquer mensagem no WhatsApp';
            await StorageService.saveFlowGraph(editingFlow.id, nodes, edges);
          }
        } catch (graphErr) {
          console.warn('Aviso ao sincronizar nós do gatilho:', graphErr);
        }
      }

      const flowPayload: Partial<Flow> = {
        id: newFlowId,
        name: flowName.trim(),
        description: flowDescription.trim(),
        trigger_type: flowTrigger,
        keywords: finalKeywords,
        trigger_keywords: finalKeywords,
        store_id: flowStoreId === 'all' ? null : flowStoreId,
        store_name: storeName,
        is_active: flowActive,
        status: flowActive ? 'published' : 'draft',
        version: editingFlow ? (editingFlow.version + 1) : 1,
        node_count: editingFlow ? (editingFlow.node_count || 2) : 2,
        steps: flowSteps,
        color: flowColor,
        created_at: editingFlow?.created_at || new Date().toISOString(),
      };

      const saved = await StorageService.saveFlow(flowPayload);
      success(
        editingFlow ? 'Fluxo Atualizado!' : 'Novo Fluxo Criado!',
        `O fluxo "${saved.name}" foi salvo e sincronizado com sucesso.`
      );
      setIsFlowModalOpen(false);
      await loadData();
    } catch (err: any) {
      toastError('Erro ao salvar fluxo', err.message);
    } finally {
      setIsSavingFlow(false);
    }
  };

  // Alternar Ativar / Desativar (Suporta múltiplos fluxos ativos independentes)
  const handleToggleFlowStatus = async (flow: Flow) => {
    const nextActive = !flow.is_active || flow.status !== 'published';
    // 1. Atualização otimista na interface (mantém os outros fluxos exatamente como estão)
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, is_active: nextActive, status: nextActive ? 'published' : 'draft' } : f));

    try {
      const updated = await StorageService.toggleFlowStatus(flow.id);
      if (updated) {
        setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, is_active: updated.is_active, status: updated.status } : f));
        const actionText = updated.is_active ? 'ativado e publicado' : 'pausado / desativado';
        success(`Fluxo "${updated.name}" ${actionText}!`);
        await loadData(true);
      }
    } catch (err: any) {
      // Reverter em caso de erro
      setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, is_active: flow.is_active, status: flow.status } : f));
      toastError('Erro ao alternar status do fluxo', err.message);
      await loadData(true);
    }
  };

  // Duplicar Fluxo
  const handleDuplicateFlow = async (flow: Flow) => {
    try {
      const clonePayload: Partial<Flow> = {
        name: `${flow.name} (Cópia)`,
        description: flow.description,
        trigger_type: flow.trigger_type,
        store_id: flow.store_id,
        store_name: flow.store_name,
        is_active: false,
        status: 'draft',
        version: 1,
        node_count: flow.node_count || 4,
        steps: flow.steps ? JSON.parse(JSON.stringify(flow.steps)) : [],
        color: flow.color || '#10b981',
      };
      await StorageService.saveFlow(clonePayload);
      success('Fluxo Duplicado!', 'Uma cópia em rascunho foi criada com sucesso.');
      loadData();
    } catch (err: any) {
      toastError('Erro ao duplicar fluxo', err.message);
    }
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!flowToDelete) return;
    try {
      await StorageService.deleteFlow(flowToDelete.id);
      success('Fluxo Excluído', `O fluxo "${flowToDelete.name}" foi removido.`);
      setFlowToDelete(null);
      loadData();
    } catch (err: any) {
      toastError('Erro ao excluir fluxo', err.message);
    }
  };

  // Adicionar Passo ao Fluxo no Modal
  const handleAddStep = (type: NodeTypeEnum, title: string, category: string, desc: string) => {
    setFlowSteps(prev => [
      ...prev,
      {
        id: `step-${Date.now()}-${prev.length + 1}`,
        title,
        type,
        category,
        description: desc,
      }
    ]);
  };

  // Remover Passo do Fluxo no Modal
  const handleRemoveStep = (index: number) => {
    setFlowSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Abrir Visual Studio N8N / BotGhost
  const handleOpenStudio = (flowId?: string) => {
    const targetId = flowId || selectedFlowForSteps?.id || flows[0]?.id || 'flow-principal-pitoco';
    setStudioFlowId(targetId);
    setViewMode('studio');
  };

  // Filtragem de Fluxos
  const filteredFlows = useMemo(() => {
    return flows.filter(f => {
      const matchSearch = 
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.trigger_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.store_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [flows, searchTerm]);

  // Contadores
  const activeFlowsCount = useMemo(() => flows.filter(f => f.is_active).length, [flows]);

  // Se o usuário estiver no modo Studio Visual N8N / BotGhost (Tela Cheia Imersiva)
  if (viewMode === 'studio') {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-dark-950 flex flex-col overflow-hidden m-0 p-0">
        <FlowEditorPage
          flowId={studioFlowId || flows[0]?.id || 'flow-principal-pitoco'}
          onNavigate={(path) => {
            if (path === '/fluxos') {
              setViewMode('list');
              loadData();
            } else if (onNavigate) {
              onNavigate(path);
            }
          }}
          onBack={() => {
            setViewMode('list');
            loadData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-dark-900 border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pitoco-blue/20 text-pitoco-blue border border-pitoco-blue/30 flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5" />
              Gestão de Fluxos do WhatsApp
            </span>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {activeFlowsCount} Fluxo(s) Ativo(s) no Robô
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            Árvores de Atendimento, Vendas & Encaminhamento
          </h2>
          <p className="text-xs text-slate-400">
            Crie, edite, ative/desative e gerencie as automações do bot com suporte a multi-lojas e transbordo humano.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Indicador de Auto-Sincronização em Tempo Real (Substitui o botão manual) */}
          <div 
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-xs transition-all select-none"
            title="Sincronização automática contínua em segundo plano com o banco de dados e robô"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${isSyncing ? 'opacity-90 duration-700' : 'opacity-60'}`}></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="font-mono text-[11px]">
              {isSyncing ? 'Sincronizando em 2º plano...' : 'Banco Conectado em Tempo Real'}
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleOpenCreateFlow}
            className="bg-pitoco-blue text-slate-900 hover:bg-pitoco-blue/90 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-glow-primary"
          >
            <Plus className="w-4 h-4" />
            Novo Fluxo
          </Button>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-dark-900 border border-white/10">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do fluxo, gatilho ou filial..."
            className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pitoco-blue"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {flows.filter(f => f.is_active || f.status === 'published').length} Ativos no WhatsApp
          </span>
          <span className="text-xs text-slate-400">
            Total: <strong className="text-white">{filteredFlows.length}</strong> fluxo(s)
          </span>
        </div>
      </div>

      {/* Lista Principal de Fluxos com Suporte a Drag & Drop */}
      <div className="w-full space-y-4">
        {filteredFlows.map((flow, index) => {
          const currentFlowColor = flow.color || '#10b981';
          const isBeingDragged = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <Card 
              key={flow.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              className={`p-5 bg-dark-900 border transition-all relative overflow-hidden ${
                isBeingDragged ? 'opacity-40 scale-[0.98] ring-2 ring-pitoco-blue' : ''
              } ${
                isDragOver ? 'border-pitoco-blue ring-2 ring-pitoco-blue/50 shadow-xl' : ''
              } ${
                flow.is_active 
                  ? 'border-white/10 hover:border-white/25 shadow-md' 
                  : 'border-white/5 opacity-70 bg-dark-950/50'
              }`}
              style={{
                borderLeft: `4px solid ${currentFlowColor}`,
              }}
            >
              {/* Linha indicadora de drop acima */}
              {isDragOver && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-pitoco-blue animate-pulse z-10" />
              )}

              {/* Cabeçalho do Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  {/* Alça Drag & Drop (Arrastar para reordenar) */}
                  <div 
                    className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
                    title="Segure e arraste para alterar a ordem deste fluxo"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div 
                    className="p-2.5 rounded-xl border transition-all shadow-sm"
                    style={{
                      backgroundColor: `${currentFlowColor}15`,
                      borderColor: `${currentFlowColor}35`,
                      color: currentFlowColor,
                    }}
                  >
                    <GitFork className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {flow.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                        v{flow.version || 1}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {flow.description}
                    </span>
                  </div>
                </div>

                {/* Ativar / Desativar Switch Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFlowStatus(flow)}
                    title={flow.is_active ? 'Clique para desativar este fluxo' : 'Clique para ativar este fluxo'}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      flow.is_active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm'
                        : 'bg-dark-800 text-slate-400 border border-white/10 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Power className={`w-3.5 h-3.5 ${flow.is_active ? 'text-emerald-400' : 'text-slate-500'}`} />
                    {flow.is_active ? 'Fluxo Ativo' : 'Desativado'}
                  </button>
                </div>
              </div>

              {/* Metadados: Gatilho, Loja Vinculada, Quantidade Exata de Funções/Nós */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-3 py-2 text-xs bg-dark-950/40 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-pitoco-blue" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Gatilho</span>
                    <span className="text-slate-200 font-medium">{flow.trigger_type || 'Mensagem'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StoreIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Loja / Destino</span>
                    <span className="text-slate-200 font-medium">{flow.store_name || 'Toda a Rede'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-pitoco-pink" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Estrutura</span>
                    <span className="text-slate-200 font-bold text-brand-400">
                      {typeof flow.node_count === 'number' && flow.node_count > 0 ? flow.node_count : (flow.steps?.length || 0)} Funções (Nós)
                    </span>
                  </div>
                </div>
              </div>

              {/* Palavras-chave em destaque no card */}
              {Boolean((flow as any).keywords || (flow as any).trigger_keywords) && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-400 shrink-0">Palavras-chave:</span>
                  <div className="flex flex-wrap gap-1">
                    {String((flow as any).keywords || (flow as any).trigger_keywords)
                      .split(',')
                      .map(k => k.trim())
                      .filter(Boolean)
                      .map((kw, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 text-[10.5px] font-mono font-semibold">
                          {kw}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação do Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {/* Seletor Rápido de Cor do Fluxo */}
                  <div className="flex items-center gap-1.5 bg-dark-950/60 px-2 py-1.5 rounded-xl border border-white/5" title="Escolher cor para o fluxo">
                    <Palette className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                    {FLOW_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleUpdateFlowColor(flow, c.hex)}
                        className={`w-4 h-4 rounded-full transition-transform hover:scale-125 flex items-center justify-center ${
                          currentFlowColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'ring-2 ring-white scale-110 shadow-sm'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={`Cor: ${c.label}`}
                      >
                        {currentFlowColor.toLowerCase() === c.hex.toLowerCase() && (
                          <Check className="w-2.5 h-2.5 text-white drop-shadow stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicateFlow(flow)}
                    className="text-xs font-semibold border-white/10 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                    title="Duplicar Fluxo"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenStudio(flow.id)}
                    className="bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-pitoco-blue/20 hover:from-purple-600/35 hover:to-pitoco-blue/35 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border border-purple-500/40 flex items-center gap-1.5 shadow-sm transition-all"
                    title="Abrir e editar fluxo no Studio Visual"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-pitoco-blue animate-pulse" />
                    Editar no Studio
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditFlow(flow)}
                    className="p-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all"
                    title="Editar Informações do Fluxo"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-pitoco-blue" />
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlowToDelete(flow)}
                    className="p-2 border-white/10 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 rounded-xl"
                    title="Apagar Fluxo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredFlows.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-dark-900 border border-white/5">
            <GitFork className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Nenhum fluxo encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Crie um novo fluxo de atendimento clicando no botão acima.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Criar ou Editar Fluxo */}
      <Modal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        title={editingFlow ? `Editar Fluxo: ${editingFlow.name}` : 'Criar Novo Fluxo de Atendimento'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveFlow} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Nome do Fluxo:
            </label>
            <input
              type="text"
              value={flowName}
              onChange={e => setFlowName(e.target.value)}
              placeholder="ex: Atendimento Principal e Vendas de Enxoval"
              className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pitoco-blue"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Descrição do Fluxo & Objetivo:
            </label>
            <textarea
              value={flowDescription}
              onChange={e => setFlowDescription(e.target.value)}
              placeholder="Descreva o propósito deste fluxo e a jornada do cliente..."
              rows={2}
              className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pitoco-blue resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Gatilho de Disparo:
              </label>
              <select
                value={flowTrigger}
                onChange={e => {
                  const val = e.target.value;
                  setFlowTrigger(val);
                  if (!val.toLowerCase().includes('palavra') && !val.toLowerCase().includes('keyword')) {
                    setFlowKeywords('');
                  }
                }}
                className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-pitoco-blue"
              >
                <option value="Qualquer Mensagem Recebida">Qualquer Mensagem Recebida</option>
                <option value="Palavra-Chave / Menu">Palavra-Chave / Menu</option>
                <option value="Transbordo para Atendimento Humano">Transbordo Humano</option>
                <option value="Fora do Horário Comercial">Fora do Horário Comercial</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Loja / Unidade Vinculada:
              </label>
              <select
                value={flowStoreId}
                onChange={e => setFlowStoreId(e.target.value)}
                className="w-full px-3 py-2.5 bg-dark-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-pitoco-blue"
              >
                <option value="all">Toda a Rede (Global)</option>
                {stores.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Palavras-chave do Gatilho */}
          {(flowTrigger.toLowerCase().includes('palavra') || flowTrigger.toLowerCase().includes('keyword')) && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 animate-in fade-in">
              <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>Palavras-chave do Gatilho (separadas por vírgula):</span>
                <span className="text-[10px] text-amber-400 font-semibold uppercase">Prioridade Absoluta</span>
              </label>
              <Input
                value={flowKeywords}
                onChange={e => setFlowKeywords(e.target.value)}
                placeholder="Ex: #enxoval, enxoval, catalogo, preco, ajuda"
                className="bg-dark-900 border-amber-500/30 text-white placeholder-slate-500"
              />
              <p className="text-[11px] text-amber-200/80 leading-tight">
                ⚡ Quando o cliente enviar qualquer uma destas palavras, este fluxo será executado <strong>imediatamente com prioridade absoluta</strong> em vez do fluxo de qualquer mensagem.
              </p>
            </div>
          )}

          {/* Status Inicial */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Status do Fluxo:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFlowActive(true)}
                className={`p-2.5 rounded-xl text-center text-xs font-bold border transition-all ${
                  flowActive
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/5 bg-dark-800 text-slate-400'
                }`}
              >
                Ativo no Robô WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setFlowActive(false)}
                className={`p-2.5 rounded-xl text-center text-xs font-bold border transition-all ${
                  !flowActive
                    ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                    : 'border-white/5 bg-dark-800 text-slate-400'
                }`}
              >
                Desativado / Rascunho
              </button>
            </div>
          </div>

          {/* Escolha da Cor do Fluxo */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-pitoco-blue" />
              Cor de Destaque do Fluxo:
            </label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-dark-800/80 border border-white/10">
              {FLOW_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFlowColor(c.hex)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                    flowColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-white text-white font-bold bg-white/10 ring-2 ring-pitoco-blue shadow-sm'
                      : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shadow-sm"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sticky -bottom-5 sm:-bottom-6 bg-dark-900/95 backdrop-blur-md -mx-5 px-5 sm:-mx-6 sm:px-6 py-3 border-t border-white/10 flex items-center justify-end gap-2 z-30">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFlowModalOpen(false)}
              className="text-xs border-white/10 text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSavingFlow}
              className="bg-pitoco-blue text-slate-950 font-bold text-xs px-5 rounded-xl hover:bg-pitoco-blue/90"
            >
              {isSavingFlow ? 'Salvando...' : editingFlow ? 'Salvar Alterações' : 'Criar Fluxo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={Boolean(flowToDelete)}
        onClose={() => setFlowToDelete(null)}
        title="Confirmar Exclusão de Fluxo"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Tem certeza que deseja apagar o fluxo <strong className="text-white">"{flowToDelete?.name}"</strong>?
          </p>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
            Esta automação deixará de responder às mensagens dos clientes no WhatsApp.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setFlowToDelete(null)}
              className="text-xs border-white/10 text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl"
            >
              Sim, Apagar Fluxo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
