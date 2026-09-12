import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './app/login/page';
import AdminPage from './app/admin/page';
import StorefrontPage from './app/page';
import { AdminLayout } from './components/layout/AdminLayout';
import { RedeLojasView } from './components/RedeLojasView';
import { AtendimentoHumanoInbox } from './components/AtendimentoHumanoInbox';
import { FlowBuilderView } from './components/FlowBuilderView';
import { WhatsappConnectView } from './components/WhatsappConnectView';
import { SettingsPage } from './pages/settings/SettingsPage';
import { LogsPage } from './pages/logs/LogsPage';
import { UsersPage } from './pages/users/UsersPage';
import { ClientsPage } from './pages/clients/ClientsPage';
import { ManagerPortalPage } from './pages/manager/ManagerPortalPage';

import { StorageService } from './lib/storage';

export interface RouteLocation {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  fullPath: string;
}

export const parseRouteLocation = (rawInput?: string): RouteLocation => {
  const input = rawInput !== undefined 
    ? rawInput 
    : (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/');

  const [pathPart, queryPart] = input.split('?');
  let cleanPath = (pathPart || '/').replace(/^\/pitocodegente\/?/, '/').replace(/^\/7assistente\/?/, '/');
  if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
  const search = queryPart ? `?${queryPart}` : '';
  const searchParams = new URLSearchParams(queryPart || '');

  return {
    pathname: cleanPath,
    search,
    searchParams,
    fullPath: `${cleanPath}${search}`
  };
};

export const App: React.FC = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    isCEO, 
    isManager, 
    isAttendant, 
    hasAdminAccess, 
    hasManagerAccess, 
    hasAttendantAccess 
  } = useAuth();

  const [route, setRoute] = useState<RouteLocation>(() => parseRouteLocation());

  useEffect(() => {
    StorageService.syncAllFromBackend().catch(() => {});
    const handlePopState = () => {
      setRoute(parseRouteLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (pathWithSearch: string) => {
    const nextRoute = parseRouteLocation(pathWithSearch);
    window.history.pushState({}, '', nextRoute.fullPath);
    setRoute(nextRoute);
  };

  const { pathname, searchParams, fullPath } = route;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-400 space-y-3">
        <div className="w-10 h-10 rounded-xl border-2 border-white border-t-transparent animate-spin" />
        <span className="text-xs font-semibold tracking-wider text-zinc-300">
          Carregando Pitoco de Gente...
        </span>
      </div>
    );
  }

  // 1. Redirecionamento oficial: /ceo -> /admin
  if (pathname === '/ceo') {
    navigate('/admin');
  }

  // 2. Vitrine Pública (Root /, /enxoval, /medidas, /fila) - apenas quando não autenticado em admin
  if (pathname === '/' || pathname === '/enxoval' || pathname === '/medidas' || pathname === '/fila') {
    return <StorefrontPage />;
  }

  // 3. Login direto
  if (pathname === '/login') {
    if (isAuthenticated) {
      const defaultTarget = hasAdminAccess ? '/admin' : hasManagerAccess ? '/gerente' : '/atendimento';
      navigate(defaultTarget);
    } else {
      return <LoginPage />;
    }
  }

  // 4. Se não estiver autenticado e tentar acessar rotas internas -> Login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 5. Restrições estritas de Acesso por Perfil/Painel Autorizado
  // Se o usuário tem apenas acesso a atendimento e tenta acessar rotas administrativas/gestão
  if (!hasAdminAccess && !hasManagerAccess && hasAttendantAccess) {
    const allowedAttendantPaths = ['/atendimento', '/conversas', '/catalogo', '/produtos', '/clientes', '/crm'];
    if (!allowedAttendantPaths.includes(pathname)) {
      navigate('/atendimento');
      return null;
    }
  }

  // Se o usuário tem apenas acesso à gerência e tenta acessar rotas restritas de admin master
  if (!hasAdminAccess && hasManagerAccess) {
    const forbiddenForManager = ['/admin', '/bot_config', '/robo', '/fluxos', '/acessos', '/usuarios', '/configuracoes', '/logs'];
    if (forbiddenForManager.includes(pathname)) {
      navigate('/gerente');
      return null;
    }
  }

  // 6. Roteamento Interno Protegido — Todas as telas envoltas no AdminLayout
  let title = 'Painel Administrativo';
  let subtitle = 'Gestão centralizada da rede Pitoco de Gente';
  let pageContent = <AdminPage onNavigate={navigate} activeTabProp="dashboard" />;

  if (pathname === '/admin' || pathname === '/dashboard') {
    const tabParam = (searchParams.get('tab') || 'dashboard') as any;
    title = isCEO ? 'Painel Executivo CEO' : 'Painel Administrador Geral';
    subtitle = isCEO ? 'Métricas consolidadas da rede, robô e faturamento' : 'Controle global de módulos, produtos e atendimentos';
    pageContent = <AdminPage onNavigate={navigate} activeTabProp={tabParam} />;
  } else if (pathname === '/gerente' || pathname === '/gestao') {
    title = 'Painel de Gestão da Filial';
    subtitle = 'Supervisão executiva, vendas da loja e fila de atendimento';
    pageContent = <ManagerPortalPage onNavigate={navigate} />;
  } else if (pathname === '/catalogo' || pathname === '/produtos') {
    title = 'Catálogo de Produtos';
    subtitle = 'Gerenciamento completo de peças, tamanhos e preços';
    pageContent = <AdminPage onNavigate={navigate} activeTabProp="produtos" />;
  } else if (pathname === '/bot_config' || pathname === '/robo') {
    title = 'Bot';
    subtitle = 'Chave PIX, fretes e mensagens automáticas do WhatsApp';
    pageContent = <AdminPage onNavigate={navigate} activeTabProp="bot_config" />;
  } else if (pathname === '/clientes' || pathname === '/crm' || pathname === '/agendamentos' || pathname === '/consultorias') {
    title = 'Gestão de Clientes';
    subtitle = 'Cadastro, histórico, tags e gerenciamento de contatos da rede';
    pageContent = <ClientsPage onNavigate={navigate} />;
  } else if (pathname === '/atendimento' || pathname === '/conversas') {
    title = 'Central de Atendimentos';
    subtitle = 'Atendimento em tempo real com direcionamento por loja e envio de catálogo';
    pageContent = (
      <AtendimentoHumanoInbox 
        portalMode={hasAdminAccess ? 'admin' : hasManagerAccess ? 'gerente' : 'atendimento'} 
        onNavigate={navigate} 
      />
    );
  } else if (pathname === '/lojas' || pathname === '/rede') {
    title = 'Central de Lojas';
    subtitle = 'Gestão centralizada das unidades Centro, Ipojuca e E-commerce';
    pageContent = <RedeLojasView onNavigate={navigate} />;
  } else if (pathname.startsWith('/fluxos')) {
    title = 'Fluxos';
    subtitle = 'Árvores de automação e nós de atendimento no WhatsApp';
    pageContent = <FlowBuilderView onNavigate={navigate} />;
  } else if (pathname === '/whatsapp' || pathname === '/qrcode') {
    title = 'Conexão WhatsApp Meta Cloud API';
    subtitle = 'Integração Oficial com a Meta WhatsApp Business Platform e Webhooks';
    pageContent = <WhatsappConnectView />;
  } else if (pathname === '/acessos' || pathname === '/usuarios') {
    title = 'Gestão de Acessos';
    subtitle = 'Controle de painéis autorizados: Admin, Gerente e Atendimento';
    pageContent = <UsersPage />;
  } else if (pathname === '/logs') {
    title = 'Logs & Auditoria';
    subtitle = 'Histórico de eventos, transbordos e mensagens do sistema';
    pageContent = <LogsPage />;
  } else if (pathname === '/configuracoes') {
    title = 'Configurações';
    subtitle = 'Perfil da empresa, status de sincronização e credenciais';
    pageContent = <SettingsPage />;
  }

  return (
    <AdminLayout
      title={title}
      subtitle={subtitle}
      currentPath={fullPath}
      onNavigate={navigate}
    >
      {pageContent}
    </AdminLayout>
  );
};
