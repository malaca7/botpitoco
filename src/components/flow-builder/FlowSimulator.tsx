import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  RotateCcw, 
  SlidersHorizontal,
  ChevronRight,
  Phone,
  UserCheck,
  UserPlus,
  Calendar,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Flow, FlowNode, FlowEdge, BotProfile, AgendaServiceItem, Contact } from '../../types';
import { substituteVariables, executeVariableAssignment } from '../../lib/flowEngine';
import { StorageService } from '../../lib/storage';

export interface FlowSimulatorProps {
  flow: Flow;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onHighlightNode?: (nodeId: string | null) => void;
}

interface SimMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  content: string;
  buttons?: Array<{ id: string; title: string }>;
  timestamp: string;
  nodeId?: string;
}

export const FlowSimulator: React.FC<FlowSimulatorProps> = ({
  flow,
  nodes,
  edges,
  onClose,
  onHighlightNode,
}) => {
  // Setup & Configuration Screen state
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [simName, setSimName] = useState('Carlos Silva');
  const [simPhone, setSimPhone] = useState('81999998888');
  const [simMode, setSimMode] = useState<'new' | 'existing'>('new');
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);

  // Simulation execution state
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [botProfile, setBotProfile] = useState<BotProfile | null>(null);
  const [agendaServices, setAgendaServices] = useState<AgendaServiceItem[]>([]);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load bot profile, services and registered contacts
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [profile, botVars, contactsList] = await Promise.all([
          StorageService.getBotProfile(),
          StorageService.getBotVariables(),
          StorageService.getContacts(),
        ]);
        setBotProfile(profile);
        setVariables(botVars || {});
        setAvailableContacts((contactsList || []).filter(c => !StorageService.isContactDeleted(c)));

        try {
          const agenda = await StorageService.getAgendaSettings();
          if (agenda?.services && Array.isArray(agenda.services)) {
            const activeServices = agenda.services.filter((s: any) => s.active !== false && s.is_active !== false);
            setAgendaServices(activeServices);
          }
        } catch (e) {
          console.warn('Error loading agenda services for simulator:', e);
        }
      } catch (err) {
        console.warn('Error initializing simulator data:', err);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start or Restart Flow Execution
  const handleStartSimulation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = (simPhone || '').replace(/\D/g, '') || '81999998888';
    const isNew = simMode === 'new';
    const clientName = simName.trim() || (isNew ? '' : 'Cliente Cadastrado');

    const initialVars: Record<string, any> = {
      ...variables,
      whatsapp_pushname: clientName || 'Cliente',
      telefone_cliente: cleanPhone,
      telefone_whatsapp: cleanPhone,
      telefone: cleanPhone,
      is_novo_contato: isNew,
      is_primeiro_contato: isNew,
      is_existing_contact: !isNew,
      tipo_cliente: isNew ? 'novo' : 'recorrente',
      nome_cliente: isNew ? '' : clientName,
      cliente_nome: isNew ? '' : clientName,
      nome: isNew ? '' : clientName,
      empresa: botProfile?.company_name || 'Pitoco de Gente',
      bot_nome: botProfile?.name || 'Pitoco Bot',
    };

    setVariables(initialVars);
    setIsConfiguring(false);
    startFlow(botProfile, initialVars);
  };

  const startFlow = (profile?: BotProfile | null, initialVars?: Record<string, any>) => {
    setMessages([]);
    const triggerNode = nodes.find((n) => (n.data?.nodeType || n.type) === 'trigger') || nodes[0];
    if (!triggerNode) {
      setMessages([
        {
          id: 'sys-0',
          sender: 'system',
          content: 'Nenhum nó de gatilho inicial encontrado no fluxo.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    const modeLabel = initialVars?.is_novo_contato ? 'Novo Contato' : 'Cliente Já Cadastrado';
    const nameLabel = initialVars?.nome_cliente || initialVars?.whatsapp_pushname || 'Cliente';

    setMessages([
      {
        id: 'sys-start',
        sender: 'system',
        content: `▶️ Simulação iniciada: ${nameLabel} (${modeLabel})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        nodeId: triggerNode.id,
      },
    ]);

    runNextFromNode(triggerNode.id, profile || botProfile, initialVars || variables, false);
  };

  const runNextFromNode = async (
    startNodeId: string,
    currentProfile?: BotProfile | null,
    currentVars?: Record<string, any>,
    executeStartNode = false
  ) => {
    setIsRunning(true);
    let currentId: string | undefined = startNodeId;
    let stepCount = 0;
    const activeVars = { ...variables, ...(currentVars || {}) };
    const p = currentProfile || botProfile;
    const currentServices = agendaServices.length > 0 ? agendaServices : [
      { id: 'srv-1', name: 'Body Suedine 100% Algodão', duration_minutes: 30, price: 49.9 },
      { id: 'srv-2', name: 'Macacão Zíper Duplo Confort', duration_minutes: 30, price: 89.9 },
      { id: 'srv-3', name: 'Saída Maternidade Tricot Luxo', duration_minutes: 30, price: 199.9 },
      { id: 'srv-4', name: 'Kit de Berço 9 Peças 200 Fios', duration_minutes: 30, price: 389.0 },
      { id: 'srv-5', name: 'Consultoria VIP de Enxoval', duration_minutes: 45, price: 0.0 },
    ];

    let isFirstStep = executeStartNode;

    while (currentId && stepCount < 25) {
      stepCount++;
      let nextNode: FlowNode | undefined;

      if (isFirstStep) {
        nextNode = nodes.find((n) => n.id === currentId);
        isFirstStep = false;
      } else {
        const outgoing = edges.filter((e) => e.source === currentId);
        if (outgoing.length === 0) break;

        const startNode = nodes.find(n => n.id === currentId);
        const startNodeType = startNode?.data?.nodeType || startNode?.type;

        let targetEdge = outgoing[0];

        // Handle branching for multi-output nodes
        if (startNodeType === 'check_contact') {
          const isNew = activeVars.is_primeiro_contato !== undefined
            ? Boolean(activeVars.is_primeiro_contato)
            : Boolean(activeVars.is_novo_contato || !activeVars.is_existing_contact);
          const targetHandle = isNew ? 'is_new' : 'is_existing';
          const branchEdge =
            outgoing.find(e => e.sourceHandle === targetHandle) ||
            outgoing.find(e => isNew 
              ? (e.sourceHandle?.includes('new') || e.sourceHandle?.includes('novo'))
              : (e.sourceHandle?.includes('exist') || e.sourceHandle?.includes('salvo') || e.sourceHandle?.includes('recorrente'))
            ) ||
            outgoing[0];
          targetEdge = branchEdge;
        } else if (startNodeType === 'store_selector') {
          const sId = activeVars.loja_id || activeVars.botao_id || 'store_matriz';
          targetEdge = outgoing.find(e => e.sourceHandle === sId) || outgoing[0];
        } else if (startNodeType === 'shipping_calculator') {
          const sId = activeVars.tipo_frete_id || activeVars.botao_id || 'shipping_motoboy';
          targetEdge = outgoing.find(e => e.sourceHandle === sId) || outgoing[0];
        } else if (startNodeType === 'pix_payment') {
          const pId = activeVars.botao_id || (activeVars.status_pagamento === 'comprovante_enviado' ? 'pix_paid' : 'pix_help');
          targetEdge = outgoing.find(e => e.sourceHandle === pId) || outgoing[0];
        } else if (startNodeType === 'vip_consultation') {
          const cId = activeVars.consultoria_id || activeVars.botao_id || 'consult_online';
          targetEdge = outgoing.find(e => e.sourceHandle === cId) || outgoing[0];
        } else if (startNodeType === 'promotional_coupon') {
          const cId = activeVars.botao_id || (activeVars.cupom_aplicado ? 'coupon_valid' : 'coupon_invalid');
          targetEdge = outgoing.find(e => e.sourceHandle === cId) || outgoing[0];
        }

        nextNode = nodes.find((n) => n.id === targetEdge.target);
      }

      if (!nextNode) break;

      currentId = nextNode.id;
      setCurrentNodeId(currentId);
      onHighlightNode?.(currentId);

      const type = nextNode.data?.nodeType || nextNode.type;
      const config = nextNode.data?.config || {};

      // 0. Trigger Node
      if (type === 'trigger') {
        const outgoing = edges.find(e => e.source === nextNode.id);
        if (outgoing) {
          currentId = outgoing.target;
          isFirstStep = true;
          continue;
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 550));

      // 1. Message Node
      if (type === 'message') {
        const text = substituteVariables(config.text || 'Olá!', activeVars, p || undefined);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      } 
      // 2. Buttons Node
      else if (type === 'buttons') {
        const body = substituteVariables(config.bodyText || 'Escolha uma opção:', activeVars, p || undefined);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: body,
            buttons: config.buttons || [{ id: 'b1', title: 'Opção 1' }, { id: 'b2', title: 'Opção 2' }],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 3. Question Node (Waits for input)
      else if (type === 'question') {
        const qText = substituteVariables(config.questionText || 'Informe seus dados:', activeVars, p || undefined);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: qText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 4. Check Contact Node
      else if (type === 'check_contact') {
        const isNew = activeVars.is_primeiro_contato !== undefined
          ? Boolean(activeVars.is_primeiro_contato)
          : Boolean(activeVars.is_novo_contato || !activeVars.is_existing_contact);

        activeVars.is_primeiro_contato = isNew;
        activeVars.is_novo_contato = isNew;
        activeVars.is_existing_contact = !isNew;
        activeVars.tipo_cliente = isNew ? 'novo' : 'recorrente';

        const targetHandle = isNew ? 'is_new' : 'is_existing';
        const branchEdge =
          edges.find((e) => e.source === nextNode.id && e.sourceHandle === targetHandle) ||
          edges.find((e) => e.source === nextNode.id && (isNew 
            ? (e.sourceHandle?.includes('new') || e.sourceHandle?.includes('novo')) 
            : (e.sourceHandle?.includes('exist') || e.sourceHandle?.includes('salvo') || e.sourceHandle?.includes('recorrente'))
          )) ||
          edges.find((e) => e.source === nextNode.id);

        if (branchEdge) {
          currentId = branchEdge.target;
          isFirstStep = true;
          continue;
        }
        break;
      }
      // 5. Variable / Set Variable Node
      else if (type === 'variable' || type === 'set_variable') {
        const assignments = config.assignments || (config.varName ? [config] : []);
        const cleanPhone = activeVars.telefone_cliente || '81999998888';
        for (const a of assignments) {
          executeVariableAssignment(a, activeVars, { id: `sim-${cleanPhone}`, name: activeVars.nome_cliente, phone: cleanPhone } as any, p || undefined);
        }
        setVariables({ ...activeVars });
        const outgoing = edges.find(e => e.source === nextNode.id);
        if (outgoing) {
          currentId = outgoing.target;
          isFirstStep = true;
          continue;
        }
        break;
      }
      // 6. Update Contact / Client Upsert Node
      else if (type === 'update_contact' || type === 'client_upsert' || type === 'save_contact') {
        const rawName = config.contactName || config.nameField;
        let resolvedName = '';
        if (rawName) {
          resolvedName = substituteVariables(rawName, activeVars, p || undefined);
          if (resolvedName === rawName && !rawName.includes('{{')) {
            resolvedName = activeVars[rawName.replace(/[{}]/g, '').trim()] || rawName;
          }
        }
        if (!resolvedName || resolvedName === '{{nome_cliente}}' || resolvedName === 'nome_cliente') {
          resolvedName = activeVars.nome_cliente || activeVars.resposta_usuario || activeVars.whatsapp_pushname || 'Cliente';
        }
        activeVars.nome_cliente = resolvedName;
        activeVars.cliente_nome = resolvedName;
        activeVars.nome = resolvedName;
        activeVars.primeiro_nome = resolvedName.split(' ')[0] || resolvedName;
        activeVars.is_primeiro_contato = false;
        activeVars.is_novo_contato = false;
        activeVars.is_existing_contact = true;
        activeVars.cliente_salvo = true;

        if (config.customFieldKey && config.customFieldValue) {
          const fieldKey = config.customFieldKey.replace(/[{}]/g, '').trim();
          const cleanVal = config.customFieldValue.replace(/[{}]/g, '').trim();
          const finalVal = activeVars[cleanVal] || config.customFieldValue;
          activeVars[fieldKey] = finalVal;
        }
        setVariables({ ...activeVars });
        const outgoing = edges.find(e => e.source === nextNode.id);
        if (outgoing) {
          currentId = outgoing.target;
          isFirstStep = true;
          continue;
        }
        break;
      }
      // 7. Show Services Node
      else if (type === 'show_services' || (type === 'services_catalog' && config.displayFormat !== 'buttons')) {
        const header = substituteVariables(config.headerText || '🍼 *Catálogo Pitoco de Gente — Bebê & Enxovais*', activeVars, p || undefined);
        const footer = config.footerText ? `\n\n_${substituteVariables(config.footerText, activeVars, p || undefined)}_` : '';

        const serviceLines = currentServices
          .map((s, idx) => {
            const priceFormatted = Number(s.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const desc = s.description ? `\n   _${s.description}_` : '';
            return `*${idx + 1}️⃣* *${s.name}*\n   💰 ${priceFormatted} • ⏱️ ${s.duration_minutes || 30} min${desc}`;
          })
          .join('\n\n');

        const fullMsg = `${header}\n\n${serviceLines}${footer}`;
        activeVars.catalogo_servicos_texto = fullMsg;
        activeVars.catalogo_servicos = fullMsg;
        setVariables((prev) => ({ ...prev, catalogo_servicos_texto: fullMsg, catalogo_servicos: fullMsg }));

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: fullMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        // Continuous flow
      } 
      // 8. Select Service Node
      else if (type === 'select_service' || (type === 'services_catalog' && config.displayFormat === 'buttons')) {
        const intro = substituteVariables(config.introMessage || 'Qual serviço você deseja agendar hoje?', activeVars, p || undefined);
        const buttons = currentServices.slice(0, 3).map((s, idx) => ({
          id: `srv_${s.id || idx + 1}`,
          title: `${s.name} (R$ ${Number(s.price || 0).toFixed(0)})`,
        }));

        let content = `✂️ *Escolha o Serviço:*\n${intro}`;
        if (currentServices.length > 3) {
          const listLines = currentServices
            .map((s) => `• *${s.name}* (R$ ${Number(s.price || 0).toFixed(2).replace('.', ',')})`)
            .join('\n');
          content += `\n\n${listLines}`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 9. Delay Node
      else if (type === 'delay') {
        const waitSec = Math.min(Math.max(Number(config.amount || config.seconds || 1.5), 1), 3);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 500));
        // Continuous flow
      } 
      // 10. Date Selection Node
      else if (type === 'select_date' || type === 'ask_date') {
        const qText = substituteVariables(config.questionText || 'Para qual dia você deseja agendar?', activeVars, p || undefined);
        const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const tomDate = new Date();
        tomDate.setDate(tomDate.getDate() + 1);
        const tomStr = tomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `📅 *Escolha a Data:*\n${qText}`,
            buttons: [
              { id: 'date_today', title: `Hoje (${todayStr})` },
              { id: 'date_tomorrow', title: `Amanhã (${tomStr})` },
              { id: 'date_custom', title: 'Outra Data' },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 11. Time Slot Selection Node
      else if (type === 'select_time_slot' || type === 'schedule_contact') {
        const srv = activeVars.servico_selecionado || 'Consultoria VIP de Enxoval';
        const dateStr = activeVars.data_agendamento || 'Hoje';
        const intro = substituteVariables(config.introMessage || 'Estes são os horários livres para agendamento. Toque no seu horário preferido:', activeVars, p || undefined);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🕒 *Horários Livres da Agenda (${dateStr}):*\n• Serviço: *${srv}*\n\n${intro}`,
            buttons: [
              { id: 'slot_0900', title: '🕒 09:00' },
              { id: 'slot_1000', title: '🕒 10:00' },
              { id: 'slot_1400', title: '🕒 14:00' },
              { id: 'slot_1600', title: '🕒 16:00' },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 12. Confirm Booking Node
      else if (type === 'confirm_booking') {
        const clientName = activeVars.nome_cliente || activeVars.whatsapp_pushname || 'Cliente';
        const srvName = activeVars.servico_selecionado || 'Consultoria VIP de Enxoval';
        const dateVal = activeVars.data_agendamento || new Date().toLocaleDateString('pt-BR');
        const timeVal = activeVars.horario_agendamento || '09:00';
        const defaultConfirm = `✅ *Agendamento Confirmado com Sucesso!*\n\n• *Cliente:* ${clientName}\n• *Serviço:* ${srvName}\n• *Data:* ${dateVal}\n• *Horário:* ${timeVal}\n\nSeu horário foi reservado em nossa Agenda com sucesso!`;
        const confirmMsg = config.confirmMessage ? substituteVariables(config.confirmMessage, activeVars, p || undefined) : defaultConfirm;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: confirmMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      } 
      // 13. AI Agent Node
      else if (type === 'ai_agent') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `✨ [Agente de IA]: Entendi sua solicitação. Como posso te auxiliar a encontrar o melhor horário?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      } 
      // 14. Human Handoff Node
      else if (type === 'human_handoff') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'system',
            content: `👨‍💼 ${config.notifyMessage || 'Atendimento transferido para a equipe humana.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      } 
      // 14.1 Store Selector Node (Multi-Filiais)
      else if (type === 'store_selector') {
        const intro = substituteVariables(config.introMessage || 'Olá! Seja bem-vinda à *Pitoco de Gente*. 🍼 Com qual de nossas lojas você deseja falar hoje?', activeVars, p || undefined);
        let loadedStores: any[] = [];
        try {
          const cached = localStorage.getItem('pitoco_stores') || localStorage.getItem('7assistente_stores');
          if (cached) loadedStores = JSON.parse(cached);
        } catch {}
        if (!Array.isArray(loadedStores) || loadedStores.length === 0) {
          loadedStores = [
            { id: 'store-001', name: 'Loja Matriz Centro' },
            { id: 'store-002', name: 'Loja Ipojuca - Filial' },
            { id: 'store-003', name: 'Atendimento Geral / E-commerce' },
          ];
        }
        const buttons = loadedStores.map((st: any, i: number) => ({
          id: st.id || `store_${st.slug || i}`,
          title: st.name.replace(/^Loja\s*/i, '').slice(0, 20)
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🏬 *Escolha de Filial / Loja:*\n\n${intro}`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 14.2 Show Catalog Node
      else if (type === 'show_catalog') {
        const header = substituteVariables(config.headerText || '🍼 *Vitrine Pitoco de Gente — Moda Bebê & Enxovais*\n\nConheça nossas peças mais amadas pelas mamães:', activeVars, p || undefined);
        const footer = substituteVariables(config.footerText || '✨ Trabalhamos do RN ao 3 anos. Peças 100% algodão suedine e tricot antialérgico.', activeVars, p || undefined);

        const catalogContent = `${header}\n\n` +
          `• *Body Suedine 100% Algodão*\n   💰 R$ 49,90 • 👶 RN a GG (Cores Lisas & Estampadas)\n\n` +
          `• *Macacão Confort Zíper Duplo*\n   💰 R$ 89,90 • 👶 RN ao 3 Anos (Proteção no Queixo)\n\n` +
          `• *Saída Maternidade Tricot Luxo (5 Peças)*\n   💰 R$ 199,90 • 👶 RN e P (Macacão + Manta + Body + Faixinha)\n\n` +
          `• *Kit de Berço 9 Peças 200 Fios*\n   💰 R$ 389,00 • 🛏️ Padrão Americano (100% Algodão Hipoalergênico)\n\n` +
          `_${footer}_`;

        activeVars.catalogo_produtos = catalogContent;
        setVariables((prev) => ({ ...prev, catalogo_produtos: catalogContent }));

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: catalogContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      }
      // 14.3 Select Product Node
      else if (type === 'select_product') {
        const intro = substituteVariables(config.introMessage || 'Qual peça da Pitoco de Gente você gostaria de escolher agora?', activeVars, p || undefined);
        const buttons = [
          { id: 'prod_body', title: 'Body Suedine (R$ 49)' },
          { id: 'prod_macacao', title: 'Macacão Zíper (R$ 89)' },
          { id: 'prod_saida', title: 'Saída Luxo (R$ 199)' },
        ];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🛍️ *Escolha seu Produto:*\n\n${intro}`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 14.4 Shipping Calculator Node
      else if (type === 'shipping_calculator') {
        const intro = substituteVariables(config.introMessage || 'Como você prefere receber seu pedido da Pitoco de Gente?', activeVars, p || undefined);
        const buttons = [
          { id: 'shipping_motoboy', title: 'Motoboy Express (R$ 15)' },
          { id: 'shipping_correios', title: 'Correios SEDEX/PAC (R$ 25)' },
          { id: 'shipping_pickup', title: 'Retirar na Loja (Grátis)' },
        ];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🚚 *Calculadora de Frete & Entrega:*\n\n${intro}\n\n• *Motoboy Express:* Recife e RMR (Entrega hoje)\n• *Correios PAC/SEDEX:* Envio para todo o Brasil\n• *Retirada:* Grátis na Matriz Centro ou Loja Ipojuca`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 14.5 Pix Payment Node
      else if (type === 'pix_payment') {
        const total = activeVars.valor_total || activeVars.valor_produto || 'R$ 89,90';
        const clientName = activeVars.nome_cliente || activeVars.whatsapp_pushname || 'Cliente';
        const pixKey = config.pixKey || 'financeiro@pitocodegente.com.br';
        const beneficiary = config.pixBeneficiary || 'Pitoco de Gente Bebê e Criança LTDA';
        const copiaCola = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865405${total.replace(/\D/g, '')}5802BR5925${beneficiary.substring(0, 25)}6009RECIFE62070503***6304`;

        activeVars.pix_copia_cola = copiaCola;
        setVariables((prev) => ({ ...prev, pix_copia_cola: copiaCola }));

        const buttons = [
          { id: 'pix_paid', title: '✅ Já Efetuei o PIX' },
          { id: 'pix_help', title: '❓ Preciso de Ajuda' },
        ];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `⚡ *Cobrança PIX Pitoco de Gente*\n\n• *Titular:* ${beneficiary}\n• *Chave PIX (E-mail):* \`${pixKey}\`\n• *Valor Total:* *${total}*\n\n📋 *Código Copia e Cola (toque para copiar):*\n\`\`\`\n${copiaCola}\n\`\`\`\n\n_Após pagar, toque no botão abaixo para confirmar:_`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 14.6 Cart Order Node
      else if (type === 'cart_order') {
        const orderNum = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
        const clientName = activeVars.nome_cliente || activeVars.whatsapp_pushname || 'Cliente';
        const product = activeVars.produto_selecionado || 'Saída Maternidade Tricot Luxo';
        const total = activeVars.valor_total || activeVars.valor_produto || 'R$ 199,90';
        const shipping = activeVars.tipo_frete || 'Motoboy Express (Recife)';

        activeVars.numero_pedido = orderNum;
        activeVars.total_pedido = total;
        activeVars.status_pedido = 'Aguardando Pagamento';
        setVariables((prev) => ({ ...prev, numero_pedido: orderNum, total_pedido: total, status_pedido: 'Aguardando Pagamento' }));

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🎉 *Pedido Gerado com Sucesso!*\n\n• *Protocolo:* *${orderNum}*\n• *Cliente:* ${clientName}\n• *Peça:* ${product}\n• *Entrega:* ${shipping}\n• *Valor Total:* *${total}*\n\nSeu pedido foi registrado em nosso sistema!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      }
      // 14.7 Measure Guide Node
      else if (type === 'measure_guide') {
        const guideText = `📏 *Tabela de Medidas Pitoco de Gente (RN a 3 Anos)*\n\n` +
          `• *RN:* Até 52 cm | Até 3,5 kg (Hospital)\n` +
          `• *P (0 a 3m):* 52 a 62 cm | 3,5 a 5,5 kg\n` +
          `• *M (3 a 6m):* 62 a 67 cm | 5,5 a 7,5 kg\n` +
          `• *G (6 a 9m):* 67 a 72 cm | 7,5 a 9,5 kg\n` +
          `• *GG / 1 Ano:* 72 a 77 cm | 9,5 a 11,5 kg\n` +
          `• *2 Anos:* 77 a 88 cm | 11,5 a 13,5 kg\n` +
          `• *3 Anos:* 88 a 98 cm | 13,5 a 15,5 kg\n\n` +
          `💡 _Dica da Pitoco: Bebês crescem rápido! Se estiver na dúvida entre dois tamanhos, escolha o maior para garantir o conforto._`;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: guideText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      }
      // 14.8 Layette Checklist Node
      else if (type === 'layette_checklist') {
        const checklistText = `🧳 *Checklist Mala de Maternidade — 10 Itens Essenciais*\n\n` +
          `1. 🍼 *6 Bodies Suedine 100% Algodão* (mangas longas e curtas)\n` +
          `2. 👶 *6 Culotes / Mijõezinhos* com pé reversível\n` +
          `3. 🧸 *4 Macacões Confort* com zíper duplo frontal\n` +
          `4. ✨ *2 Saídas Maternidade completas* com mantas em tricot\n` +
          `5. 🧤 *3 Pares de luvinhas e meinhas* de algodão\n` +
          `6. 🧣 *6 Fraldinhas de boca* em algodão duplo macio\n` +
          `7. 🛁 *2 Toalhas de banho soft* com capuz e fralda\n` +
          `8. 🧼 *1 Kit higiene do bebê* (escovinha, sabonete glicerina)\n` +
          `9. 🛏️ *3 Cueiros flanelados* para enrolar o recém-nascido\n` +
          `10. 🎀 *1 Ninho redutor de berço* para descanso aconchegante\n\n` +
          `💖 _Temos todas as peças disponíveis em pronta entrega!_`;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: checklistText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      }
      // 14.9 VIP Consultation Node
      else if (type === 'vip_consultation') {
        const intro = substituteVariables(config.introMessage || '✨ Como você prefere realizar sua Consultoria VIP de Enxoval da Pitoco de Gente?', activeVars, p || undefined);
        const buttons = [
          { id: 'consult_online', title: '📱 Online (WhatsApp/Vídeo)' },
          { id: 'consult_store', title: '🏬 Presencial na Loja' },
        ];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `✨ *Consultoria VIP de Enxoval:*\n\n${intro}`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 14.10 Order Tracking Node
      else if (type === 'order_tracking') {
        const orderNum = activeVars.numero_pedido || 'PED-839201';
        const clientPhone = activeVars.telefone_cliente || '81999998888';

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `📦 *Rastreamento de Pedido Pitoco de Gente*\n\n• *Protocolo:* *${orderNum}*\n• *Telefone:* ${clientPhone}\n• *Status:* 🚚 *Em Trânsito / Saiu para Entrega*\n• *Previsão:* Hoje até as 18h\n\nVocê receberá uma mensagem quando o entregador estiver chegando! 💕`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
      }
      // 14.11 Promotional Coupon Node
      else if (type === 'promotional_coupon') {
        const coupon = config.couponCode || 'BEMVINDO10';
        const buttons = [
          { id: 'coupon_valid', title: `✅ Aplicar ${coupon}` },
          { id: 'coupon_invalid', title: '❌ Sem Cupom' },
        ];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: `🎟️ *Cupom de Desconto Especial:*\n\nGanhe *10% OFF* na sua primeira compra com o cupom *${coupon}*!\n\nDeseja aplicar agora ao seu pedido?`,
            buttons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
      // 15. End Flow Node
      else if (type === 'end_flow' || type === 'finish_flow' || type === 'end') {
        const finalMsg = config.message
          ? substituteVariables(config.message, activeVars, p || undefined)
          : '🏁 *Atendimento finalizado com sucesso!*';
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: 'bot',
            content: finalMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
          {
            id: `msg-end-${Date.now()}`,
            sender: 'system',
            content: '🔒 Fluxo finalizado e concluído.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: nextNode.id,
          },
        ]);
        break;
      }
    }

    setIsRunning(false);
  };

  const handleButtonClick = (btnTitle: string, btnId?: string, btnIndex?: number, addMessage = true) => {
    if (addMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-btn-${Date.now()}`,
          sender: 'user',
          content: btnTitle,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }

    const updatedVars = { ...variables };
    updatedVars.opcao_selecionada = btnTitle;
    if (btnId) updatedVars.botao_id = btnId;

    // Store variables based on button type
    if (btnId && (btnId.startsWith('store_') || btnId.startsWith('store-'))) {
      const storeName = btnTitle.replace(/^\d+️⃣?\s*/, '').trim();
      updatedVars.loja_escolhida = storeName;
      updatedVars.loja_id = btnId;
      updatedVars.loja_nome = storeName;
      updatedVars.opcao_selecionada = storeName;
      updatedVars.resposta_usuario = storeName;
    }
    if (btnId === 'shipping_motoboy' || btnId === 'shipping_correios' || btnId === 'shipping_pickup') {
      const shipMap: Record<string, { label: string; price: string; days: string }> = {
        shipping_motoboy: { label: 'Motoboy Express (Recife)', price: 'R$ 15,00', days: 'Hoje' },
        shipping_correios: { label: 'Correios SEDEX / PAC', price: 'R$ 24,90', days: '2 a 5 dias úteis' },
        shipping_pickup: { label: 'Retirada Grátis em Loja', price: 'Grátis', days: 'Pronto em 2h' },
      };
      const sInfo = shipMap[btnId] || { label: btnTitle, price: 'R$ 15,00', days: '1 dia' };
      updatedVars.tipo_frete = sInfo.label;
      updatedVars.valor_frete = sInfo.price;
      updatedVars.prazo_entrega = sInfo.days;
      updatedVars.tipo_frete_id = btnId;
    }
    if (btnId === 'pix_paid' || btnId === 'pix_help') {
      updatedVars.status_pagamento = btnId === 'pix_paid' ? 'comprovante_enviado' : 'ajuda_solicitada';
    }
    if (btnId === 'consult_online' || btnId === 'consult_store') {
      updatedVars.tipo_consultoria = btnId === 'consult_online' ? 'Online (Vídeo / WhatsApp)' : 'Presencial na Loja Física';
      updatedVars.consultoria_id = btnId;
    }
    if (btnId === 'coupon_valid' || btnId === 'coupon_invalid') {
      updatedVars.cupom_aplicado = btnId === 'coupon_valid' ? 'BEMVINDO10' : '';
      updatedVars.desconto_valor = btnId === 'coupon_valid' ? '10%' : '0%';
    }
    if (btnId?.startsWith('prod_') || btnTitle.includes('Body') || btnTitle.includes('Macacão') || btnTitle.includes('Saída')) {
      const pName = btnTitle.split('(')[0].trim();
      updatedVars.produto_selecionado = pName;
      updatedVars.opcao_selecionada = pName;
      if (btnTitle.includes('49')) updatedVars.valor_produto = 'R$ 49,90';
      else if (btnTitle.includes('89')) updatedVars.valor_produto = 'R$ 89,90';
      else if (btnTitle.includes('199')) updatedVars.valor_produto = 'R$ 199,90';
      else updatedVars.valor_produto = 'R$ 79,90';
      updatedVars.valor_total = updatedVars.valor_produto;
    }
    if (btnId?.startsWith('srv_') || btnTitle.includes('R$')) {
      const srvName = btnTitle.split('(')[0].trim();
      const matched = agendaServices.find(s => s.name?.toLowerCase().trim() === srvName.toLowerCase().trim());
      const srvPrice = matched?.price ? `R$ ${Number(matched.price).toFixed(2).replace('.', ',')}` : '';
      const srvDur = matched?.duration_minutes || 30;

      updatedVars.servico_selecionado = srvName;
      updatedVars.opcao_selecionada = srvName;
      updatedVars.valor_servico = srvPrice;
      updatedVars.duracao_minutos = srvDur;
      updatedVars.duracao_servico = `${srvDur} min`;
    }
    if (btnId?.startsWith('slot_') || btnTitle.includes('🕒')) {
      const timeVal = btnTitle.replace('🕒', '').trim();
      updatedVars.horario_agendamento = timeVal;
      updatedVars.horario_escolhido = timeVal;
    }
    if (btnId?.startsWith('date_') || btnTitle.toLowerCase().includes('hoje') || btnTitle.toLowerCase().includes('amanh')) {
      const isTomorrow = btnId === 'date_tomorrow' || btnTitle.toLowerCase().includes('amanh');
      const dateObj = new Date();
      if (isTomorrow) dateObj.setDate(dateObj.getDate() + 1);
      const dateVal = dateObj.toLocaleDateString('pt-BR');
      updatedVars.data_agendamento = dateVal;
      updatedVars.data_formatada = dateVal;
    }

    setVariables(updatedVars);

    if (currentNodeId) {
      const idx = typeof btnIndex === 'number' ? btnIndex : -1;
      const matchingEdge =
        edges.find((e) => e.source === currentNodeId && (
          e.sourceHandle === btnId ||
          (idx >= 0 && (e.sourceHandle === `btn_${idx + 1}` || e.sourceHandle === `btn_${idx}`)) ||
          (idx >= 0 && (e.sourceHandle === `store-${String(idx + 1).padStart(3, '0')}` || e.sourceHandle === `store_${idx + 1}`)) ||
          (btnId === 'store-001' && (e.sourceHandle === 'store_matriz' || e.sourceHandle === 'matriz' || e.sourceHandle === 'store-001')) ||
          (btnId === 'store-002' && (e.sourceHandle === 'store_ipojuca' || e.sourceHandle === 'store_boulevard' || e.sourceHandle === 'ipojuca' || e.sourceHandle === 'store-002')) ||
          (btnId === 'store-003' && (e.sourceHandle === 'store_ecommerce' || e.sourceHandle === 'ecommerce' || e.sourceHandle === 'store-003'))
        )) ||
        (idx >= 0 ? edges.filter((e) => e.source === currentNodeId)[idx] : null) ||
        edges.find((e) => e.source === currentNodeId && e.sourceHandle === btnId) ||
        edges.find((e) => e.source === currentNodeId);

      if (matchingEdge) {
        const nextNode = nodes.find((n) => n.id === matchingEdge.target);
        if (nextNode) {
          runNextFromNode(matchingEdge.target, undefined, updatedVars, true);
          return;
        }
      }
      runNextFromNode(currentNodeId, undefined, updatedVars, false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        content: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    const activeNode = nodes.find(n => n.id === currentNodeId);
    const activeType = activeNode?.data?.nodeType || activeNode?.type;

    // Check if active node is expecting button / option selection
    const lastMsgWithButtons = [...messages].reverse().find(m => m.buttons && m.buttons.length > 0 && m.nodeId === currentNodeId);
    const availableButtons = lastMsgWithButtons?.buttons || activeNode?.data?.config?.buttons || [];

    if (
      (activeType === 'buttons' ||
        activeType === 'select_service' ||
        activeType === 'select_date' ||
        activeType === 'select_time_slot' ||
        activeType === 'store_selector' ||
        activeType === 'select_product' ||
        activeType === 'shipping_calculator' ||
        activeType === 'pix_payment' ||
        activeType === 'vip_consultation' ||
        activeType === 'promotional_coupon') &&
      availableButtons.length > 0
    ) {
      const normalize = (str: string) =>
        String(str || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

      const normInput = normalize(userText);
      const cleanDigits = normInput.replace(/\D/g, '');
      let matchedBtnIndex = -1;

      // 1. Exact numeric index match (e.g. '1', '2', '3')
      if (cleanDigits) {
        const num = parseInt(cleanDigits, 10);
        if (!isNaN(num) && num >= 1 && num <= availableButtons.length) {
          matchedBtnIndex = num - 1;
        }
      }

      // 2. ID match
      if (matchedBtnIndex === -1) {
        matchedBtnIndex = availableButtons.findIndex(
          (b) => b.id === userText || b.id === normInput || (b.id && normInput.includes(b.id))
        );
      }

      // 3. Exact, keyword, or substring title match
      if (matchedBtnIndex === -1) {
        for (let i = 0; i < availableButtons.length; i++) {
          const b = availableButtons[i];
          const normTitle = normalize(b.title || '');
          const cleanTitle = normalize(normTitle.replace(/^\d+[\.\-\)]\s*/, ''));

          if (normInput === normTitle || normInput === cleanTitle) {
            matchedBtnIndex = i;
            break;
          }
          if (cleanTitle.includes(normInput) && normInput.length >= 3) {
            matchedBtnIndex = i;
            break;
          }
          if (normInput.includes(cleanTitle) && cleanTitle.length >= 3) {
            matchedBtnIndex = i;
            break;
          }
          const inputWords = normInput.split(/\s+/).filter((w) => w.length >= 3);
          const titleWords = cleanTitle.split(/\s+/).filter((w) => w.length >= 3);
          const hasCommonWord = inputWords.some((w) => titleWords.some((tw) => tw.includes(w) || w.includes(tw)));
          if (hasCommonWord) {
            matchedBtnIndex = i;
            break;
          }
        }
      }

      if (matchedBtnIndex >= 0) {
        const matched = availableButtons[matchedBtnIndex];
        handleButtonClick(matched.title, matched.id, matchedBtnIndex, false);
        return;
      } else {
        // Unrecognized option - resend options reminder identical to WhatsApp bot
        const retryLines = availableButtons.map((b, i) => {
          const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i] || `*${i + 1}*`;
          const cleanTitle = (b.title || `Opção ${i + 1}`).replace(/^\d+[\.\-\)]\s*/, '').trim();
          return `${numEmoji} *${cleanTitle}*`;
        }).join('\n\n');

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'bot',
            content: `*Opção não reconhecida.*\n\nPor favor, escolha uma das opções abaixo:\n\n${retryLines}\n\n_👉 Digite o número ou o nome da opção desejada:_`,
            buttons: availableButtons,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            nodeId: currentNodeId || undefined,
          },
        ]);
        return;
      }
    }

    // Save variable if answering a question
    const updatedVars = { ...variables };
    if (activeNode && (activeNode.data?.nodeType || activeNode.type) === 'question') {
      const rawVarKey = activeNode.data?.config?.variableName || 'resposta_usuario';
      const cleanKey = rawVarKey.replace(/[{}]/g, '').trim();
      updatedVars[cleanKey] = userText;
      updatedVars[rawVarKey] = userText;
      if (cleanKey.includes('nome')) {
        updatedVars.nome_cliente = userText;
        updatedVars.cliente_nome = userText;
        updatedVars.nome = userText;
      }
      setVariables(updatedVars);
    }

    if (currentNodeId) {
      runNextFromNode(currentNodeId, undefined, updatedVars, false);
    } else {
      const trigger = nodes.find((n) => (n.data?.nodeType || n.type) === 'trigger') || nodes[0];
      if (trigger) runNextFromNode(trigger.id, undefined, updatedVars, false);
    }
  };

  const handleSelectExistingContact = (contact: Contact) => {
    setSimName(contact.name || 'Cliente Cadastrado');
    setSimPhone(contact.phone || '');
    setSimMode('existing');
  };

  return (
    <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 top-16 sm:top-20 w-auto sm:w-[440px] bg-dark-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden select-none animate-in slide-in-from-bottom-5 duration-200">
      {/* 1. SETUP / PRE-SIMULATION SCREEN */}
      {isConfiguring ? (
        <div className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar bg-dark-950/80">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Configurar Simulação
                  <Badge variant="brand" className="text-[9px] py-0 px-1.5">WhatsApp Real</Badge>
                </h3>
                <p className="text-[11px] text-slate-400">Informe os dados antes de iniciar o teste</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleStartSimulation} className="mt-4 space-y-4 flex-1 flex flex-col">
            {/* Field: Client Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-400" />
                Nome do Cliente
              </label>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="Ex: Carlos Silva ou Rogerio"
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>

            {/* Field: WhatsApp Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Número do WhatsApp
              </label>
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="Ex: (81) 99613-8924 ou 81999998888"
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>

            {/* Scenario Selection Cards */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Cenário de Atendimento:
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Option 1: Novo Contato */}
                <div
                  onClick={() => setSimMode('new')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    simMode === 'new'
                      ? 'bg-brand-500/10 border-brand-500/50 shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-dark-900/60 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-cyan-400" />
                      1. Novo Contato (1ª Mensagem)
                    </span>
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      simMode === 'new' ? 'border-brand-400 bg-brand-500' : 'border-slate-600'
                    }`}>
                      {simMode === 'new' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Testa a rota de cadastro (<strong className="text-slate-200">is_new</strong>). O robô verifica que o contato não existe na agenda, pergunta o nome do cliente e salva o perfil.
                  </p>
                </div>

                {/* Option 2: Cliente Cadastrado */}
                <div
                  onClick={() => setSimMode('existing')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    simMode === 'existing'
                      ? 'bg-brand-500/10 border-brand-500/50 shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-dark-900/60 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      2. Cliente Já Cadastrado na Agenda
                    </span>
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      simMode === 'existing' ? 'border-brand-400 bg-brand-500' : 'border-slate-600'
                    }`}>
                      {simMode === 'existing' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Testa a rota recorrente (<strong className="text-slate-200">is_existing</strong>). O robô identifica o cliente pelo WhatsApp e preenche <strong className="text-slate-200">&#123;&#123;nome_cliente&#125;&#125;</strong> de imediato.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Pick Registered Contact (Optional) */}
            {availableContacts.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Ou preencher com cliente salvo na base:
                </label>
                <select
                  onChange={(e) => {
                    const c = availableContacts.find(item => item.id === e.target.value);
                    if (c) handleSelectExistingContact(c);
                  }}
                  defaultValue=""
                  className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="" disabled>Selecionar cliente existente...</option>
                  {availableContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-white/5 flex items-center gap-2 mt-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="flex-1 text-xs border-white/10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="brand"
                size="sm"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 font-semibold"
              >
                ▶️ Iniciar Simulação
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* 2. ACTIVE CHAT SIMULATION SCREEN */
        <>
          {/* Simulator Header */}
          <div className="p-3.5 border-b border-white/5 flex items-center justify-between bg-dark-950/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white truncate">
                    {simName || 'Cliente'}
                  </h3>
                  <Badge 
                    variant={simMode === 'new' ? 'secondary' : 'brand'} 
                    className="text-[9px] py-0 px-1.5 uppercase font-medium"
                  >
                    {simMode === 'new' ? 'Novo Contato' : 'Cadastrado'}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>{simPhone}</span>
                  <span>•</span>
                  <span className="truncate">{flow.name}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setIsConfiguring(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Trocar Contato / Cenário"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleStartSimulation()}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Reiniciar Conversa"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fechar Simulador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-dark-950/40">
            {messages.map((m) => {
              if (m.sender === 'system') {
                return (
                  <div key={m.id} className="text-center my-1.5">
                    <span className="text-[10px] bg-dark-950 text-slate-400 px-3 py-1 rounded-full border border-white/5 inline-block">
                      {m.content}
                    </span>
                  </div>
                );
              }

              const isUser = m.sender === 'user';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                      isUser
                        ? 'bg-[#005c4b] text-white rounded-br-none border border-[#007a64]/40'
                        : 'bg-dark-850 text-slate-100 border border-white/5 rounded-bl-none'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>

                    {/* Interactive Buttons */}
                    {m.buttons && m.buttons.length > 0 && (
                      <div className="pt-2.5 space-y-1.5">
                        {m.buttons.map((btn, bIdx) => (
                          <button
                            key={btn.id}
                            onClick={() => handleButtonClick(btn.title, btn.id, bIdx)}
                            className="w-full py-2 px-3 rounded-xl bg-dark-950 hover:bg-dark-800 border border-brand-500/40 text-brand-300 hover:text-white text-xs font-semibold text-center transition-all flex items-center justify-between gap-1 shadow-sm active:scale-[0.98]"
                          >
                            <span className="truncate">{btn.title}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className={`flex items-center justify-end gap-1 mt-1.5 text-[9px] ${
                        isUser ? 'text-emerald-300/70' : 'text-slate-500'
                      }`}
                    >
                      <span>{m.timestamp}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-cyan-300" />}
                    </div>
                  </div>
                </div>
              );
            })}
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-brand-400 animate-pulse py-1">
                <span className="w-2 h-2 rounded-full bg-brand-400" />
                <span>Robô digitando resposta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-dark-950 border-t border-white/5 flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite para responder na simulação..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-dark-850 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button
              type="submit"
              variant="brand"
              size="sm"
              disabled={!inputText.trim()}
              className="px-3 py-2 h-auto bg-emerald-600 hover:bg-emerald-500"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
};
