import React from 'react';
import { NodeProps } from '@xyflow/react';
import { Zap, MessageSquare, ListChecks, HelpCircle, CheckCheck } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { FlowNodeData } from '../../../types';
import { VariableBadge } from '../ui/VariableBadge';

export const TriggerNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  const isKeyword = config.eventType === 'keyword';
  const matchType = config.keywordMatchType || 'exact'; // 'exact' | 'contains'
  const keywordsList = (config.keywords || '')
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Gatilho Inicial'}
      subtitle="Início da Automação"
      icon={<Zap className="w-4 h-4 text-amber-300 fill-amber-400/30" />}
      iconBg="bg-gradient-to-tr from-amber-600 to-yellow-500"
      accentColor="bg-amber-500"
      hasInput={false}
      hasOutput={true}
      isConfigured={true}
    >
      <div className="p-2.5 rounded-xl bg-dark-950/80 border border-amber-500/20 text-[11px] text-slate-300 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            ⚡ {isKeyword ? 'Palavra-chave' : 'Mensagem Recebida'}
          </span>
          {isKeyword ? (
            <span
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                matchType === 'exact'
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                  : 'bg-sky-950/90 text-sky-300 border border-sky-500/40'
              }`}
            >
              {matchType === 'exact' ? '🎯 Exata' : '🔍 Contém'}
            </span>
          ) : (
            <span className="text-[9px] text-slate-500 font-mono">WhatsApp</span>
          )}
        </div>

        {isKeyword ? (
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400">
              {matchType === 'exact' ? 'Ativa se a mensagem for exatamente:' : 'Ativa se a mensagem contiver:'}
            </span>
            <div className="flex flex-wrap gap-1">
              {keywordsList.length > 0 ? (
                keywordsList.map((kw: string, i: number) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300 font-mono text-[10px]"
                  >
                    "{kw}"
                  </span>
                ))
              ) : (
                <span className="italic text-slate-500 text-[10px]">Nenhuma palavra definida</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10.5px] text-slate-300">
            Dispara automaticamente ao receber qualquer mensagem do cliente.
          </p>
        )}
      </div>
    </BaseNode>
  );
};

export const MessageNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const text = config.text || '';

  // Highlight {{variables}} inside message preview
  const renderMessageContent = (content: string) => {
    if (!content) {
      return <span className="italic text-slate-500">Clique para escrever a mensagem...</span>;
    }

    const parts = content.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span
            key={index}
            className="px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] mx-0.5"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Enviar Mensagem'}
      subtitle="Mensagem WhatsApp"
      icon={<MessageSquare className="w-4 h-4" />}
      iconBg="bg-gradient-to-tr from-cyan-600 to-sky-500"
      accentColor="bg-cyan-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.text)}
      replyMode={config.replyMode || 'send'}
    >
      {/* WhatsApp-Style Chat Bubble */}
      <div className="relative p-3 rounded-2xl rounded-tl-none bg-dark-950/90 border border-slate-800/80 text-[11px] text-slate-200 shadow-inner">
        <div className="line-clamp-4 leading-relaxed font-sans select-none">
          {renderMessageContent(text)}
        </div>
        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-500">
          <span>{text.length} caracteres</span>
          <CheckCheck className="w-3 h-3 text-cyan-400" />
        </div>
      </div>
    </BaseNode>
  );
};

export const ButtonsNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};
  const buttons = (config.buttons as Array<{ id: string; title: string }>) || [
    { id: 'btn_1', title: 'Opção 1' },
    { id: 'btn_2', title: 'Opção 2' },
  ];

  const colors = ['!bg-primary-400', '!bg-cyan-400', '!bg-emerald-400', '!bg-amber-400'];

  const outputs = buttons.map((b, i) => ({
    id: b.id || `btn_${i + 1}`,
    label: b.title || `Botão ${i + 1}`,
    color: colors[i % colors.length],
  }));

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Botões Interativos'}
      subtitle="Mensagem de Escolha"
      icon={<ListChecks className="w-4 h-4" />}
      iconBg="bg-gradient-to-tr from-brand-600 to-indigo-500"
      accentColor="bg-brand-500"
      hasInput={true}
      hasOutput={false}
      customOutputs={outputs}
      isConfigured={buttons.length > 0}
      replyMode={config.replyMode || 'send'}
    >
      <div className="space-y-2">
        {/* WhatsApp Message Body */}
        <div className="p-2.5 rounded-xl bg-dark-950/90 border border-white/5 text-[11px] text-slate-200">
          <p className="font-medium leading-snug text-white mb-0.5 line-clamp-2">
            {config.bodyText || 'Escolha uma das opções abaixo:'}
          </p>
          {config.footerText && (
            <p className="text-[9px] text-slate-400 italic">
              {config.footerText}
            </p>
          )}
        </div>

        {/* Buttons List Preview */}
        <div className="space-y-1">
          {buttons.map((b, i) => (
            <div key={b.id || i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10.5px]">
              <span className="w-4 h-4 rounded bg-brand-500/20 text-brand-300 font-mono text-[9px] flex items-center justify-center font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-white truncate font-medium flex-1">{b.title || `Opção ${i + 1}`}</span>
            </div>
          ))}
        </div>

        {/* Buttons List Summary */}
        <div className="text-[10px] text-brand-300 font-semibold flex items-center justify-between px-1 pt-0.5">
          <span>Opções Interativas:</span>
          <span className="text-[9px] text-slate-400 font-mono">{buttons.length} saídas ativas</span>
        </div>
      </div>
    </BaseNode>
  );
};

export const QuestionNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = data as unknown as FlowNodeData;
  const config = nodeData.config || {};

  return (
    <BaseNode
      id={id}
      selected={selected}
      title={nodeData.label || 'Fazer Pergunta'}
      subtitle="Coleta de Resposta"
      icon={<HelpCircle className="w-4 h-4" />}
      iconBg="bg-zinc-800 border border-zinc-700"
      accentColor="bg-zinc-500"
      hasInput={true}
      hasOutput={true}
      isConfigured={Boolean(config.questionText)}
      replyMode={config.replyMode || 'send'}
    >
      <div className="space-y-2">
        <div className="p-2.5 rounded-xl bg-dark-950/80 border border-slate-800 text-[11px] text-slate-200 line-clamp-2">
          {config.questionText ? (
            <span>"{config.questionText}"</span>
          ) : (
            <span className="italic text-slate-500">Qual pergunta deseja fazer?</span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
          <span className="px-1.5 py-0.5 rounded bg-dark-850 border border-slate-700/60 text-[9.5px]">
            Tipo: {config.expectedType || 'Texto livre'}
          </span>
          <div className="flex items-center gap-1 font-mono text-[9px]">
            <span className="text-slate-500">Salva:</span>
            <VariableBadge name={config.variableName || 'resposta'} />
          </div>
        </div>
      </div>
    </BaseNode>
  );
};

