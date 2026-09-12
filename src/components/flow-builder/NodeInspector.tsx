import React, { useState, useRef, useEffect } from 'react';
import { FlowNode, Store, Product, Category } from '../../types';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { 
  Trash2, 
  Copy, 
  SlidersHorizontal, 
  Sparkles, 
  X, 
  Plus, 
  Check, 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle2,
  Sliders,
  Hash,
  Type,
  Clock,
  CalendarDays,
  Calculator,
  RotateCcw,
  FileText,
  Wand2,
  Tag,
  Scissors,
  Store as StoreIcon,
  ShoppingBag,
  ShoppingCart,
  Truck,
  CreditCard,
  Ruler,
  Luggage,
  Package,
  BadgePercent,
  HeartHandshake,
  UserCheck,
  Link2,
  User,
  Phone,
  MessageSquare,
  Send,
  GitBranch
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VariableBadge } from './ui/VariableBadge';
import { StorageService } from '../../lib/storage';

const SYSTEM_VARIABLES_LIST = [
  { key: 'etapa_funil', label: 'etapa_funil (Funil CRM)', category: 'Funil' },
  { key: 'interesse', label: 'interesse (Serviço/Produto)', category: 'CRM' },
  { key: 'nome_cliente', label: 'nome_cliente (Nome Completo)', category: 'Contato' },
  { key: 'primeiro_nome', label: 'primeiro_nome (1º Nome)', category: 'Contato' },
  { key: 'telefone_cliente', label: 'telefone_cliente (WhatsApp)', category: 'Contato' },
  { key: 'status', label: 'status (Status Geral)', category: 'Status' },
  { key: 'nome_bebe', label: 'nome_bebe (Nome do Bebê)', category: 'Pitoco CRM' },
  { key: 'data_parto', label: 'data_parto (DPP Gestação)', category: 'Pitoco CRM' },
  { key: 'loja_escolhida', label: 'loja_escolhida (Filial / Loja)', category: 'Vendas' },
  { key: 'cupom_aplicado', label: 'cupom_aplicado (Desconto)', category: 'Vendas' },
  { key: 'numero_pedido', label: 'numero_pedido (Pedido Online)', category: 'Vendas' },
  { key: 'valor_total', label: 'valor_total (Financeiro)', category: 'Financeiro' },
  { key: 'tentativas_contato', label: 'tentativas_contato (Contador)', category: 'Controle' },
  { key: 'observacoes', label: 'observacoes (Notas do Lead)', category: 'CRM' },
  { key: 'atendente_responsavel', label: 'atendente_responsavel (Equipe)', category: 'Equipe' },
  { key: 'origem_lead', label: 'origem_lead (Canal de Entrada)', category: 'Marketing' },
  { key: 'nota_avaliacao', label: 'nota_avaliacao (NPS)', category: 'Avaliação' },
];


export interface NodeInspectorProps {
  node: FlowNode | null;
  onUpdateConfig: (nodeId: string, label: string, config: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onClose: () => void;
  onStartConnecting?: (node: FlowNode, handleId?: string | null, handleLabel?: string) => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
  allNodes?: FlowNode[];
  edges?: any[];
  onSetTargetNode?: (sourceId: string, targetId: string, handleId?: string | null) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  onUpdateConfig,
  onDeleteNode,
  onDuplicateNode,
  onClose,
  onStartConnecting,
  width = 360,
  onWidthChange,
  allNodes = [],
  edges = [],
  onSetTargetNode,
}) => {
  const [localWidth, setLocalWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const startXRef = useRef(0);
  const startWidthRef = useRef(localWidth);

  useEffect(() => {
    Promise.all([
      StorageService.getStores().catch(() => []),
      StorageService.getProducts().catch(() => []),
      StorageService.getCategories().catch(() => []),
    ]).then(([sList, pList, cList]) => {
      if (Array.isArray(sList)) setStores(sList);
      if (Array.isArray(pList)) setProducts(pList);
      if (Array.isArray(cList)) setCategories(cList);
    });
  }, []);

  // Extrair dinamicamente variáveis criadas nos nós do fluxo (ex: perguntas, variáveis)
  const dynamicFlowVars = React.useMemo(() => {
    const list: { tag: string; label: string }[] = [];
    (allNodes || []).forEach(n => {
      const cfg = n.data?.config || {};
      const nodeType = n.data?.nodeType || n.type;
      if (nodeType === 'question' && cfg.variableName) {
        const v = String(cfg.variableName).replace(/[{}]/g, '').trim();
        if (v && !list.some(item => item.tag === `{{${v}}}`)) {
          list.push({ tag: `{{${v}}}`, label: `Pergunta: ${v}` });
        }
      }
      if (nodeType === 'variable' && (cfg.variableName || cfg.varName)) {
        const v = String(cfg.variableName || cfg.varName).replace(/[{}]/g, '').trim();
        if (v && !list.some(item => item.tag === `{{${v}}}`)) {
          list.push({ tag: `{{${v}}}`, label: `Variável: ${v}` });
        }
      }
    });
    return list;
  }, [allNodes]);

  const currentWidth = onWidthChange ? width : localWidth;

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Dragging left increases width, dragging right decreases width
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, 220), 650);
      if (onWidthChange) {
        onWidthChange(newWidth);
      } else {
        setLocalWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange, currentWidth]);

  const inspectorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = inspectorRef.current;
    if (!el) return;

    const stopKeyBubbling = (e: KeyboardEvent) => {
      // Prevents canvas listeners from catching Space, Delete, Backspace, or Ctrl shortcuts from within the inspector
      e.stopPropagation();
    };

    el.addEventListener('keydown', stopKeyBubbling);
    el.addEventListener('keyup', stopKeyBubbling);
    el.addEventListener('keypress', stopKeyBubbling);

    return () => {
      el.removeEventListener('keydown', stopKeyBubbling);
      el.removeEventListener('keyup', stopKeyBubbling);
      el.removeEventListener('keypress', stopKeyBubbling);
    };
  }, []);

  if (!node) return null;

  const { data } = node;
  const config = data.config || {};
  const nodeType = data.nodeType || node.type;

  const handleLabelChange = (newLabel: string) => {
    onUpdateConfig(node.id, newLabel, config);
  };

  const handleConfigChange = (keyOrObj: string | Record<string, any>, value?: any) => {
    if (typeof keyOrObj === 'string') {
      onUpdateConfig(node.id, data.label, { ...config, [keyOrObj]: value });
    } else {
      onUpdateConfig(node.id, data.label, { ...config, ...keyOrObj });
    }
  };

  const updateConfigKey = (key: string, value: any) => {
    handleConfigChange(key, value);
  };

  return (
    <aside
      ref={inspectorRef}
      style={{ width: `${currentWidth}px` }}
      className="bg-dark-900 border-l border-white/5 flex flex-col h-full z-20 shadow-2xl relative transition-all duration-75 select-text nowheel nopan nodrag"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Draggable Resizer Handle on Left Border */}
      <div
        onMouseDown={startResizing}
        className={cn(
          'absolute top-0 left-0 bottom-0 w-2 cursor-col-resize hover:bg-primary-500/50 transition-colors z-30 flex items-center justify-center group select-none',
          isResizing && 'bg-primary-500'
        )}
        title="Arraste para redimensionar painel de propriedades"
      >
        <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full opacity-60 group-hover:opacity-100" />
      </div>

      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between pl-4 sm:pl-5 select-none gap-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <SlidersHorizontal className="w-4 h-4 text-primary-400 flex-shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            {currentWidth < 280 ? 'Propriedades' : 'Propriedades da Função'}
          </h3>
        </div>
        
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Botões de Dimensionamento Rápido do Inspetor */}
          <div className="flex items-center bg-dark-850 p-0.5 rounded-lg border border-white/10 text-[9.5px]">
            <button
              type="button"
              onClick={() => {
                if (onWidthChange) onWidthChange(235);
                else setLocalWidth(235);
              }}
              className={cn(
                "px-1.5 py-0.5 rounded transition-colors font-bold",
                currentWidth <= 260 ? "bg-primary-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              )}
              title="Diminuir para tamanho Mini (235px)"
            >
              Mini
            </button>
            <button
              type="button"
              onClick={() => {
                if (onWidthChange) onWidthChange(350);
                else setLocalWidth(350);
              }}
              className={cn(
                "px-1.5 py-0.5 rounded transition-colors font-bold",
                currentWidth > 260 && currentWidth <= 420 ? "bg-primary-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              )}
              title="Tamanho Normal (350px)"
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => {
                if (onWidthChange) onWidthChange(480);
                else setLocalWidth(480);
              }}
              className={cn(
                "px-1.5 py-0.5 rounded transition-colors font-bold",
                currentWidth > 420 ? "bg-primary-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              )}
              title="Modo Amplo (480px)"
            >
              Amplo
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar propriedades"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body / Config fields */}
      <div className={cn("flex-1 overflow-y-auto", currentWidth < 280 ? "p-3 space-y-3.5" : "p-5 space-y-5")}>
        {/* Ações Rápidas do Card de Função (Conectar com 1 clique, Duplicar, Excluir) */}
        <div className="p-2.5 rounded-2xl bg-dark-950/80 border border-white/10 flex items-center justify-between gap-1.5 shadow-sm">
          {onStartConnecting && (
            <button
              type="button"
              onClick={() => onStartConnecting(node)}
              className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              title="Clique para ligar esta função a outra na tela (sem precisar arrastar)"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Ligar a Outra Função</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDuplicateNode(node.id)}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-white/5 transition-all"
            title="Duplicar Função"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-200 border border-rose-800/40 transition-all"
            title="Excluir Card de Função"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>

        {/* Node Name */}
        <Input
          label="Título da Função"
          value={data.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Ex: Mensagem de Boas-Vindas"
        />

        {/* Modo de Envio no WhatsApp: Responder/Citar vs Apenas Enviar */}
        {nodeType !== 'trigger' && (
          <div className="p-3.5 rounded-2xl bg-dark-950/80 border border-white/10 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Envio no WhatsApp</span>
              </label>
              <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                {config.replyMode === 'reply' ? '💬 Citação Ativa' : '📨 Envio Direto'}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-tight">
              Defina se este card responde citando a mensagem recebida ou se envia a mensagem de forma direta:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleConfigChange('replyMode', 'reply')}
                className={cn(
                  "py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95",
                  config.replyMode === 'reply'
                    ? "bg-purple-950/80 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400/50"
                    : "bg-dark-900/80 border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <span className="text-base">💬</span>
                <span>Responder / Citar</span>
                <span className="text-[8.5px] font-normal opacity-70">Cita a mensagem</span>
              </button>
              <button
                type="button"
                onClick={() => handleConfigChange('replyMode', 'send')}
                className={cn(
                  "py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all active:scale-95",
                  config.replyMode !== 'reply'
                    ? "bg-sky-950/80 border-sky-400 text-sky-200 shadow-md ring-1 ring-sky-400/50"
                    : "bg-dark-900/80 border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <span className="text-base">📨</span>
                <span>Apenas Enviar</span>
                <span className="text-[8.5px] font-normal opacity-70">Direto sem citação</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic fields based on node type */}
        {/* 1. Trigger */}
        {nodeType === 'trigger' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Tipo de Gatilho</label>
              <select
                value={config.eventType || 'any_message'}
                onChange={(e) => handleConfigChange('eventType', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="any_message">Qualquer mensagem recebida</option>
                <option value="keyword">Palavra-chave específica</option>
                <option value="new_contact">Primeiro contato do usuário</option>
                <option value="webhook_event">Evento via Webhook / Meta API</option>
              </select>
            </div>

            {config.eventType === 'keyword' && (
              <Input
                label="Palavras-chave (separadas por vírgula)"
                value={config.keywords || ''}
                onChange={(e) => handleConfigChange('keywords', e.target.value)}
                placeholder="Ex: preco, planos, ajuda, suporte"
              />
            )}
          </div>
        )}

        {/* 2. Message */}
        {nodeType === 'message' && (
          <div className="space-y-4">
            <Textarea
              label="Conteúdo da Mensagem"
              value={config.text || ''}
              onChange={(e) => handleConfigChange('text', e.target.value)}
              placeholder="Digite sua mensagem. Ex: Olá {{nome}}, sou a {{bot_nome}} da {{empresa}}..."
              rows={5}
            />
            
            {/* Variables Panel */}
            <div className="p-3 rounded-xl bg-dark-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Variáveis do Bot & Contato:</span>
                <span className="text-[10px] text-primary-400">Clique para inserir</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { tag: '{{bot_nome}}', label: 'Nome do Bot' },
                  { tag: '{{empresa}}', label: 'Empresa' },
                  { tag: '{{nome}}', label: 'Nome do Cliente' },
                  { tag: '{{telefone}}', label: 'Telefone' },
                  { tag: '{{horario_atendimento}}', label: 'Horário' },
                  { tag: '{{suporte_telefone}}', label: 'Telefone Suporte' },
                  { tag: '{{suporte_email}}', label: 'E-mail' },
                  { tag: '{{site_empresa}}', label: 'Site' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    title={item.label}
                    onClick={() => handleConfigChange('text', `${config.text || ''} ${item.tag}`)}
                    className="px-2 py-0.5 rounded bg-dark-850 hover:bg-primary-950/80 text-primary-300 hover:text-primary-200 border border-slate-700/80 hover:border-primary-500/60 transition-colors font-mono text-[10px] flex items-center gap-1"
                  >
                    <span>+</span> {item.tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Buttons */}
        {nodeType === 'buttons' && (
          <div className="space-y-4">
            <Textarea
              label="Texto do Corpo da Mensagem (Body)"
              value={config.bodyText || ''}
              onChange={(e) => handleConfigChange('bodyText', e.target.value)}
              placeholder="Ex: Escolha uma das opções abaixo para continuarmos:"
              rows={3}
            />

            {/* Atalhos Rápidos de Variáveis para o Corpo */}
            <div className="p-2.5 rounded-xl bg-dark-950/80 border border-brand-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-brand-300 text-[10px] uppercase tracking-wider">Variáveis Dinâmicas:</span>
                <span className="text-[9.5px] text-slate-400">Toque para inserir</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { tag: '{{loja_escolhida}}', label: 'Loja Escolhida' },
                  { tag: '{{nome_cliente}}', label: 'Nome Cliente' },
                  { tag: '{{primeiro_nome}}', label: '1º Nome' },
                  { tag: '{{empresa}}', label: 'Empresa' },
                  { tag: '{{bot_nome}}', label: 'Nome do Bot' },
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleConfigChange('bodyText', `${config.bodyText || ''} ${v.tag}`)}
                    className="px-2 py-0.5 rounded-md bg-dark-900 border border-brand-500/30 text-brand-300 hover:bg-brand-500/20 text-[10px] font-mono transition-all"
                    title={`Inserir ${v.label}`}
                  >
                    + {v.tag}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Texto de Rodapé (Footer - Opcional)"
              value={config.footerText || ''}
              onChange={(e) => handleConfigChange('footerText', e.target.value)}
              placeholder="Ex: Pitoco de Gente • Atendimento Oficial"
            />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-200">
                  Botões Interativos ({ (config.buttons || []).length }/3)
                </label>
                <span className="text-[10px] text-brand-400">Cada botão cria 1 saída dedicada</span>
              </div>

              {(config.buttons || []).map((btn: any, index: number) => {
                const handleId = btn.id || `btn_${index + 1}`;
                const connectedEdge = edges?.find((e: any) => e.source === node.id && (
                  e.sourceHandle === handleId || 
                  e.sourceHandle === btn.id || 
                  e.sourceHandle === `btn_${index + 1}` || 
                  e.sourceHandle === `btn_${index}`
                ));
                const targetNode = allNodes?.find((n: FlowNode) => n.id === connectedEdge?.target);

                return (
                  <div key={index} className="p-2.5 rounded-xl bg-dark-950/80 border border-brand-500/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-brand-500/20 text-brand-400 font-mono text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <Input
                        value={btn.title || ''}
                        onChange={(e) => {
                          const updated = [...(config.buttons || [])];
                          updated[index] = { ...btn, title: e.target.value };
                          handleConfigChange('buttons', updated);
                        }}
                        placeholder={`Texto do Botão ${index + 1}`}
                      />
                      {onStartConnecting && (
                        <button
                          type="button"
                          onClick={() => onStartConnecting(node, handleId, btn.title || `Botão ${index + 1}`)}
                          className="px-2 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-950/40 border border-emerald-500/30 text-[10px] font-bold shrink-0 transition-all"
                          title="Ligar saída deste botão no canvas"
                        >
                          ⚡ Ligar
                        </button>
                      )}
                      {(config.buttons || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (config.buttons || []).filter((_: any, i: number) => i !== index);
                            handleConfigChange('buttons', updated);
                          }}
                          className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/40 shrink-0"
                          title="Excluir este botão"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {allNodes && allNodes.length > 0 && onSetTargetNode && (
                      <div className="pt-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>Destino Conectado (Saída #{index + 1}):</span>
                          {targetNode ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Conectado a: {targetNode.data?.label || targetNode.id}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Desconectado</span>
                          )}
                        </div>
                        <select
                          value={connectedEdge?.target || ''}
                          onChange={(e) => onSetTargetNode(node.id, e.target.value, handleId)}
                          className="w-full bg-dark-900 border border-brand-500/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-400"
                        >
                          <option value="">-- Selecione o Próximo Card deste Botão --</option>
                          {allNodes.filter((n: FlowNode) => n.id !== node.id).map((n: FlowNode) => (
                            <option key={n.id} value={n.id}>
                              ➡️ {n.data?.label || n.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}

              {(config.buttons || []).length < 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const nextIdx = (config.buttons || []).length + 1;
                    const updated = [
                      ...(config.buttons || []),
                      { id: `btn_${nextIdx}`, title: `Opção ${nextIdx}` },
                    ];
                    handleConfigChange('buttons', updated);
                  }}
                  className="w-full"
                >
                  Adicionar Novo Botão
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 4. Question */}
        {nodeType === 'question' && (
          <div className="space-y-4">
            <Textarea
              label="Pergunta a enviar"
              value={config.questionText || ''}
              onChange={(e) => handleConfigChange('questionText', e.target.value)}
              placeholder="Ex: Qual é o seu e-mail corporativo?"
              rows={3}
            />
            <Input
              label="Nome da Variável para salvar a resposta"
              value={config.variableName || ''}
              onChange={(e) => handleConfigChange('variableName', e.target.value)}
              placeholder="Ex: email_cliente"
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Validação Esperada</label>
              <select
                value={config.expectedType || 'text'}
                onChange={(e) => handleConfigChange('expectedType', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="text">Texto Livre</option>
                <option value="email">E-mail válido</option>
                <option value="phone">Telefone / WhatsApp</option>
                <option value="cpf">CPF / CNPJ</option>
                <option value="number">Número</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. Condition */}
        {nodeType === 'condition' && (
          <div className="space-y-4">
            <Input
              label="Nome da Variável a testar"
              value={config.variable || ''}
              onChange={(e) => handleConfigChange('variable', e.target.value)}
              placeholder="Ex: status ou tipo_interesse"
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Operador</label>
              <select
                value={config.operator || '=='}
                onChange={(e) => handleConfigChange('operator', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              >
                <option value="==">Igual a (==)</option>
                <option value="!=">Diferente de (!=)</option>
                <option value="contains">Contém texto</option>
                <option value=">">Maior que (&gt;)</option>
                <option value="<">Menor que (&lt;)</option>
              </select>
            </div>
            <Input
              label="Valor de Comparação"
              value={config.value || ''}
              onChange={(e) => handleConfigChange('value', e.target.value)}
              placeholder="Ex: sim ou enterprise"
            />
          </div>
        )}

        {/* 5.1 Variable Setter (Definir Variável) */}
        {nodeType === 'variable' && (() => {
          const rawAssignments = Array.isArray(config.assignments) && config.assignments.length > 0
            ? config.assignments
            : [{
                varName: config.varName || 'etapa_funil',
                operation: config.operation || 'set_value',
                value: config.varValue !== undefined ? config.varValue : 'agendamento_iniciado',
                contactField: config.contactField || 'first_name',
                sourceVar: config.sourceVar || '',
                mathAmount: config.mathAmount ?? 1,
              }];

          const updateAssignmentsList = (newAssignments: any[]) => {
            const first = newAssignments[0] || {};
            onUpdateConfig(node.id, data.label, {
              ...config,
              assignments: newAssignments,
              varName: first.varName || '',
              varValue: first.value !== undefined ? first.value : '',
              operation: first.operation || 'set_value',
            });
          };

          const handleUpdateItem = (index: number, updatedFields: Record<string, any>) => {
            const next = rawAssignments.map((item: any, i: number) => {
              if (i !== index) return item;
              return { ...item, ...updatedFields };
            });
            updateAssignmentsList(next);
          };

          const handleAddItem = () => {
            const next = [
              ...rawAssignments,
              {
                varName: '',
                operation: 'set_value',
                value: '',
                contactField: 'first_name',
                sourceVar: '',
                mathAmount: 1,
              }
            ];
            updateAssignmentsList(next);
          };

          const handleRemoveItem = (index: number) => {
            if (rawAssignments.length <= 1) return;
            const next = rawAssignments.filter((_: any, i: number) => i !== index);
            updateAssignmentsList(next);
          };

          const handleApplyTemplate = (preset: any[]) => {
            updateAssignmentsList(preset);
          };

          return (
            <div className="space-y-4">
              {/* Quick Templates Header */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                    Modelos Rápidos (1-Clique)
                  </label>
                  <span className="text-[10px] text-slate-500">Auto-preencher</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate([
                      { varName: 'etapa_funil', operation: 'set_value', value: 'agendamento_iniciado' }
                    ])}
                    className="px-2 py-1 rounded-lg bg-dark-850 hover:bg-violet-950/70 border border-slate-700/80 hover:border-violet-500/50 text-[10px] font-medium text-violet-300 transition-colors flex items-center gap-1"
                  >
                    🎯 Etapa Funil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate([
                      { varName: 'primeiro_nome', operation: 'contact_field', contactField: 'first_name' }
                    ])}
                    className="px-2 py-1 rounded-lg bg-dark-850 hover:bg-cyan-950/70 border border-slate-700/80 hover:border-cyan-500/50 text-[10px] font-medium text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    👤 1º Nome
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate([
                      { varName: 'data_registro', operation: 'date_today_br' }
                    ])}
                    className="px-2 py-1 rounded-lg bg-dark-850 hover:bg-emerald-950/70 border border-slate-700/80 hover:border-emerald-500/50 text-[10px] font-medium text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    📅 Data Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate([
                      { varName: 'tentativas_contato', operation: 'math_increment', mathAmount: 1 }
                    ])}
                    className="px-2 py-1 rounded-lg bg-dark-850 hover:bg-amber-950/70 border border-slate-700/80 hover:border-amber-500/50 text-[10px] font-medium text-amber-300 transition-colors flex items-center gap-1"
                  >
                    ➕ Contador (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate([
                      { varName: 'interesse', operation: 'set_value', value: 'saida_maternidade' }
                    ])}
                    className="px-2 py-1 rounded-lg bg-dark-850 hover:bg-pink-950/70 border border-slate-700/80 hover:border-pink-500/50 text-[10px] font-medium text-pink-300 transition-colors flex items-center gap-1"
                  >
                    🏷️ Interesse
                  </button>
                </div>
              </div>

              {/* Assignments List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-violet-400" />
                    Variáveis a Definir ({rawAssignments.length})
                  </label>
                  <span className="text-[10px] text-slate-400">Executadas em ordem</span>
                </div>

                {rawAssignments.map((assignment: any, index: number) => {
                  const op = assignment.operation || 'set_value';

                  return (
                    <div 
                      key={index} 
                      className="p-3 rounded-xl bg-dark-950/80 border border-slate-800/80 hover:border-violet-500/40 transition-all space-y-3"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/40 text-[10px] font-bold text-violet-300 flex items-center justify-center">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-200">
                            {assignment.varName ? (
                              <code className="text-violet-300">{'{{' + assignment.varName + '}}'}</code>
                            ) : (
                              <span className="text-slate-500 italic">Variável sem nome</span>
                            )}
                          </span>
                        </div>
                        {rawAssignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                            title="Remover esta variável"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Variable Name Selection */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-slate-300">Nome da Variável</label>
                        <div className="grid grid-cols-1 gap-1.5">
                          <select
                            value={SYSTEM_VARIABLES_LIST.some(v => v.key === assignment.varName) ? assignment.varName : '__custom__'}
                            onChange={(e) => {
                              if (e.target.value !== '__custom__') {
                                handleUpdateItem(index, { varName: e.target.value });
                              }
                            }}
                            className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            <option value="__custom__">-- Digitar nome personalizado --</option>
                            {SYSTEM_VARIABLES_LIST.map((sv) => (
                              <option key={sv.key} value={sv.key}>
                                {sv.label}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={assignment.varName || ''}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[\s{{}}]/g, '_').toLowerCase();
                              handleUpdateItem(index, { varName: cleaned });
                            }}
                            placeholder="Ex: status_lead, interesse_plano..."
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      {/* Operation Type Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-slate-300">Modo de Atribuição / Operação</label>
                        <select
                          value={op}
                          onChange={(e) => handleUpdateItem(index, { operation: e.target.value })}
                          className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <optgroup label="📝 Valores & Textos">
                            <option value="set_value">Texto / Valor Fixo (com variáveis)</option>
                            <option value="set_number">Número Fixo</option>
                            <option value="set_boolean">Booleano (Verdadeiro / Falso)</option>
                            <option value="copy_var">Copiar de Outra Variável</option>
                          </optgroup>
                          <optgroup label="👤 Dados do Contato">
                            <option value="contact_field">Extrair Campo do Contato</option>
                          </optgroup>
                          <optgroup label="🧮 Cálculos Matemáticos">
                            <option value="math_increment">Incrementar (+1 ou +N)</option>
                            <option value="math_decrement">Decrementar (-1 ou -N)</option>
                            <option value="math_add">Somar (+ N)</option>
                            <option value="math_subtract">Subtrair (- N)</option>
                            <option value="math_multiply">Multiplicar (* N)</option>
                            <option value="math_divide">Dividir (/ N)</option>
                          </optgroup>
                          <optgroup label="🔤 Transformações de Texto">
                            <option value="text_first_name">Apenas Primeiro Nome</option>
                            <option value="text_uppercase">Converter para MAIÚSCULAS</option>
                            <option value="text_lowercase">Converter para minúsculas</option>
                            <option value="text_capitalize">Primeira Letra Maiúscula (Aa)</option>
                            <option value="text_numbers_only">Apenas Dígitos / Números</option>
                            <option value="text_trim">Remover Espaços Extras (Trim)</option>
                          </optgroup>
                          <optgroup label="📅 Data & Hora Dinâmica">
                            <option value="date_today_br">Data de Hoje (DD/MM/AAAA)</option>
                            <option value="date_today_iso">Data de Hoje (AAAA-MM-DD)</option>
                            <option value="date_tomorrow_br">Data de Amanhã (DD/MM/AAAA)</option>
                            <option value="time_now">Hora Atual (HH:mm)</option>
                            <option value="datetime_now">Data e Hora Atual (DD/MM/AAAA HH:mm)</option>
                            <option value="timestamp_now">Timestamp Atual (Milissegundos)</option>
                          </optgroup>
                          <optgroup label="🗑️ Limpeza">
                            <option value="clear_var">Limpar / Esvaziar Variável</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Dynamic Inputs based on Operation */}
                      {op === 'set_value' && (
                        <div className="space-y-2">
                          <Input
                            label="Valor a Atribuir"
                            value={assignment.value !== undefined ? assignment.value : ''}
                            onChange={(e) => handleUpdateItem(index, { value: e.target.value })}
                            placeholder="Ex: agendamento_confirmado ou Olá {{nome_cliente}}"
                          />
                          {/* Variables Quick Tags Panel */}
                          <div className="p-2 rounded-lg bg-dark-900/90 border border-slate-800 text-[10px] text-slate-400 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-300">Inserir tag dinâmica:</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {[
                                '{{bot_nome}}',
                                '{{empresa}}',
                                '{{nome_cliente}}',
                                '{{primeiro_nome}}',
                                '{{telefone}}',
                                '{{data_agendamento}}',
                                '{{horario_agendamento}}',
                                '{{servico_selecionado}}',
                                '{{valor_total}}'
                              ].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const curr = assignment.value !== undefined ? String(assignment.value) : '';
                                    handleUpdateItem(index, { value: curr ? `${curr} ${tag}` : tag });
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-dark-850 hover:bg-violet-950 text-violet-300 border border-slate-700/70 hover:border-violet-500/50 font-mono text-[9px] transition-colors"
                                >
                                  +{tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {op === 'set_number' && (
                        <Input
                          label="Valor Numérico"
                          type="number"
                          step="any"
                          value={assignment.value !== undefined ? assignment.value : 0}
                          onChange={(e) => handleUpdateItem(index, { value: Number(e.target.value) })}
                          placeholder="Ex: 100 ou 49.90"
                        />
                      )}

                      {op === 'set_boolean' && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-medium text-slate-300">Valor Booleano</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(index, { value: true })}
                              className={cn(
                                'py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                                assignment.value === true || assignment.value === 'true'
                                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                                  : 'bg-dark-850 border-slate-800 text-slate-400 hover:text-slate-200'
                              )}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Verdadeiro (true)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(index, { value: false })}
                              className={cn(
                                'py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                                assignment.value === false || assignment.value === 'false'
                                  ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-sm'
                                  : 'bg-dark-850 border-slate-800 text-slate-400 hover:text-slate-200'
                              )}
                            >
                              <X className="w-3.5 h-3.5" />
                              Falso (false)
                            </button>
                          </div>
                        </div>
                      )}

                      {op === 'copy_var' && (
                        <div className="space-y-1.5">
                          <Input
                            label="Variável de Origem para Copiar"
                            value={assignment.sourceVar || assignment.value || ''}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[\s{{}}]/g, '');
                              handleUpdateItem(index, { sourceVar: cleaned, value: cleaned });
                            }}
                            placeholder="Ex: servico_selecionado ou resposta_usuario"
                            className="font-mono text-xs"
                          />
                          <span className="text-[10px] text-slate-400">
                            O conteúdo de <code className="text-violet-300">{'{{' + (assignment.sourceVar || 'origem') + '}}'}</code> será copiado para esta variável.
                          </span>
                        </div>
                      )}

                      {op === 'contact_field' && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-medium text-slate-300">Campo do Contato</label>
                          <select
                            value={assignment.contactField || 'first_name'}
                            onChange={(e) => handleUpdateItem(index, { contactField: e.target.value })}
                            className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            <option value="first_name">Primeiro Nome (Ex: Carlos)</option>
                            <option value="name">Nome Completo / Pushname WhatsApp</option>
                            <option value="phone">Telefone / WhatsApp (Apenas números)</option>
                            <option value="email">E-mail Cadastrado</option>
                            <option value="tags">Tags do Contato</option>
                            <option value="id">ID do Contato</option>
                          </select>
                        </div>
                      )}

                      {(op === 'math_increment' || op === 'math_decrement') && (
                        <Input
                          label="Quantidade do Passo"
                          type="number"
                          min="1"
                          value={assignment.mathAmount ?? 1}
                          onChange={(e) => handleUpdateItem(index, { mathAmount: Number(e.target.value) })}
                          placeholder="Padrão: 1"
                        />
                      )}

                      {(op === 'math_add' || op === 'math_subtract' || op === 'math_multiply' || op === 'math_divide') && (
                        <Input
                          label="Valor da Operação Numérica"
                          type="number"
                          step="any"
                          value={assignment.mathAmount !== undefined ? assignment.mathAmount : (assignment.value || 0)}
                          onChange={(e) => handleUpdateItem(index, { mathAmount: Number(e.target.value), value: Number(e.target.value) })}
                          placeholder="Ex: 10 ou 2.5"
                        />
                      )}

                      {(op.startsWith('text_')) && (
                        <div className="space-y-1.5">
                          <Input
                            label="Variável de Texto de Origem (Opcional)"
                            value={assignment.sourceVar || ''}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[\s{{}}]/g, '');
                              handleUpdateItem(index, { sourceVar: cleaned });
                            }}
                            placeholder="Deixe em branco para usar o próprio nome do contato ou da variável"
                            className="font-mono text-xs"
                          />
                          <span className="text-[10px] text-slate-400">
                            {op === 'text_first_name' && 'Extrai apenas a primeira palavra/nome do cliente.'}
                            {op === 'text_uppercase' && 'Converte todo o texto para MAIÚSCULAS.'}
                            {op === 'text_lowercase' && 'Converte todo o texto para minúsculas.'}
                            {op === 'text_capitalize' && 'Deixa apenas a primeira letra em maiúscula.'}
                            {op === 'text_numbers_only' && 'Remove letras e símbolos, mantendo somente números.'}
                            {op === 'text_trim' && 'Remove espaços em branco sobrando no início e fim.'}
                          </span>
                        </div>
                      )}

                      {(op.startsWith('date_') || op.startsWith('time_') || op === 'timestamp_now') && (
                        <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-800/40 text-[11px] text-violet-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                          <span>
                            Gera automaticamente o valor temporal dinâmico no exato momento da execução do nó.
                          </span>
                        </div>
                      )}

                      {op === 'clear_var' && (
                        <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-[11px] text-rose-300 flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>
                            Esta variável será resetada (esvaziada) da memória do cliente durante a conversa.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Variable Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="w-full border-dashed border-slate-700/80 hover:border-violet-500/60 hover:bg-violet-950/30 text-violet-300 flex items-center justify-center gap-2 py-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Outra Variável neste Nó
                </Button>
              </div>
            </div>
          );
        })()}

        {/* 6. Delay */}
        {nodeType === 'delay' && (
          <div className="space-y-4">
            <Input
              label="Quantidade de Tempo"
              type="number"
              min="1"
              value={config.amount || 5}
              onChange={(e) => handleConfigChange('amount', Number(e.target.value))}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Unidade</label>
              <select
                value={config.unit || 'segundos'}
                onChange={(e) => handleConfigChange('unit', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="segundos">Segundos</option>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
              </select>
            </div>
          </div>
        )}

        {/* 7. AI Agent */}
        {nodeType === 'ai_agent' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Modelo de IA</label>
              <select
                value={config.model || 'gemini-1.5-pro'}
                onChange={(e) => handleConfigChange('model', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Recomendado)</option>
                <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ultra rápido)</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <Input
              label="Persona / Função do Agente"
              value={config.persona || ''}
              onChange={(e) => handleConfigChange('persona', e.target.value)}
              placeholder="Ex: Consultor de Vendas Especialista em SaaS"
            />

            <Textarea
              label="Prompt do Sistema & Instruções"
              value={config.systemPrompt || ''}
              onChange={(e) => handleConfigChange('systemPrompt', e.target.value)}
              placeholder="Instrua o modelo. Ex: Você é a {{bot_nome}}, assistente virtual da empresa {{empresa}}..."
              rows={4}
            />

            {/* Quick Bot Variables for AI */}
            <div className="p-2.5 rounded-xl bg-dark-950/70 border border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-semibold block">Inserir variáveis no Prompt de IA:</span>
              <div className="flex flex-wrap gap-1">
                {['{{bot_nome}}', '{{empresa}}', '{{bot_genero}}', '{{bot_tom}}', '{{horario_atendimento}}'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleConfigChange('systemPrompt', `${config.systemPrompt || ''} ${v}`)}
                    className="px-2 py-0.5 rounded bg-dark-850 hover:bg-purple-950/80 text-purple-300 border border-slate-700/80 text-[10px] font-mono"
                  >
                    + {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Temperatura (Criatividade):</span>
                <span className="font-mono text-primary-400">{config.temperature ?? 0.4}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature ?? 0.4}
                onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-primary-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* 8. Human Handoff */}
        {nodeType === 'human_handoff' && (
          <div className="space-y-4">
            <Input
              label="Fila / Departamento"
              value={config.department || ''}
              onChange={(e) => handleConfigChange('department', e.target.value)}
              placeholder="Ex: Vendas, Suporte Técnico, Financeiro"
            />
            <Textarea
              label="Mensagem de Transferência ao Cliente"
              value={config.notifyMessage || ''}
              onChange={(e) => handleConfigChange('notifyMessage', e.target.value)}
              placeholder="Aguarde um instante, um atendente já vai te responder..."
              rows={3}
            />
          </div>
        )}

        {/* 8.5 Media Node (Image, Video, Audio/Voice, Document) */}
        {nodeType === 'media' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Tipo de Mídia</label>
              <select
                value={config.mediaType || 'image'}
                onChange={(e) => handleConfigChange('mediaType', e.target.value)}
                className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="image">📸 Imagem (JPG, PNG, WebP)</option>
                <option value="video">🎥 Vídeo (MP4)</option>
                <option value="audio">🎙️ Áudio / Mensagem de Voz (PTT)</option>
                <option value="document">📄 Documento / PDF / Catálogo</option>
              </select>
            </div>

            <Input
              label="URL Direta do Arquivo / Mídia"
              value={config.mediaUrl || ''}
              onChange={(e) => handleConfigChange('mediaUrl', e.target.value)}
              placeholder="https://exemplo.com/imagem.png ou link do arquivo"
              hint="Cole o link direto da imagem, vídeo, áudio ou documento."
            />

            {/* Local File Upload Button */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400">Ou envie um arquivo do seu computador:</label>
              <input
                type="file"
                accept={
                  config.mediaType === 'video'
                    ? 'video/*'
                    : config.mediaType === 'audio'
                    ? 'audio/*'
                    : config.mediaType === 'document'
                    ? '.pdf,.doc,.docx,.xls,.xlsx,.zip'
                    : 'image/*'
                }
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      handleConfigChange('mediaUrl', reader.result as string);
                      if (config.mediaType === 'document' && !config.fileName) {
                        handleConfigChange('fileName', file.name);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-pink-500/20 file:text-pink-300 hover:file:bg-pink-500/30 cursor-pointer"
              />
            </div>

            {config.mediaType === 'document' && (
              <Input
                label="Nome do Arquivo (Exibido no WhatsApp)"
                value={config.fileName || ''}
                onChange={(e) => handleConfigChange('fileName', e.target.value)}
                placeholder="Ex: Catalogo-Empresa-2026.pdf"
              />
            )}

            {config.mediaType === 'audio' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-dark-950/70 border border-white/5">
                <input
                  type="checkbox"
                  id="isPtt"
                  checked={config.isPtt !== false}
                  onChange={(e) => handleConfigChange('isPtt', e.target.checked)}
                  className="rounded border-slate-700 text-pink-500 focus:ring-pink-500"
                />
                <label htmlFor="isPtt" className="text-xs text-slate-300 cursor-pointer">
                  Enviar como <strong>Mensagem de Voz Gravada (PTT)</strong> com onda sonora
                </label>
              </div>
            )}

            {config.mediaType !== 'audio' && (
              <Textarea
                label="Legenda da Mídia (Caption)"
                value={config.caption || ''}
                onChange={(e) => handleConfigChange('caption', e.target.value)}
                placeholder="Ex: Olá {{nome_cliente}}! Veja nosso catálogo de produtos acima."
                rows={3}
                hint="Suporta variáveis como {{nome_cliente}}, {{empresa}}, etc."
              />
            )}

            {/* Media Preview Box */}
            {config.mediaUrl && (
              <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 space-y-2">
                <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block">
                  Pré-visualização:
                </span>
                {config.mediaType === 'image' && (
                  <img
                    src={config.mediaUrl}
                    alt="Preview"
                    className="w-full h-36 object-cover rounded-xl border border-white/10"
                  />
                )}
                {config.mediaType === 'video' && (
                  <video
                    src={config.mediaUrl}
                    controls
                    className="w-full h-36 rounded-xl border border-white/10"
                  />
                )}
                {config.mediaType === 'audio' && (
                  <audio src={config.mediaUrl} controls className="w-full" />
                )}
                {config.mediaType === 'document' && (
                  <div className="p-3 rounded-xl bg-dark-850 border border-white/5 flex items-center gap-2 text-xs text-slate-300">
                    <span>📄</span>
                    <span className="font-mono font-bold text-white truncate">
                      {config.fileName || 'documento.pdf'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* Client Lookup (Consultar Cliente CRM) */}
        {nodeType === 'client_lookup' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <UserCheck className="w-3.5 h-3.5" />
                Consulta de Cliente no CRM:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Busca o cliente na base pelo número de telefone do WhatsApp. Se encontrado, carrega todas as informações (nome, bebê, data prevista, tags) nas variáveis da conversa.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-2.5">
              <span className="text-xs font-semibold text-emerald-400 block">
                Saídas de Ramificação no Fluxo:
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span><strong>Encontrado (Verde):</strong> Cliente já possui cadastro na base</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span><strong>Não Encontrado (Amarelo):</strong> Primeiro contato ou sem cadastro</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">
                  Variáveis Carregadas Automaticamente:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">1-Clique Copiar</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <VariableBadge name="cliente_encontrado" />
                <VariableBadge name="cliente_nome" />
                <VariableBadge name="cliente_telefone" />
                <VariableBadge name="cliente_email" />
                <VariableBadge name="cliente_bebe" />
                <VariableBadge name="cliente_dpp" />
                <VariableBadge name="cliente_tags" />
              </div>
            </div>
          </div>
        )}

        {/* Client Upsert (Cadastrar / Atualizar Cliente) */}
        {nodeType === 'client_upsert' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-indigo-300">
                <Users className="w-3.5 h-3.5" />
                Cadastrar / Atualizar Cliente no CRM:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Salva ou atualiza os dados do cliente diretamente no banco de dados e Supabase. Você pode usar variáveis coletadas no fluxo como <code>{'{{nome_cliente}}'}</code>.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Cliente (ou variável):
                </label>
                <Input
                  value={config.nameField ?? '{{nome_cliente}}'}
                  onChange={(e) => updateConfigKey('nameField', e.target.value)}
                  placeholder="Ex: {{nome_cliente}} ou Maria Silva"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefone WhatsApp:
                </label>
                <Input
                  value={config.phoneField ?? '{{telefone_whatsapp}}'}
                  onChange={(e) => updateConfigKey('phoneField', e.target.value)}
                  placeholder="Ex: {{telefone_whatsapp}}"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Bebê:
                  </label>
                  <Input
                    value={config.babyNameField ?? '{{nome_bebe}}'}
                    onChange={(e) => updateConfigKey('babyNameField', e.target.value)}
                    placeholder="Ex: {{nome_bebe}}"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data Parto (DPP):
                  </label>
                  <Input
                    value={config.dueDateField ?? '{{data_parto}}'}
                    onChange={(e) => updateConfigKey('dueDateField', e.target.value)}
                    placeholder="Ex: {{data_parto}}"
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tags (separadas por vírgula):
                </label>
                <Input
                  value={config.tagsField ?? 'Cliente WhatsApp, Bot'}
                  onChange={(e) => updateConfigKey('tagsField', e.target.value)}
                  placeholder="Ex: Cliente WhatsApp, Enxoval"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notas / Observações:
                </label>
                <Input
                  value={config.notesField ?? 'Cadastrado automaticamente pelo bot'}
                  onChange={(e) => updateConfigKey('notesField', e.target.value)}
                  placeholder="Anotações do cliente..."
                  className="text-xs"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400">
                  Variáveis de Retorno:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">1-Clique Copiar</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <VariableBadge name="cliente_salvo" />
                <VariableBadge name="cliente_id" />
              </div>
            </div>
          </div>
        )}

        {/* 12. Check Contact (Primeiro Contato vs Contato Salvo) */}
        {nodeType === 'check_contact' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1.5 shadow-lg shadow-indigo-950/20">
              <span className="font-bold flex items-center gap-1.5 text-indigo-300">
                <Users className="w-4 h-4 text-indigo-400" />
                Detecção Inteligente: Novo Contato vs Contato Salvo
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Verifica automaticamente se quem enviou mensagem é um <strong>Primeiro Contato (Novo Cliente)</strong> ou um <strong>Contato Já Salvo (Cliente Recorrente)</strong> no banco/CRM.
              </p>
            </div>

            {/* Ramificações e Conexão das Saídas */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                Saídas de Ramificação no Fluxo
              </span>

              {/* Ramo 1: Novo Cliente */}
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-300">
                      Saída 1: Se for Novo Cliente (1ª Vez)
                    </span>
                  </div>
                  {onStartConnecting && (
                    <button
                      type="button"
                      onClick={() => onStartConnecting(node, 'is_new', 'Novo Cliente')}
                      className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all"
                    >
                      Ligar Saída 🟢
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Ideal para direcionar para nós de perguntas como: "Qual o seu nome?", coleta de dados ou cadastro inicial.
                </p>
                {allNodes && allNodes.length > 0 && onSetTargetNode && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-medium text-slate-300 mb-1">
                      Destino Conectado:
                    </label>
                    <select
                      value={edges?.find((e: any) => e.source === node.id && (e.sourceHandle === 'is_new' || e.sourceHandle?.includes('new') || e.sourceHandle?.includes('novo')))?.target || ''}
                      onChange={(e) => onSetTargetNode(node.id, e.target.value, 'is_new')}
                      className="w-full bg-dark-900 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      <option value="">-- Selecione o Próximo Passo --</option>
                      {allNodes.filter((n: FlowNode) => n.id !== node.id).map((n: FlowNode) => (
                        <option key={n.id} value={n.id}>
                          ➡️ {n.data?.label || n.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Ramo 2: Cliente Já Salvo */}
              <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-bold text-cyan-300">
                      Saída 2: Se for Cliente Já Salvo (Recorrente)
                    </span>
                  </div>
                  {onStartConnecting && (
                    <button
                      type="button"
                      onClick={() => onStartConnecting(node, 'is_existing', 'Cliente Salvo')}
                      className="px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold transition-all"
                    >
                      Ligar Saída 🔵
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Ideal para enviar mensagem de boas-vindas com nome ("Que bom ter você de volta, *{'{{nome_cliente}}'}*!") ou ir direto ao catálogo/menu.
                </p>
                {allNodes && allNodes.length > 0 && onSetTargetNode && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-medium text-slate-300 mb-1">
                      Destino Conectado:
                    </label>
                    <select
                      value={edges?.find((e: any) => e.source === node.id && (e.sourceHandle === 'is_existing' || e.sourceHandle?.includes('exist') || e.sourceHandle?.includes('salvo') || e.sourceHandle?.includes('recorrente')))?.target || ''}
                      onChange={(e) => onSetTargetNode(node.id, e.target.value, 'is_existing')}
                      className="w-full bg-dark-900 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    >
                      <option value="">-- Selecione o Próximo Passo --</option>
                      {allNodes.filter((n: FlowNode) => n.id !== node.id).map((n: FlowNode) => (
                        <option key={n.id} value={n.id}>
                          ➡️ {n.data?.label || n.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Configurações de Detecção */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">
                ⚙️ Configurações de Identificação
              </span>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-300">Critério para considerar Contato Salvo:</label>
                <select
                  value={config.checkCriteria || 'crm_or_name'}
                  onChange={(e) => handleConfigChange('checkCriteria', e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="crm_or_name">✅ Cadastro no CRM ou Nome Salvo (Padrão Recomendado)</option>
                  <option value="appointment_or_order">📅 Histórico de Agendamento ou Pedido Confirmado</option>
                  <option value="tag">🏷️ Apenas se possuir Tag de Cliente (ex: VIP, Cliente)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-300">Origem do Telefone para Busca:</label>
                <select
                  value={config.phoneMode || 'sender'}
                  onChange={(e) => handleConfigChange('phoneMode', e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sender">📱 WhatsApp do Remetente (Automático)</option>
                  <option value="variable">🔤 Variável coletada em pergunta anterior</option>
                </select>
              </div>

              {config.phoneMode === 'variable' && (
                <Input
                  label="Nome da Variável com o Telefone"
                  value={config.phoneVariable || ''}
                  onChange={(e) => handleConfigChange('phoneVariable', e.target.value)}
                  placeholder="Ex: {{telefone_digitado}} ou telefone_contato"
                  className="text-xs font-mono"
                />
              )}
            </div>

            {/* Variáveis Geradas */}
            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400">
                  Variáveis Geradas Automaticamente:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">1-Clique Copiar</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <VariableBadge name="is_primeiro_contato" />
                <VariableBadge name="tipo_cliente" />
                <VariableBadge name="nome_cliente" />
                <VariableBadge name="primeiro_nome" />
                <VariableBadge name="telefone_whatsapp" />
                <VariableBadge name="tags_contato" />
              </div>
            </div>
          </div>
        )}

        {/* 13. Update Contact Profile (Salvar / Vincular Dados) */}
        {nodeType === 'update_contact' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/60 to-dark-950 border border-cyan-500/30 text-xs text-cyan-200 space-y-1.5 shadow-lg shadow-cyan-950/20">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Salvar / Vincular Dados do Cliente no Banco
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Salva e atualiza o cadastro do cliente no banco de dados e Supabase com <strong>Nome</strong>, <strong>WhatsApp</strong>, <strong>Foto Oficial do WhatsApp</strong> e dados de CRM.
              </p>
            </div>

            {/* 1. Nome do Cliente */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Nome do Cliente (Digitado ou Variável)
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">1-Clique Inserir</span>
              </div>

              {/* Input com binding bidirecional confiável */}
              <Input
                value={config.contactName !== undefined ? config.contactName : (config.nameField !== undefined ? config.nameField : '{{nome_cliente}}')}
                onChange={(e) => {
                  const val = e.target.value;
                  handleConfigChange({
                    contactName: val,
                    nameField: val,
                  });
                }}
                placeholder="Ex: {{resposta_usuario}} ou Maria Oliveira"
                className="text-xs font-mono"
              />

              {/* Botões Rápidos de Inserção de Variável */}
              <div className="space-y-1.5 pt-0.5">
                <span className="text-[10px] font-semibold text-slate-400 block">
                  Inserir Variável Rápida no Nome:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    ...dynamicFlowVars,
                    { tag: '{{resposta_usuario}}', label: 'Última Pergunta' },
                    { tag: '{{nome_cliente}}', label: 'Nome Completo' },
                    { tag: '{{primeiro_nome}}', label: '1º Nome' },
                    { tag: '{{nome}}', label: 'Nome' },
                    { tag: '{{cliente_nome}}', label: 'CRM Nome' },
                  ].filter((item, idx, self) => idx === self.findIndex(t => t.tag === item.tag)).map((item) => {
                    const currentVal = config.contactName !== undefined ? config.contactName : (config.nameField !== undefined ? config.nameField : '{{nome_cliente}}');
                    const isActive = currentVal === item.tag;
                    return (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => {
                          handleConfigChange({
                            contactName: item.tag,
                            nameField: item.tag,
                          });
                        }}
                        className={cn(
                          "px-2 py-1 rounded-lg font-mono text-[10px] transition-all border flex items-center gap-1",
                          isActive
                            ? "bg-cyan-500/25 text-cyan-200 border-cyan-400 font-bold shadow-xs ring-1 ring-cyan-400/40"
                            : "bg-dark-900 hover:bg-cyan-950/80 text-cyan-300 border-slate-700/80 hover:border-cyan-500/60"
                        )}
                      >
                        <span>+ {item.tag}</span>
                        <span className="text-[9px] text-slate-400">({item.label})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">Outras variáveis:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const vTag = `{{${e.target.value}}}`;
                        handleConfigChange({
                          contactName: vTag,
                          nameField: vTag,
                        });
                      }
                    }}
                    className="bg-dark-850 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">+ Escolher outra variável do fluxo...</option>
                    {SYSTEM_VARIABLES_LIST.map((v) => (
                      <option key={v.key} value={v.key}>{v.key} — {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                💡 Dica: Se você perguntou o nome do cliente no passo anterior, use <code>{'{{resposta_usuario}}'}</code> ou a variável que configurou na pergunta.
              </p>
            </div>

            {/* 2. WhatsApp do Cliente */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-2.5">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                WhatsApp do Cliente
              </label>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-300">Origem do Número</label>
                <select
                  value={config.phoneMode || 'sender'}
                  onChange={(e) => handleConfigChange('phoneMode', e.target.value)}
                  className="w-full rounded-xl bg-dark-850 border border-slate-700/60 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="sender">📱 Número que está interagindo no WhatsApp (Automático)</option>
                  <option value="variable">🔤 Variável com outro telefone (ex: {'{{telefone_digitado}}'})</option>
                  <option value="fixed">✏️ Número digitado fixo (ex: 81999998888)</option>
                </select>
              </div>

              {config.phoneMode === 'variable' && (
                <Input
                  label="Nome da Variável com o Telefone"
                  value={config.phoneVariable || ''}
                  onChange={(e) => handleConfigChange('phoneVariable', e.target.value)}
                  placeholder="Ex: {{outro_telefone}} ou telefone_contato"
                  className="text-xs font-mono"
                />
              )}

              {config.phoneMode === 'fixed' && (
                <Input
                  label="Número de Telefone Fixo (DDD + Número)"
                  value={config.fixedPhone || ''}
                  onChange={(e) => handleConfigChange('fixedPhone', e.target.value)}
                  placeholder="Ex: 81999998888"
                  className="text-xs font-mono"
                />
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Gravar em Variável de Saída (Opcional):
                </label>
                <Input
                  value={config.phoneVarName || 'telefone_whatsapp'}
                  onChange={(e) => handleConfigChange('phoneVarName', e.target.value)}
                  placeholder="telefone_whatsapp"
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* 3. Foto de Perfil do WhatsApp */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-2.5">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Foto de Perfil do Cliente
              </label>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveProfilePicCheck"
                  checked={config.saveProfilePicture !== false}
                  onChange={(e) => handleConfigChange('saveProfilePicture', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-dark-800 text-cyan-500 focus:ring-cyan-500 mt-0.5"
                />
                <label htmlFor="saveProfilePicCheck" className="text-xs text-slate-200 cursor-pointer">
                  <span className="font-semibold block">Capturar foto oficial do perfil do WhatsApp</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    O robô baixa a foto pública de perfil do WhatsApp do cliente e vincula ao contato no CRM e na Central de Atendimento.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Ou URL Personalizada de Foto (Opcional):
                </label>
                <Input
                  value={config.customPhotoUrl || ''}
                  onChange={(e) => handleConfigChange('customPhotoUrl', e.target.value)}
                  placeholder="Ex: {{foto_cliente}} ou https://exemplo.com/foto.jpg"
                  className="text-xs"
                />
              </div>
            </div>

            {/* 4. Dados Complementares do CRM (Pitoco de Gente) */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">
                👶 Dados de Enxoval & CRM (Pitoco de Gente)
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Nome do Bebê:
                  </label>
                  <Input
                    value={config.babyNameField || ''}
                    onChange={(e) => handleConfigChange('babyNameField', e.target.value)}
                    placeholder="Ex: {{nome_bebe}}"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Data Parto / DPP:
                  </label>
                  <Input
                    value={config.dueDateField || ''}
                    onChange={(e) => handleConfigChange('dueDateField', e.target.value)}
                    placeholder="Ex: {{data_parto}}"
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  E-mail do Cliente:
                </label>
                <Input
                  value={config.emailField || ''}
                  onChange={(e) => handleConfigChange('emailField', e.target.value)}
                  placeholder="Ex: {{email_cliente}} ou contato@cliente.com"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Tags do Cliente (separadas por vírgula):
                </label>
                <Input
                  value={config.tags !== undefined ? config.tags : (config.tagsField ?? 'Cliente WhatsApp, Bot')}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleConfigChange({
                      tags: val,
                      tagsField: val,
                    });
                  }}
                  placeholder="Ex: Cliente WhatsApp, Enxoval, VIP"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Notas / Observações Internas:
                </label>
                <Input
                  value={config.notesField || ''}
                  onChange={(e) => handleConfigChange('notesField', e.target.value)}
                  placeholder="Ex: Cadastrado no fluxo de boas-vindas"
                  className="text-xs"
                />
              </div>

              <div className="pt-2 border-t border-white/5 space-y-2">
                <span className="text-[11px] font-semibold text-cyan-400 block">
                  Campo Personalizado Adicional (Chave = Valor):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nome do Campo (ex: cidade)"
                    value={config.customFieldKey || ''}
                    onChange={(e) => handleConfigChange('customFieldKey', e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Valor (ex: {{cidade}})"
                    value={config.customFieldValue || ''}
                    onChange={(e) => handleConfigChange('customFieldValue', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <span className="text-xs font-semibold text-white block">Atualizar Conversa Ativa</span>
                  <span className="text-[10px] text-slate-400">Reflete o novo nome e foto no chat imediatamente</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.updateActiveConversation !== false}
                  onChange={(e) => handleConfigChange('updateActiveConversation', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-dark-800 text-cyan-500 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 14. End Flow Node */}
        {(nodeType === 'end_flow' || nodeType === 'finish_flow' || nodeType === 'end') && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Encerramento do Fluxo:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Este nó é o <strong>ponto terminal</strong> da automação. Ele encerra a conversa, reseta a sessão do WhatsApp e envia a mensagem final de conclusão ao cliente.
              </p>
            </div>

            <Textarea
              label="Mensagem de Encerramento (Opcional)"
              value={config.message ?? '🏁 *Atendimento finalizado com sucesso!*\n\nSe precisar de algo mais, basta nos enviar uma nova mensagem. Até logo!'}
              onChange={(e) => handleConfigChange('message', e.target.value)}
              rows={4}
              placeholder="Mensagem de agradecimento / despedida..."
              hint="Suporta variáveis como {{nome_cliente}}, {{empresa}}, {{chave_pix}}, etc."
            />

            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Encerrar Conversa no Painel</span>
                  <span className="text-[10px] text-slate-400">Marca o atendimento como fechado</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.closeConversation !== false}
                  onChange={(e) => handleConfigChange('closeConversation', e.target.checked)}
                  className="rounded bg-dark-900 border-white/10 text-brand-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <span className="text-xs font-semibold text-white block">Resetar Variáveis Temporárias</span>
                  <span className="text-[10px] text-slate-400">Limpa variáveis de etapas para o próximo contato</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.clearVariables !== false}
                  onChange={(e) => handleConfigChange('clearVariables', e.target.checked)}
                  className="rounded bg-dark-900 border-white/10 text-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 15. Store Selector Node (Multi-Filiais) */}
        {nodeType === 'store_selector' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-300">
                <StoreIcon className="w-4 h-4" />
                Seleção de Filial / Loja (Saídas Dedicadas)
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Permite ao cliente escolher com qual unidade física ou atendimento online deseja falar. Cada filial possui uma <strong>saída dedicada</strong> no fluxo.
              </p>
            </div>

            <Textarea
              label="Mensagem de Apresentação das Lojas"
              value={config.introMessage ?? 'Olá! Seja bem-vinda à *Pitoco de Gente*. 🍼 Com qual de nossas unidades você deseja falar hoje?'}
              onChange={(e) => handleConfigChange('introMessage', e.target.value)}
              rows={3}
              placeholder="Mensagem de saudação e apresentação das lojas..."
            />

            {/* Atalhos Rápidos de Variáveis */}
            <div className="p-2.5 rounded-xl bg-dark-950/80 border border-amber-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 text-[10px] uppercase tracking-wider">Variáveis Disponíveis:</span>
                <span className="text-[9.5px] text-slate-400">Toque para inserir</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { tag: '{{nome_cliente}}', label: 'Nome Cliente' },
                  { tag: '{{primeiro_nome}}', label: '1º Nome' },
                  { tag: '{{empresa}}', label: 'Empresa' },
                  { tag: '{{bot_nome}}', label: 'Nome do Bot' },
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleConfigChange('introMessage', `${config.introMessage || ''} ${v.tag}`)}
                    className="px-2 py-0.5 rounded-md bg-dark-900 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[10px] font-mono transition-all"
                    title={`Inserir ${v.label}`}
                  >
                    + {v.tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400">
                  Lojas e Conexões de Saída:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  {stores.length > 0 ? `${stores.length} lojas ativas` : '3 lojas'}
                </span>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-tight">
                Cada loja abaixo possui uma <strong>saída independente</strong>. Conecte-as aos cards de atendimento correspondentes:
              </p>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {(stores.length > 0 ? stores : [
                  { id: 'store-001', name: 'Loja Matriz — Centro', city: 'Recife - PE', address: 'Rua do Sol, 120' },
                  { id: 'store-002', name: 'Loja Ipojuca - Filial', city: 'Ipojuca - PE', address: 'Rodovia PE-060' },
                  { id: 'store-003', name: 'Atendimento Geral / E-commerce', city: 'Digital', address: 'Online / WhatsApp' },
                ]).map((st: any, idx: number) => {
                  const handleId = st.id || `store-${idx + 1}`;
                  const isSelected = !Array.isArray(config.selectedStores) || config.selectedStores.length === 0 || config.selectedStores.includes(st.id) || config.selectedStores.includes(st.slug);
                  const connectedEdge = edges?.find((e: any) => e.source === node.id && (
                    e.sourceHandle === handleId || 
                    e.sourceHandle === st.id || 
                    e.sourceHandle === st.slug ||
                    e.sourceHandle === `store_${st.slug}` ||
                    (st.id === 'store-001' && (e.sourceHandle === 'store_matriz' || e.sourceHandle === 'matriz' || e.sourceHandle === 'store-001')) ||
                    (st.id === 'store-002' && (e.sourceHandle === 'store_ipojuca' || e.sourceHandle === 'store_boulevard' || e.sourceHandle === 'ipojuca' || e.sourceHandle === 'store-002')) ||
                    (st.id === 'store-003' && (e.sourceHandle === 'store_ecommerce' || e.sourceHandle === 'ecommerce' || e.sourceHandle === 'store-003'))
                  ));
                  const targetNode = allNodes?.find((n: FlowNode) => n.id === connectedEdge?.target);

                  return (
                    <div 
                      key={st.id || idx} 
                      className={cn(
                        "p-3 rounded-xl border space-y-2 transition-all",
                        isSelected
                          ? "bg-amber-950/20 border-amber-500/40 text-white"
                          : "bg-dark-900/50 border-white/5 text-slate-400 opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={cn(
                            "w-4 h-4 rounded-md border flex items-center justify-center text-[10px] shrink-0 font-bold",
                            isSelected ? "bg-amber-500 border-amber-400 text-dark-950" : "border-white/20"
                          )}>
                            {isSelected && '✓'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">
                              {st.name}
                            </span>
                            <p className="text-[10px] text-slate-400 truncate">{st.address || st.city || 'Filial Oficial'}</p>
                          </div>
                        </div>
                        <span className="text-[9.5px] px-2 py-0.5 rounded-md bg-white/5 text-amber-300 font-mono shrink-0 ml-2 border border-white/5">
                          Saída #{idx + 1}
                        </span>
                      </div>

                      {allNodes && allNodes.length > 0 && onSetTargetNode && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Destino da Saída:</span>
                            {targetNode ? (
                              <span className="text-amber-300 font-semibold flex items-center gap-1 truncate max-w-[180px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                {targetNode.data?.label || targetNode.id}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Desconectado</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={connectedEdge?.target || ''}
                              onChange={(e) => onSetTargetNode(node.id, e.target.value, handleId)}
                              className="flex-1 bg-dark-900 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                              <option value="">-- Selecione o Próximo Card para esta Filial --</option>
                              {allNodes.filter((n: FlowNode) => n.id !== node.id).map((n: FlowNode) => (
                                <option key={n.id} value={n.id}>
                                  ➡️ {n.data?.label || n.id}
                                </option>
                              ))}
                            </select>
                            {onStartConnecting && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartConnecting(node, handleId, st.name);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 transition-all"
                                title="Ligar saída desta loja no canvas"
                              >
                                ⚡ Ligar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Input
              label="Variável para Salvar a Escolha"
              value={config.storeVarName || 'loja_escolhida'}
              onChange={(e) => handleConfigChange('storeVarName', e.target.value)}
              placeholder="loja_escolhida"
              hint="Armazena o nome da loja selecionada (ex: Loja Matriz — Centro, Loja Ipojuca - Filial)."
            />
          </div>
        )}

        {/* 16. Show Catalog Node */}
        {nodeType === 'show_catalog' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-pink-950/40 border border-pink-500/30 text-xs text-pink-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-pink-300">
                <ShoppingBag className="w-4 h-4" />
                Vitrine da Loja Virtual
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Envia uma apresentação das peças em destaque com fotos, tamanhos (RN a 3 anos) e preços da Pitoco de Gente.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Filtro de Categoria</label>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {categories.length > 0 ? `${categories.length} categorias sincronizadas` : ''}
                </span>
              </div>
              <select
                value={config.categoryFilter || 'all'}
                onChange={(e) => handleConfigChange('categoryFilter', e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="all">Todas as Categorias em Destaque</option>
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="bodies">Bodies & Macacões Confort</option>
                    <option value="saidas">Saídas Maternidade de Tricot Luxo</option>
                    <option value="berco">Kits de Berço & Quarto de Bebê</option>
                    <option value="enxoval">Enxoval Completo para Recém-Nascido</option>
                  </>
                )}
              </select>
            </div>

            <Textarea
              label="Cabeçalho da Mensagem"
              value={config.headerText ?? '🍼 *Vitrine Pitoco de Gente — Moda Bebê & Enxovais*\n\nConheça nossas peças mais amadas pelas mamães:'}
              onChange={(e) => handleConfigChange('headerText', e.target.value)}
              rows={3}
            />

            <Textarea
              label="Rodapé / Instruções"
              value={config.footerText ?? '✨ Trabalhamos do RN ao 3 anos. Peças 100% algodão suedine e tricot antialérgico.'}
              onChange={(e) => handleConfigChange('footerText', e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* 17. Select Product Node */}
        {nodeType === 'select_product' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <ShoppingCart className="w-4 h-4" />
                Seleção de Produto Interativo
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Disponibiliza botões clicáveis no WhatsApp com os produtos mais vendidos para o cliente escolher.
              </p>
            </div>

            <Textarea
              label="Mensagem de Introdução"
              value={config.introMessage ?? 'Qual peça da Pitoco de Gente você gostaria de escolher agora?'}
              onChange={(e) => handleConfigChange('introMessage', e.target.value)}
              rows={2}
            />

            <Input
              label="Variável do Produto"
              value={config.productVarName || 'produto_selecionado'}
              onChange={(e) => handleConfigChange('productVarName', e.target.value)}
              placeholder="produto_selecionado"
            />

            <Input
              label="Variável do Preço"
              value={config.priceVarName || 'valor_produto'}
              onChange={(e) => handleConfigChange('priceVarName', e.target.value)}
              placeholder="valor_produto"
            />
          </div>
        )}

        {/* 18. Shipping Calculator Node */}
        {nodeType === 'shipping_calculator' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-dark-900 border border-zinc-700/60 text-xs text-zinc-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-zinc-100">
                <Truck className="w-4 h-4" />
                Calculadora de Frete & Entrega (3 Saídas)
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Calcula o frete e disponibiliza 3 saídas independentes: <strong>1. Motoboy Express</strong> (<code>shipping_motoboy</code>), <strong>2. Correios PAC/SEDEX</strong> (<code>shipping_correios</code>) e <strong>3. Retirada em Loja</strong> (<code>shipping_pickup</code>).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Valor Motoboy (R$)"
                type="number"
                step="0.5"
                value={config.motoboyPrice ?? 15.00}
                onChange={(e) => handleConfigChange('motoboyPrice', parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Valor Correios (R$)"
                type="number"
                step="0.5"
                value={config.correiosPrice ?? 24.90}
                onChange={(e) => handleConfigChange('correiosPrice', parseFloat(e.target.value) || 0)}
              />
            </div>

            <Input
              label="Frete Grátis Acima de (R$)"
              type="number"
              value={config.freeShippingThreshold ?? 250.00}
              onChange={(e) => handleConfigChange('freeShippingThreshold', parseFloat(e.target.value) || 0)}
              hint="Pedidos com valor igual ou superior ganham frete gratuito."
            />

            <Textarea
              label="Texto Explicativo de Entrega"
              value={config.introMessage ?? 'Como você prefere receber seu pedido da Pitoco de Gente?'}
              onChange={(e) => handleConfigChange('introMessage', e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* 19. Pix Payment Node */}
        {nodeType === 'pix_payment' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <CreditCard className="w-4 h-4" />
                Cobrança PIX Automática (2 Saídas)
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Envia os dados do PIX oficial e o código Copia e Cola para pagamento rápido. Saídas: <strong>Comprovante Enviado</strong> (<code>pix_paid</code>) e <strong>Dúvida / Outra Forma</strong> (<code>pix_help</code>).
              </p>
            </div>

            <Input
              label="Chave PIX Oficial"
              value={config.pixKey ?? 'financeiro@pitocodegente.com.br'}
              onChange={(e) => handleConfigChange('pixKey', e.target.value)}
              placeholder="Chave CNPJ, E-mail ou Telefone..."
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Tipo da Chave"
                value={config.pixKeyType ?? 'E-mail'}
                onChange={(e) => handleConfigChange('pixKeyType', e.target.value)}
                placeholder="CNPJ, E-mail, Celular..."
              />
              <Input
                label="Banco / Instituição"
                value={config.pixBank ?? 'Banco Santander / Inter'}
                onChange={(e) => handleConfigChange('pixBank', e.target.value)}
              />
            </div>

            <Input
              label="Beneficiário / Razão Social"
              value={config.pixBeneficiary ?? 'Pitoco de Gente Bebê e Criança LTDA'}
              onChange={(e) => handleConfigChange('pixBeneficiary', e.target.value)}
            />

            <Textarea
              label="Instruções de Pagamento"
              value={config.paymentInstructions ?? 'Após efetuar o PIX, toque no botão *Já Efetuei o Pagamento* ou envie a foto do comprovante aqui para agilizar o envio! 🚀'}
              onChange={(e) => handleConfigChange('paymentInstructions', e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* 20. Cart Order Node */}
        {nodeType === 'cart_order' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-purple-300">
                <ShoppingBag className="w-4 h-4" />
                Criar Pedido de Venda Online
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Gera o protocolo oficial <code>PED-XXXXXX</code>, grava no banco de dados e exibe o resumo completo com total, frete e itens para a mamãe.
              </p>
            </div>

            <Input
              label="Prefixo do Pedido"
              value={config.orderPrefix ?? 'PED-'}
              onChange={(e) => handleConfigChange('orderPrefix', e.target.value)}
              placeholder="PED-"
            />

            <Input
              label="Status Inicial"
              value={config.initialStatus ?? 'Aguardando Pagamento'}
              onChange={(e) => handleConfigChange('initialStatus', e.target.value)}
              placeholder="Aguardando Pagamento"
            />

            <Textarea
              label="Resumo do Pedido (Template)"
              value={config.summaryMessage ?? '🎉 *Pedido Realizado com Sucesso!*\n\n• *Protocolo:* {{numero_pedido}}\n• *Cliente:* {{nome_cliente}}\n• *Item:* {{produto_selecionado}}\n• *Entrega:* {{tipo_frete}} ({{valor_frete}})\n• *Valor Total:* {{valor_total}}\n\nNossa equipe já está separando com todo amor e carinho! 💕'}
              onChange={(e) => handleConfigChange('summaryMessage', e.target.value)}
              rows={5}
            />
          </div>
        )}

        {/* 21. Measure Guide Node */}
        {nodeType === 'measure_guide' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                <Ruler className="w-4 h-4" />
                Guia de Medidas do Bebê (RN a 3 Anos)
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Envia a tabela oficial de tamanhos por peso e estatura da Pitoco de Gente para garantir o tamanho perfeito para o bebê.
              </p>
            </div>

            <Textarea
              label="Texto de Apresentação"
              value={config.introText ?? '📏 *Tabela de Medidas Pitoco de Gente (RN a 3 Anos)*\n\nConfira as referências para não errar no tamanho:'}
              onChange={(e) => handleConfigChange('introText', e.target.value)}
              rows={3}
            />

            <Textarea
              label="Dicas Adicionais para Enxoval"
              value={config.footerTips ?? '💡 *Dica da Especialista:* Bebês crescem muito rápido nos primeiros 3 meses! Sugerimos comprar poucas peças RN e focar nos tamanhos P e M.'}
              onChange={(e) => handleConfigChange('footerTips', e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* 22. Layette Checklist Node */}
        {nodeType === 'layette_checklist' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-300">
                <Luggage className="w-4 h-4" />
                Checklist Mala de Maternidade
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Envia a lista com os 10 itens essenciais recomendados para a mala do hospital (bebê + mamãe).
              </p>
            </div>

            <Textarea
              label="Texto Introdutório"
              value={config.introText ?? '🧳 *Checklist da Mala de Maternidade — Pitoco de Gente*\n\nTudo o que você precisa levar para as primeiras 48 horas no hospital:'}
              onChange={(e) => handleConfigChange('introText', e.target.value)}
              rows={3}
            />

            <Textarea
              label="Dica Final"
              value={config.footerTips ?? '💖 Temos kits completos de malas, saídas maternidade e roupinhas já lavadas e prontas para uso!'}
              onChange={(e) => handleConfigChange('footerTips', e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* 23. VIP Consultation Node */}
        {nodeType === 'vip_consultation' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-pink-950/40 border border-pink-500/30 text-xs text-pink-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-pink-300">
                <HeartHandshake className="w-4 h-4" />
                Consultoria VIP de Enxoval (2 Saídas)
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Agendamento de consultoria personalizada com uma consultora da Pitoco de Gente. Saídas: <strong>Online</strong> (<code>consult_online</code>) e <strong>Presencial em Loja</strong> (<code>consult_store</code>).
              </p>
            </div>

            <Textarea
              label="Mensagem de Convite"
              value={config.introMessage ?? '✨ Que alegria poder fazer parte desse momento tão mágico! Nossa consultoria de enxoval é 100% gratuita e personalizada.\n\nComo você prefere ser atendida?'}
              onChange={(e) => handleConfigChange('introMessage', e.target.value)}
              rows={3}
            />

            <Input
              label="Nome da Consultora"
              value={config.consultantName ?? 'Sofia — Especialista em Moda Bebê'}
              onChange={(e) => handleConfigChange('consultantName', e.target.value)}
            />
          </div>
        )}

        {/* 24. Order Tracking Node */}
        {nodeType === 'order_tracking' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <Package className="w-4 h-4" />
                Rastreamento de Pedido
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Localiza automaticamente os pedidos vinculados ao número do WhatsApp do cliente e envia o status de separação, envio e código de rastreio.
              </p>
            </div>

            <Textarea
              label="Mensagem Quando Não Houver Pedido"
              value={config.notFoundMessage ?? 'Não encontramos nenhum pedido pendente vinculado ao seu número. Digite *0* para falar com uma de nossas consultoras ou envie o número do pedido.'}
              onChange={(e) => handleConfigChange('notFoundMessage', e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* 25. Promotional Coupon Node */}
        {nodeType === 'promotional_coupon' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-yellow-950/40 border border-yellow-500/30 text-xs text-yellow-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-yellow-300">
                <BadgePercent className="w-4 h-4" />
                Aplicar Cupom de Desconto (2 Saídas)
              </span>
              <p className="text-[11px] text-slate-300 leading-snug">
                Valida o cupom promocional e concede o desconto. Saídas: <strong>Cupom Válido</strong> (<code>coupon_valid</code>) e <strong>Cupom Inválido / Expirado</strong> (<code>coupon_invalid</code>).
              </p>
            </div>

            <Input
              label="Código do Cupom Aceito"
              value={config.couponCode ?? 'BEMVINDO10'}
              onChange={(e) => handleConfigChange('couponCode', e.target.value.toUpperCase())}
              placeholder="BEMVINDO10"
            />

            <Input
              label="Porcentagem de Desconto (%)"
              type="number"
              value={config.discountPercentage ?? 10}
              onChange={(e) => handleConfigChange('discountPercentage', parseFloat(e.target.value) || 0)}
              placeholder="10"
            />

            <Input
              label="Valor Mínimo do Pedido (R$)"
              type="number"
              value={config.minOrderValue ?? 0}
              onChange={(e) => handleConfigChange('minOrderValue', parseFloat(e.target.value) || 0)}
              placeholder="0 para qualquer valor"
            />
          </div>
        )}
      </div>

      {/* Footer Actions (Duplicate / Delete) */}
      <div className="p-4 border-t border-white/5 bg-dark-950/80 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Copy className="w-3.5 h-3.5" />}
          onClick={() => onDuplicateNode(node.id)}
        >
          Duplicar
        </Button>
        <Button
          size="sm"
          variant="danger"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => onDeleteNode(node.id)}
        >
          Excluir Card de Função
        </Button>
      </div>
    </aside>
  );
};
