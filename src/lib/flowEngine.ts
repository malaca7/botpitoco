import { Flow, FlowNode, FlowEdge, Contact, Conversation, Message, BotProfile } from '../types';
import { StorageService } from './storage';

export interface FlowExecutionContext {
  flowId: string;
  contact: Contact;
  conversation: Conversation;
  variables: Record<string, any>;
  currentNodeId: string | null;
  history: string[];
  waitingForInput?: {
    nodeId: string;
    variableName: string;
    expectedType?: string;
  };
}

export interface FlowExecutionResult {
  replies: Array<{
    type: 'text' | 'buttons' | 'media';
    content: string;
    buttons?: Array<{ id: string; title: string }>;
    mediaUrl?: string;
  }>;
  handoffToHuman?: boolean;
  ended?: boolean;
  nextContext: FlowExecutionContext;
}

// Intelligent executor for Variable assignments
export function executeVariableAssignment(
  assignment: any,
  variables: Record<string, any>,
  contact?: Contact,
  botProfile?: Partial<BotProfile>
) {
  const varName = assignment?.varName?.trim();
  if (!varName) return;

  const op = assignment.operation || 'set_value';

  switch (op) {
    case 'set_value': {
      const rawVal = assignment.value !== undefined ? assignment.value : (assignment.varValue ?? '');
      variables[varName] = substituteVariables(String(rawVal), variables, botProfile);
      break;
    }
    case 'set_number': {
      const num = Number(assignment.value);
      variables[varName] = isNaN(num) ? 0 : num;
      break;
    }
    case 'set_boolean': {
      variables[varName] = assignment.value === true || assignment.value === 'true';
      break;
    }
    case 'copy_var': {
      const src = assignment.sourceVar || assignment.value;
      variables[varName] = src ? (variables[src] ?? '') : '';
      break;
    }
    case 'contact_field': {
      const field = assignment.contactField || 'first_name';
      if (field === 'first_name') {
        const full = contact?.name || contact?.phone || 'Cliente';
        variables[varName] = full.trim().split(/\s+/)[0] || full;
      } else if (field === 'name') {
        variables[varName] = contact?.name || 'Cliente';
      } else if (field === 'phone') {
        variables[varName] = contact?.phone || '';
      } else if (field === 'email') {
        variables[varName] = contact?.email || '';
      } else if (field === 'tags') {
        variables[varName] = Array.isArray(contact?.tags) ? contact.tags.join(', ') : (contact?.tags || '');
      } else if (field === 'id') {
        variables[varName] = contact?.id || '';
      }
      break;
    }
    case 'math_increment': {
      const step = Number(assignment.mathAmount ?? 1);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = cur + (isNaN(step) ? 1 : step);
      break;
    }
    case 'math_decrement': {
      const step = Number(assignment.mathAmount ?? 1);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = cur - (isNaN(step) ? 1 : step);
      break;
    }
    case 'math_add': {
      const amt = Number(assignment.mathAmount ?? assignment.value ?? 0);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = cur + (isNaN(amt) ? 0 : amt);
      break;
    }
    case 'math_subtract': {
      const amt = Number(assignment.mathAmount ?? assignment.value ?? 0);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = cur - (isNaN(amt) ? 0 : amt);
      break;
    }
    case 'math_multiply': {
      const factor = Number(assignment.mathAmount ?? assignment.value ?? 1);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = cur * (isNaN(factor) ? 1 : factor);
      break;
    }
    case 'math_divide': {
      const div = Number(assignment.mathAmount ?? assignment.value ?? 1);
      const cur = Number(variables[varName]) || 0;
      variables[varName] = div === 0 ? 0 : (cur / div);
      break;
    }
    case 'text_first_name': {
      const srcKey = assignment.sourceVar || varName;
      const fullText = String(variables[srcKey] !== undefined ? variables[srcKey] : (contact?.name || ''));
      variables[varName] = fullText.trim().split(/\s+/)[0] || fullText;
      break;
    }
    case 'text_uppercase': {
      const srcKey = assignment.sourceVar || varName;
      const text = String(variables[srcKey] !== undefined ? variables[srcKey] : (assignment.value ?? ''));
      variables[varName] = text.toUpperCase();
      break;
    }
    case 'text_lowercase': {
      const srcKey = assignment.sourceVar || varName;
      const text = String(variables[srcKey] !== undefined ? variables[srcKey] : (assignment.value ?? ''));
      variables[varName] = text.toLowerCase();
      break;
    }
    case 'text_capitalize': {
      const srcKey = assignment.sourceVar || varName;
      const text = String(variables[srcKey] !== undefined ? variables[srcKey] : (assignment.value ?? ''));
      variables[varName] = text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';
      break;
    }
    case 'text_numbers_only': {
      const srcKey = assignment.sourceVar || varName;
      const text = String(variables[srcKey] !== undefined ? variables[srcKey] : (assignment.value ?? ''));
      variables[varName] = text.replace(/\D/g, '');
      break;
    }
    case 'text_trim': {
      const srcKey = assignment.sourceVar || varName;
      const text = String(variables[srcKey] !== undefined ? variables[srcKey] : (assignment.value ?? ''));
      variables[varName] = text.trim();
      break;
    }
    case 'date_today_br': {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      variables[varName] = `${dd}/${mm}/${yyyy}`;
      break;
    }
    case 'date_today_iso': {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      variables[varName] = `${yyyy}-${mm}-${dd}`;
      break;
    }
    case 'date_tomorrow_br': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const yyyy = tomorrow.getFullYear();
      variables[varName] = `${dd}/${mm}/${yyyy}`;
      break;
    }
    case 'time_now': {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      variables[varName] = `${hh}:${min}`;
      break;
    }
    case 'datetime_now': {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      variables[varName] = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
      break;
    }
    case 'timestamp_now': {
      variables[varName] = Date.now();
      break;
    }
    case 'clear_var': {
      delete variables[varName];
      break;
    }
    default: {
      const rawVal = assignment.value !== undefined ? assignment.value : (assignment.varValue ?? '');
      variables[varName] = rawVal;
      break;
    }
  }
}

// Replace global {{variables}} in text strings
export function substituteVariables(
  text: string,
  variables: Record<string, any>,
  botProfile?: Partial<BotProfile>
): string {
  if (!text) return '';

  let result = text;

  // Bot variables
  if (botProfile) {
    result = result.replace(/\{\{bot_nome\}\}/gi, botProfile.name || '7 Assistente');
    result = result.replace(/\{\{empresa\}\}/gi, botProfile.company_name || 'Minha Empresa');
    result = result.replace(/\{\{bot_genero\}\}/gi, botProfile.gender === 'female' ? 'Feminino' : 'Masculino');
    result = result.replace(/\{\{bot_tom\}\}/gi, botProfile.tone || 'Amigável');
    result = result.replace(/\{\{suporte_email\}\}/gi, botProfile.support_email || 'suporte@empresa.com');
    result = result.replace(/\{\{suporte_telefone\}\}/gi, botProfile.support_phone || '+55 (81) 99613-8924');
    result = result.replace(/\{\{horario_atendimento\}\}/gi, botProfile.business_hours || '08h às 18h');
    result = result.replace(/\{\{site_empresa\}\}/gi, botProfile.website_url || 'https://7assistente.com.br');
    result = result.replace(/\{\{mensagem_boas_vindas\}\}/gi, botProfile.welcome_message || '');
  }

  // Dynamic context variables
  Object.keys(variables).forEach((key) => {
    const val = variables[key];
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, String(val ?? ''));
  });

  return result;
}

// Intelligent AI fallback response generator (when AI Agent node is executed)
export async function executeAiNode(
  systemPrompt: string,
  userMessage: string,
  persona: string,
  variables: Record<string, any>
): Promise<string> {
  const cleanMessage = userMessage.toLowerCase().trim();

  if (cleanMessage.includes('preço') || cleanMessage.includes('valor') || cleanMessage.includes('plano')) {
    return `Nossos planos do 7 Assistente começam a partir de R$ 97/mês com fluxos ilimitados, WhatsApp conectado e suporte completo! Posso te enviar o link para contratação?`;
  }

  if (cleanMessage.includes('atendente') || cleanMessage.includes('humano') || cleanMessage.includes('falar com')) {
    return `Com certeza! Já estou transferindo seu atendimento para nossa equipe humana. Um instante por favor.`;
  }

  if (cleanMessage.includes('horário') || cleanMessage.includes('funciona')) {
    return `Nosso atendimento humano funciona de segunda a sexta, das 08h às 18h. Já nossos robôs inteligentes e fluxos atendem 24 horas por dia, 7 dias por semana!`;
  }

  // General helpful response with persona context
  return `Olá! Sou o assistente virtual da ${variables.empresa || 'nossa empresa'}. Entendi sua dúvida sobre "${userMessage}". Como posso te ajudar a avançar hoje? Escolha uma das opções ou me diga o que procura!`;
}

// Flow Engine
export const FlowEngine = {
  // Execute a flow from a given input
  async processIncomingMessage(
    incomingText: string,
    contact: Contact,
    conversation: Conversation
  ): Promise<FlowExecutionResult> {
    const flows = await StorageService.getFlows();
    const publishedFlow = flows.find((f) => f.status === 'published') || flows[0];

    const botProfile = await StorageService.getBotProfile();
    const globalVars = await StorageService.getBotVariables();

    const variables: Record<string, any> = {
      ...globalVars,
      nome_cliente: contact.name || 'Cliente',
      telefone_cliente: contact.phone,
      mensagem_recebida: incomingText,
    };

    if (!publishedFlow) {
      return {
        replies: [
          {
            type: 'text',
            content: `Olá! Sou ${botProfile.name || '7 Assistente'}. Recebi sua mensagem: "${incomingText}". Como posso te ajudar hoje?`,
          },
        ],
        nextContext: {
          flowId: 'none',
          contact,
          conversation,
          variables,
          currentNodeId: null,
          history: [],
        },
      };
    }

    const nodes = await StorageService.getFlowNodes(publishedFlow.id);
    const edges = await StorageService.getFlowEdges(publishedFlow.id);

    // Find starting trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger') || nodes[0];
    if (!triggerNode) {
      return {
        replies: [{ type: 'text', content: 'Fluxo sem nó de gatilho configurado.' }],
        nextContext: { flowId: publishedFlow.id, contact, conversation, variables, currentNodeId: null, history: [] },
      };
    }

    const replies: FlowExecutionResult['replies'] = [];
    let handoffToHuman = false;
    let currentNode: FlowNode | undefined = triggerNode;
    const history: string[] = [triggerNode.id];
    let maxSteps = 10; // Prevent infinite loops

    while (currentNode && maxSteps > 0) {
      maxSteps--;
      const nodeType = currentNode.data.nodeType || currentNode.type;
      const config = currentNode.data.config || {};

      // 1. Message Node
      if (nodeType === 'message') {
        const text = substituteVariables(config.text || 'Olá!', variables, botProfile);
        replies.push({ type: 'text', content: text });
      }

      // 2. Buttons Node
      else if (nodeType === 'buttons') {
        const body = substituteVariables(config.bodyText || 'Escolha uma opção:', variables, botProfile);
        replies.push({
          type: 'buttons',
          content: body,
          buttons: config.buttons || [
            { id: 'btn_1', title: 'Opção 1' },
            { id: 'btn_2', title: 'Falar com Atendente' },
          ],
        });
      }

      // 3. Question Node
      else if (nodeType === 'question') {
        const qText = substituteVariables(config.questionText || 'Por favor, informe seu dado:', variables, botProfile);
        replies.push({ type: 'text', content: qText });
      }

      // 4. Media Node
      else if (nodeType === 'media') {
        replies.push({
          type: 'media',
          content: config.caption || 'Mídia enviada',
          mediaUrl: config.mediaUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
        });
      }

      // 5. AI Agent Node
      else if (nodeType === 'ai_agent') {
        const aiResponse = await executeAiNode(
          config.systemPrompt || 'Você é um assistente especialista.',
          incomingText,
          config.persona || 'Assistente',
          variables
        );
        replies.push({ type: 'text', content: aiResponse });
      }

      // 6. Human Handoff Node
      else if (nodeType === 'human_handoff') {
        handoffToHuman = true;
        replies.push({
          type: 'text',
          content: config.notifyMessage || 'Transferindo você para um atendente humano...',
        });
      }

      // 6.5 Show Services Node (Apenas Leitura / Catálogo de Serviços)
      else if (nodeType === 'show_services' || (nodeType === 'services_catalog' && config.displayFormat !== 'buttons')) {
        let services = [
          { id: 'srv-1', name: 'Body Suedine 100% Algodão', duration_minutes: 30, price: 49.9 },
          { id: 'srv-2', name: 'Macacão Zíper Duplo Confort', duration_minutes: 30, price: 89.9 },
          { id: 'srv-3', name: 'Saída Maternidade Tricot Luxo', duration_minutes: 30, price: 199.9 },
          { id: 'srv-4', name: 'Kit de Berço 9 Peças 200 Fios', duration_minutes: 30, price: 389.0 },
          { id: 'srv-5', name: 'Consultoria VIP de Enxoval', duration_minutes: 45, price: 0.0 },
        ];
        try {
          const agenda = await StorageService.getAgendaSettings();
          if (agenda?.services && Array.isArray(agenda.services)) {
            const active = agenda.services.filter((s: any) => s.active !== false && s.is_active !== false);
            if (active.length > 0) services = active;
          }
        } catch {}

        const header = substituteVariables(config.headerText || '🍼 *Catálogo Pitoco de Gente - Bebê & Enxovais*', variables, botProfile);
        const footer = config.footerText ? `\n\n_${substituteVariables(config.footerText, variables, botProfile)}_` : '';

        const serviceLines = services
          .map((s: any, idx: number) => {
            const priceStr = Number(s.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const descStr = s.description ? `\n   _${s.description}_` : '';
            return `*${idx + 1}️⃣* *${s.name}*\n   💰 ${priceStr} • ⏱️ ${s.duration_minutes || 30} min${descStr}`;
          })
          .join('\n\n');

        const fullCatalogText = `${header}\n\n${serviceLines}${footer}`;
        variables.catalogo_servicos_texto = fullCatalogText;
        variables.catalogo_servicos = fullCatalogText;
        replies.push({ type: 'text', content: fullCatalogText });
      }

      // 6.6 Select Service Node (Escolha de Serviço via Botões)
      else if (nodeType === 'select_service' || (nodeType === 'services_catalog' && config.displayFormat === 'buttons')) {
        let services = [
          { id: 'srv-1', name: 'Body Suedine 100% Algodão', duration_minutes: 30, price: 49.9 },
          { id: 'srv-2', name: 'Macacão Zíper Duplo Confort', duration_minutes: 30, price: 89.9 },
        ];
        try {
          const agenda = await StorageService.getAgendaSettings();
          if (agenda?.services && Array.isArray(agenda.services)) {
            const active = agenda.services.filter((s: any) => s.active !== false && s.is_active !== false);
            if (active.length > 0) services = active;
          }
        } catch {}

        const intro = substituteVariables(config.introMessage || 'Qual peça ou atendimento você deseja escolher hoje?', variables, botProfile);
        replies.push({
          type: 'buttons',
          content: `✂️ *Escolha o Serviço:*\n${intro}`,
          buttons: services.slice(0, 3).map((s: any, idx: number) => ({
            id: `srv_${s.id || idx + 1}`,
            title: `${s.name} (R$ ${Number(s.price || 0).toFixed(0)})`,
          })),
        });
      }

      // 6.7 Select Date / Ask Date Node
      else if (nodeType === 'select_date' || nodeType === 'ask_date') {
        const qText = substituteVariables(config.questionText || 'Para qual dia você gostaria de agendar seu atendimento?', variables, botProfile);
        const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const tomDate = new Date();
        tomDate.setDate(tomDate.getDate() + 1);
        const tomStr = tomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        replies.push({
          type: 'buttons',
          content: `📅 *Escolha a Data:*\n${qText}`,
          buttons: [
            { id: 'date_today', title: `Hoje (${todayStr})` },
            { id: 'date_tomorrow', title: `Amanhã (${tomStr})` },
            { id: 'date_custom', title: 'Outra Data' },
          ],
        });
      }

      // 7. Schedule Contact Node
      else if (nodeType === 'schedule_contact' || nodeType === 'select_time_slot') {
        const srvName = variables.servico_selecionado || config.serviceName || 'Atendimento Geral';
        const dateVal = variables.data_agendamento || variables[config.dateVariable] || 'Hoje';
        const timeVal = variables.horario_agendamento || variables[config.timeVariable] || 'Horário Comercial';
        const defaultConfirm = `📅 Agendamento Confirmado!\n• Serviço: ${srvName}\n• Data: ${dateVal}\n• Horário: ${timeVal}\n\nVinculado com sucesso ao WhatsApp!`;
        const confirmText = substituteVariables(config.confirmMessage || defaultConfirm, variables, botProfile);
        replies.push({ type: 'text', content: confirmText });
      }

      // 7.5 Confirm Booking Node
      else if (nodeType === 'confirm_booking') {
        const clientName = variables.nome_cliente || 'Cliente';
        const srvName = variables.servico_selecionado || 'Atendimento';
        const dateVal = variables.data_agendamento || new Date().toLocaleDateString('pt-BR');
        const timeVal = variables.horario_agendamento || '10:00';
        const defaultConfirm = `✅ *Agendamento Confirmado com Sucesso!*\n\n• *Cliente:* ${clientName}\n• *Serviço:* ${srvName}\n• *Data:* ${dateVal}\n• *Horário:* ${timeVal}\n\nSeu horário foi reservado em nossa Agenda com sucesso!`;
        const confirmText = substituteVariables(config.confirmMessage || defaultConfirm, variables, botProfile);
        replies.push({ type: 'text', content: confirmText });
      }

      // 7.8 Store Selector Node (Escolha de Filial / Loja)
      else if (nodeType === 'store_selector') {
        let storesList = [
          { id: 'store-001', name: 'Loja Matriz — Centro', city: 'Cabo - PE', slug: 'matriz' },
          { id: 'store-002', name: 'Loja Ipojuca - Filial', city: 'Ipojuca - PE', slug: 'ipojuca' },
          { id: 'store-003', name: 'Loja Virtual & E-commerce', city: 'Online', slug: 'ecommerce' },
        ];
        try {
          const loadedStores = await StorageService.getStores();
          if (Array.isArray(loadedStores) && loadedStores.length > 0) {
            const active = loadedStores.filter((s: any) => s.is_active !== false);
            if (active.length > 0) storesList = active;
          }
        } catch {}

        const intro = substituteVariables(
          config.introMessage || '🏬 *PITOCO DE GENTE — Escolha sua Loja de Preferência:*\n\nQual de nossas lojas você deseja falar hoje?',
          variables,
          botProfile
        );
        const storesText = storesList.map((st: any) => `• *${st.name}*${st.city ? ` (${st.city})` : ''}`).join('\n');
        const buttons = storesList.slice(0, 3).map((st: any, i: number) => ({
          id: st.id || `store-${i + 1}`,
          title: st.name.replace(/^Loja\s*/i, '').slice(0, 20),
        }));

        replies.push({
          type: 'buttons',
          content: `🏬 *Escolha de Filial / Loja:*\n\n${intro}\n\n${storesText}`,
          buttons,
        });
      }

      // 8. Update Contact Profile Node
      else if (nodeType === 'update_contact' || nodeType === 'client_upsert') {
        let nameVal = config.contactName || config.nameField;
        if (nameVal) {
          nameVal = substituteVariables(nameVal, variables, botProfile);
          if (nameVal === (config.contactName || config.nameField) && !nameVal.includes('{{')) {
            nameVal = variables[nameVal] || nameVal;
          }
        }
        if (!nameVal || nameVal === '{{nome_cliente}}' || nameVal === 'nome_cliente') {
          nameVal = variables.nome_cliente || variables.resposta_usuario || variables.nome || contact?.name || 'Cliente';
        }
        variables.nome_cliente = nameVal;
        variables.cliente_nome = nameVal;
        variables.nome = nameVal;
        variables.primeiro_nome = nameVal.split(' ')[0] || nameVal;
        variables.is_primeiro_contato = false;
        variables.is_novo_contato = false;
        variables.is_existing_contact = true;
        variables.cliente_salvo = true;

        if (contact) {
          contact.name = nameVal;
          if (config.tags) {
            const rawTags = config.tags;
            const newTags = typeof rawTags === 'string' ? rawTags.split(',').map((t: string) => t.trim()) : rawTags;
            contact.tags = Array.from(new Set([...(contact.tags || []), ...(newTags || [])]));
          }
        }

        if (config.customFieldKey) {
          const cKey = config.customFieldKey.replace(/[{}]/g, '').trim();
          variables[cKey] = substituteVariables(config.customFieldValue || '', variables, botProfile);
        }
      }

      // 8.5 Check Contact Node (Primeiro Contato vs Contato Salvo)
      else if (nodeType === 'check_contact') {
        const isNew = Boolean(
          variables.is_primeiro_contato !== undefined
            ? variables.is_primeiro_contato
            : (!contact?.name || contact.name === 'Cliente' || contact.name === 'Cliente WhatsApp')
        );

        variables.is_primeiro_contato = isNew;
        variables.is_novo_contato = isNew;
        variables.is_existing_contact = !isNew;
        variables.tipo_cliente = isNew ? 'novo' : 'recorrente';
        if (!isNew && contact?.name) {
          variables.nome_cliente = contact.name;
          variables.primeiro_nome = contact.name.split(' ')[0] || contact.name;
        }

        const targetHandle = isNew ? 'is_new' : 'is_existing';
        let branchEdge = edges.find((e) => e.source === currentNode?.id && e.sourceHandle === targetHandle);
        if (!branchEdge) {
          branchEdge = edges.find((e) => e.source === currentNode?.id && (isNew ? e.sourceHandle?.includes('new') : e.sourceHandle?.includes('exist')));
        }
        if (!branchEdge) {
          branchEdge = edges.find((e) => e.source === currentNode?.id);
        }
        if (branchEdge) {
          const nextNode = nodes.find((n) => n.id === branchEdge.target);
          if (nextNode) {
            history.push(nextNode.id);
            currentNode = nextNode;
            continue;
          }
        }
        break;
      }

      // 9. Variable Setter Node
      else if (nodeType === 'variable') {
        const assignments = Array.isArray(config.assignments) && config.assignments.length > 0
          ? config.assignments
          : config.varName
            ? [{
                varName: config.varName,
                operation: config.operation || 'set_value',
                value: config.varValue,
                contactField: config.contactField,
                sourceVar: config.sourceVar,
                mathAmount: config.mathAmount,
              }]
            : [];

        for (const item of assignments) {
          executeVariableAssignment(item, variables, contact, botProfile);
        }
      }

      // Find next connected node
      const outgoingEdge = edges.find((e) => e.source === currentNode?.id);
      if (outgoingEdge) {
        const nextNode = nodes.find((n) => n.id === outgoingEdge.target);
        if (nextNode) {
          history.push(nextNode.id);
          currentNode = nextNode;
          continue;
        }
      }

      // If no outgoing edge, stop
      break;
    }

    return {
      replies: replies.length > 0 ? replies : [{ type: 'text', content: 'Mensagem processada pelo fluxo.' }],
      handoffToHuman,
      ended: true,
      nextContext: {
        flowId: publishedFlow.id,
        contact,
        conversation,
        variables,
        currentNodeId: currentNode?.id || null,
        history,
      },
    };
  },
};
