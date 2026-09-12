'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShoppingBag, 
  MessageSquare, 
  Users, 
  GitFork, 
  Settings as SettingsIcon, 
  Calendar, 
  QrCode, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  LifeBuoy, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Store as StoreIcon, 
  ArrowRight,
  LogOut,
  Sparkles,
  Bot,
  Truck,
  CreditCard,
  X,
  RefreshCw,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { RedeLojasView } from '../../components/RedeLojasView';
import { AtendimentoHumanoInbox } from '../../components/AtendimentoHumanoInbox';
import { WhatsappConnectView } from '../../components/WhatsappConnectView';
import { FlowBuilderView } from '../../components/FlowBuilderView';
import { AccessManagementView } from '../../components/AccessManagementView';
import { DashboardCEO } from '../../components/dashboards/DashboardCEO';
import { DashboardGerente } from '../../components/dashboards/DashboardGerente';
import { DashboardConsultora } from '../../components/dashboards/DashboardConsultora';
import { StorageService } from '../../lib/storage';
import { Product, Store, SupportTicket, VIPConsultation, DashboardKPIs, BotConfig } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export interface AdminPageProps {
  onNavigate?: (path: string) => void;
  activeTabProp?: 'dashboard' | 'lojas' | 'produtos' | 'bot_config' | 'atendimento' | 'agendamentos' | 'fluxos' | 'whatsapp' | 'acessos';
}

export default function AdminPage({ onNavigate, activeTabProp }: AdminPageProps = {}) {
  const { user, isCEO, isManager, isAttendant, logout } = useAuth();
  const { success, info, warning } = useToast();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'lojas' | 'produtos' | 'bot_config' | 'atendimento' | 'agendamentos' | 'fluxos' | 'whatsapp' | 'acessos'
  >(activeTabProp || 'dashboard');

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    if (onNavigate) {
      const pathMap: Record<string, string> = {
        dashboard: '/admin?tab=dashboard',
        lojas: '/lojas',
        produtos: '/catalogo',
        bot_config: '/bot_config',
        atendimento: '/atendimento',
        clientes: '/clientes',
        agendamentos: '/clientes?tab=agendamentos',
        fluxos: '/fluxos',
        whatsapp: '/whatsapp',
        acessos: '/acessos',
      };
      if (pathMap[tab]) {
        onNavigate(pathMap[tab]);
      } else {
        onNavigate(`/admin?tab=${tab}`);
      }
    }
  };

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [consultations, setConsultations] = useState<VIPConsultation[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Produto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields de Produto
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('49.90');
  const [prodPromoPrice, setProdPromoPrice] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodMaterial, setProdMaterial] = useState('Algodão Suedine 100% Pima');
  const [prodStock, setProdStock] = useState('50');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>(['RN', 'P', 'M', 'G', 'GG']);
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodActive, setProdActive] = useState(true);
  const [prodStores, setProdStores] = useState<string[]>([]);

  // Form Fields do Bot Config
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixName, setPixName] = useState('');
  const [pixCity, setPixCity] = useState('');
  const [shippingMotoboy, setShippingMotoboy] = useState('15.00');
  const [shippingCorreios, setShippingCorreios] = useState('24.90');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('250.00');
  const [botActive, setBotActive] = useState(true);
  const [isSavingBot, setIsSavingBot] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [kpiData, prods, storesData, ticketsData, consData, botCfg] = await Promise.all([
        StorageService.getKPIs(selectedStoreId || undefined),
        StorageService.getProducts(selectedStoreId || undefined),
        StorageService.getStores(),
        StorageService.getSupportTickets(selectedStoreId || undefined),
        StorageService.getVIPConsultations(selectedStoreId || undefined),
        StorageService.getBotConfig(),
      ]);
      setKpis(kpiData);
      setProducts(prods);
      setStores(storesData);
      setTickets(ticketsData);
      setConsultations(consData);
      setBotConfig(botCfg);

      if (botCfg) {
        setWelcomeMsg(botCfg.welcome_message);
        setPixKey(botCfg.pix_key);
        setPixName(botCfg.pix_name);
        setPixCity(botCfg.pix_city);
        setShippingMotoboy(String(botCfg.shipping_motoboy_price || '15.00'));
        setShippingCorreios(String(botCfg.shipping_correios_price || '24.90'));
        setFreeShippingThreshold(String(botCfg.free_shipping_threshold || '250.00'));
        setBotActive(botCfg.is_active !== false);
      }
    }
    loadData();
  }, [selectedStoreId]);

  const formatBRLInput = (val: string | number): string => {
    const digits = String(val).replace(/\D/g, '');
    if (!digits) return '';
    const num = Number(digits) / 100;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parseBRLInput = (val: string): number => {
    const digits = String(val).replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits) / 100;
  };

  const handleProductImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      warning('Por favor selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      setProdImageUrl(uploadEvt.target?.result as string);
      success('Foto do produto adicionada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleProductPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleProductImageFile(file);
          return;
        }
      }
    }
  };

  // Handler para abrir modal de criação
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('R$ 49,90');
    setProdPromoPrice('');
    setProdDesc('Confeccionado com toque suave e antialérgico para a pele delicada do bebê.');
    setProdMaterial('Algodão Suedine 100% Pima');
    setProdStock('50');
    setProdImageUrl('');
    setProdSizes(['RN', 'P', 'M', 'G', 'GG']);
    setProdStores(stores.map(s => s.id));
    setProdFeatured(false);
    setProdActive(true);
    setIsProductModalOpen(true);
  };

  // Handler para abrir modal de edição
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdPrice(formatBRLInput(Math.round(prod.price * 100)));
    setProdPromoPrice(prod.promotional_price ? formatBRLInput(Math.round(prod.promotional_price * 100)) : '');
    setProdDesc(prod.description);
    setProdMaterial(prod.material || 'Algodão Suedine 100% Pima');
    setProdStock(String(prod.stock_quantity ?? 50));
    setProdImageUrl(prod.image_url || '');
    setProdSizes(prod.sizes || ['RN', 'P', 'M']);
    setProdStores(
      prod.store_ids && prod.store_ids.length > 0 
        ? prod.store_ids 
        : (prod.store_id ? [prod.store_id] : stores.map(s => s.id))
    );
    setProdFeatured(Boolean(prod.is_featured));
    setProdActive(prod.is_active !== false);
    setIsProductModalOpen(true);
  };

  // Salvar Produto (Criação ou Edição)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    const payload: Partial<Product> = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      name: prodName.trim(),
      price: parseBRLInput(prodPrice) || 49.90,
      promotional_price: prodPromoPrice ? parseBRLInput(prodPromoPrice) : undefined,
      description: prodDesc.trim(),
      material: prodMaterial.trim(),
      stock_quantity: parseInt(prodStock) || 50,
      image_url: prodImageUrl.trim() || undefined,
      sizes: prodSizes as any,
      store_ids: prodStores.length > 0 ? prodStores : stores.map(s => s.id),
      store_id: prodStores[0] || null,
      is_featured: prodFeatured,
      is_active: prodActive,
      category_name: 'Roupas & Enxovais',
    };

    const saved = await StorageService.saveProduct(payload);

    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    setIsProductModalOpen(false);
    success(
      editingProduct ? 'Produto atualizado com sucesso!' : 'Novo produto adicionado ao catálogo!',
      'Sincronizado com o banco de dados e disponível no bot WhatsApp imediatamente'
    );
  };

  // Excluir Produto
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${name}"?`)) return;
    await StorageService.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    info(`Produto "${name}" removido do catálogo`);
  };

  // Salvar Configurações do Bot WhatsApp
  const handleSaveBotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBot(true);
    try {
      const updated = await StorageService.saveBotConfig({
        welcome_message: welcomeMsg,
        pix_key: pixKey.trim(),
        pix_name: pixName.trim(),
        pix_city: pixCity.trim(),
        shipping_motoboy_price: parseFloat(shippingMotoboy) || 15.00,
        shipping_correios_price: parseFloat(shippingCorreios) || 24.90,
        free_shipping_threshold: parseFloat(freeShippingThreshold) || 250.00,
        is_active: botActive,
      });
      setBotConfig(updated);
      success(
        'Configurações do Robô salvas com sucesso!',
        'O bot no Discloud atualizou os textos, fretes e chave PIX em tempo real'
      );
    } catch (err: any) {
      warning('Erro ao salvar configurações do bot: ' + err.message);
    } finally {
      setIsSavingBot(false);
    }
  };


  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.material && p.material.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="w-full text-zinc-100">
      {/* TAB 1: DASHBOARD (SEPARADO POR PAPEL RBAC: CEO, GERENTE, CONSULTORA) */}
      {activeTab === 'dashboard' && (
        <>
          {isCEO && (
            <DashboardCEO
              kpis={kpis}
              stores={stores}
              products={products}
              tickets={tickets}
              consultations={consultations}
              onNavigateTab={handleTabChange}
              onSelectStore={setSelectedStoreId}
            />
          )}
          {isManager && (
            <DashboardGerente
              stores={stores}
              products={products}
              tickets={tickets}
              consultations={consultations}
              onNavigateTab={handleTabChange}
              selectedStoreId={selectedStoreId}
              onSelectStore={setSelectedStoreId}
            />
          )}
          {isAttendant && (
            <DashboardConsultora
              products={products}
              consultations={consultations}
              onNavigateTab={handleTabChange}
            />
          )}
        </>
      )}

        {/* TAB 2: REDE DE LOJAS */}
        {activeTab === 'lojas' && (
          <RedeLojasView
            onSelectStore={store => setSelectedStoreId(store ? store.id : null)}
          />
        )}

        {/* TAB 3: CATÁLOGO DE PRODUTOS COM CRUD COMPLETO */}
        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-pitoco-blue" />
                  Catálogo de Roupas & Enxovais ({filteredProducts.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tudo que você cadastrar, alterar ou excluir aqui é refletido no bot WhatsApp em tempo real.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar produto ou tecido..."
                    className="bg-dark-800 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pitoco-blue w-60"
                  />
                </div>

                <Button
                  onClick={handleOpenCreateProduct}
                  className="bg-pitoco-blue text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-pitoco-blue/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Novo Produto
                </Button>
              </div>
            </div>

            {/* Grid de Produtos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredProducts.map(prod => (
                <Card key={prod.id} className="p-5 bg-dark-900 border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
                  <div>
                    {prod.image_url ? (
                      <img 
                        src={prod.image_url} 
                        alt={prod.name} 
                        className="w-full h-44 object-cover rounded-xl mb-3"
                      />
                    ) : (
                      <div className="w-full h-44 bg-dark-800 rounded-xl mb-3 flex items-center justify-center text-slate-500 text-xs">
                        Sem Foto Cadastrada
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-pitoco-blue font-bold uppercase tracking-wider block">
                        {prod.category_name || 'Roupas & Enxovais'}
                      </span>
                      {prod.is_featured && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pitoco-pink/20 text-pitoco-pink font-semibold border border-pitoco-pink/30">
                          ★ Destaque
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white mt-1">{prod.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{prod.description}</p>
                    
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-white">
                        R$ {(prod.promotional_price || prod.price).toFixed(2).replace('.', ',')}
                      </span>
                      {prod.promotional_price && (
                        <span className="text-xs text-slate-500 line-through">
                          R$ {prod.price.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400">
                      🧵 <strong>Material:</strong> {prod.material || 'Algodão'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      📏 <strong>Tamanhos:</strong> {(prod.sizes || []).join(', ')}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${
                      prod.stock_quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {prod.stock_quantity > 0 ? `✓ ${prod.stock_quantity} em estoque` : '✗ Esgotado'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Editar produto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CONFIGURAÇÕES DO ROBÔ WHATSAPP & PIX */}
        {activeTab === 'bot_config' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-pitoco-blue" />
                  Gerenciamento do Robô WhatsApp & Pagamentos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure a chave PIX, taxas de entrega e mensagens automáticas. O bot atualiza em tempo real.
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                botActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${botActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {botActive ? 'Robô Operando Online' : 'Robô Pausado'}
              </span>
            </div>

            <form onSubmit={handleSaveBotConfig} className="space-y-6">
              {/* Card 1: Chave PIX Oficial */}
              <Card className="p-6 bg-dark-900 border-white/10 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Chave PIX da Empresa</h3>
                    <p className="text-xs text-slate-400">
                      Utilizada para envio automático aos clientes que selecionarem a Opção 6 no WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Chave PIX (E-mail, CNPJ ou Telefone):</label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={e => setPixKey(e.target.value)}
                      placeholder="financeiro@pitocodegente.com.br"
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Favorecido / Razão Social:</label>
                    <input
                      type="text"
                      value={pixName}
                      onChange={e => setPixName(e.target.value)}
                      placeholder="Pitoco de Gente Artigos Infantis LTDA"
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Cidade da Conta:</label>
                    <input
                      type="text"
                      value={pixCity}
                      onChange={e => setPixCity(e.target.value)}
                      placeholder="Recife"
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>
                </div>
              </Card>

              {/* Card 2: Políticas de Frete & Entrega */}
              <Card className="p-6 bg-dark-900 border-white/10 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="p-2.5 rounded-xl bg-pitoco-blue/20 text-pitoco-blue border border-pitoco-blue/30">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Taxas de Entrega & Frete</h3>
                    <p className="text-xs text-slate-400">
                      Valores apresentados na Opção 5 (Cálculo de Frete) do robô.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Taxa Motoboy Express (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingMotoboy}
                      onChange={e => setShippingMotoboy(e.target.value)}
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Taxa Correios SEDEX/PAC (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCorreios}
                      onChange={e => setShippingCorreios(e.target.value)}
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Valor Mínimo para Frete Grátis (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={freeShippingThreshold}
                      onChange={e => setFreeShippingThreshold(e.target.value)}
                      className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-white"
                      required
                    />
                  </div>
                </div>
              </Card>

              {/* Card 3: Mensagem de Boas-Vindas */}
              <Card className="p-6 bg-dark-900 border-white/10 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="p-2.5 rounded-xl bg-pitoco-pink/20 text-pitoco-pink border border-pitoco-pink/30">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Mensagem de Boas-Vindas do WhatsApp</h3>
                    <p className="text-xs text-slate-400">
                      Texto exibido logo no início da conversa (use <code>{'{clientName}'}</code> para o nome da mamãe/cliente).
                    </p>
                  </div>
                </div>

                <div className="text-xs">
                  <textarea
                    rows={4}
                    value={welcomeMsg}
                    onChange={e => setWelcomeMsg(e.target.value)}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl p-3 text-white leading-relaxed font-sans"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="botActiveToggle"
                    checked={botActive}
                    onChange={e => setBotActive(e.target.checked)}
                    className="rounded bg-dark-800 border-white/10 text-pitoco-blue focus:ring-0"
                  />
                  <label htmlFor="botActiveToggle" className="text-slate-300 text-xs cursor-pointer font-medium">
                    Ativar atendimento automático do Robô (desmarque para deixar apenas atendimento humano)
                  </label>
                </div>
              </Card>

              {/* Botão de Salvar */}
              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isSavingBot}
                  className="bg-pitoco-blue text-slate-950 font-bold text-sm px-6 py-3 rounded-xl shadow-xl shadow-pitoco-blue/20 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSavingBot ? 'animate-spin' : ''}`} />
                  {isSavingBot ? 'Salvando Configurações...' : 'Salvar Configurações do Robô'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 5: ATENDIMENTO HUMANO INBOX (ADMIN) */}
        {activeTab === 'atendimento' && (
          <AtendimentoHumanoInbox portalMode="admin" initialStoreId={selectedStoreId} />
        )}



        {/* TAB 8: FLUXOS */}
        {activeTab === 'fluxos' && (
          <FlowBuilderView onNavigate={tab => setActiveTab(tab as any)} />
        )}

        {/* TAB 9: WHATSAPP QR */}
        {activeTab === 'whatsapp' && (
          <WhatsappConnectView onNavigate={tab => setActiveTab(tab as any)} />
        )}

        {/* TAB 10: GERENCIAMENTO DE ACESSOS */}
        {activeTab === 'acessos' && (
          <AccessManagementView />
        )}

      {/* MODAL CRIAR / EDITAR PRODUTO */}
      {isProductModalOpen && (
        <div 
          onPaste={handleProductPaste}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-dark-900 border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-white" />
                {editingProduct ? 'Editar Produto do Catálogo' : 'Novo Produto no Catálogo'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Nome do Produto:</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  placeholder="Ex: Macacão Canelado Zíper Duplo"
                  className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Preço Normal (R$):</label>
                  <input
                    type="text"
                    value={prodPrice}
                    onChange={e => setProdPrice(formatBRLInput(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Preço Promocional (Opcional):</label>
                  <input
                    type="text"
                    value={prodPromoPrice}
                    onChange={e => setProdPromoPrice(formatBRLInput(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Tecido / Material:</label>
                  <input
                    type="text"
                    value={prodMaterial}
                    onChange={e => setProdMaterial(e.target.value)}
                    placeholder="Ex: Algodão Suedine 100% Pima"
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Estoque Inicial:</label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={e => setProdStock(e.target.value)}
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              </div>

              {/* Upload e Ctrl+V de Foto do Produto */}
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">
                  Foto do Produto (Upload ou Ctrl + V):
                </label>
                {prodImageUrl ? (
                  <div className="relative rounded-2xl border border-white/10 p-3 bg-[#18181b] flex items-center gap-4">
                    <img
                      src={prodImageUrl}
                      alt="Prévia do produto"
                      className="w-20 h-20 object-cover rounded-xl border border-white/10 shadow"
                    />
                    <div className="flex-1 space-y-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ✓ Imagem Carregada
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        Dica: Você pode arrastar outra foto ou colar direto com Ctrl + V.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProdImageUrl('')}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 text-zinc-300 text-xs transition-colors"
                    >
                      Trocar Foto
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleProductImageFile(e.dataTransfer.files[0]);
                    }}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 hover:border-white/40 rounded-2xl bg-[#141416] cursor-pointer transition-all text-center group"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleProductImageFile(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-[#1f1f23] flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-zinc-200">
                      Clique para enviar foto ou arraste o arquivo aqui
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5 justify-center">
                      <span>Ou simplesmente aperte</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300">Ctrl + V</kbd>
                      <span>para colar imagem copiada</span>
                    </span>
                  </label>
                )}
              </div>

              {/* Seleção Múltipla de Lojas da Rede */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-semibold block">
                    Disponível nas Lojas da Rede ({prodStores.length} selecionadas):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (prodStores.length === stores.length) setProdStores([]);
                      else setProdStores(stores.map(s => s.id));
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white underline"
                  >
                    {prodStores.length === stores.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stores.map(s => {
                    const isChecked = prodStores.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-zinc-800/80 border-white/20 text-white font-medium'
                            : 'bg-[#18181b]/50 border-white/5 text-zinc-400 hover:border-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) setProdStores(prodStores.filter(id => id !== s.id));
                            else setProdStores([...prodStores, s.id]);
                          }}
                          className="rounded bg-[#27272a] border-white/20 text-white focus:ring-0"
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Descrição Detalhada:</label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={e => setProdDesc(e.target.value)}
                  placeholder="Detalhes para a mamãe sobre o produto..."
                  className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="prodFeaturedCheck"
                    checked={prodFeatured}
                    onChange={e => setProdFeatured(e.target.checked)}
                    className="rounded bg-[#18181b] border-white/10 text-white focus:ring-0"
                  />
                  <label htmlFor="prodFeaturedCheck" className="text-zinc-300 cursor-pointer">
                    Produto em Destaque
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="prodActiveCheck"
                    checked={prodActive}
                    onChange={e => setProdActive(e.target.checked)}
                    className="rounded bg-[#18181b] border-white/10 text-emerald-400 focus:ring-0"
                  />
                  <label htmlFor="prodActiveCheck" className="text-zinc-300 cursor-pointer">
                    Produto Ativo no Catálogo
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-xs text-zinc-300 border-white/10 hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-white text-black hover:bg-zinc-200 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
