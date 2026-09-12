import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Tag, 
  Calendar, 
  MessageSquare, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  ExternalLink, 
  MessageCircle, 
  Download, 
  Filter, 
  FileText, 
  UserCheck, 
  Sparkles, 
  ChevronRight, 
  X, 
  Save, 
  ListFilter, 
  LayoutGrid, 
  List, 
  TrendingUp, 
  CalendarPlus,
  Scissors
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { StorageService, getBackendUrl } from '../../lib/storage';
import { Contact, Appointment, AgendaSettings } from '../../types';
import { formatPhone, formatDate } from '../../lib/utils';

export interface ClientsPageProps {
  onNavigate: (path: string) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onNavigate }) => {
  const { success, error: toastError, info, warning } = useToast();
  const [clients, setClients] = useState<Contact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agendaSettings, setAgendaSettings] = useState<AgendaSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Views
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [filterAppointmentStatus, setFilterAppointmentStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals & Drawers
  const [selectedClientForDrawer, setSelectedClientForDrawer] = useState<Contact | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Contact | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Contact | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  // Quick Appointment Modal for specific client
  const [isQuickAptModalOpen, setIsQuickAptModalOpen] = useState(false);
  const [quickAptClient, setQuickAptClient] = useState<Contact | null>(null);
  const [quickAptService, setQuickAptService] = useState('');
  const [quickAptDate, setQuickAptDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickAptTime, setQuickAptTime] = useState('09:00');
  const [quickAptNotes, setQuickAptNotes] = useState('');

  // Form states for Client Modal
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTags, setFormTags] = useState('Cliente, WhatsApp');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'blocked' | 'archived'>('active');

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [contactsData, aptsData, settingsData] = await Promise.all([
        StorageService.getContacts(),
        StorageService.getAppointments(),
        StorageService.getAgendaSettings(),
      ]);
      setClients(contactsData);
      setAppointments(aptsData);
      setAgendaSettings(settingsData);
    } catch (e) {
      console.error('Error loading clients data:', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);

    // 1. Sincronização periódica contínua em background (a cada 3,5s)
    const interval = setInterval(() => {
      loadData(true);
    }, 3500);

    // 2. Inscrição em tempo real no Supabase
    const unsubscribeClients = StorageService.subscribeToClients(() => {
      loadData(true);
    });

    // 3. Sincronização instantânea ao focar a tela ou alternar de aba
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    // 4. Sincronização quando o banco ou localStorage for atualizado
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'pitoco_contacts' ||
        e.key === '7assistente_contacts' ||
        e.key === 'pitoco_appointments' ||
        e.key === '7assistente_appointments'
      ) {
        loadData(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      if (typeof unsubscribeClients === 'function') unsubscribeClients();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update selected client in drawer if clients state changes
  useEffect(() => {
    if (selectedClientForDrawer) {
      const fresh = clients.find(c => c.id === selectedClientForDrawer.id || c.phone === selectedClientForDrawer.phone);
      if (fresh) setSelectedClientForDrawer(fresh);
    }
  }, [clients]);

  // Phone match helper
  const isMatchingPhone = (phoneA?: string, phoneB?: string) => {
    if (!phoneA || !phoneB) return false;
    const cleanA = phoneA.replace(/\D/g, '');
    const cleanB = phoneB.replace(/\D/g, '');
    return cleanA === cleanB || cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
  };

  // Compute Client Statistics (Appointments history, LTV, last visit)
  const clientStatsMap = useMemo(() => {
    const stats: Record<string, {
      totalAppointments: number;
      completedCount: number;
      confirmedCount: number;
      cancelledCount: number;
      noShowCount: number;
      totalSpent: number;
      lastVisitDate: string | null;
      nextVisitDate: string | null;
      clientAppointments: Appointment[];
      favoriteServices: string[];
    }> = {};

    const todayStr = new Date().toISOString().split('T')[0];

    for (const client of clients) {
      const clientApts = appointments.filter(a => isMatchingPhone(a.contact_phone, client.phone));
      
      // Sort appointments by date descending
      clientApts.sort((a, b) => new Date(`${b.appointment_date}T${b.appointment_time || '00:00'}`).getTime() - new Date(`${a.appointment_date}T${a.appointment_time || '00:00'}`).getTime());

      const completed = clientApts.filter(a => a.status === 'completed');
      const confirmed = clientApts.filter(a => a.status === 'confirmed');
      const cancelled = clientApts.filter(a => a.status === 'cancelled');
      const noShow = clientApts.filter(a => a.status === 'no_show');

      // Estimate total spent
      let totalSpent = 0;
      const srvFrequency: Record<string, number> = {};

      for (const apt of completed) {
        let price = apt.price;
        if (!price && agendaSettings?.services) {
          const srvObj = agendaSettings.services.find(s => s.name?.toLowerCase().trim() === apt.service_name?.toLowerCase().trim());
          price = srvObj?.price || 35;
        }
        totalSpent += price || 35;

        if (apt.service_name) {
          srvFrequency[apt.service_name] = (srvFrequency[apt.service_name] || 0) + 1;
        }
      }

      // Past & Future visits
      const pastVisits = clientApts.filter(a => a.appointment_date <= todayStr && (a.status === 'completed' || a.status === 'confirmed'));
      const futureVisits = clientApts.filter(a => a.appointment_date >= todayStr && a.status === 'confirmed');

      const lastVisit = pastVisits[0]?.appointment_date || null;
      const nextVisit = futureVisits[futureVisits.length - 1]?.appointment_date || null;

      const favServices = Object.entries(srvFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 2);

      stats[client.id] = {
        totalAppointments: clientApts.length,
        completedCount: completed.length,
        confirmedCount: confirmed.length,
        cancelledCount: cancelled.length,
        noShowCount: noShow.length,
        totalSpent,
        lastVisitDate: lastVisit,
        nextVisitDate: nextVisit,
        clientAppointments: clientApts,
        favoriteServices: favServices,
      };
    }

    return stats;
  }, [clients, appointments, agendaSettings]);

  // Overall Global KPIs
  const totalClientsCount = clients.length;
  const activeClientsCount = clients.filter(c => c.status !== 'blocked').length;
  const totalCompletedAppointments = appointments.filter(a => a.status === 'completed').length;
  const totalRevenueGenerated = useMemo(() => {
    return Object.values(clientStatsMap).reduce((acc, curr) => acc + curr.totalSpent, 0);
  }, [clientStatsMap]);

  // Tags list
  const allTags = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => (c.tags || []).forEach(t => set.add(t.trim())));
    return ['all', ...Array.from(set)];
  }, [clients]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        client.name.toLowerCase().includes(search) ||
        client.phone.includes(search) ||
        (client.email || '').toLowerCase().includes(search) ||
        (client.tags || []).some(t => t.toLowerCase().includes(search)) ||
        (client.notes || '').toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (selectedTag !== 'all' && !(client.tags || []).includes(selectedTag)) {
        return false;
      }

      if (filterAppointmentStatus !== 'all') {
        const stats = clientStatsMap[client.id];
        if (filterAppointmentStatus === 'has_future' && !stats?.nextVisitDate) return false;
        if (filterAppointmentStatus === 'frequent' && (stats?.completedCount || 0) < 3) return false;
        if (filterAppointmentStatus === 'no_apts' && (stats?.totalAppointments || 0) > 0) return false;
        if (filterAppointmentStatus === 'no_show' && (stats?.noShowCount || 0) === 0) return false;
      }

      return true;
    });
  }, [clients, searchTerm, selectedTag, filterAppointmentStatus, clientStatsMap]);

  // Open Client Modal (New / Edit)
  const handleOpenAddClient = () => {
    setEditingClient(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormTags('Cliente, WhatsApp');
    setFormNotes('');
    setFormStatus('active');
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (client: Contact) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormPhone(client.phone);
    setFormEmail(client.email || '');
    setFormTags((client.tags || []).join(', '));
    setFormNotes(client.notes || '');
    setFormStatus(client.status || 'active');
    setIsClientModalOpen(true);
  };

  // Save Client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toastError('Telefone inválido', 'Informe um número com DDD (ex: 81996138924).');
      return;
    }

    try {
      const tagsArray = formTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const clientData: Contact = {
        id: editingClient?.id || `contact-${cleanPhone}`,
        phone: cleanPhone,
        name: formName.trim() || 'Cliente WhatsApp',
        email: formEmail.trim() || undefined,
        status: formStatus,
        tags: tagsArray.length > 0 ? tagsArray : ['Cliente'],
        notes: formNotes.trim() || undefined,
        metadata: editingClient?.metadata || {},
        created_at: editingClient?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await StorageService.saveContact(clientData);
      await loadData();
      setIsClientModalOpen(false);
      success(
        editingClient ? 'Cliente Atualizado' : 'Cliente Cadastrado',
        `Os dados de "${clientData.name}" foram sincronizados no banco de dados.`
      );
    } catch (err: any) {
      toastError('Erro ao salvar cliente', err.message);
    }
  };

  // Delete Client
  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const target = clientToDelete;
    const targetCleanPhone = (target.phone || '').replace(/\D/g, '');
    const altPhone = targetCleanPhone.startsWith('55') ? targetCleanPhone.substring(2) : `55${targetCleanPhone}`;

    // 1. Optimistic removal from UI state
    setClients(prev => prev.filter(c => {
      const cPhone = (c.phone || '').replace(/\D/g, '');
      const isMatch = c.id === target.id ||
                      c.phone === target.phone ||
                      (targetCleanPhone && (cPhone === targetCleanPhone || cPhone === altPhone));
      return !isMatch;
    }));

    if (selectedClientForDrawer?.id === target.id || selectedClientForDrawer?.phone === target.phone) {
      setSelectedClientForDrawer(null);
    }
    setClientToDelete(null);

    try {
      await StorageService.deleteContact(target.id, target.phone);
      success('Cliente Excluído', `O cadastro de "${target.name}" foi removido com sucesso.`);
    } catch (err: any) {
      toastError('Erro ao excluir', err.message);
      loadData(false);
    }
  };

  // Delete All Clients
  const handleConfirmDeleteAllClients = async () => {
    setIsDeleteAllModalOpen(false);
    setClients([]);
    setSelectedClientForDrawer(null);
    try {
      await StorageService.deleteAllContacts();
      success('Base de Clientes Limpa', 'Todos os clientes foram excluídos com sucesso.');
      await loadData(false);
    } catch (err: any) {
      toastError('Erro ao excluir todos os clientes', err.message);
      loadData(false);
    }
  };

  // Open Quick Appointment Modal for Client
  const handleOpenQuickApt = (client: Contact) => {
    setQuickAptClient(client);
    const defaultSrv = agendaSettings?.services?.[0]?.name || 'Consultoria VIP de Enxoval';
    setQuickAptService(defaultSrv);
    setQuickAptDate(new Date().toISOString().split('T')[0]);
    setQuickAptTime('09:00');
    setQuickAptNotes('');
    setIsQuickAptModalOpen(true);
  };

  // Save Quick Appointment
  const handleSaveQuickApt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAptClient) return;

    try {
      const srvObj = agendaSettings?.services?.find(s => s.name?.toLowerCase().trim() === quickAptService.toLowerCase().trim());
      const duration = srvObj?.duration_minutes || 30;
      const price = srvObj?.price || 35;

      const newApt: Appointment = {
        id: `apt-${Date.now()}`,
        contact_name: quickAptClient.name,
        contact_phone: quickAptClient.phone,
        service_name: quickAptService,
        duration_minutes: duration,
        price,
        appointment_date: quickAptDate,
        appointment_time: quickAptTime,
        status: 'confirmed',
        notes: quickAptNotes.trim() || undefined,
        created_at: new Date().toISOString(),
      };

      await StorageService.saveAppointment(newApt);
      await loadData();
      setIsQuickAptModalOpen(false);
      success('Agendamento Realizado', `Horário marcado para ${quickAptClient.name} em ${quickAptDate} às ${quickAptTime}.`);
    } catch (err: any) {
      toastError('Erro ao agendar', err.message);
    }
  };

  // Update Appointment Status in Drawer
  const handleUpdateAppointmentStatus = async (aptId: string, newStatus: Appointment['status']) => {
    try {
      await StorageService.updateAppointmentStatus(aptId, newStatus);
      await loadData();
      success('Status Atualizado', `O agendamento agora está como ${
        newStatus === 'completed' ? 'Realizado / Concluído' :
        newStatus === 'confirmed' ? 'Confirmado' :
        newStatus === 'cancelled' ? 'Cancelado' :
        newStatus === 'no_show' ? 'Não Compareceu' : 'Pendente'
      }.`);
    } catch (err: any) {
      toastError('Erro ao atualizar status', err.message);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Tags', 'Status', 'Total Agendamentos', 'Total Investido (R$)', 'Última Visita'];
    const rows = clients.map(c => {
      const stats = clientStatsMap[c.id];
      return [
        `"${c.name}"`,
        `"${c.phone}"`,
        `"${c.email || ''}"`,
        `"${(c.tags || []).join(', ')}"`,
        `"${c.status}"`,
        stats?.totalAppointments || 0,
        (stats?.totalSpent || 0).toFixed(2),
        `"${stats?.lastVisitDate || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clientes_7assistente_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    info('Exportação Concluída', 'Relatório CSV de clientes baixado com sucesso.');
  };

  // Avatar Color Generator
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-brand-600 to-cyan-500',
      'from-purple-600 to-indigo-500',
      'from-emerald-600 to-teal-500',
      'from-amber-600 to-orange-500',
      'from-rose-600 to-pink-500',
    ];
    const index = (name.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/60 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 p-0.5 shadow-lg shadow-brand-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-dark-950 rounded-[14px] flex items-center justify-center text-brand-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Gestão de Clientes & CRM
              <Badge variant="brand" className="text-[10px] py-0 px-2">Sincronizado</Badge>
            </h1>
            <p className="text-xs text-slate-400">
              Base central de clientes, histórico de serviços prestados, agendamentos e preferências
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteAllModalOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
              className="text-xs border-rose-500/20 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40"
            >
              Excluir Todos
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs border-white/10 hover:border-white/20"
          >
            Exportar CSV
          </Button>
          <Button
            variant="brand"
            onClick={handleOpenAddClient}
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs shadow-lg shadow-brand-500/20"
          >
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 border-white/5 bg-dark-900/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total de Clientes</span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">{totalClientsCount}</p>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
            <CheckCircle2 className="w-3 h-3" /> {activeClientsCount} ativos na base
          </span>
        </Card>

        <Card className="p-4 border-white/5 bg-dark-900/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Atendimentos Realizados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1.5">{totalCompletedAppointments}</p>
          <span className="text-[10px] text-slate-400 mt-1 font-mono">Serviços concluídos com sucesso</span>
        </Card>

        <Card className="p-4 border-white/5 bg-dark-900/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Faturamento Acumulado</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">R$ {totalRevenueGenerated.toFixed(2).replace('.', ',')}</p>
          <span className="text-[10px] text-slate-400 mt-1 font-mono">Receita total gerada</span>
        </Card>

        <Card className="p-4 border-white/5 bg-dark-900/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Ticket Médio por Cliente</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1.5">
            R$ {(totalClientsCount > 0 ? totalRevenueGenerated / totalClientsCount : 0).toFixed(2).replace('.', ',')}
          </p>
          <span className="text-[10px] text-amber-300/80 mt-1 font-mono">LTV médio por cadastro</span>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-dark-900/40 p-3.5 rounded-2xl border border-white/5">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone, email, notas ou tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-950 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Tag Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-dark-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">Todas as Tags</option>
              {allTags.filter(t => t !== 'all').map(t => (
                <option key={t} value={t}>Tag: {t}</option>
              ))}
            </select>

            <select
              value={filterAppointmentStatus}
              onChange={(e) => setFilterAppointmentStatus(e.target.value)}
              className="bg-dark-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">Todos os Clientes</option>
              <option value="has_future">Com Agendamento Futuro</option>
              <option value="frequent">Recorrente (3+ visitas)</option>
              <option value="no_apts">Sem Agendamentos</option>
              <option value="no_show">Com Falta / Não Compareceu</option>
            </select>
          </div>
        </div>

        {/* View Switcher (Cards / Table) */}
        <div className="flex items-center gap-1 bg-dark-950 p-1 rounded-xl border border-white/10 self-end md:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Visualização em Cartões"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Visualização em Tabela"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Clients Content */}
      {filteredClients.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-dark-900/40 border-white/5">
          <Users className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum cliente cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Não há clientes cadastrados no painel. Novos números que enviarem mensagens pelo WhatsApp serão atendidos como <strong>Primeiro Contato (Novo Cliente)</strong>.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="brand" size="sm" onClick={handleOpenAddClient} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Cadastrar Primeiro Cliente
            </Button>
          </div>
        </Card>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const stats = clientStatsMap[client.id] || {
              totalAppointments: 0,
              completedCount: 0,
              confirmedCount: 0,
              cancelledCount: 0,
              noShowCount: 0,
              totalSpent: 0,
              lastVisitDate: null,
              nextVisitDate: null,
              clientAppointments: [],
              favoriteServices: [],
            };

            const initials = client.name
              .split(' ')
              .map(n => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'CL';

            return (
              <Card
                key={client.id}
                className="p-5 rounded-3xl bg-dark-900/80 border border-white/10 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3.5">
                  {/* Top: Avatar & Main Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(client.name)} flex items-center justify-center font-bold text-sm text-white shadow-md`}>
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors flex items-center gap-1.5">
                          {client.name}
                          {stats.completedCount >= 3 && (
                            <span title="Cliente Frequente" className="text-xs">⭐</span>
                          )}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          {formatPhone(client.phone)}
                        </p>
                      </div>
                    </div>

                    <a
                      href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/20 transition-colors"
                      title="Abrir WhatsApp Direto"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {(client.tags || ['Cliente']).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-dark-950 text-slate-300 border border-white/5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Client Metrics Box */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-dark-950/70 border border-white/5 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Agendados</span>
                      <span className="text-xs font-bold text-white">{stats.totalAppointments}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Realizados</span>
                      <span className="text-xs font-bold text-emerald-400">{stats.completedCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Investido</span>
                      <span className="text-xs font-bold text-cyan-400 font-mono">
                        R$ {Math.round(stats.totalSpent)}
                      </span>
                    </div>
                  </div>

                  {/* Next / Last Visit */}
                  <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                    {stats.nextVisitDate ? (
                      <div className="flex items-center justify-between text-emerald-400 font-medium">
                        <span>Próximo Atendimento:</span>
                        <span className="font-mono">{formatDate(stats.nextVisitDate)}</span>
                      </div>
                    ) : stats.lastVisitDate ? (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Última Visita:</span>
                        <span className="font-mono text-slate-300">{formatDate(stats.lastVisitDate)}</span>
                      </div>
                    ) : (
                      <div className="text-slate-500 italic text-[10px]">
                        Nenhum atendimento realizado ainda
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-3 mt-4 border-t border-white/5 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedClientForDrawer(client)}
                    className="text-xs flex-1 border-white/10 hover:border-brand-500/40"
                  >
                    Ver Dossiê
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('/atendimento')}
                    className="text-xs px-2.5 border-white/10 hover:bg-white/10 text-white"
                    title="Abrir no Inbox WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>

                  <button
                    onClick={() => handleOpenEditClient(client)}
                    className="p-2 rounded-xl bg-dark-950 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Editar Cliente"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setClientToDelete(client)}
                    className="p-2 rounded-xl bg-rose-950/30 text-rose-300 hover:bg-rose-900/50 transition-colors"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="bg-dark-900/70 border-white/5 overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-dark-950 text-[11px] text-slate-400 font-semibold border-b border-white/5 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">WhatsApp</th>
                  <th className="p-4">Tags</th>
                  <th className="p-4">Atendimentos</th>
                  <th className="p-4">Gasto Total</th>
                  <th className="p-4">Última Visita</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map((client) => {
                  const stats = clientStatsMap[client.id];
                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${getAvatarGradient(client.name)} flex items-center justify-center font-bold text-xs text-white`}>
                          {client.name[0] || 'C'}
                        </div>
                        <div>
                          <span>{client.name}</span>
                          {client.email && <span className="block text-[10px] text-slate-500 font-normal">{client.email}</span>}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-300">
                        {formatPhone(client.phone)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(client.tags || []).slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-dark-950 text-slate-300 border border-white/5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 font-semibold">
                          <span className="text-emerald-400">{stats?.completedCount || 0} feitos</span>
                          <span className="text-slate-500">/</span>
                          <span className="text-slate-300">{stats?.totalAppointments || 0} total</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-emerald-400 font-bold">
                        R$ {(stats?.totalSpent || 0).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="p-4 text-slate-400 font-mono">
                        {stats?.lastVisitDate ? formatDate(stats.lastVisitDate) : '-'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClientForDrawer(client)}
                            className="text-xs h-8 px-2.5"
                          >
                            Dossiê
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('/atendimento')}
                            className="h-8 px-2.5 border-white/10 hover:bg-white/10 text-white"
                            title="Abrir no Inbox WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                          <button
                            onClick={() => handleOpenEditClient(client)}
                            className="p-1.5 rounded-lg bg-dark-950 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DRAWER: Dossiê e Histórico do Cliente */}
      {selectedClientForDrawer && (
        <div 
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedClientForDrawer(null)}
        >
          <div 
            className="w-full max-w-xl bg-dark-950 border-l border-white/10 h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(selectedClientForDrawer.name)} flex items-center justify-center font-bold text-lg text-white shadow-lg`}>
                    {selectedClientForDrawer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedClientForDrawer.name}
                    </h2>
                    <p className="text-xs font-mono text-brand-400">
                      {formatPhone(selectedClientForDrawer.phone)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedClientForDrawer(null)}
                  className="p-2 rounded-xl bg-dark-900 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/55${selectedClientForDrawer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 flex items-center justify-center gap-2 text-xs font-bold transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chamar no WhatsApp
                </a>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('/atendimento')}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  className="text-xs border-white/10 hover:bg-white/10 text-white"
                >
                  Abrir no Inbox
                </Button>
              </div>

              {/* Client Details / Notes Box */}
              <div className="p-4 rounded-2xl bg-dark-900/80 border border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-400" />
                  Preferências & Anotações do Profissional
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-dark-950 p-3 rounded-xl border border-white/5 min-h-[48px]">
                  {selectedClientForDrawer.notes || 'Nenhuma preferência anotada para este cliente. Edite para registrar tamanhos (RN a 3 anos), temas favoritos, cores ou observações.'}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Tags do Cliente:</span>
                  <div className="flex flex-wrap gap-1">
                    {(selectedClientForDrawer.tags || []).map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-dark-950 text-slate-300 border border-white/10 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Appointments History Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Histórico de Agendamentos & Serviços
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {clientStatsMap[selectedClientForDrawer.id]?.totalAppointments || 0} registros
                  </span>
                </div>

                {(!clientStatsMap[selectedClientForDrawer.id]?.clientAppointments || clientStatsMap[selectedClientForDrawer.id].clientAppointments.length === 0) ? (
                  <div className="p-8 text-center bg-dark-900/40 rounded-2xl border border-white/5 text-slate-500 text-xs">
                    Nenhum agendamento registrado no histórico deste cliente.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar p-1">
                    {clientStatsMap[selectedClientForDrawer.id].clientAppointments.map((apt) => {
                      const isDone = apt.status === 'completed';
                      const isCancelled = apt.status === 'cancelled';
                      const isNoShow = apt.status === 'no_show';
                      const isConfirmed = apt.status === 'confirmed';

                      return (
                        <div
                          key={apt.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isDone
                              ? 'bg-emerald-950/20 border-emerald-500/20'
                              : isCancelled
                              ? 'bg-rose-950/20 border-rose-500/20 opacity-70'
                              : isNoShow
                              ? 'bg-amber-950/20 border-amber-500/20'
                              : 'bg-dark-900 border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">
                                  {apt.service_name}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                  isDone ? 'bg-emerald-500/20 text-emerald-300' :
                                  isCancelled ? 'bg-rose-500/20 text-rose-300' :
                                  isNoShow ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-brand-500/20 text-brand-300'
                                }`}>
                                  {isDone ? 'Realizado / Concluído' :
                                   isCancelled ? 'Cancelado' :
                                   isNoShow ? 'Não Compareceu' : 'Confirmado'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                                <span>📅 {formatDate(apt.appointment_date)}</span>
                                <span>🕒 {apt.appointment_time}</span>
                                {apt.duration_minutes && <span>⏱️ {apt.duration_minutes} min</span>}
                              </p>
                            </div>

                            {/* Status Quick Toggle */}
                            <div className="flex items-center gap-1">
                              {!isDone && (
                                <button
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'completed')}
                                  className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 hover:bg-emerald-900 text-[10px] font-semibold flex items-center gap-1"
                                  title="Marcar como Realizado"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Concluir</span>
                                </button>
                              )}
                              {!isNoShow && !isDone && (
                                <button
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'no_show')}
                                  className="p-1.5 rounded-lg bg-amber-950 text-amber-400 hover:bg-amber-900 text-[10px]"
                                  title="Marcar como Não Compareceu"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!isCancelled && !isDone && (
                                <button
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'cancelled')}
                                  className="p-1.5 rounded-lg bg-rose-950 text-rose-400 hover:bg-rose-900 text-[10px]"
                                  title="Cancelar Agendamento"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {apt.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-2 pt-2 border-t border-white/5">
                              Obs: "{apt.notes}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleOpenEditClient(selectedClientForDrawer);
                  setSelectedClientForDrawer(null);
                }}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Editar Cadastro
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() => setSelectedClientForDrawer(null)}
              >
                Fechar Dossiê
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Novo / Editar Cliente */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        subtitle="Mantenha o cadastro e histórico do cliente sempre atualizados"
        maxWidth="md"
      >
        <form onSubmit={handleSaveClient} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Nome Completo *</label>
            <Input
              type="text"
              placeholder="Ex: João da Silva"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">WhatsApp / Telefone *</label>
              <Input
                type="text"
                placeholder="Ex: 81 99613-8924"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail (Opcional)</label>
              <Input
                type="email"
                placeholder="Ex: joao@email.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Tags (Separadas por vírgula)</label>
            <Input
              type="text"
              placeholder="Ex: VIP, Gestante, Chá de Bebê, Enxoval Completo..."
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Anotações & Preferências do Cliente</label>
            <Textarea
              rows={3}
              placeholder="Ex: Bebê previsto para Novembro, prefere tricot azul bebê, quarto safari, tamanho RN..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10 sticky bottom-0 bg-dark-900/95 backdrop-blur-md pb-1 -mx-5 sm:-mx-6 px-5 sm:px-6 z-10">
            <Button variant="outline" type="button" onClick={() => setIsClientModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" type="submit">
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Novo Agendamento Rápido para Cliente */}
      <Modal
        isOpen={isQuickAptModalOpen}
        onClose={() => setIsQuickAptModalOpen(false)}
        title={`Agendar para ${quickAptClient?.name}`}
        subtitle="Cadastre uma vaga ou compromisso direto na agenda do cliente"
        maxWidth="md"
      >
        <form onSubmit={handleSaveQuickApt} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Serviço Desejado *</label>
            <select
              value={quickAptService}
              onChange={(e) => setQuickAptService(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
            >
              {(agendaSettings?.services || [
                { id: '1', name: 'Consultoria VIP de Enxoval', price: 0 },
                { id: '2', name: 'Montagem de Mala Maternidade', price: 0 },
                { id: '3', name: 'Guia de Medidas & Tamanhos', price: 0 },
              ]).map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} (R$ {Number(s.price || 0).toFixed(2).replace('.', ',')})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Data do Atendimento *</label>
              <Input
                type="date"
                value={quickAptDate}
                onChange={(e) => setQuickAptDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Horário *</label>
              <Input
                type="time"
                value={quickAptTime}
                onChange={(e) => setQuickAptTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Observações do Agendamento</label>
            <Textarea
              rows={2}
              placeholder="Instruções ou pedidos especiais..."
              value={quickAptNotes}
              onChange={(e) => setQuickAptNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10 sticky bottom-0 bg-dark-900/95 backdrop-blur-md pb-1 -mx-5 sm:-mx-6 px-5 sm:px-6 z-10">
            <Button variant="outline" type="button" onClick={() => setIsQuickAptModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" type="submit" className="bg-emerald-600 hover:bg-emerald-500">
              Confirmar Agendamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Confirmar Exclusão de Cliente */}
      <Modal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        title="Excluir Cliente?"
        subtitle="Confirme a remoção deste cliente da base"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-300">
            Tem certeza que deseja remover o cliente <strong className="text-white">"{clientToDelete?.name}"</strong>? O histórico de mensagens e agendamentos deixará de estar vinculado.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClientToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteClient}>
              Confirmar Exclusão
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Confirmar Exclusão em Massa de Todos os Clientes */}
      <Modal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        title="Excluir TODOS os Clientes?"
        subtitle="Esta ação removerá todos os clientes da base e do banco de dados"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Atenção: Essa ação irá excluir definitivamente todos os <strong>{clients.length}</strong> clientes cadastrados. A lista ficará completamente limpa e nenhum dado fictício será inserido.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteAllModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteAllClients}>
              Excluir Todos
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
