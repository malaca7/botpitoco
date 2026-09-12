import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  Edge, 
  Node, 
  ReactFlowProvider, 
  useReactFlow 
} from '@xyflow/react';

import { FlowCanvas } from '../../components/flow-builder/FlowCanvas';
import { FlowConnectionProvider } from '../../components/flow-builder/FlowConnectionContext';
import { FlowVariablesModal } from '../../components/flow-builder/FlowVariablesModal';
import { FlowToolbar } from '../../components/flow-builder/FlowToolbar';
import { NodePalette, NodeDefinition, NODE_DEFINITIONS, CATEGORY_INFO } from '../../components/flow-builder/NodePalette';
import { NodeInspector } from '../../components/flow-builder/NodeInspector';
import { FlowSimulator } from '../../components/flow-builder/FlowSimulator';
import { MobileFlowBuilder } from '../../components/flow-builder/MobileFlowBuilder';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { StorageService, getBackendUrl } from '../../lib/storage';
import { Flow, FlowNode, FlowEdge, FlowNodeData, Store } from '../../types';
import { 
  Plus, 
  Edit3, 
  Link2, 
  Trash2, 
  Copy, 
  Sparkles, 
  X, 
  ChevronRight, 
  Smartphone, 
  Layout, 
  ArrowRight,
  GitBranch,
  Layers,
  Search
} from 'lucide-react';

export interface FlowEditorPageProps {
  flowId: string;
  onNavigate: (path: string) => void;
  onBack?: () => void;
}

export const FlowEditorPageContent: React.FC<FlowEditorPageProps> = ({ flowId, onNavigate, onBack }) => {
  const { success, error: toastError, info, warning } = useToast();
  const { isConnected } = useWhatsApp();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(300);
  const [inspectorWidth, setInspectorWidth] = useState(380);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // View Mode: Visual Canvas by default, with option to switch to Step List
  const [isStepListView, setIsStepListView] = useState<boolean>(false);

  // Mobile Tap-to-Connect State
  const [connectingSource, setConnectingSource] = useState<{
    node: FlowNode;
    handleId?: string | null;
    handleLabel?: string;
  } | null>(null);

  // Mobile Palette Bottom Sheet Modal
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [mobilePaletteCategory, setMobilePaletteCategory] = useState<string>('all');
  const [mobilePaletteSearch, setMobilePaletteSearch] = useState<string>('');

  // Mobile Inspector Modal (Bottom Sheet Drawer)
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  // Branch Selector Modal for nodes with multiple outputs (e.g. check_contact or buttons)
  const [branchSelectorNode, setBranchSelectorNode] = useState<FlowNode | null>(null);

  // Lojas reais cadastradas no painel admin para conexões e saídas dinâmicas
  const [adminStores, setAdminStores] = useState<Store[]>([]);

  useEffect(() => {
    StorageService.getStores().then((stList) => {
      if (Array.isArray(stList)) setAdminStores(stList);
    }).catch(() => {});
  }, []);

  // Line style state
  const [edgeType, setEdgeType] = useState<'smoothstep' | 'default' | 'straight' | 'step'>('smoothstep');

  // Auto-save configuration: 'instant' | 'interval' | 'manual'
  const [autoSaveMode, setAutoSaveMode] = useState<'instant' | 'interval' | 'manual'>(() => {
    return (localStorage.getItem('7assistente_autosave_mode') as any) || 'instant';
  });
  const [autoSaveIntervalSec, setAutoSaveIntervalSec] = useState<number>(30);

  // Undo / Redo history stack
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const debounceSaveTimerRef = useRef<any>(null);

  // Load flow data
  useEffect(() => {
    async function loadFlow() {
      setIsLoading(true);
      try {
        const flowData = await StorageService.getFlowById(flowId);
        if (!flowData) {
          toastError('Não encontrado', 'Fluxo não localizado.');
          onNavigate('/fluxos');
          return;
        }
        setFlow(flowData);

        const loadedNodes = await StorageService.getFlowNodes(flowId);
        const loadedEdges = await StorageService.getFlowEdges(flowId);

        // Sanitize any edge where targetHandle was erroneously hooked to the back/right side
        const sanitizedEdges = (loadedEdges as unknown as Edge[]).map((e) => ({
          ...e,
          targetHandle: null,
        }));

        setNodes(loadedNodes as unknown as Node[]);
        setEdges(sanitizedEdges);

        // Initialize history
        historyRef.current = [{ nodes: loadedNodes as unknown as Node[], edges: sanitizedEdges }];
        historyIndexRef.current = 0;
        setLastSavedTime(new Date());
        setIsDirty(false);
      } catch (err) {
        console.error('Error loading flow graph:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFlow();
  }, [flowId]);

  // Push history state
  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    const nextIndex = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, nextIndex);
    historyRef.current.push({ nodes: newNodes, edges: newEdges });
    historyIndexRef.current = nextIndex;
    setIsDirty(true);
  }, []);

  // Save Flow to database & sync with WhatsApp
  const handleSave = useCallback(
    async (isSilent = false) => {
      if (!flow) return;
      setIsSaving(true);
      try {
        await StorageService.saveFlowGraph(
          flowId,
          nodes as unknown as FlowNode[],
          edges as unknown as FlowEdge[]
        );

        const updatedFlow = {
          ...flow,
          node_count: nodes.length,
          updated_at: new Date().toISOString(),
        };
        await StorageService.saveFlow(updatedFlow);
        setFlow(updatedFlow);
        setIsDirty(false);
        setLastSavedTime(new Date());

        if (!isSilent) {
          success('Fluxo Salvo', 'Estrutura gravada e sincronizada com sucesso.');
        }
      } catch (err: any) {
        if (!isSilent) {
          toastError('Erro ao salvar', err.message || 'Falha ao salvar o fluxo.');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [flow, flowId, nodes, edges, success, toastError]
  );

  // Auto-Save Management
  const handleUpdateAutoSaveConfig = (mode: 'instant' | 'interval' | 'manual', interval: number) => {
    setAutoSaveMode(mode);
    setAutoSaveIntervalSec(interval);
    localStorage.setItem('7assistente_autosave_mode', mode);
    success('Configuração Salva', `Modo de salvamento alterado para ${mode === 'instant' ? 'Tempo Real' : mode === 'interval' ? `Intervalo (${interval}s)` : 'Manual'}.`);
  };

  // Instant Auto-Save (Debounced 600ms on change)
  useEffect(() => {
    if (autoSaveMode === 'instant' && isDirty && !isLoading) {
      if (debounceSaveTimerRef.current) clearTimeout(debounceSaveTimerRef.current);
      debounceSaveTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, 600);
    }
    return () => {
      if (debounceSaveTimerRef.current) clearTimeout(debounceSaveTimerRef.current);
    };
  }, [nodes, edges, isDirty, autoSaveMode, isLoading, handleSave]);

  // Interval Auto-Save
  useEffect(() => {
    if (autoSaveMode === 'interval' && autoSaveIntervalSec > 0) {
      const timer = setInterval(() => {
        if (isDirty) {
          handleSave(true);
        }
      }, autoSaveIntervalSec * 1000);
      return () => clearInterval(timer);
    }
  }, [autoSaveMode, autoSaveIntervalSec, isDirty, handleSave]);

  // Intercept React Flow node changes to trigger Auto-Save on dragging, dimension, or removing
  const handleCustomNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
      const hasMeaningful = changes.some(
        (c) => (c.type === 'position' && c.dragging === false) || c.type === 'remove' || c.type === 'add' || c.type === 'replace'
      );
      if (hasMeaningful) {
        setIsDirty(true);
      }
    },
    [onNodesChange]
  );

  // Intercept React Flow edge changes to trigger Auto-Save
  const handleCustomEdgesChange = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes);
      const hasMeaningful = changes.some(
        (c) => c.type === 'remove' || c.type === 'add' || c.type === 'replace'
      );
      if (hasMeaningful) {
        setIsDirty(true);
      }
    },
    [onEdgesChange]
  );

  // Connect edges
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) {
        return;
      }

      setEdges((eds) => {
        const alreadyExists = eds.some(
          (e) =>
            (e.source === params.source && e.target === params.target && (e.sourceHandle || null) === (params.sourceHandle || null)) ||
            (e.source === params.target && e.target === params.source)
        );
        if (alreadyExists) {
          info('Conexão Existente', 'Essas funções já estão interligadas.');
          return eds;
        }

        const newEdge: Edge = {
          id: `xy-edge__${params.source}${params.sourceHandle ? '-' + params.sourceHandle : ''}-${params.target}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle || null,
          targetHandle: null,
          type: edgeType,
          animated: true,
          style: { stroke: '#06b6d4', strokeWidth: 2.5 },
        };

        const newEdges = addEdge(newEdge, eds);
        pushHistory(nodes, newEdges);
        return newEdges;
      });

      setIsDirty(true);
      success('Ligação Criada', 'Funções conectadas com sucesso no organograma.');
    },
    [nodes, edgeType, setEdges, pushHistory, info, success]
  );

  // Callback para conexões disparadas via FlowConnectionContext
  const handleConnectFromProvider = useCallback(
    (sourceNodeId: string, sourceHandleId: string | null, targetNodeId: string, targetHandleId: string | null) => {
      onConnect({
        source: sourceNodeId,
        sourceHandle: sourceHandleId,
        target: targetNodeId,
        targetHandle: targetHandleId,
      });
    },
    [onConnect]
  );

  // Node Click: handles both normal selection and Tap-to-Connect
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      const clickedFlowNode = node as unknown as FlowNode;

      // 1. If in Tap-to-Connect Mode: Connect source to clicked target node!
      if (connectingSource) {
        if (connectingSource.node.id === node.id) {
          warning('Conexão Inválida', 'Você não pode ligar uma função nela mesma.');
          return;
        }

        const newEdge: Edge = {
          id: `xy-edge__${connectingSource.node.id}${connectingSource.handleId ? '-' + connectingSource.handleId : ''}-${node.id}`,
          source: connectingSource.node.id,
          target: node.id,
          sourceHandle: connectingSource.handleId || null,
          targetHandle: null,
          type: edgeType,
          animated: true,
          style: { stroke: '#06b6d4', strokeWidth: 2.5 },
        };

        setEdges((eds) => {
          const nextEdges = addEdge(newEdge, eds);
          pushHistory(nodes, nextEdges);
          return nextEdges;
        });

        success(
          'Ligação Criada',
          `Conectado: "${connectingSource.node.data.label}" ➡️ "${clickedFlowNode.data.label}".`
        );
        setConnectingSource(null);
        setSelectedNode(clickedFlowNode);
        return;
      }

      // 2. Normal Selection
      setSelectedNode(clickedFlowNode);
      setSelectedEdge(null);
    },
    [connectingSource, edgeType, nodes, setEdges, pushHistory, success, warning]
  );

  const onPaneClick = useCallback(() => {
    if (connectingSource) {
      setConnectingSource(null);
      info('Conexão Cancelada', 'Modo de ligação cancelado.');
    }
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [connectingSource, info]);

  // Edge Selection and Delete
  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => {
        const nextEdges = eds.filter((e) => e.id !== edgeId);
        pushHistory(nodes, nextEdges);
        return nextEdges;
      });
      setSelectedEdge(null);
      info('Ligação Removida', 'A linha de conexão foi excluída do fluxo.');
    },
    [nodes, setEdges, pushHistory, info]
  );

  const onEdgeDoubleClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      handleDeleteEdge(edge.id);
    },
    [handleDeleteEdge]
  );

  // Start Tap-to-Connect helper
  const handleStartConnecting = (node: FlowNode, handleId?: string | null, handleLabel?: string) => {
    const nodeType = node.data?.nodeType || node.type;

    if (
      (nodeType === 'check_contact' ||
        nodeType === 'store_selector' ||
        nodeType === 'shipping_calculator' ||
        nodeType === 'pix_payment' ||
        nodeType === 'vip_consultation' ||
        nodeType === 'promotional_coupon') &&
      !handleId
    ) {
      setBranchSelectorNode(node);
      return;
    }

    if (nodeType === 'buttons' && !handleId) {
      const rawButtons = node.data?.config?.buttons || [];
      if (rawButtons.length > 0) {
        setBranchSelectorNode(node);
        return;
      }
    }

    setConnectingSource({ node, handleId: handleId || null, handleLabel });
    info('Modo Conexão Ativo', `Toque na função de destino para ligar "${node.data.label}".`);
  };

  // Set specific target node for a source node and branch handle directly
  const handleSetTargetNode = useCallback(
    (sourceId: string, targetId: string, handleId?: string | null) => {
      setEdges((eds) => {
        // Remove existing edge from this source with same handle if any
        const filtered = eds.filter(
          (e) => !(e.source === sourceId && (e.sourceHandle || null) === (handleId || null))
        );

        if (!targetId) {
          pushHistory(nodes, filtered);
          setIsDirty(true);
          return filtered;
        }

        const newEdge: Edge = {
          id: `xy-edge__${sourceId}${handleId ? '-' + handleId : ''}-${targetId}`,
          source: sourceId,
          target: targetId,
          sourceHandle: handleId || null,
          targetHandle: null,
          type: edgeType,
          animated: true,
          style: { stroke: '#06b6d4', strokeWidth: 2.5 },
        };

        const nextEdges = addEdge(newEdge, filtered);
        pushHistory(nodes, nextEdges);
        setIsDirty(true);
        return nextEdges;
      });
      success('Saída Conectada', 'A ligação de ramificação foi atualizada com sucesso.');
    },
    [nodes, edgeType, setEdges, pushHistory, success]
  );

  // Spawn node helper function
  const spawnNodeAtPosition = useCallback(
    (def: NodeDefinition, position: { x: number; y: number }) => {
      const newNodeId = `node-${def.type}-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type: def.type,
        position,
        data: {
          label: def.label,
          nodeType: def.type,
          description: def.description,
          isConfigured: true,
          config: { ...def.defaultConfig },
        } as FlowNodeData,
      };

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      pushHistory(nextNodes, edges);
      setSelectedNode(newNode as unknown as FlowNode);
      setSelectedEdge(null);
      setIsMobilePaletteOpen(false);
      success('Função Adicionada', `Card de Função "${def.label}" inserido no fluxo.`);
    },
    [nodes, edges, setNodes, pushHistory, success]
  );

  // Add new node from palette: Clicking spawns in the visual center of current viewport
  const handleAddNode = useCallback(
    (def: NodeDefinition) => {
      try {
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const offsetPos = {
          x: position.x - 120 + (nodes.length % 4) * 20,
          y: position.y - 50 + (nodes.length % 4) * 20,
        };
        spawnNodeAtPosition(def, offsetPos);
      } catch (e) {
        spawnNodeAtPosition(def, { x: 250, y: 200 });
      }
    },
    [screenToFlowPosition, nodes.length, spawnNodeAtPosition]
  );

  // Drag & Drop handlers for dropping nodes anywhere on canvas
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const dataStr = event.dataTransfer.getData('application/reactflow');
      if (!dataStr) return;
      try {
        const def: NodeDefinition = JSON.parse(dataStr);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        spawnNodeAtPosition(def, position);
      } catch (err) {
        console.error('Error onDrop:', err);
      }
    },
    [screenToFlowPosition, spawnNodeAtPosition]
  );

  // Advanced Pure Function for Top-to-Bottom Auto-Layout (Generous 110px Spacing & Strict Downward Hierarchy)
  const computeOrganizedNodes = useCallback((currentNodes: Node[], currentEdges: Edge[]): Node[] => {
    if (!currentNodes || currentNodes.length === 0) return currentNodes;

    // 1. Dynamic Height Estimator
    const getNodeHeight = (n: Node): number => {
      const type = n.data?.nodeType || n.type;
      const cfg = (n.data as any)?.config || {};
      switch (type) {
        case 'trigger':
          return 90;
        case 'message': {
          const text = cfg.text || '';
          return text.length > 80 ? 140 : 110;
        }
        case 'buttons': {
          const btnCount = (cfg.buttons || []).length || 2;
          return 110 + Math.min(btnCount, 4) * 32;
        }
        case 'question':
          return 120;
        case 'check_contact':
          return 130;
        case 'services_catalog':
        case 'select_service':
        case 'show_services':
          return 140;
        case 'schedule_contact':
        case 'select_time_slot':
          return 140;
        case 'ask_date':
        case 'select_date':
          return 130;
        case 'confirm_booking':
          return 140;
        case 'store_selector':
        case 'shipping_calculator':
          return 145;
        case 'show_catalog':
        case 'select_product':
        case 'vip_consultation':
          return 140;
        case 'pix_payment':
        case 'cart_order':
        case 'promotional_coupon':
          return 135;
        case 'measure_guide':
        case 'layette_checklist':
        case 'order_tracking':
          return 125;
        case 'condition':
          return 130;
        case 'variable': {
          const count = Array.isArray(cfg.assignments) ? cfg.assignments.length : 1;
          return 95 + Math.min(count, 3) * 25;
        }
        case 'ai_agent':
          return 120;
        case 'human_handoff':
          return 110;
        case 'delay':
          return 85;
        case 'media':
          return 120;
        case 'end_flow':
        case 'finish_flow':
        case 'end':
          return 85;
        default:
          return 120;
      }
    };

    const NODE_WIDTH = 320;
    const HORIZONTAL_GAP = 110; // Espaço ampliado e arejado entre as colunas dos nós
    const VERTICAL_GAP = 110;   // Espaço ampliado e arejado entre as linhas dos nós
    const COL_WIDTH = NODE_WIDTH + HORIZONTAL_GAP; // 430px
    const START_X = 100;
    const START_Y = 100;
    const MAIN_CENTER_X = 600;

    // 2. Build Adjacency Graph
    const allChildrenMap = new Map<string, string[]>();
    const allParentMap = new Map<string, string[]>();
    const forwardChildrenMap = new Map<string, string[]>();
    const forwardParentMap = new Map<string, string[]>();
    const edgeHandleMap = new Map<string, string | undefined>();

    currentNodes.forEach((n) => {
      allChildrenMap.set(n.id, []);
      allParentMap.set(n.id, []);
      forwardChildrenMap.set(n.id, []);
      forwardParentMap.set(n.id, []);
    });

    // Sort edges so branching handles preserve natural left-to-right order
    const sortedEdges = [...(currentEdges || [])].sort((a, b) => {
      const hA = a.sourceHandle || '';
      const hB = b.sourceHandle || '';
      if (hA === 'is_new' || hA === 'store_matriz' || hA === 'shipping_motoboy' || hA === 'pix_paid' || hA === 'consult_online' || hA === 'coupon_valid' || hA === 'true' || hA.includes('1') || hA.includes('new')) return -1;
      if (hB === 'is_new' || hB === 'store_matriz' || hB === 'shipping_motoboy' || hB === 'pix_paid' || hB === 'consult_online' || hB === 'coupon_valid' || hB === 'true' || hB.includes('1') || hB.includes('new')) return 1;
      if (hA === 'is_existing' || hA === 'store_ecommerce' || hA === 'shipping_pickup' || hA === 'pix_help' || hA === 'consult_store' || hA === 'coupon_invalid' || hA === 'false' || hA.includes('2') || hA.includes('exist')) return 1;
      if (hB === 'is_existing' || hB === 'store_ecommerce' || hB === 'shipping_pickup' || hB === 'pix_help' || hB === 'consult_store' || hB === 'coupon_invalid' || hB === 'false' || hB.includes('2') || hB.includes('exist')) return -1;
      return hA.localeCompare(hB);
    });

    sortedEdges.forEach((e) => {
      if (allChildrenMap.has(e.source) && allChildrenMap.has(e.target)) {
        if (!allChildrenMap.get(e.source)!.includes(e.target)) {
          allChildrenMap.get(e.source)!.push(e.target);
        }
        if (!allParentMap.get(e.target)!.includes(e.source)) {
          allParentMap.get(e.target)!.push(e.source);
        }
        edgeHandleMap.set(`${e.source}->${e.target}`, e.sourceHandle || undefined);
      }
    });

    // 3. Cycle Detection (DFS 3-color) to identify loop back-edges
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const state = new Map<string, number>();
    currentNodes.forEach((n) => state.set(n.id, WHITE));

    const inDegree = new Map<string, number>();
    currentNodes.forEach((n) => inDegree.set(n.id, 0));
    (currentEdges || []).forEach((e) => {
      if (inDegree.has(e.target)) {
        inDegree.set(e.target, inDegree.get(e.target)! + 1);
      }
    });

    const startNodes = currentNodes.slice().sort((a, b) => {
      const isTrigA = (a.data?.nodeType || a.type) === 'trigger' ? 1 : 0;
      const isTrigB = (b.data?.nodeType || b.type) === 'trigger' ? 1 : 0;
      if (isTrigA !== isTrigB) return isTrigB - isTrigA;
      return (inDegree.get(a.id) || 0) - (inDegree.get(b.id) || 0);
    });

    const backEdges = new Set<string>();
    const dfs = (u: string) => {
      state.set(u, GRAY);
      for (const v of allChildrenMap.get(u) || []) {
        if (state.get(v) === GRAY) {
          // v is an active ancestor on DFS recursion stack => back-edge!
          backEdges.add(`${u}->${v}`);
        } else {
          if (!forwardChildrenMap.get(u)!.includes(v)) {
            forwardChildrenMap.get(u)!.push(v);
          }
          if (!forwardParentMap.get(v)!.includes(u)) {
            forwardParentMap.get(v)!.push(u);
          }
          if (state.get(v) === WHITE) {
            dfs(v);
          }
        }
      }
      state.set(u, BLACK);
    };

    startNodes.forEach((n) => {
      if (state.get(n.id) === WHITE) dfs(n.id);
    });

    // 4. Longest-Path Layering on Forward DAG
    // Strictly guarantees that for every forward connection, rank[target] >= rank[source] + 1
    const dagInDegree = new Map<string, number>();
    currentNodes.forEach((n) => dagInDegree.set(n.id, 0));
    for (const [, children] of forwardChildrenMap.entries()) {
      for (const v of children) {
        dagInDegree.set(v, (dagInDegree.get(v) || 0) + 1);
      }
    }

    const dagQueue: string[] = [];
    currentNodes.forEach((n) => {
      if (dagInDegree.get(n.id) === 0) dagQueue.push(n.id);
    });

    const rankMap = new Map<string, number>();
    currentNodes.forEach((n) => rankMap.set(n.id, 0));

    while (dagQueue.length > 0) {
      const u = dagQueue.shift()!;
      const uRank = rankMap.get(u) || 0;
      for (const v of forwardChildrenMap.get(u) || []) {
        rankMap.set(v, Math.max(rankMap.get(v) || 0, uRank + 1));
        dagInDegree.set(v, (dagInDegree.get(v) || 0) - 1);
        if (dagInDegree.get(v) === 0) {
          dagQueue.push(v);
        }
      }
    }

    // Handle any disconnected components
    currentNodes.forEach((n) => {
      if (!rankMap.has(n.id)) rankMap.set(n.id, 0);
    });

    // Rank Compression: eliminate any empty gaps while strictly preserving rank(target) > rank(source)
    const distinctRanks = Array.from(new Set(rankMap.values())).sort((a, b) => a - b);
    const compressedRankMap = new Map<number, number>();
    distinctRanks.forEach((oldR, newR) => {
      compressedRankMap.set(oldR, newR);
    });
    currentNodes.forEach((n) => {
      rankMap.set(n.id, compressedRankMap.get(rankMap.get(n.id)) ?? 0);
    });

    const maxRank = Math.max(...Array.from(rankMap.values()), 0);
    const totalRows = Math.min(maxRank + 1, currentNodes.length);
    const rows: Node[][] = Array.from({ length: totalRows }, () => []);
    currentNodes.forEach((n) => {
      const r = Math.min(rankMap.get(n.id) || 0, totalRows - 1);
      rows[r].push(n);
    });

    // 5. Compute Y position for each row with uniform VERTICAL_GAP
    const rowYPositions = new Map<number, number>();
    let currentY = START_Y;
    for (let r = 0; r < totalRows; r++) {
      rowYPositions.set(r, currentY);
      const rowNodes = rows[r];
      const maxHeightInRow = rowNodes.length > 0
        ? Math.max(...rowNodes.map(getNodeHeight))
        : 110;
      currentY += maxHeightInRow + VERTICAL_GAP;
    }

    // Check if a node leads to a back-edge loop back to an ancestor
    const nodeLeadsToBackEdge = (startNodeId: string, targetAncestorId: string): boolean => {
      const q = [startNodeId];
      const vis = new Set<string>([startNodeId]);
      while (q.length > 0) {
        const cur = q.shift()!;
        if (backEdges.has(`${cur}->${targetAncestorId}`)) return true;
        for (const nxt of forwardChildrenMap.get(cur) || []) {
          if (!vis.has(nxt)) {
            vis.add(nxt);
            q.push(nxt);
          }
        }
      }
      return false;
    };

    // 6. Branch Offset Calculator
    const getHandleOffset = (parent: Node, childId: string): number => {
      const pType = parent.data?.nodeType || parent.type;
      const pCfg = (parent.data as any)?.config || {};
      const handle = edgeHandleMap.get(`${parent.id}->${childId}`) || '';

      // Check contact: 2 handles: is_new (left) vs is_existing (right)
      if (pType === 'check_contact' || handle === 'is_new' || handle === 'is_existing') {
        if (handle === 'is_new' || handle.includes('new') || handle === 'true') {
          return -COL_WIDTH / 2;
        }
        if (handle === 'is_existing' || handle.includes('exist') || handle === 'false') {
          return COL_WIDTH / 2;
        }
      }

      // Store selector: handles dinâmicos para lojas reais
      if (pType === 'store_selector' || handle.startsWith('store_') || handle.startsWith('store-')) {
        const storesList = adminStores.length > 0 ? adminStores : [
          { id: 'store-001', slug: 'matriz' },
          { id: 'store-002', slug: 'ipojuca' },
          { id: 'store-003', slug: 'ecommerce' },
        ];
        const storeIdx = storesList.findIndex((s: any) => s.id === handle || `store_${s.slug}` === handle || s.slug === handle);
        if (storeIdx >= 0) {
          const total = Math.max(storesList.length, 1);
          const step = (COL_WIDTH * 2) / (total + 1);
          return -COL_WIDTH + step * (storeIdx + 1);
        }
      }

      // Shipping calculator: 3 dedicated branch handles
      if (pType === 'shipping_calculator' || handle.startsWith('shipping_')) {
        if (handle === 'shipping_motoboy') return -COL_WIDTH;
        if (handle === 'shipping_correios') return 0;
        if (handle === 'shipping_pickup') return COL_WIDTH;
      }

      // PIX payment: 2 handles
      if (pType === 'pix_payment' || handle.startsWith('pix_')) {
        if (handle === 'pix_paid') return -COL_WIDTH / 2;
        if (handle === 'pix_help') return COL_WIDTH / 2;
      }

      // VIP consultation: 2 handles
      if (pType === 'vip_consultation' || handle.startsWith('consult_')) {
        if (handle === 'consult_online') return -COL_WIDTH / 2;
        if (handle === 'consult_store') return COL_WIDTH / 2;
      }

      // Promotional coupon: 2 handles
      if (pType === 'promotional_coupon' || handle.startsWith('coupon_')) {
        if (handle === 'coupon_valid') return -COL_WIDTH / 2;
        if (handle === 'coupon_invalid') return COL_WIDTH / 2;
      }

      // Condition: true (left) vs false (right)
      if (pType === 'condition' || handle === 'true' || handle === 'false') {
        return handle === 'true' ? -COL_WIDTH / 2 : COL_WIDTH / 2;
      }

      // If this branch loops back to the parent, offset to side lane so wire has clear corridor
      const loopsBackToParent = nodeLeadsToBackEdge(childId, parent.id);
      if (loopsBackToParent) {
        if (handle === 'btn_1' || handle.includes('left') || handle === 'is_new') {
          return -COL_WIDTH;
        }
        return COL_WIDTH;
      }

      // Buttons: 2 or 3 buttons
      if (pType === 'buttons' || handle.startsWith('btn_')) {
        const btnCount = (pCfg.buttons || []).length || 2;
        let btnIdx = 0;
        if (handle.startsWith('btn_')) {
          const num = parseInt(handle.replace('btn_', ''), 10);
          if (Number.isFinite(num) && num > 0) btnIdx = num - 1;
        }
        return (btnIdx - (btnCount - 1) / 2) * COL_WIDTH;
      }

      // Multiple generic children
      const children = forwardChildrenMap.get(parent.id) || [];
      if (children.length > 1) {
        const idx = children.indexOf(childId);
        if (idx !== -1) {
          return (idx - (children.length - 1) / 2) * COL_WIDTH;
        }
      }

      return 0;
    };

    // 7. Compute X positions with Branch Offsets + Barycenter + Collision Prevention
    const xPositions = new Map<string, number>();

    for (let r = 0; r < totalRows; r++) {
      const rowNodes = rows[r];

      if (r === 0) {
        // Row 0 roots: center around MAIN_CENTER_X
        const totalWidth = rowNodes.length * NODE_WIDTH + (rowNodes.length - 1) * HORIZONTAL_GAP;
        let startX = MAIN_CENTER_X - totalWidth / 2;
        rowNodes.forEach((n) => {
          xPositions.set(n.id, startX);
          startX += COL_WIDTH;
        });
        continue;
      }

      // Row r >= 1: compute ideal X for each node based on its parents and branch offsets
      rowNodes.forEach((n) => {
        const upstreamParents = (forwardParentMap.get(n.id) || []).filter((p) => xPositions.has(p));
        if (upstreamParents.length === 1) {
          const pId = upstreamParents[0];
          const pNode = currentNodes.find((nd) => nd.id === pId);
          const pX = xPositions.get(pId) ?? (MAIN_CENTER_X - NODE_WIDTH / 2);
          const offset = pNode ? getHandleOffset(pNode, n.id) : 0;
          xPositions.set(n.id, pX + offset);
        } else if (upstreamParents.length > 1) {
          // Merge node: center between effective incoming branch positions
          const incomingXs = upstreamParents.map((pId) => {
            const pNode = currentNodes.find((nd) => nd.id === pId);
            const pX = xPositions.get(pId) ?? (MAIN_CENTER_X - NODE_WIDTH / 2);
            const offset = pNode ? getHandleOffset(pNode, n.id) : 0;
            return pX + offset;
          });
          const avgX = incomingXs.reduce((sum, x) => sum + x, 0) / incomingXs.length;
          xPositions.set(n.id, avgX);
        } else {
          xPositions.set(n.id, MAIN_CENTER_X - NODE_WIDTH / 2);
        }
      });

      // If multiple nodes in row, sort by current X to resolve collisions
      if (rowNodes.length > 1) {
        rowNodes.sort((a, b) => (xPositions.get(a.id) || 0) - (xPositions.get(b.id) || 0));

        // Left-to-right collision resolution
        for (let i = 1; i < rowNodes.length; i++) {
          const prevX = xPositions.get(rowNodes[i - 1].id) ?? 0;
          const curX = xPositions.get(rowNodes[i].id) ?? 0;
          const minX = prevX + COL_WIDTH;
          if (curX < minX) {
            xPositions.set(rowNodes[i].id, minX);
          }
        }
      }
    }

    // 8. Global Normalization: align left-most node to START_X
    const allXs = Array.from(xPositions.values()).filter(Number.isFinite);
    const minX = allXs.length > 0 ? Math.min(...allXs) : START_X;
    const shiftX = START_X - minX;

    return currentNodes.map((n) => {
      const rank = rankMap.get(n.id) ?? 0;
      const rawX = xPositions.get(n.id);
      const rawY = rowYPositions.get(rank);

      const posX = (Number.isFinite(rawX) ? rawX! : (MAIN_CENTER_X - NODE_WIDTH / 2)) + shiftX;
      const posY = Number.isFinite(rawY) ? rawY! : (START_Y + rank * (110 + VERTICAL_GAP));

      return {
        ...n,
        position: { x: Math.round(posX), y: Math.round(posY) },
      };
    });
  }, []);

  // Track latest nodes, edges, and flow in refs for exit auto-organize
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const flowRef = useRef(flow);
  flowRef.current = flow;

  // Manual Trigger: Auto-Organize Action from Toolbar
  const handleAutoLayout = useCallback(() => {
    if (!nodes || nodes.length === 0) return;

    try {
      const layoutedNodes = computeOrganizedNodes(nodes, edges);
      setNodes(layoutedNodes);
      pushHistory(layoutedNodes, edges);
      setIsDirty(true);
      success(
        'Fluxo Auto-Organizado',
        'Fluxo organizado com espaçamento ampliado e conexões perfeitamente alinhadas de cima para baixo!'
      );

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 60);
    } catch (err: any) {
      console.error('Error during handleAutoLayout:', err);
      toastError('Erro ao Organizar', err.message || 'Ocorreu um erro ao organizar o fluxo.');
    }
  }, [nodes, edges, computeOrganizedNodes, setNodes, pushHistory, fitView, success, toastError]);

  // Global Keyboard Shortcut: Alt + O for Auto-Layout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleAutoLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAutoLayout]);

  // Always Auto-Organize and Save Flow Before Exiting the Studio
  const handleExitStudio = useCallback(async () => {
    try {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      if (currentNodes && currentNodes.length > 0) {
        const layoutedNodes = computeOrganizedNodes(currentNodes, currentEdges);
        setNodes(layoutedNodes);
        await StorageService.saveFlowGraph(
          flowId,
          layoutedNodes as unknown as FlowNode[],
          currentEdges as unknown as FlowEdge[]
        );
        if (flowRef.current) {
          const updatedFlow = {
            ...flowRef.current,
            node_count: layoutedNodes.length,
            updated_at: new Date().toISOString(),
          };
          await StorageService.saveFlow(updatedFlow);
        }
      }
    } catch (err) {
      console.error('Error auto-organizing on exit:', err);
    } finally {
      if (onBack) {
        onBack();
      } else {
        onNavigate('/fluxos');
      }
    }
  }, [flowId, computeOrganizedNodes, setNodes, onNavigate, onBack]);

  // Safety net: Auto-organize and persist on unmount
  useEffect(() => {
    return () => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      if (currentNodes && currentNodes.length > 0) {
        try {
          const layoutedNodes = computeOrganizedNodes(currentNodes, currentEdges);
          StorageService.saveFlowGraph(
            flowId,
            layoutedNodes as unknown as FlowNode[],
            currentEdges as unknown as FlowEdge[]
          );
        } catch (e) {}
      }
    };
  }, [flowId, computeOrganizedNodes]);

  // Duplicate Selected Node
  const handleDuplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const newNodeId = `node-${selectedNode.type}-${Date.now()}`;
    const duplicatedNode: Node = {
      id: newNodeId,
      type: selectedNode.type,
      position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
      data: {
        ...selectedNode.data,
        label: `${selectedNode.data.label} (Cópia)`,
      },
    };

    const nextNodes = [...nodes, duplicatedNode];
    setNodes(nextNodes);
    pushHistory(nextNodes, edges);
    setSelectedNode(duplicatedNode as unknown as FlowNode);
    success('Nó Duplicado', `Cópia criada: "${duplicatedNode.data.label}".`);
  }, [selectedNode, nodes, edges, setNodes, pushHistory, success]);

  // Delete Selected Node
  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedNode.id);
    const nextEdges = edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id);
    setNodes(nextNodes);
    setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);
    setSelectedNode(null);
    setIsMobileInspectorOpen(false);
    info('Nó Removido', `O nó "${selectedNode.data.label}" foi excluído.`);
  }, [selectedNode, nodes, edges, setNodes, setEdges, pushHistory, info]);

  // Update node config from Inspector
  const handleUpdateConfig = useCallback(
    (nodeId: string, label: string, config: Record<string, any>) => {
      setNodes((prevNodes) => {
        const nextNodes = prevNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                label,
                config,
                isConfigured: true,
              },
            };
          }
          return n;
        });
        pushHistory(nextNodes, edges);
        return nextNodes;
      });

      setSelectedNode((prev) => {
        if (prev && prev.id === nodeId) {
          return {
            ...prev,
            data: {
              ...prev.data,
              label,
              config,
              isConfigured: true,
            },
          };
        }
        return prev;
      });
    },
    [edges, setNodes, pushHistory]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      setSelectedNode(null);
      setSelectedEdge(null);
      setIsDirty(true);
    }
  }, [setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const state = historyRef.current[historyIndexRef.current];
      setNodes(state.nodes);
      setEdges(state.edges);
      setSelectedNode(null);
      setSelectedEdge(null);
      setIsDirty(true);
    }
  }, [setNodes, setEdges]);

  // Publish / Pause status toggle
  const handleToggleStatus = async () => {
    if (!flow) return;
    const newStatus = flow.status === 'published' ? 'paused' : 'published';

    // 1. Save graph first so latest canvas edits are immediately persisted
    await StorageService.saveFlowGraph(
      flowId,
      nodes as unknown as FlowNode[],
      edges as unknown as FlowEdge[]
    );

    // 2. Save flow status
    const updated = await StorageService.saveFlow({
      ...flow,
      status: newStatus,
      is_active: newStatus === 'published',
      node_count: nodes.length,
      updated_at: new Date().toISOString(),
    });
    setFlow(updated);

    // 4. Publish directly on server
    const backendUrl = getBackendUrl();
    try {
      if (newStatus === 'published') {
        await fetch(`${backendUrl}/api/whatsapp/flows/${flow.id}/publish`, { method: 'POST' });
      }
    } catch {}

    success(
      newStatus === 'published' ? 'Fluxo Publicado' : 'Fluxo Pausado',
      `O fluxo "${flow.name}" agora está ${newStatus === 'published' ? 'Publicado e Ativo no WhatsApp' : 'Pausado'}.`
    );
  };

  const isValid = nodes.length > 0;
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  if (isLoading || !flow) {
    return (
      <div className="h-screen w-screen bg-dark-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 rounded-xl border-2 border-brand-500 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold tracking-wider text-slate-300">
          Carregando Studio do Fluxo...
        </span>
      </div>
    );
  }

  // 📱 Optional Step List View (If user explicitly taps "Modo Lista")
  if (isStepListView) {
    return (
      <MobileFlowBuilder
        flow={flow}
        nodes={nodes as unknown as FlowNode[]}
        edges={edges as unknown as FlowEdge[]}
        onUpdateNodes={(updatedNodes) => {
          setNodes(updatedNodes as unknown as Node[]);
          pushHistory(updatedNodes as unknown as Node[], edges);
        }}
        onUpdateEdges={(updatedEdges) => {
          setEdges(updatedEdges as unknown as Edge[]);
          pushHistory(nodes, updatedEdges as unknown as Edge[]);
        }}
        onSave={() => handleSave(false)}
        onToggleStatus={handleToggleStatus}
        isSaving={isSaving}
        isDirty={isDirty}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onBack={handleExitStudio}
        onSwitchToCanvas={() => setIsStepListView(false)}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-950 overflow-hidden select-none relative">
      {/* Top Floating Connection Mode Banner */}
      {connectingSource && (
        <div className="absolute top-16 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-in slide-in-from-top-4">
          <div className="bg-dark-900/95 backdrop-blur-2xl border-2 border-cyan-500/80 p-3 rounded-2xl shadow-2xl shadow-cyan-950/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
              <div>
                <p className="font-bold text-white leading-tight">
                  🔗 Modo Conectar: <span className="text-cyan-300">{connectingSource.node.data?.label}</span>
                  {connectingSource.handleLabel && <span className="text-brand-300 ml-1">({connectingSource.handleLabel})</span>}
                </p>
                <p className="text-[10px] text-slate-400">Toque no Card de destino na tela para ligar as duas funções</p>
              </div>
            </div>
            <button
              onClick={() => setConnectingSource(null)}
              className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white border border-white/10 font-bold active:scale-95 transition-all flex-shrink-0"
            >
              ✕ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Top Studio Toolbar */}
      <FlowToolbar
        flow={flow}
        onBack={handleExitStudio}
        onSave={() => handleSave(false)}
        onToggleStatus={handleToggleStatus}
        onTestFlow={() => setIsSimulatorOpen(true)}
        onSwitchToMobileMode={() => setIsStepListView(true)}
        isSaving={isSaving}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isValid={isValid}
        validationError={!isValid ? 'Adicione funções para iniciar o fluxo' : null}
        isConnectedWhatsApp={isConnected}
        autoSaveMode={autoSaveMode}
        autoSaveIntervalSec={autoSaveIntervalSec}
        onUpdateAutoSaveConfig={handleUpdateAutoSaveConfig}
        lastSavedTime={lastSavedTime}
        isDirty={isDirty}
        edgeType={edgeType}
        onChangeEdgeType={setEdgeType}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenVariables={() => setIsVariablesModalOpen(true)}
        onAutoLayout={handleAutoLayout}
      />

      {/* Main Canvas Workspace (Identical Desktop Visual Organogram) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left: Node Palette (Desktop Sidebar) */}
        <NodePalette
          onAddNode={handleAddNode}
          isOpen={isPaletteOpen}
          onToggleOpen={() => setIsPaletteOpen(!isPaletteOpen)}
          width={paletteWidth}
          onWidthChange={setPaletteWidth}
        />

        {/* Workspace envolto no FlowConnectionProvider para conexão de clique duplo e alta acessibilidade */}
        <FlowConnectionProvider onConnectRequest={handleConnectFromProvider}>
          {/* Center: ReactFlow Canvas */}
          <div className="flex-1 h-full relative">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleCustomNodesChange}
              onEdgesChange={handleCustomEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onEdgeClick={onEdgeClick}
              onEdgeDoubleClick={onEdgeDoubleClick}
              edgeType={edgeType}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          </div>

          {/* Right: Node Inspector (Desktop Sidebar) */}
          {selectedNode && (
            <div className="hidden md:block">
              <NodeInspector
                node={selectedNode}
                onUpdateConfig={handleUpdateConfig}
                onDeleteNode={handleDeleteSelectedNode}
                onDuplicateNode={handleDuplicateSelectedNode}
                onClose={() => setSelectedNode(null)}
                onStartConnecting={handleStartConnecting}
                width={inspectorWidth}
                onWidthChange={setInspectorWidth}
                allNodes={nodes as unknown as FlowNode[]}
                edges={edges}
                onSetTargetNode={handleSetTargetNode}
              />
            </div>
          )}
        </FlowConnectionProvider>
      </div>

      {/* 📱 Mobile Floating Quick Action Bar (When a Node is Selected) */}
      {selectedNode && (
        <div className="md:hidden fixed bottom-4 inset-x-3 z-40 animate-in slide-in-from-bottom-4">
          <div className="bg-dark-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-3 shadow-2xl shadow-black/80 space-y-2">
            {/* Header: Node Info */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse flex-shrink-0" />
                <h4 className="text-xs font-bold text-white truncate">
                  {selectedNode.data?.label || selectedNode.id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                onClick={() => setIsMobileInspectorOpen(true)}
                className="p-2.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-[11px] flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar</span>
              </button>

              <button
                onClick={() => handleStartConnecting(selectedNode)}
                className="p-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform"
              >
                <Link2 className="w-4 h-4" />
                <span>Ligar Nó</span>
              </button>

              <button
                onClick={handleDuplicateSelectedNode}
                className="p-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 text-[11px] font-medium flex flex-col items-center gap-1 border border-white/5 active:scale-95 transition-transform"
              >
                <Copy className="w-4 h-4" />
                <span>Duplicar</span>
              </button>

              <button
                onClick={handleDeleteSelectedNode}
                className="p-2.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-[11px] font-medium flex flex-col items-center gap-1 border border-rose-800/40 active:scale-95 transition-transform"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 Mobile Floating Edge Delete Pill (When an Edge is Selected) */}
      {selectedEdge && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 animate-in slide-in-from-bottom-4">
          <div className="bg-dark-900/95 backdrop-blur-2xl border border-cyan-500/50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300 font-medium">Linha de Ligação Selecionada</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleDeleteEdge(selectedEdge.id)}
              >
                Excluir Ligação
              </Button>
              <button
                onClick={() => setSelectedEdge(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 Mobile Floating Action Button (+ Adicionar Função) */}
      <div className="md:hidden fixed bottom-4 right-4 z-30">
        {!selectedNode && (
          <button
            onClick={() => setIsMobilePaletteOpen(true)}
            className="px-4 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-primary-600 text-white font-bold text-xs flex items-center gap-2 shadow-2xl shadow-brand-500/40 border border-white/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Função</span>
          </button>
        )}
      </div>

      {/* 📱 Mobile Node Palette Modal */}
      <Modal
        isOpen={isMobilePaletteOpen}
        onClose={() => setIsMobilePaletteOpen(false)}
        title="Catálogo de Funções de Fluxo"
        subtitle="Toque em qualquer função para adicionar no organograma visual"
        maxWidth="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setMobilePaletteCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-colors ${
                mobilePaletteCategory === 'all'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-dark-800 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              Todos ({NODE_DEFINITIONS.length})
            </button>
            {(Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>).map((catKey) => {
              const cat = CATEGORY_INFO[catKey];
              const isSelected = mobilePaletteCategory === catKey;
              return (
                <button
                  key={catKey}
                  onClick={() => setMobilePaletteCategory(catKey)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-dark-800 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Node Types Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {NODE_DEFINITIONS.filter(
              (def) => mobilePaletteCategory === 'all' || def.category === mobilePaletteCategory
            ).map((def) => (
              <button
                key={def.type}
                onClick={() => handleAddNode(def)}
                className="p-3.5 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/5 hover:border-brand-500/40 text-left transition-all active:scale-[0.98] flex items-start gap-3 group"
              >
                <div className={`p-2.5 rounded-xl text-white ${def.iconBg} shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  {def.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-white group-hover:text-brand-300 transition-colors">
                      {def.label}
                    </h4>
                    {def.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                        {def.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                    {def.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* 📱 Mobile Node Inspector Modal / Drawer */}
      {isMobileInspectorOpen && selectedNode && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
          <div className="bg-dark-900 border-t border-white/15 rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-dark-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500 text-white">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Editar: {selectedNode.data?.label || selectedNode.id}
                  </h3>
                  <p className="text-[10px] text-slate-400">Configure textos, parâmetros e variáveis da etapa</p>
                </div>
              </div>

              <button
                onClick={() => setIsMobileInspectorOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inspector Form Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <NodeInspector
                node={selectedNode}
                onUpdateConfig={handleUpdateConfig}
                onDeleteNode={handleDeleteSelectedNode}
                onDuplicateNode={handleDuplicateSelectedNode}
                onClose={() => setIsMobileInspectorOpen(false)}
                onStartConnecting={(nd, hId, hLbl) => {
                  setIsMobileInspectorOpen(false);
                  handleStartConnecting(nd, hId, hLbl);
                }}
                width={600}
                allNodes={nodes as unknown as FlowNode[]}
                edges={edges}
                onSetTargetNode={handleSetTargetNode}
              />
            </div>

            {/* Bottom Save & Close Button */}
            <div className="p-3 bg-dark-850 border-t border-white/10 flex justify-end gap-2">
              <Button
                variant="brand"
                onClick={() => setIsMobileInspectorOpen(false)}
                className="w-full font-bold"
              >
                Concluir & Salvar Edição
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Output Selector Modal (For check_contact or buttons) */}
      {branchSelectorNode && (
        <Modal
          isOpen={Boolean(branchSelectorNode)}
          onClose={() => setBranchSelectorNode(null)}
          title="Escolha a Saída para Conectar"
          subtitle={`Selecione qual caminho de "${branchSelectorNode.data.label}" você deseja ligar`}
          maxWidth="sm"
        >
          <div className="space-y-2 pt-2">
            {(branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'check_contact' ? (
              <>
                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'is_new', 'Novo Cliente');
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span>🟢 Saída: Se for Novo Cliente</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'is_existing', 'Cliente Salvo');
                  }}
                  className="w-full p-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-400" />
                    <span>🔵 Saída: Se for Cliente Já Salvo</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'store_selector' ? (
              <>
                {(adminStores.length > 0 ? adminStores : [
                  { id: 'store-001', name: 'Loja Matriz Centro', city: 'Recife - PE' },
                  { id: 'store-002', name: 'Loja Ipojuca - Filial', city: 'Ipojuca - PE' },
                  { id: 'store-003', name: 'Atendimento Geral / E-commerce', city: 'Digital' },
                ]).map((st: any, idx: number) => {
                  const handleKey = st.id || `store_${st.slug || idx}`;
                  const label = `${idx + 1}. ${st.name}`;
                  const colors = ['bg-amber-400', 'bg-cyan-400', 'bg-emerald-400', 'bg-purple-400', 'bg-rose-400'];
                  const dotColor = colors[idx % colors.length];
                  return (
                    <button
                      key={handleKey}
                      onClick={() => {
                        const node = branchSelectorNode;
                        setBranchSelectorNode(null);
                        handleStartConnecting(node, handleKey, label);
                      }}
                      className="w-full p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-between text-left transition-all active:scale-95"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
                        <span className="truncate">🏬 {label} {st.city ? `(${st.city})` : ''}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  );
                })}
              </>
            ) : (branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'shipping_calculator' ? (
              <>
                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'shipping_motoboy', 'Motoboy Express');
                  }}
                  className="w-full p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>🛵 1. Motoboy Express (Recife e RMR)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'shipping_correios', 'Correios PAC/SEDEX');
                  }}
                  className="w-full p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-zinc-400" />
                    <span>📦 2. Correios PAC / SEDEX (Brasil)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'shipping_pickup', 'Retirada em Loja');
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span>🏪 3. Retirada Grátis na Loja Física</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'pix_payment' ? (
              <>
                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'pix_paid', 'Comprovante Enviado');
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span>✅ 1. Comprovante Enviado / PIX Pago</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'pix_help', 'Dúvida / Outra Forma');
                  }}
                  className="w-full p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>❓ 2. Dúvida / Outra Forma de Pagamento</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'vip_consultation' ? (
              <>
                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'consult_online', 'Consultoria Online');
                  }}
                  className="w-full p-3 rounded-2xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-pink-400" />
                    <span>📱 1. Consultoria Online (WhatsApp / Vídeo)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'consult_store', 'Presencial na Loja');
                  }}
                  className="w-full p-3 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-purple-400" />
                    <span>🏬 2. Presencial na Loja Física</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (branchSelectorNode.data?.nodeType || branchSelectorNode.type) === 'promotional_coupon' ? (
              <>
                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'coupon_valid', 'Cupom Válido');
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span>🎟️ 1. Cupom Válido (Aplicado)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, 'coupon_invalid', 'Cupom Inválido');
                  }}
                  className="w-full p-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span>❌ 2. Cupom Inválido / Expirado</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              (branchSelectorNode.data?.config?.buttons || []).map((b: any, idx: number) => (
                <button
                  key={b.id || idx}
                  onClick={() => {
                    const node = branchSelectorNode;
                    setBranchSelectorNode(null);
                    handleStartConnecting(node, b.id || `btn_${idx + 1}`, b.title || `Botão ${idx + 1}`);
                  }}
                  className="w-full p-3 rounded-2xl bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-300 font-bold text-xs flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-brand-400" />
                    <span>Saída: {b.title || `Opção ${idx + 1}`}</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Simulator Modal */}
      {isSimulatorOpen && (
        <FlowSimulator
          flow={flow}
          nodes={nodes as unknown as FlowNode[]}
          edges={edges as unknown as FlowEdge[]}
          onClose={() => setIsSimulatorOpen(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      <Modal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        title="Atalhos de Teclado & Gestos do Studio"
        subtitle="Agilize a criação e navegação dos seus fluxos"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-2.5">
            {[
              { desc: 'Auto-Organizar Funções de Cima para Baixo', keys: ['Alt', 'O'] },
              { desc: 'Salvar Fluxo Manualmente', keys: ['Ctrl', 'S'] },
              { desc: 'Desfazer última alteração', keys: ['Ctrl', 'Z'] },
              { desc: 'Refazer alteração', keys: ['Ctrl', 'Y'] },
              { desc: 'Duplicar função selecionada', keys: ['Ctrl', 'D'] },
              { desc: 'Excluir função selecionada OU ligação', keys: ['Delete', 'ou', 'Backspace'] },
              { desc: 'Excluir linha de ligação instantaneamente', keys: ['Clique Duplo', 'na Linha'] },
              { desc: 'Adicionar função no centro da tela', keys: ['Clique', 'na Função'] },
              { desc: 'Adicionar função em posição exata', keys: ['Arrastar', 'para a Tela'] },
              { desc: 'Desmarcar seleção de funções ou linhas', keys: ['Esc'] },
              { desc: 'Abrir este menu de atalhos', keys: ['F1', 'ou', '?'] },
            ].map((sc, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-dark-850 border border-white/5 flex items-center justify-between"
              >
                <span className="text-slate-300">{sc.desc}</span>
                <div className="flex items-center gap-1">
                  {sc.keys.map((k, j) => (
                    <kbd
                      key={j}
                      className="px-2 py-1 rounded-lg bg-dark-800 border border-slate-700 text-[10px] font-mono font-bold text-brand-300 shadow-sm"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="brand" onClick={() => setIsShortcutsModalOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Popup de Variáveis do Sistema & Fluxo */}
      <FlowVariablesModal
        isOpen={isVariablesModalOpen}
        onClose={() => setIsVariablesModalOpen(false)}
        flowNodes={nodes as unknown as FlowNode[]}
      />
    </div>
  );
};

export const FlowEditorPage: React.FC<FlowEditorPageProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowEditorPageContent {...props} />
    </ReactFlowProvider>
  );
};
