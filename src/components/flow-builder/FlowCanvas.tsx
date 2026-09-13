import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  NodeTypes,
  Edge,
  Node,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ConnectionMode,
  ConnectionLineType,
  Connection,
  Panel,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, Sparkles } from 'lucide-react';

import { TriggerNode, MessageNode, ButtonsNode, QuestionNode } from './nodes/StandardNodes';
import { 
  ConditionNode, 
  DelayNode, 
  HttpRequestNode, 
  WebhookNode, 
  VariableNode, 
  AiAgentNode, 
  MediaNode, 
  HumanHandoffNode,
  UpdateContactNode,
  ClientUpsertNode,
  ClientLookupNode,
  CheckContactNode,
  EndFlowNode,
  StoreSelectorNode,
  ShowCatalogNode,
  SelectProductNode,
  ShippingCalculatorNode,
  PixPaymentNode,
  CartOrderNode,
  MeasureGuideNode,
  LayetteChecklistNode,
  VipConsultationNode,
  OrderTrackingNode,
  PromotionalCouponNode,
} from './nodes/AdvancedNodes';

import { useFlowConnection } from './FlowConnectionContext';

export interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onPaneClick?: () => void;
  edgeType?: string;
  onDrop?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeDoubleClick?: (event: React.MouseEvent, edge: Edge) => void;
  onAutoOrganize?: () => void;
}

// Widget flutuante de Zoom e Ferramentas com indicação exata de porcentagem e comandos rápidos
const FlowCanvasZoomControls: React.FC<{ onAutoOrganize?: () => void }> = ({ onAutoOrganize }) => {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const zoomPct = Math.round((zoom || 1) * 100);

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-dark-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/80">
      {/* Zoom Out (-): Permite reduzir muito o zoom para ver o fluxo macro */}
      <button
        type="button"
        onClick={() => zoomOut({ duration: 250 })}
        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-white/5"
        title="Reduzir Zoom (Menos Zoom) • Atalho: - ou Ctrl+Rolar"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Indicador de Zoom % (Clique rápido para redefinir para 100%) */}
      <button
        type="button"
        onClick={() => zoomTo(1, { duration: 250 })}
        className="px-2.5 h-8 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center justify-center transition-all min-w-[56px] border border-white/5 hover:border-cyan-500/30"
        title={`Nível de zoom atual: ${zoomPct}%. Clique para redefinir para 100%`}
      >
        {zoomPct}%
      </button>

      {/* Zoom In (+): Permite aproximar para ver microdetalhes e editar textos */}
      <button
        type="button"
        onClick={() => zoomIn({ duration: 250 })}
        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-white/5"
        title="Aumentar Zoom (Mais Zoom) • Atalho: + ou Ctrl+Rolar"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

      {/* Centralizar e Enquadrar todo o fluxo */}
      <button
        type="button"
        onClick={() => fitView({ padding: 0.25, duration: 400 })}
        className="px-2.5 h-8 rounded-xl bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 border border-white/5 hover:border-sky-500/30"
        title="Enquadrar e centralizar todo o fluxo na tela"
      >
        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline">Enquadrar</span>
      </button>

      {/* Auto-Organizar Cards e Conexões com alinhamento perfeito */}
      {onAutoOrganize && (
        <>
          <div className="w-[1px] h-5 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={onAutoOrganize}
            className="px-3 h-8 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-500/40 hover:to-teal-500/40 border border-emerald-500/40 text-emerald-300 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
            title="Auto-Organizar cards com alinhamento perfeito de cima para baixo (Alt+O)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Auto-Organizar</span>
          </button>
        </>
      )}
    </div>
  );
};

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  edgeType = 'smoothstep',
  onDrop,
  onDragOver,
  onEdgeClick,
  onEdgeDoubleClick,
  onAutoOrganize,
}) => {
  const connCtx = useFlowConnection();

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      message: MessageNode,
      buttons: ButtonsNode,
      question: QuestionNode,
      condition: ConditionNode,
      delay: DelayNode,
      http_request: HttpRequestNode,
      webhook: WebhookNode,
      variable: VariableNode,
      ai_agent: AiAgentNode,
      media: MediaNode,
      human_handoff: HumanHandoffNode,
      update_contact: UpdateContactNode,
      save_contact: UpdateContactNode,
      client_upsert: ClientUpsertNode,
      client_lookup: ClientLookupNode,
      check_contact: CheckContactNode,
      end_flow: EndFlowNode,
      finish_flow: EndFlowNode,
      end: EndFlowNode,
      // Funções de Loja Virtual & Atendimento Pitoco de Gente
      store_selector: StoreSelectorNode,
      show_catalog: ShowCatalogNode,
      select_product: SelectProductNode,
      shipping_calculator: ShippingCalculatorNode,
      pix_payment: PixPaymentNode,
      cart_order: CartOrderNode,
      measure_guide: MeasureGuideNode,
      layette_checklist: LayetteChecklistNode,
      vip_consultation: VipConsultationNode,
      order_tracking: OrderTrackingNode,
      promotional_coupon: PromotionalCouponNode,
    }),
    []
  );

  const handlePaneClick = () => {
    if (connCtx?.isConnecting) {
      connCtx.cancelConnecting();
    }
    if (onPaneClick) {
      onPaneClick();
    }
  };

  return (
    <div
      className="w-full h-full relative bg-dark-950 select-none"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Banner Flutuante de Modo de Conexão Ativo */}
      {connCtx?.connectingSource && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-dark-900/95 border border-cyan-500/60 shadow-2xl shadow-cyan-950/80 rounded-full px-5 py-2.5 backdrop-blur-md animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
            <span>Ligando:</span>
            <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/30">
              {connCtx.connectingSource.nodeLabel}
              {connCtx.connectingSource.branchLabel ? ` (${connCtx.connectingSource.branchLabel})` : ''}
            </span>
            <span className="text-slate-300">➔ Clique no Card de destino ou no ponto azul</span>
          </div>
          <button
            type="button"
            onClick={connCtx.cancelConnecting}
            className="ml-2 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-all hover:scale-105"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={handlePaneClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        deleteKeyCode="Delete"
        panActivationKeyCode={null}
        multiSelectionKeyCode={null}
        zoomActivationKeyCode={null}
        preventScrolling={false}
        edgesFocusable={true}
        edgesReconnectable={true}
        fitView
        fitViewOptions={{ padding: 0.25, includeHiddenNodes: false }}
        snapToGrid
        snapGrid={[15, 15]}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={60}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        minZoom={0.02}
        maxZoom={4.0}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        connectionLineType={
          edgeType === 'smoothstep'
            ? ConnectionLineType.SmoothStep
            : edgeType === 'straight'
            ? ConnectionLineType.Straight
            : ConnectionLineType.Bezier
        }
        connectionLineStyle={{
          stroke: '#38bdf8',
          strokeWidth: 3,
          strokeDasharray: '6,4',
        }}
        defaultEdgeOptions={{
          type: edgeType,
          animated: true,
          style: { stroke: '#06b6d4', strokeWidth: 2.5 },
          pathOptions: { offset: 35, borderRadius: 20 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#334155"
          gap={24}
          size={1.5}
          variant={BackgroundVariant.Dots}
          className="opacity-40"
        />

        {/* Barra Flutuante de Zoom & Controles no Canto Inferior Esquerdo */}
        <Panel position="bottom-left" className="!m-4 z-40 select-none">
          <FlowCanvasZoomControls onAutoOrganize={onAutoOrganize} />
        </Panel>
      </ReactFlow>
    </div>
  );
};
