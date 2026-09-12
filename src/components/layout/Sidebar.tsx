import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  GitFork, 
  Users, 
  MessageSquareText, 
  Sparkles, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Store,
  ShoppingBag,
  Building2,
  Calendar,
  Bot,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Palette,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

export interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  widthMode?: 'compact' | 'normal' | 'wide';
  onCycleWidth?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  collapsed,
  onToggleCollapse,
  widthMode = 'normal',
  onCycleWidth,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, isCEO, isManager, isAttendant, hasAdminAccess, hasManagerAccess, logout } = useAuth();
  const { isConnected } = useWhatsApp();
  const { openThemeModal } = useTheme();

  // Todos os itens de navegação organizados conforme nova estrutura oficial
  const allNavigationGroups = [
    {
      title: 'VISÃO GERAL',
      items: [
        {
          id: 'dashboard',
          label: 'Painel CEO',
          path: '/admin',
          icon: LayoutDashboard,
          roles: ['ceo', 'admin', 'manager', 'attendant'],
        },
      ],
    },
    {
      title: 'OPERAÇÃO',
      items: [
        {
          id: 'atendimento',
          label: 'Central de Atendimentos',
          path: '/atendimento',
          icon: MessageSquareText,
          badge: 'LIVE',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          roles: ['ceo', 'admin', 'manager', 'attendant'],
        },
        {
          id: 'produtos',
          label: 'Catálogo de Produtos',
          path: '/catalogo',
          icon: ShoppingBag,
          roles: ['ceo', 'admin', 'manager', 'attendant'],
        },
        {
          id: 'lojas',
          label: 'Central de Lojas',
          path: '/lojas',
          icon: Building2,
          badge: 'REDE',
          badgeColor: 'bg-white/10 text-zinc-300 border border-white/20',
          roles: ['ceo', 'admin', 'manager'],
        },
      ],
    },
    {
      title: 'GESTÃO',
      items: [
        {
          id: 'fluxos',
          label: 'Fluxos',
          path: '/fluxos',
          icon: GitFork,
          roles: ['ceo', 'admin'],
        },
        {
          id: 'clientes',
          label: 'Gestão de Clientes',
          path: '/clientes',
          icon: Users,
          roles: ['ceo', 'admin', 'manager', 'attendant'],
        },
        {
          id: 'acessos',
          label: 'Gestão de Acessos',
          path: '/acessos',
          icon: ShieldCheck,
          roles: ['ceo', 'admin', 'manager'],
        },
      ],
    },
    {
      title: 'SISTEMA',
      items: [
        {
          id: 'configuracoes',
          label: 'Configurações',
          path: '/configuracoes',
          icon: SettingsIcon,
          roles: ['ceo', 'admin'],
        },
        {
          id: 'logs',
          label: 'Logs & Auditoria',
          path: '/logs',
          icon: Sparkles,
          roles: ['ceo', 'admin'],
        },
        {
          id: 'whatsapp',
          label: 'Meta WhatsApp API',
          path: '/whatsapp',
          icon: Smartphone,
          badge: isConnected ? 'OFICIAL' : 'CONFIG',
          badgeColor: isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          roles: ['ceo', 'admin'],
        },
        {
          id: 'bot_config',
          label: 'Bot',
          path: '/bot_config',
          icon: Bot,
          roles: ['ceo', 'admin'],
        },
      ],
    },
  ];

  // Determinação de Permissões do Usuário Logado
  const userPanels = Array.isArray(user?.panels) ? user.panels : [];
  const allowedPanels = Array.isArray(user?.allowed_panels) ? user.allowed_panels : [];
  const currentRole = user?.role || 'ceo';
  const currentUsername = (user?.username || '').toLowerCase();

  // É Admin/CEO se tiver 'admin' nos painéis, role ceo/admin, flag do AuthContext, ou username malaca/admin/ceo
  const isAdmin = 
    Boolean(hasAdminAccess) || 
    Boolean(isCEO) || 
    currentRole === 'ceo' || 
    currentRole === 'admin' || 
    userPanels.includes('admin') || 
    allowedPanels.includes('admin') ||
    currentUsername === 'malaca' ||
    currentUsername === 'admin' ||
    currentUsername === 'ceo';

  // É Gerente se tiver 'gerente' nos painéis ou role 'manager'
  const isMgr = 
    isAdmin || 
    Boolean(hasManagerAccess) || 
    Boolean(isManager) || 
    currentRole === 'manager' || 
    userPanels.includes('gerente') || 
    allowedPanels.includes('gerente');

  // Filtragem dos grupos de navegação
  const filteredGroups = allNavigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // 1. Se for Admin/CEO (incluindo malaca), tem visão e controle IRRESTRITO de todos os menus
      if (isAdmin) return true;

      // 2. Se houver permissões granulares por item ID atribuídas explicitamente
      const granularItemIds = allowedPanels.filter(p => !['admin', 'gerente', 'atendimento'].includes(p));
      if (granularItemIds.length > 0 && granularItemIds.includes(item.id)) {
        return true;
      }

      // 3. Gerente acessa itens com role 'manager' e 'attendant'
      if (isMgr) {
        return item.roles.includes('manager') || item.roles.includes('attendant');
      }

      // 4. Atendente acessa itens com role 'attendant'
      return item.roles.includes('attendant');
    }),
  })).filter(group => group.items.length > 0);

  const handleItemClick = (path: string) => {
    onNavigate(path);
    onCloseMobile();
  };

  // Larguras baseadas no modo
  const getSidebarWidthClass = () => {
    if (collapsed) return 'w-[72px]';
    if (widthMode === 'wide') return 'w-80';
    return 'w-64';
  };

  return (
    <>
      {/* Backdrop Mobile */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 bg-[#09090b] border-r border-white/10 flex flex-col transition-all duration-300 ease-in-out select-none',
          getSidebarWidthClass(),
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Top Header: Logo e Controles de Tamanho */}
        <div className="h-20 px-4 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
          {!collapsed ? (
            <div 
              onClick={() => onNavigate('/admin')}
              className="flex items-center gap-3 cursor-pointer overflow-hidden group"
            >
              <img 
                src="https://pitoco.malaca.com.br/logo.png" 
                onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                alt="Pitoco de Gente" 
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
              />
              <div className="leading-tight overflow-hidden">
                <span className="text-xs font-bold text-white tracking-tight block truncate">
                  Pitoco de Gente
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  {isCEO ? 'Portal CEO' : isManager ? 'Portal Gerente' : 'Atendimento'}
                </span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => onNavigate('/admin')}
              className="mx-auto cursor-pointer p-1"
              title="Pitoco de Gente"
            >
              <img 
                src="https://pitoco.malaca.com.br/logo.png" 
                onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                alt="Pitoco" 
                className="w-9 h-9 object-contain" 
              />
            </div>
          )}

          {/* Botões de Ação: Abrir/Fechar & Aumentar/Diminuir */}
          <div className="flex items-center gap-1">
            {!collapsed && onCycleWidth && (
              <button
                onClick={onCycleWidth}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex"
                title={widthMode === 'wide' ? 'Reduzir para largura normal' : 'Aumentar largura'}
              >
                {widthMode === 'wide' ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors hidden lg:flex"
              title={collapsed ? 'Abrir menu lateral' : 'Recolher menu lateral'}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-zinc-300" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-zinc-300" />
              )}
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        {!collapsed && user && (
          <div className="p-3 mx-3 my-2 rounded-xl bg-[#141416] border border-white/5 flex items-center justify-between">
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-white block truncate">
                {user.name || user.username}
              </span>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1.5 mt-0.5 font-mono">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  currentPath.startsWith('/admin') ? 'bg-amber-400' : currentPath.startsWith('/gerente') ? 'bg-emerald-400' : 'bg-pink-400'
                )} />
                @{user.username || 'acesso'}
              </span>
            </div>
            <span className={cn(
              'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full font-mono shrink-0',
              currentPath.startsWith('/admin') ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20' :
              currentPath.startsWith('/gerente') ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20' :
              'bg-pink-400/10 text-pink-300 border border-pink-400/20'
            )}>
              {currentPath.startsWith('/admin') ? 'Admin' : currentPath.startsWith('/gerente') ? 'Gestão' : 'Atendimento'}
            </span>
          </div>
        )}

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {filteredGroups.map(group => (
            <div key={group.title} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    {group.title}
                  </span>
                </div>
              ) : (
                <div className="w-full h-px bg-white/5 my-2" />
              )}

              {group.items.map(item => {
                const Icon = item.icon;
                const baseCurrentPath = currentPath.split('?')[0];
                const isActive = 
                  baseCurrentPath === item.path || 
                  (item.path !== '/admin' && baseCurrentPath.startsWith(item.path));

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.path)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center rounded-xl text-xs transition-all duration-150 relative group',
                      collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'bg-white text-black font-bold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] font-medium'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white')} />
                    
                    {!collapsed && (
                      <span className="truncate flex-1 text-left font-medium">
                        {item.label}
                      </span>
                    )}

                    {!collapsed && item.badge && (
                      <span className={cn('text-[9px] font-semibold px-2 py-0.5 rounded-full ml-auto', item.badgeColor)}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Controls: Theme, WhatsApp Status & Logout */}
        <div className="p-3 border-t border-white/[0.08] space-y-2 bg-[#0c0c0e]/80 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <span className={cn(
                  'w-2 h-2 rounded-full animate-pulse',
                  isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                )} />
                {isConnected ? 'WhatsApp Online' : 'WhatsApp Offline'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openThemeModal}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
                  title="Personalizar Tema e Aparência"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Tema
                </button>

                <button
                  onClick={logout}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
                  title="Sair do painel"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span 
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                )} 
                title={isConnected ? 'WhatsApp Online' : 'WhatsApp Offline'}
              />
              <button
                type="button"
                onClick={openThemeModal}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Personalizar Tema"
              >
                <Palette className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
