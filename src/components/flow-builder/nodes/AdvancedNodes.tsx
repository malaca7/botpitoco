import React from 'react';
import { NodeProps } from '@xyflow/react';
import { 
  GitBranch, 
  Clock, 
  Globe, 
  Webhook, 
  Sliders, 
  Sparkles, 
  Image as ImageIcon, 
  UserCheck,
  Calendar,
  CalendarDays,
  DollarSign,
  UserPlus,
  CheckCircle2,
  ListOrdered,
  OctagonX,
  Scissors,
  ListChecks,
  Layers,
  Users,
  Store,
  ShoppingBag,
  ShoppingCart,
  Truck,
  CreditCard,
  Ruler,
  Luggage,
  Package,
  BadgePercent,
  HeartHandshake
} from 'lucide-react';
import { BaseNode } from './BaseNode';
import { FlowNodeData, Store as StoreType } from '../../../types';
import { VariableBadge } from '../ui/VariableBadge';
import { StorageService } from '../../../lib/storage';
import { cn } from '../../../lib/utils';

export const ConditionNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const outputs = [
    { id: 'true', label: 'SIM / Verdadeiro', color: '!bg-emerald-400' },
    { id: 'false', label: 'NÃO / Falso', color: '!bg-rose-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Condição / IF'}
      subtitle="Desvio Condicional"
      icon={<GitBranch className="w-4 h-4" />}
      iconBg="bg-gradient-to-tr from-purple-600 to-indigo-600"
      accentColor="bg-purple-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={Boolean(config.variable && config.operator)}
    >
      <div className="p-2.5 rounded-xl bg-dark-950/90 border border-purple-500/20 text-[11px] text-slate-300 font-mono flex items-center gap-1.5 flex-wrap">
        {config.variable ? (
          <>
            <span className="text-[10px] text-slate-400 font-sans">Se:</span>
            <VariableBadge name={config.variable} />
            <span className="text-purple-400 font-bold px-1 py-0.5 rounded bg-purple-950/80 border border-purple-800/60 text-[10px]">
              {config.operator || '=='}
            </span>
            <span className="text-slate-200 truncate font-sans font-semibold">"{config.value || ''}"</span>
          </>
        ) : (
          <span className="italic text-slate-500 font-sans text-[10.5px]">Clique para configurar a regra IF...</span>
        )}
      </div>
    </BaseNode>
  );
};

export const DelayNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Aguardar / Espera'}
      subtitle="Pausa temporizada"
      icon={<Clock className="w-4 h-4" />}
      iconBg="bg-amber-600"
      accentColor="bg-amber-600"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.amount)}
    >
      <div className="p-2 rounded-lg bg-dark-950/70 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
        <span>Duração da pausa:</span>
        <span className="font-bold text-amber-400">
          {config.amount || 5} {config.unit || 'segundos'}
        </span>
      </div>
    </BaseNode>
  );
};

export const HttpRequestNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const method = (config.method || 'POST').toUpperCase();
  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    POST: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    PUT: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    PATCH: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    DELETE: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  };

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Requisição HTTP / API'}
      subtitle="Integração externa REST"
      icon={<Globe className="w-4 h-4" />}
      iconBg="bg-sky-500/20 text-sky-400 border border-sky-500/40"
      accentColor="bg-sky-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.url)}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-bold border font-mono",
            methodColors[method] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
          )}>
            {method}
          </span>
          <span className="text-[11px] text-slate-300 truncate flex-1 font-mono" title={config.url || 'https://api.exemplo.com/v1'}>
            {config.url || 'https://api.exemplo.com/v1'}
          </span>
        </div>
        {config.responseVar && (
          <div className="text-[9.5px] text-slate-400 flex items-center gap-1 font-mono">
            <span className="text-sky-400">Salva:</span>
            <span className="px-1.5 py-0.2 bg-dark-900 rounded border border-white/10 text-sky-300">
              {`{{${config.responseVar}}}`}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export const WebhookNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const isEndpoint = config.webhookMode === 'endpoint';
  const displayUrl = isEndpoint 
    ? `/api/wh/${config.endpoint || 'novo-evento'}` 
    : (config.url || config.webhookUrl || 'https://webhook.site/...');
  const isConfigured = Boolean(config.url || config.webhookUrl || config.endpoint);

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Disparo Webhook'}
      subtitle={isEndpoint ? 'Endpoint Interno' : 'Disparo Outbound'}
      icon={<Webhook className="w-4 h-4" />}
      iconBg="bg-teal-500/20 text-teal-400 border border-teal-500/40"
      accentColor="bg-teal-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={isConfigured}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
            POST
          </span>
          <span className="text-[10px] text-slate-400">
            {config.payloadMode === 'custom' ? 'JSON Custom' : 'Payload Completo'}
          </span>
        </div>
        <div className="p-1.5 rounded-lg bg-dark-950/80 border border-teal-500/20 text-[10.5px] text-teal-200 truncate font-mono" title={displayUrl}>
          {displayUrl}
        </div>
      </div>
    </BaseNode>
  );
};

export const VariableNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const assignments = Array.isArray(config.assignments) && config.assignments.length > 0
    ? config.assignments
    : config.varName
      ? [{
          varName: config.varName,
          operation: config.operation || 'set_value',
          value: config.varValue !== undefined ? config.varValue : '',
          contactField: config.contactField || 'first_name',
          sourceVar: config.sourceVar || '',
          mathAmount: config.mathAmount ?? 1,
        }]
      : [];

  const isConfigured = assignments.length > 0 && assignments.some((a: any) => Boolean(a.varName));

  const formatOperationPreview = (item: any) => {
    const op = item.operation || 'set_value';
    switch (op) {
      case 'set_value':
        return <span className="truncate max-w-[90px] text-slate-200">"{String(item.value ?? '')}"</span>;
      case 'set_number':
        return <span className="text-emerald-400 font-bold">{String(item.value ?? 0)}</span>;
      case 'set_boolean':
        return (
          <span className={item.value === true || item.value === 'true' ? 'text-emerald-400' : 'text-rose-400'}>
            {item.value === true || item.value === 'true' ? 'true' : 'false'}
          </span>
        );
      case 'copy_var':
        return <span className="text-violet-300">← {'{{' + (item.sourceVar || item.value || 'origem') + '}}'}</span>;
      case 'contact_field':
        return <span className="text-cyan-300">👤 {item.contactField || 'nome'}</span>;
      case 'math_increment':
        return <span className="text-amber-300 font-bold">+{item.mathAmount ?? 1}</span>;
      case 'math_decrement':
        return <span className="text-amber-300 font-bold">-{item.mathAmount ?? 1}</span>;
      case 'math_add':
        return <span className="text-amber-300 font-bold">+{item.mathAmount ?? item.value ?? 0}</span>;
      case 'math_subtract':
        return <span className="text-amber-300 font-bold">-{item.mathAmount ?? item.value ?? 0}</span>;
      case 'math_multiply':
        return <span className="text-amber-300 font-bold">*{item.mathAmount ?? item.value ?? 1}</span>;
      case 'math_divide':
        return <span className="text-amber-300 font-bold">/{item.mathAmount ?? item.value ?? 1}</span>;
      case 'text_first_name':
        return <span className="text-indigo-300">🔤 1º nome</span>;
      case 'text_uppercase':
        return <span className="text-indigo-300">🔤 MAIÚSC.</span>;
      case 'text_lowercase':
        return <span className="text-indigo-300">🔤 minúsc.</span>;
      case 'text_capitalize':
        return <span className="text-indigo-300">🔤 Capitalize</span>;
      case 'text_numbers_only':
        return <span className="text-indigo-300">🔢 123</span>;
      case 'text_trim':
        return <span className="text-indigo-300">✂ Trim</span>;
      case 'date_today_br':
        return <span className="text-emerald-300">📅 Hoje (BR)</span>;
      case 'date_today_iso':
        return <span className="text-emerald-300">📅 Hoje (ISO)</span>;
      case 'date_tomorrow_br':
        return <span className="text-emerald-300">📅 Amanhã</span>;
      case 'time_now':
        return <span className="text-emerald-300">⏰ Hora Atual</span>;
      case 'datetime_now':
        return <span className="text-emerald-300">📅⏰ Data/Hora</span>;
      case 'timestamp_now':
        return <span className="text-emerald-300">⚡ Timestamp</span>;
      case 'clear_var':
        return <span className="text-rose-400">🗑️ Limpar</span>;
      default:
        return <span className="truncate max-w-[90px] text-slate-200">{String(item.value ?? '')}</span>;
    }
  };

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Definir Variável'}
      subtitle={
        assignments.length > 1
          ? `${assignments.length} variáveis`
          : assignments[0]?.varName
            ? `{{${assignments[0].varName}}}`
            : 'Armazenar estado'
      }
      icon={<Sliders className="w-4 h-4" />}
      iconBg="bg-violet-600"
      accentColor="bg-violet-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={isConfigured}
    >
      {assignments.length > 0 ? (
        <div className="space-y-1.5">
          {assignments.slice(0, 3).map((item: any, idx: number) => (
            <div
              key={idx}
              className="p-1.5 rounded-lg bg-dark-950/70 border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between font-mono gap-1.5"
            >
              <VariableBadge name={item.varName || 'variavel'} />
              <span className="text-slate-500 text-[10px]">=</span>
              <div className="text-[10px]">{formatOperationPreview(item)}</div>
            </div>
          ))}
          {assignments.length > 3 && (
            <p className="text-[9px] text-slate-400 text-center font-medium">
              +{assignments.length - 3} mais variável(is)
            </p>
          )}
        </div>
      ) : (
        <div className="p-2 rounded-lg bg-dark-950/40 border border-dashed border-slate-800 text-[10px] text-slate-400 text-center">
          Clique para configurar variáveis
        </div>
      )}
    </BaseNode>
  );
};

export const AiAgentNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Agente de IA'}
      subtitle="LLM & Base de Conhecimento"
      icon={<Sparkles className="w-4 h-4" />}
      iconBg="bg-gradient-to-tr from-purple-600 to-indigo-500"
      accentColor="bg-gradient-to-r from-purple-500 to-indigo-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.persona || config.model)}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-purple-300 font-semibold">{config.model || 'Gemini 1.5 Pro'}</span>
          <span className="text-slate-400">Temp: {config.temperature || 0.4}</span>
        </div>
        <p className="text-[11px] text-slate-300 p-2 rounded-lg bg-dark-950/70 border border-slate-800 line-clamp-2">
          {config.persona || 'Assistente com persona inteligente e contextual'}
        </p>
      </div>
    </BaseNode>
  );
};

export const MediaNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const mediaType = config.mediaType || 'image';

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Enviar Mídia'}
      subtitle={
        mediaType === 'image'
          ? 'Imagem (Foto / Banner)'
          : mediaType === 'video'
          ? 'Vídeo (MP4)'
          : mediaType === 'audio'
          ? 'Áudio / Voz (PTT)'
          : 'Documento / PDF'
      }
      icon={<ImageIcon className="w-4 h-4" />}
      iconBg="bg-pink-500"
      accentColor="bg-pink-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.mediaUrl)}
    >
      <div className="space-y-2">
        {config.mediaUrl ? (
          <div className="space-y-1.5">
            {mediaType === 'image' && (
              <img
                src={config.mediaUrl}
                alt="Preview"
                className="w-full h-24 object-cover rounded-lg border border-white/10"
              />
            )}
            {mediaType === 'video' && (
              <div className="h-20 rounded-lg bg-pink-950/40 border border-pink-500/30 flex flex-col items-center justify-center text-pink-300 gap-1 text-xs font-semibold">
                <span>🎥 Vídeo Anexado</span>
              </div>
            )}
            {mediaType === 'audio' && (
              <div className="h-16 rounded-lg bg-pink-950/40 border border-pink-500/30 flex items-center justify-center text-pink-300 gap-2 text-xs font-semibold">
                <span>🎙️ Mensagem de Voz (PTT)</span>
              </div>
            )}
            {mediaType === 'document' && (
              <div className="p-2 rounded-lg bg-dark-950 border border-white/10 flex items-center gap-2 text-[11px] text-white">
                <span>📄</span>
                <span className="truncate font-mono">{config.fileName || 'documento.pdf'}</span>
              </div>
            )}
            {config.caption && (
              <p className="text-[10px] text-slate-300 line-clamp-1 italic">
                "{config.caption}"
              </p>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-dark-950/70 border border-slate-800 text-[11px] text-slate-500 italic text-center">
            Clique para configurar mídia ou upload
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export const HumanHandoffNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Transferir para Humano'}
      subtitle="Pausa automação e notifica"
      icon={<UserCheck className="w-4 h-4" />}
      iconBg="bg-rose-500"
      accentColor="bg-rose-500"
      hasInput={true}
      hasOutput={false}
      isConfigured={true}
    >
      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300">
        <span className="font-semibold">Fila: </span>
        {config.department || 'Atendimento Humano Geral'}
      </div>
    </BaseNode>
  );
};

export const CheckContactNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const criteriaLabel = config.checkCriteria === 'appointment_or_order' 
    ? 'Agendamento/Pedido' 
    : config.checkCriteria === 'tag' 
    ? 'Tag de Cliente' 
    : 'CRM / Cadastro no Banco';

  const outputs = [
    { id: 'is_new', label: 'Novo Contato (1ª Vez)', color: '!bg-emerald-400' },
    { id: 'is_existing', label: 'Contato Salvo (Recorrente)', color: '!bg-cyan-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Verificar Contato (Novo vs Salvo)'}
      subtitle="Primeiro Contato vs Contato Salvo"
      icon={<Users className="w-4 h-4" />}
      iconBg="bg-indigo-600"
      accentColor="bg-indigo-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
    >
      <div className="p-2.5 rounded-xl bg-dark-950/90 border border-indigo-500/20 text-[10px] text-slate-300 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-indigo-300 font-bold flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-indigo-400" />
            Critério:
          </span>
          <span className="text-[9px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/60 font-medium">
            {criteriaLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[9.5px]">
          <div className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
            <span className="font-bold block">🟢 1ª Vez (Novo)</span>
            <span className="text-[8.5px] text-slate-400">Coletar nome e dados</span>
          </div>
          <div className="p-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-300">
            <span className="font-bold block">🔵 Salvo (Recorrente)</span>
            <span className="text-[8.5px] text-slate-400">Saudação com nome</span>
          </div>
        </div>

        <div className="pt-1 border-t border-white/5 space-y-1">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-slate-400">Variáveis Disponíveis:</span>
            <span className="text-emerald-400 font-mono">1-Clique Copiar</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <VariableBadge name="is_primeiro_contato" />
            <VariableBadge name="nome_cliente" />
            <VariableBadge name="primeiro_nome" />
            <VariableBadge name="telefone_whatsapp" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

export const ClientUpsertNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const nameVal = config.nameField || config.contactName || '{{nome_cliente}}';
  const phoneVal = config.phoneField || config.phoneVariable || '{{telefone_whatsapp}}';
  const babyVal = config.babyNameField;
  const tagsVal = config.tagsField || config.tags;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Cadastrar / Atualizar Cliente'}
      subtitle="Registra e atualiza cliente no CRM"
      icon={<Users className="w-4 h-4" />}
      iconBg="bg-indigo-600"
      accentColor="bg-indigo-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/90 border border-indigo-500/20 text-[11px] text-slate-300">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-indigo-400 font-bold flex items-center gap-1">
            <Users className="w-3 h-3" />
            Dados do CRM:
          </span>
          <span className="text-emerald-400 font-mono text-[9px]">Auto-Sync</span>
        </div>

        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-400 font-medium">Nome:</span>
            <VariableBadge name={nameVal} />
          </div>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-400 font-medium">Whats:</span>
            <VariableBadge name={phoneVal} />
          </div>

          {babyVal && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-pink-400 font-medium">Bebê:</span>
              <VariableBadge name={babyVal} />
            </div>
          )}

          {tagsVal && (
            <div className="flex items-center gap-1 text-[9.5px] truncate pt-0.5">
              <span className="text-slate-400">Tags:</span>
              <span className="bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/60 font-sans truncate">
                {tagsVal}
              </span>
            </div>
          )}
        </div>

        <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-400">
          <span>Saída:</span>
          <div className="flex gap-1">
            <span className="font-mono text-cyan-300 bg-cyan-950/60 px-1 rounded border border-cyan-800/40">cliente_salvo</span>
            <span className="font-mono text-indigo-300 bg-indigo-950/60 px-1 rounded border border-indigo-800/40">cliente_id</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

export const ClientLookupNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const phoneVar = config.phoneVar || 'telefone_whatsapp';

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Consultar Cliente (CRM)'}
      subtitle="Busca dados pelo WhatsApp"
      icon={<UserCheck className="w-4 h-4" />}
      iconBg="bg-emerald-600"
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/90 border border-emerald-500/20 text-[11px] text-slate-300">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-emerald-400 font-bold">Buscar por:</span>
          <span className="text-emerald-300 font-mono text-[9px]">1-Clique</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400">WhatsApp:</span>
          <VariableBadge name={phoneVar} />
        </div>
        <div className="pt-1 border-t border-white/5 flex flex-wrap gap-1">
          <VariableBadge name="cliente_encontrado" />
          <VariableBadge name="cliente_nome" />
          <VariableBadge name="cliente_bebe" />
        </div>
      </div>
    </BaseNode>
  );
};

export const UpdateContactNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const hasPhoto = config.saveProfilePicture !== false;
  const contactName = config.contactName || config.nameField;
  const phoneLabel = config.phoneMode === 'fixed' 
    ? config.fixedPhone 
    : config.phoneMode === 'variable' 
    ? (config.phoneVariable || 'variável')
    : 'WhatsApp Atual (Interação)';

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Salvar / Vincular Dados'}
      subtitle="Cadastra e atualiza cliente no CRM"
      icon={<Sliders className="w-4 h-4" />}
      iconBg="bg-cyan-600"
      accentColor="bg-cyan-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(contactName || config.tags || config.phoneMode || hasPhoto)}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/80 border border-cyan-500/20 text-[11px] text-slate-300">
        {contactName ? (
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 font-semibold text-[10px]">Nome: </span>
            <VariableBadge name={contactName} />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="text-cyan-400 font-semibold">Nome: </span>
            <span className="text-slate-300">Automático (WhatsApp)</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] text-slate-300 truncate">
          <span className="text-emerald-400 font-semibold">Whats: </span>
          <span className="font-mono text-slate-200 truncate">{phoneLabel}</span>
        </div>

        {hasPhoto && (
          <div className="flex items-center gap-1 text-[9.5px] text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30">
            <span>📸</span>
            <span>Salva Foto do WhatsApp</span>
          </div>
        )}

        {config.babyNameField && (
          <div className="flex items-center gap-1 text-[10px] text-pink-300">
            <span className="font-semibold text-pink-400">Bebê: </span>
            <VariableBadge name={config.babyNameField} />
          </div>
        )}

        {(config.tags || config.tagsField) && (
          <div className="truncate">
            <span className="text-cyan-400 font-semibold text-[10px]">Tags: </span>
            <span className="text-[9.5px] bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60 font-sans">
              {config.tags || config.tagsField}
            </span>
          </div>
        )}

        {config.customFieldKey && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="font-mono text-slate-400">{config.customFieldKey} =</span>
            <VariableBadge name={config.customFieldValue || 'valor'} />
          </div>
        )}

        <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-400">
          <span>Saída:</span>
          <div className="flex gap-1">
            <span className="font-mono text-cyan-300 bg-cyan-950/60 px-1 rounded border border-cyan-800/40">is_primeiro_contato=false</span>
            <span className="font-mono text-emerald-300 bg-emerald-950/60 px-1 rounded border border-emerald-800/40">cliente_salvo</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

export const EndFlowNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Finalizar Fluxo'}
      subtitle="Fim do atendimento"
      icon={<OctagonX className="w-4 h-4" />}
      iconBg="bg-rose-600"
      accentColor="bg-rose-500"
      hasInput={true}
      hasOutput={false}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2 rounded-xl bg-dark-950/80 border border-rose-500/20 text-[11px] text-slate-300">
        <div className="flex items-center gap-1 text-[10px] text-rose-300 font-semibold">
          <OctagonX className="w-3 h-3 text-rose-400" />
          <span>Encerramento do Fluxo</span>
        </div>
        <p className="text-[10px] text-slate-400 line-clamp-2 italic">
          {config.message || 'Atendimento finalizado com sucesso!'}
        </p>
        <div className="flex items-center gap-1 pt-1 border-t border-white/5">
          <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-[9px] text-rose-300 font-mono">
            Sessão Concluída
          </span>
        </div>
      </div>
    </BaseNode>
  );
};

// ==============================================================================
// 🛍️ NÓS ESPECIAIS: LOJA VIRTUAL & ATENDIMENTO ONLINE (PITOCO DE GENTE)
// ==============================================================================

// 1. Seleção de Loja / Filial
export const StoreSelectorNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const [stores, setStores] = React.useState<StoreType[]>(() => {
    try {
      const cached = localStorage.getItem('pitoco_stores') || localStorage.getItem('7assistente_stores');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  React.useEffect(() => {
    let isMounted = true;
    StorageService.getStores().then((list) => {
      if (isMounted && Array.isArray(list) && list.length > 0) {
        setStores(list);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const activeStores = stores.filter(s => s.is_active !== false);
  const effectiveStores = (Array.isArray(config.selectedStores) && config.selectedStores.length > 0)
    ? stores.filter(s => config.selectedStores.includes(s.id) || config.selectedStores.includes(s.slug))
    : (activeStores.length > 0 ? activeStores : stores);

  const colors = ['!bg-amber-400', '!bg-cyan-400', '!bg-emerald-400', '!bg-purple-400', '!bg-rose-400', '!bg-sky-400'];

  // Gera saídas dinamicamente a partir das lojas reais cadastradas no painel admin
  const outputs = effectiveStores.length > 0 ? effectiveStores.map((st, idx) => ({
    id: st.id || `store_${st.slug || idx}`,
    label: st.name,
    color: colors[idx % colors.length],
  })) : [
    { id: 'store-001', label: 'Loja Matriz Centro', color: '!bg-amber-400' },
    { id: 'store-002', label: 'Loja Ipojuca - Filial', color: '!bg-cyan-400' },
    { id: 'store-003', label: 'Atendimento Geral / E-commerce', color: '!bg-emerald-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Escolha de Loja / Filial'}
      subtitle="Direciona para cada loja física/online"
      icon={<Store className="w-4 h-4 text-amber-300" />}
      iconBg="bg-gradient-to-tr from-amber-600 to-yellow-500"
      accentColor="bg-amber-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
      replyMode={config.replyMode || 'send'}
    >
      <div className="space-y-2.5 p-2.5 rounded-xl bg-dark-950/90 border border-amber-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            🏬 Multi-Lojas
          </span>
          <span className="text-[10px] text-amber-300/90 font-mono font-bold">
            {outputs.length} {outputs.length === 1 ? 'Saída Dedicada' : 'Saídas Dedicadas'}
          </span>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-400 block">
            Lojas do seu Painel Admin:
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
            {(effectiveStores.length > 0 ? effectiveStores : [
              { id: 'store-001', name: 'Loja Matriz Centro', city: 'Recife - PE' },
              { id: 'store-002', name: 'Loja Ipojuca - Filial', city: 'Ipojuca - PE' },
              { id: 'store-003', name: 'Atendimento Geral / E-commerce', city: 'Digital' },
            ]).map((st: any, idx: number) => (
              <div key={st.id || idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10.5px] text-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="font-semibold text-white truncate flex-1">{st.name}</span>
                {st.city && <span className="text-[9px] text-slate-400 ml-auto shrink-0 font-mono">{st.city.split('-')[0].trim()}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-amber-400 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="loja_escolhida" />
            <VariableBadge name="loja_id" />
            <VariableBadge name="loja_whatsapp" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 2. Vitrine do Catálogo da Loja Virtual
export const ShowCatalogNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Vitrine da Loja Virtual'}
      subtitle="Exibe peças, fotos, tamanhos e valores"
      icon={<ShoppingBag className="w-4 h-4 text-pink-300" />}
      iconBg="bg-gradient-to-tr from-pink-600 to-rose-500"
      accentColor="bg-pink-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-pink-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-pink-500/15 text-pink-300 border border-pink-500/30">
            🍼 Moda Bebê & Enxovais
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Fotos & Detalhes</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Envia as peças em destaque (Bodies Pima, Macacões Zíper Duplo, Saídas Maternidade) com preços e tamanhos RN a 3 anos.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-pink-400 block">Filtro:</span>
          <span className="px-2 py-0.5 rounded bg-pink-950/60 border border-pink-800/40 text-[10px] text-pink-200 font-mono">
            {config.categoryFilter || 'Todas as Categorias em Destaque'}
          </span>
        </div>
      </div>
    </BaseNode>
  );
};

// 3. Selecionar Produto
export const SelectProductNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Selecionar Produto do Catálogo'}
      subtitle="Botões de escolha de peça e tamanho"
      icon={<ShoppingCart className="w-4 h-4 text-emerald-300" />}
      iconBg="bg-gradient-to-tr from-emerald-600 to-teal-500"
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-emerald-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            🔘 Escolha Interativa
          </span>
          <span className="text-[10px] text-slate-400 font-mono">WhatsApp</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Oferece botões ou opções numeradas para a mamãe selecionar o item que deseja encomendar.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-emerald-400 block">Variáveis Geradas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="produto_selecionado" />
            <VariableBadge name="valor_produto" />
            <VariableBadge name="tamanho_escolhido" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 4. Calculadora de Frete & Entrega
export const ShippingCalculatorNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const outputs = [
    { id: 'shipping_motoboy', label: 'Motoboy Express (Recife)', color: '!bg-amber-400' },
    { id: 'shipping_correios', label: 'Correios SEDEX / PAC', color: '!bg-zinc-400' },
    { id: 'shipping_pickup', label: 'Retirada Grátis em Loja', color: '!bg-emerald-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Calculadora de Frete & Entrega'}
      subtitle="Motoboy, Correios ou Retirada"
      icon={<Truck className="w-4 h-4 text-zinc-100" />}
      iconBg="bg-zinc-800 border border-zinc-700"
      accentColor="bg-zinc-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-zinc-800 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
            🚚 Logística & Prazo
          </span>
          <span className="text-[10px] text-slate-400 font-mono">3 Saídas</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Apresenta opções com taxa fixa (Motoboy R$ 15 / Correios R$ 24,90 / Grátis acima de R$ 250).
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-zinc-300 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="tipo_frete" />
            <VariableBadge name="valor_frete" />
            <VariableBadge name="prazo_entrega" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 5. Cobrança PIX Automática
export const PixPaymentNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const outputs = [
    { id: 'pix_paid', label: 'Comprovante Enviado', color: '!bg-emerald-400' },
    { id: 'pix_help', label: 'Dúvida / Outra Forma', color: '!bg-amber-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Cobrança PIX Automática'}
      subtitle="Chave Oficial & Código Copia e Cola"
      icon={<CreditCard className="w-4 h-4 text-emerald-300" />}
      iconBg="bg-gradient-to-tr from-emerald-600 to-teal-500"
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-emerald-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            ⚡ PIX Instantâneo
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Copia e Cola</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Envia a chave PIX da loja, razão social e o código EMV Copia e Cola para pagamento no app bancário.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-emerald-400 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="pix_copia_cola" />
            <VariableBadge name="valor_total" />
            <VariableBadge name="status_pagamento" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 6. Criar Pedido de Venda Online
export const CartOrderNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Criar Pedido de Venda'}
      subtitle="Gera protocolo PED-XXXXXX e salva no banco"
      icon={<ShoppingBag className="w-4 h-4 text-purple-300" />}
      iconBg="bg-gradient-to-tr from-purple-600 to-indigo-500"
      accentColor="bg-purple-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-purple-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
            📦 Pedido de Venda
          </span>
          <span className="text-[10px] text-slate-400 font-mono">DB Sincronizado</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Registra o pedido oficial com cliente, produto, frete e valor final. Envia resumo detalhado ao cliente.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-purple-400 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="numero_pedido" />
            <VariableBadge name="total_pedido" />
            <VariableBadge name="status_pedido" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 7. Guia de Medidas do Bebê
export const MeasureGuideNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Guia de Medidas (RN a 3 Anos)'}
      subtitle="Tabela de peso, altura e idade"
      icon={<Ruler className="w-4 h-4 text-cyan-300" />}
      iconBg="bg-zinc-800 border border-zinc-700"
      accentColor="bg-zinc-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/90 border border-cyan-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            📐 Medidas Oficiais
          </span>
          <span className="text-[10px] text-slate-400 font-mono">RN ao 3 Anos</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Envia a tabela de medidas orientando o tamanho correto por kg e altura para evitar trocas.
        </p>
      </div>
    </BaseNode>
  );
};

// 8. Checklist Mala de Maternidade
export const LayetteChecklistNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Checklist Mala de Maternidade'}
      subtitle="10 itens essenciais para o hospital"
      icon={<Luggage className="w-4 h-4 text-amber-300" />}
      iconBg="bg-gradient-to-tr from-amber-600 to-orange-500"
      accentColor="bg-amber-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/90 border border-amber-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            🧳 Guia da Mamãe
          </span>
          <span className="text-[10px] text-slate-400 font-mono">10 Itens</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Envia a lista completa da mala para as primeiras 48h com link direto para os produtos correspondentes.
        </p>
      </div>
    </BaseNode>
  );
};

// 9. Consultoria VIP de Enxoval
export const VipConsultationNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const outputs = [
    { id: 'consult_online', label: 'Online (WhatsApp / Vídeo)', color: '!bg-pink-400' },
    { id: 'consult_store', label: 'Presencial na Loja Física', color: '!bg-purple-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Agendar Consultoria de Enxoval'}
      subtitle="Consultoria exclusiva online ou loja física"
      icon={<HeartHandshake className="w-4 h-4 text-pink-300" />}
      iconBg="bg-gradient-to-tr from-pink-600 to-rose-500"
      accentColor="bg-pink-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-pink-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-pink-500/15 text-pink-300 border border-pink-500/30">
            ✨ Consultoria VIP
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Online / Loja</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Coleta o DPP (Data Prevista do Parto), preferências e reserva horário com a especialista em enxoval.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-pink-400 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="tipo_consultoria" />
            <VariableBadge name="data_consultoria" />
            <VariableBadge name="dpp_bebe" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

// 10. Rastreamento de Pedido
export const OrderTrackingNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Rastreamento de Pedido'}
      subtitle="Status de separação, envio e código"
      icon={<Package className="w-4 h-4 text-emerald-300" />}
      iconBg="bg-gradient-to-tr from-emerald-600 to-teal-500"
      accentColor="bg-emerald-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="space-y-1.5 p-2.5 rounded-xl bg-dark-950/90 border border-emerald-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            📦 Consulta Online
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Automático</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Localiza pedidos vinculados ao telefone do WhatsApp e responde com status e rastreamento.
        </p>
      </div>
    </BaseNode>
  );
};

// 11. Cupom de Desconto & Ofertas
export const PromotionalCouponNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const outputs = [
    { id: 'coupon_valid', label: 'Cupom Válido (Aplicado)', color: '!bg-emerald-400' },
    { id: 'coupon_invalid', label: 'Cupom Inválido / Expirado', color: '!bg-rose-400' },
  ];

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Aplicar Cupom de Desconto'}
      subtitle="Valida código e concede desconto"
      icon={<BadgePercent className="w-4 h-4 text-amber-300" />}
      iconBg="bg-gradient-to-tr from-amber-600 to-yellow-500"
      accentColor="bg-amber-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={true}
    >
      <div className="space-y-2 p-2.5 rounded-xl bg-dark-950/90 border border-amber-500/20 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            🎟️ Promoção & Cupons
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Bifurcação</span>
        </div>
        <p className="text-[10.5px] text-slate-300 leading-snug">
          Verifica o cupom digitado pelo cliente (ex: {config.couponCode || 'BEMVINDO10'}) e aplica o abatimento.
        </p>
        <div className="border-t border-white/5 pt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-amber-400 block">Variáveis Gravadas:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VariableBadge name="cupom_aplicado" />
            <VariableBadge name="desconto_valor" />
            <VariableBadge name="total_com_desconto" />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};


