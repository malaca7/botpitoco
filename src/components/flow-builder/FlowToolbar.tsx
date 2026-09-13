import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Play, 
  Pause, 
  ArrowLeft, 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle,
  Keyboard,
  Settings,
  Clock,
  Sparkles,
  GitCommit,
  Check,
  ChevronDown,
  Smartphone,
  List,
  Maximize2,
  Minimize2,
  Braces,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Flow } from '../../types';

export interface FlowToolbarProps {
  flow: Flow;
  onBack: () => void;
  onSave: () => void;
  onToggleStatus: () => void;
  onTestFlow?: () => void;
  onSwitchToMobileMode?: () => void;
  onOpenVariables?: () => void;
  isSaving: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isValid: boolean;
  validationError?: string | null;
  isConnectedWhatsApp?: boolean;
  autoSaveMode: 'instant' | 'interval' | 'manual';
  autoSaveIntervalSec: number;
  onUpdateAutoSaveConfig: (mode: 'instant' | 'interval' | 'manual', interval: number) => void;
  lastSavedTime?: Date | null;
  isDirty?: boolean;
  edgeType: 'smoothstep' | 'default' | 'straight' | 'step';
  onChangeEdgeType: (type: 'smoothstep' | 'default' | 'straight' | 'step') => void;
  onOpenShortcuts: () => void;
  onAutoLayout?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
}

export const FlowToolbar: React.FC<FlowToolbarProps> = ({
  flow,
  onBack,
  onSave,
  onToggleStatus,
  onTestFlow,
  onSwitchToMobileMode,
  onOpenVariables,
  isSaving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isValid,
  validationError,
  isConnectedWhatsApp = true,
  autoSaveMode,
  autoSaveIntervalSec,
  onUpdateAutoSaveConfig,
  lastSavedTime,
  isDirty,
  edgeType,
  onChangeEdgeType,
  onOpenShortcuts,
  onAutoLayout,
  onZoomIn,
  onZoomOut,
  onFitView,
}) => {
  const [isAutoSaveMenuOpen, setIsAutoSaveMenuOpen] = useState(false);
  const [isLinesMenuOpen, setIsLinesMenuOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPublished = flow.status === 'published';

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const formattedSavedTime = lastSavedTime
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastSavedTime)
    : null;

  return (
    <div className="h-16 bg-dark-900 border-b border-white/5 px-4 flex items-center justify-between z-20 flex-shrink-0 relative gap-2">
      {/* Left: Back button + Flow Name + Status */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-850 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm shrink-0"
          title="Sair do Studio e voltar para a Lista de Fluxos"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-white" />
          <span className="hidden sm:inline">Sair do Studio</span>
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[320px] truncate" title={flow.name}>
              {flow.name}
            </h2>
            <Badge
              variant={isPublished ? 'brand' : flow.status === 'paused' ? 'warning' : 'neutral'}
              dot
              className="shrink-0"
            >
              {isPublished ? 'Publicado' : flow.status === 'paused' ? 'Pausado' : 'Rascunho'}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Versão {flow.version || 1} • Studio Visual</p>
        </div>
      </div>

      {/* Center: Live Auto-save & Validation status */}
      <div className="hidden md:flex items-center gap-3">
        {/* Auto-save Status Indicator with Real-Time Feedback */}
        <div className="relative">
          <button
            onClick={() => setIsAutoSaveMenuOpen(!isAutoSaveMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-850/90 border border-white/10 hover:border-white/20 text-xs transition-colors shadow-sm"
            title="Clique para alterar modo de salvamento automático"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-brand-300 font-bold">Salvando alterações...</span>
              </>
            ) : isDirty ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-semibold">Gravando em tempo real...</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-500/50" />
                <span className="text-emerald-300 font-bold">Auto-salve Ativo</span>
                {formattedSavedTime && (
                  <span className="text-slate-400 text-[11px] font-mono hidden lg:inline">
                    ({formattedSavedTime})
                  </span>
                )}
              </>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {/* Auto-save Options Dropdown */}
          {isAutoSaveMenuOpen && (
            <div className="absolute top-full mt-2 left-0 w-64 p-3 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl space-y-2 z-50 animate-in fade-in">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                Configurações de Salvamento
              </span>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    onUpdateAutoSaveConfig('instant', 30);
                    setIsAutoSaveMenuOpen(false);
                  }}
                  className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                    autoSaveMode === 'instant'
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'text-slate-300 hover:bg-dark-850'
                  }`}
                >
                  <div>
                    <p className="font-bold">A Cada Alteração (Tempo Real)</p>
                    <p className="text-[10px] text-slate-400">Salva instantaneamente ao mover ou editar funções</p>
                  </div>
                  {autoSaveMode === 'instant' && <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />}
                </button>

                <button
                  onClick={() => {
                    onUpdateAutoSaveConfig('interval', 30);
                    setIsAutoSaveMenuOpen(false);
                  }}
                  className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                    autoSaveMode === 'interval'
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'text-slate-300 hover:bg-dark-850'
                  }`}
                >
                  <div>
                    <p className="font-bold">A cada 30 segundos</p>
                    <p className="text-[10px] text-slate-400">Salva em lote periodicamente</p>
                  </div>
                  {autoSaveMode === 'interval' && autoSaveIntervalSec === 30 && (
                    <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => {
                    onUpdateAutoSaveConfig('manual', 0);
                    setIsAutoSaveMenuOpen(false);
                  }}
                  className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                    autoSaveMode === 'manual'
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'text-slate-300 hover:bg-dark-850'
                  }`}
                >
                  <div>
                    <p className="font-bold">Apenas Manual</p>
                    <p className="text-[10px] text-slate-400">Salva somente quando clicar no botão Salvar</p>
                  </div>
                  {autoSaveMode === 'manual' && <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Validation Status Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-850 border border-slate-800 text-xs">
          {isValid ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-slate-300">
                {isConnectedWhatsApp
                  ? 'Pronto para execução'
                  : 'Validado • Conecte o WhatsApp'}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-300">{validationError || 'Atenção nas funções'}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-0.5 pr-1 border-r border-white/5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Desfazer (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Refazer (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        {(onZoomIn || onZoomOut || onFitView) && (
          <div className="hidden lg:flex items-center gap-0.5 px-1 py-0.5 rounded-xl bg-dark-850 border border-white/10 shadow-xs">
            {onZoomOut && (
              <button
                type="button"
                onClick={onZoomOut}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Reduzir Zoom (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            )}
            {onFitView && (
              <button
                type="button"
                onClick={onFitView}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Ajustar e Enquadrar Todo o Fluxo na Tela"
              >
                <Maximize2 className="w-3 h-3 text-sky-400" />
                <span className="hidden xl:inline">Enquadrar</span>
              </button>
            )}
            {onZoomIn && (
              <button
                type="button"
                onClick={onZoomIn}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Aumentar Zoom (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Auto-Organize Flow Button */}
        {onAutoLayout && (
          <button
            type="button"
            onClick={onAutoLayout}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-500/40 hover:to-teal-500/40 border border-emerald-500/40 text-emerald-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95"
            title="Auto-Organizar funções de cima para baixo (Atalho: Alt+O)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Auto-Organizar</span>
          </button>
        )}

        {/* Dropdown de Ferramentas & Opções do Studio */}
        <div className="relative">
          <button
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            className="px-2.5 py-1.5 rounded-xl bg-dark-850 border border-white/10 hover:border-white/20 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors shadow-sm"
            title="Mais opções e configurações do editor de fluxo"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline font-medium">Opções</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isOptionsMenuOpen && (
            <div className="absolute top-full mt-2 right-0 w-60 p-2.5 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl space-y-2 z-50 animate-in fade-in">
              <div className="px-2 py-1 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  Configurações do Studio
                </span>
                <button
                  onClick={() => setIsOptionsMenuOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <ChevronDown className="w-3 h-3 rotate-180" />
                </button>
              </div>

              {/* Seletor de Estilo de Linhas */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold px-2 block">
                  Estilo das Linhas ({edgeType}):
                </span>
                <div className="grid grid-cols-2 gap-1 px-1">
                  {[
                    { id: 'smoothstep', label: 'Suaves' },
                    { id: 'default', label: 'Bézier' },
                    { id: 'straight', label: 'Retas' },
                    { id: 'step', label: 'Ângulo' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        onChangeEdgeType(style.id as any);
                      }}
                      className={`px-2 py-1 rounded-lg text-left text-[11px] flex items-center justify-between transition-colors ${
                        edgeType === style.id
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-slate-400 hover:bg-dark-850 hover:text-white'
                      }`}
                    >
                      <span>{style.label}</span>
                      {edgeType === style.id && <Check className="w-3 h-3 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/5 pt-1 space-y-1">
                {/* Dicionário de Variáveis */}
                {onOpenVariables && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenVariables();
                      setIsOptionsMenuOpen(false);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 text-slate-300 hover:text-white hover:bg-dark-850 transition-colors"
                  >
                    <Braces className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dicionário de Variáveis</span>
                  </button>
                )}

                {/* Modo Lista / Mobile */}
                {onSwitchToMobileMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchToMobileMode();
                      setIsOptionsMenuOpen(false);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 text-slate-300 hover:text-white hover:bg-dark-850 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-brand-400" />
                    <span>Modo Lista Passo a Passo</span>
                  </button>
                )}

                {/* Atalhos de Teclado */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenShortcuts();
                    setIsOptionsMenuOpen(false);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 text-slate-300 hover:text-white hover:bg-dark-850 transition-colors"
                >
                  <Keyboard className="w-3.5 h-3.5 text-brand-400" />
                  <span>Atalhos de Teclado (F1)</span>
                </button>

                {/* Tela Cheia */}
                <button
                  type="button"
                  onClick={() => {
                    handleToggleFullscreen();
                    setIsOptionsMenuOpen(false);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 text-slate-300 hover:text-white hover:bg-dark-850 transition-colors"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Restaurar Janela</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Expandir Tela Cheia</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Test Simulator */}
        {onTestFlow && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Play className="w-3.5 h-3.5 text-brand-400" />}
            onClick={onTestFlow}
            className="text-xs h-8 px-2.5"
          >
            <span className="hidden sm:inline">Testar</span>
          </Button>
        )}

        {/* Save Flow */}
        <Button
          size="sm"
          variant={isDirty ? 'primary' : 'outline'}
          leftIcon={!isDirty ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
          isLoading={isSaving}
          disabled={!isDirty || isSaving}
          onClick={onSave}
          title={isDirty ? 'Salvar Alterações (Ctrl+S)' : 'Nenhuma alteração pendente (Tudo Salvo)'}
          className={!isDirty ? 'opacity-50 cursor-not-allowed border-white/5 text-slate-400 hover:bg-transparent h-8 px-2.5 text-xs' : 'border-primary-500/60 shadow-sm h-8 px-2.5 text-xs'}
        >
          {isDirty ? 'Salvar' : 'Salvo'}
        </Button>

        {/* Publish / Activate Toggle */}
        <Button
          size="sm"
          variant={isPublished ? 'secondary' : isConnectedWhatsApp ? 'brand' : 'outline'}
          leftIcon={isPublished ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5" />}
          onClick={onToggleStatus}
          className="text-xs h-8 px-2.5 font-bold"
        >
          {isPublished ? 'Pausar' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
};
