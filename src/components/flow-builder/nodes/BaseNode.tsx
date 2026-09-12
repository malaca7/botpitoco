import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../../lib/utils';
import { CheckCircle2, AlertCircle, Link2 } from 'lucide-react';
import { useFlowConnection } from '../FlowConnectionContext';

export interface BaseNodeProps {
  id: string;
  selected?: boolean;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  accentColor: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  isConfigured?: boolean;
  children?: React.ReactNode;
  customOutputs?: Array<{ id: string; label: string; color?: string }>;
  replyMode?: 'reply' | 'send';
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  selected,
  title,
  subtitle,
  icon,
  iconBg,
  accentColor,
  hasInput = true,
  hasOutput = true,
  isConfigured = true,
  children,
  customOutputs,
  replyMode,
}) => {
  const connCtx = useFlowConnection();
  const isConnecting = connCtx?.isConnecting ?? false;
  const isSource = connCtx?.connectingSource?.nodeId === id;
  const isEligibleTarget = isConnecting && !isSource && hasInput;

  return (
    <div
      onClick={(e) => {
        if (isEligibleTarget && connCtx) {
          e.stopPropagation();
          connCtx.completeConnecting(id, null);
        }
      }}
      className={cn(
        'w-[310px] sm:w-[330px] rounded-2xl bg-gradient-to-b from-dark-900/95 to-dark-950/95 backdrop-blur-xl border transition-all duration-200 shadow-2xl relative select-none group/node',
        isSource
          ? 'ring-4 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)] border-emerald-400 scale-[1.01]'
          : isEligibleTarget
          ? 'ring-2 ring-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.45)] animate-pulse border-cyan-400/80 cursor-pointer hover:scale-[1.02]'
          : selected
          ? 'border-primary-400 ring-2 ring-primary-500/40 shadow-glow-primary scale-[1.01]'
          : 'border-white/10 hover:border-white/25 hover:shadow-cyan-950/30'
      )}
    >
      {/* Target Banner quando este card for elegível para receber ligação */}
      {isEligibleTarget && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap bg-cyan-500 text-dark-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-cyan-500/30 flex items-center gap-1 animate-bounce">
          <span>👉 Clique aqui para conectar!</span>
        </div>
      )}

      {/* Top Accent Strip */}
      <div className={cn('h-1.5 w-full rounded-t-2xl', accentColor)} />

      {/* Target Handle (Input) at Top - Centralized for Top-to-Bottom Flow */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ width: isEligibleTarget ? 28 : 22, height: isEligibleTarget ? 28 : 22 }}
          className={cn(
            '!border-2 !border-dark-950 shadow-lg -top-3 left-1/2 -translate-x-1/2 cursor-crosshair z-30 transition-all rounded-full',
            isEligibleTarget
              ? '!bg-cyan-300 ring-8 ring-cyan-400/70 animate-pulse scale-125 !cursor-pointer'
              : '!bg-sky-400 ring-4 ring-sky-500/30 hover:ring-sky-400 hover:scale-110'
          )}
          onClick={(e) => {
            if (isEligibleTarget && connCtx) {
              e.stopPropagation();
              connCtx.completeConnecting(id, null);
            }
          }}
          title={isEligibleTarget ? '👉 Clique aqui para ligar a este Card de Funções!' : 'Entrada (Ponto de conexão desta função)'}
        />
      )}

      {/* Node Header */}
      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 transition-transform group-hover/node:scale-105',
              iconBg
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">{title}</h4>
            {subtitle && <p className="text-[10.5px] text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Configuration status indicator & Quick Connect Action */}
        <div className="flex items-center gap-1.5">
          {hasOutput && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (connCtx) {
                  if (isSource) {
                    connCtx.cancelConnecting();
                  } else {
                    connCtx.startConnecting(id, null, title, 'Saída Principal');
                  }
                }
              }}
              className={cn(
                'p-1.5 rounded-lg border transition-all',
                isSource
                  ? 'bg-emerald-500 text-dark-950 border-emerald-400 shadow-md font-bold'
                  : 'bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40'
              )}
              title="Ligar este Card de Funções a outro (clique aqui e depois no destino)"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          )}

          {replyMode && (
            <span 
              title={replyMode === 'reply' ? 'Cita e responde à mensagem do cliente no WhatsApp' : 'Envia a mensagem direta no WhatsApp, sem citação'}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shadow-xs transition-all',
                replyMode === 'reply'
                  ? 'bg-purple-950/70 border-purple-500/40 text-purple-300'
                  : 'bg-sky-950/70 border-sky-500/40 text-sky-300'
              )}
            >
              <span>{replyMode === 'reply' ? '💬 Cita msg' : '📨 Envia'}</span>
            </span>
          )}

          {isConfigured ? (
            <span 
              title="Configurado e pronto" 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[9px] font-semibold text-emerald-400 shadow-sm"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Pronto</span>
            </span>
          ) : (
            <span 
              title="Configuração pendente" 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-[9px] font-semibold text-amber-400 shadow-sm animate-pulse"
            >
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>Pendente</span>
            </span>
          )}
        </div>
      </div>

      {/* Node Body / Content preview */}
      {children && <div className="p-3 text-xs text-slate-300 space-y-2">{children}</div>}

      {/* Standard Source Handle (Output) at Bottom - Centralized for Top-to-Bottom Flow */}
      {hasOutput && !customOutputs && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ width: 22, height: 22 }}
          className={cn(
            '!border-2 !border-dark-950 shadow-lg -bottom-2.5 left-1/2 -translate-x-1/2 cursor-crosshair z-30 transition-all rounded-full',
            isSource
              ? '!bg-emerald-300 ring-8 ring-emerald-400/80 scale-125'
              : '!bg-emerald-400 ring-4 ring-emerald-500/30 hover:ring-emerald-400 hover:scale-110'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (connCtx) {
              if (isSource) {
                connCtx.cancelConnecting();
              } else {
                connCtx.startConnecting(id, null, title, 'Saída Principal');
              }
            }
          }}
          title="Saída (Clique para ligar ou arraste até outro Card de Funções)"
        />
      )}

      {/* Custom Multiple Source Handles at Bottom (e.g. Buttons, IF Condition True/False, or Contact Status) */}
      {customOutputs && customOutputs.length > 0 && (
        <div className="border-t border-white/5 p-2 bg-dark-950/70 rounded-b-2xl">
          <div className={cn(
            'grid gap-1.5',
            customOutputs.length === 2 ? 'grid-cols-2' : customOutputs.length === 3 ? 'grid-cols-3' : 'grid-cols-1'
          )}>
            {customOutputs.map((out, index) => {
              const isThisBranchSource = isSource && connCtx?.connectingSource?.handleId === out.id;
              return (
                <div 
                  key={out.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connCtx) {
                      if (isThisBranchSource) {
                        connCtx.cancelConnecting();
                      } else {
                        connCtx.startConnecting(id, out.id, title, out.label);
                      }
                    }
                  }}
                  className={cn(
                    'relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border transition-all text-center group/btn cursor-pointer select-none',
                    isThisBranchSource
                      ? 'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-500/50 shadow-md'
                      : 'bg-dark-900/90 border-white/10 hover:border-emerald-500/50 hover:bg-dark-850 active:scale-98'
                  )}
                  title={`Saída: ${out.label} (Toque para ligar a outra função ou arraste o ponto)`}
                >
                  <span className="text-[10px] font-semibold text-slate-200 truncate w-full px-0.5 group-hover/btn:text-white">
                    {out.label}
                  </span>
                  <span className="text-[8.5px] text-slate-500 font-mono group-hover/btn:text-slate-300">
                    {isThisBranchSource ? '⚡ Conectando...' : `Saída #${index + 1}`}
                  </span>
                  <Handle
                    id={out.id}
                    type="source"
                    position={Position.Bottom}
                    style={{ width: isThisBranchSource ? 22 : 18, height: isThisBranchSource ? 22 : 18 }}
                    className={cn(
                      '!border-2 !border-dark-950 shadow-md -bottom-2 left-1/2 -translate-x-1/2 cursor-crosshair z-30 transition-all rounded-full',
                      isThisBranchSource
                        ? '!bg-emerald-300 ring-4 ring-emerald-400 scale-125'
                        : 'ring-2 ring-white/20 hover:ring-primary-400 hover:scale-110',
                      out.color || '!bg-emerald-400'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (connCtx) {
                        if (isThisBranchSource) {
                          connCtx.cancelConnecting();
                        } else {
                          connCtx.startConnecting(id, out.id, title, out.label);
                        }
                      }
                    }}
                    title={`Saída: ${out.label} (Clique para ligar ou arraste)`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


