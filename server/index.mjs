import './websocketPolyfill.mjs';
import WebSocket from 'ws';

if (typeof globalThis !== 'undefined') {
  globalThis.WebSocket = WebSocket;
}
if (typeof global !== 'undefined') {
  global.WebSocket = WebSocket;
}

import express from 'express';
import cors from 'cors';
import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { 
  executePublishedFlow, 
  loadDb, 
  saveDb, 
  getActiveFlowAndGraph,
  exportDatabase,
  importDatabase,
  getDatabaseStats,
  syncFlowToSupabase,
  deleteFlowFromSupabase,
  syncFlowGraphToSupabase,
  cleanButtonTitle,
  resolveLinkedPhones,
  syncContactToSupabase,
  recordRealMessage
} from './flowRunner.mjs';
import { processAdminBotMessage } from './botEngine.mjs';
import { syncToSupabase } from './syncSupabase.mjs';
import {
  getMetaConfig,
  updateMetaConfig,
  testMetaConnection,
  verifyMetaWebhook,
  sendMetaMessage,
  markMetaMessageAsRead,
  parseMetaWebhook,
  formatPhoneForMeta
} from './metaWhatsAppService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AUTH_FOLDER = path.resolve(__dirname, 'whatsapp_auth');

if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

// Environment variables
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cbeiguyvoepbcafmxduy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWlndXl2b2VwYmNhZm14ZHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODczNTk3NywiZXhwIjoyMTA0MzExOTc3fQ.sbB-6Fx4uR61oDin8djrdbpmNSPs2Z8hGdYSoVhIHvw';

const supabaseServer = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

const safeSupa = async (builder) => {
  try {
    return await builder;
  } catch (err) {
    return { data: null, error: err };
  }
};

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lojas oficiais Pitoco de Gente
const STORES = [
  {
    id: 'store-001',
    name: 'Loja Matriz — Centro',
    slug: 'matriz',
    address: 'Rua do Sol, 120 - Centro, Recife - PE',
    phone: '8132211000',
    whatsapp_number: '81996138924',
    is_active: true,
    business_hours: '08:30 às 18:30',
  },
  {
    id: 'store-002',
    name: 'Loja Ipojuca - Filial',
    slug: 'ipojuca',
    address: 'Rodovia PE-060, Centro, Ipojuca - PE',
    phone: '8135511000',
    whatsapp_number: '81996138924',
    is_active: true,
    business_hours: '08:30 às 18:00',
  },
  {
    id: 'store-003',
    name: 'Atendimento Geral / E-commerce',
    slug: 'ecommerce',
    address: 'Central Digital / E-commerce Brasil',
    phone: '81996138924',
    whatsapp_number: '81996138924',
    is_active: true,
    business_hours: '24h Online',
  },
];

const clientSessions = new Map();

let sock = null;
let currentQR = null;
let currentQRDataUrl = null;
let connectionStatus = 'disconnected';
let connectedPhone = null;
let connectedName = null;
let connectedAt = null;
let isStartingWhatsApp = false;

async function restartWhatsApp(clearAuth = false) {
  try {
    console.log(`🔄 [Server] Reiniciando conexão WhatsApp Baileys (limpar credenciais: ${clearAuth})...`);
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('messages.upsert');
        sock.end();
      } catch (e) {}
      sock = null;
    }

    if (clearAuth && fs.existsSync(AUTH_FOLDER)) {
      try {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        console.log('🧹 [Server] Pasta whatsapp_auth limpa com sucesso.');
      } catch (e) {
        console.warn('⚠️ [Server] Aviso ao limpar whatsapp_auth:', e.message);
      }
    }

    connectionStatus = 'connecting';
    currentQR = null;
    currentQRDataUrl = null;
    isStartingWhatsApp = false;
    await startWhatsApp();
    return true;
  } catch (err) {
    console.error('❌ [Server] Erro ao reiniciar Baileys:', err);
    isStartingWhatsApp = false;
    return false;
  }
}

async function startWhatsApp() {
  if (isStartingWhatsApp) return;
  isStartingWhatsApp = true;
  try {
    connectionStatus = 'connecting';
    console.log('🔄 [Server] Inicializando WhatsApp Baileys...');
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: false }));

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['Pitoco de Gente', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        connectionStatus = 'qrcode';
        try {
          currentQRDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
        } catch (e) {}
        console.log('📱 [Server] Novo QR Code gerado para leitura no WhatsApp Business.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`⚠️ [Server] Conexão WhatsApp fechada (código: ${statusCode}, loggedOut: ${isLoggedOut})`);
        connectionStatus = 'disconnected';
        currentQR = null;
        currentQRDataUrl = null;

        if (isLoggedOut) {
          console.log('🧹 [Server] Dispositivo deslogado. Limpando credenciais antigas do Baileys para novo QR Code...');
          setTimeout(() => restartWhatsApp(true), 2000);
        } else {
          setTimeout(() => restartWhatsApp(false), 5000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        currentQRDataUrl = null;
        connectedAt = new Date().toISOString();
        const rawId = sock.user?.id || '';
        connectedPhone = rawId.split(':')[0] || rawId.split('@')[0] || '';
        connectedName = sock.user?.name || 'Pitoco de Gente';
        console.log(`✅ [Server] WhatsApp Baileys Conectado com Sucesso: ${connectedPhone} (${connectedName})`);
      }
    });

    // 0. Mapeamento bidirecional dinâmico de WhatsApp LIDs <-> Telefones Reais
    const registerLidMapping = (lid, phone) => {
      if (!lid || !phone) return;
      const cleanLid = String(lid).replace(/@lid$/, '').replace(/\D/g, '');
      const cleanPhone = String(phone).replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
      if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

      if (cleanPhone.length >= 10 && cleanPhone.length <= 13 && cleanLid.length >= 14) {
        try {
          const db = loadDb();
          if (!db.lid_mappings) db.lid_mappings = {};
          if (db.lid_mappings[cleanLid] !== cleanPhone || db.lid_mappings[cleanPhone] !== cleanLid) {
            db.lid_mappings[cleanLid] = cleanPhone;
            db.lid_mappings[cleanPhone] = cleanLid;
            saveDb(db);
            console.log(`[LID Mapping] 🔗 Par mapeado: LID ${cleanLid} <-> Telefone ${cleanPhone}`);
          }
        } catch (e) {}
      }
    };

    sock.ev.on('contacts.upsert', (contacts) => {
      try {
        for (const c of (contacts || [])) {
          if (!c) continue;
          if (c.lid && c.id && c.id.includes('@s.whatsapp.net')) {
            registerLidMapping(c.lid, c.id);
          } else if (c.phoneNumber && c.id && c.id.includes('@lid')) {
            registerLidMapping(c.id, c.phoneNumber);
          }
        }
      } catch (e) {}
    });

    sock.ev.on('contacts.update', (updates) => {
      try {
        for (const c of (updates || [])) {
          if (!c) continue;
          if (c.lid && c.id && c.id.includes('@s.whatsapp.net')) {
            registerLidMapping(c.lid, c.id);
          } else if (c.phoneNumber && c.id && c.id.includes('@lid')) {
            registerLidMapping(c.id, c.phoneNumber);
          }
        }
      } catch (e) {}
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Aceita mensagens recebidas tanto como 'notify' quanto como 'append'
      for (const msg of (messages || [])) {
        if (!msg.message) continue;
        const remoteJid = msg.key.remoteJid || '';
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast' || remoteJid.includes('broadcast') || remoteJid.includes('@newsletter')) continue;

        // 🛑 REGRA FUNDAMENTAL: NUNCA processar mensagens enviadas pelo próprio robô ou atendente (fromMe: true)
        // Isso previne 100% de loops, respostas a si mesmo, criação de chats fantasmas e duplicações de contatos.
        if (msg.key.fromMe) continue;

        // Desempacotar mensagens com wrappers do WhatsApp (ephemeral, viewOnce, etc.)
        let m = msg.message;
        while (m?.ephemeralMessage?.message || m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.documentWithCaptionMessage?.message) {
          m = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
        }

        let text = m.conversation || 
                   m.extendedTextMessage?.text || 
                   m.imageMessage?.caption ||
                   m.videoMessage?.caption ||
                   m.documentMessage?.caption ||
                   m.buttonsResponseMessage?.selectedButtonId ||
                   m.buttonsResponseMessage?.selectedDisplayText ||
                   m.templateButtonReplyMessage?.selectedId ||
                   m.templateButtonReplyMessage?.selectedDisplayText ||
                   m.listResponseMessage?.singleSelectReply?.selectedRowId ||
                   m.listResponseMessage?.title ||
                   '';

        if (!text && m.interactiveResponseMessage) {
          try {
            const nativeFlow = m.interactiveResponseMessage.nativeFlowResponseMessage;
            if (nativeFlow?.paramsJson) {
              const parsed = JSON.parse(nativeFlow.paramsJson);
              text = parsed.id || parsed.selected_id || parsed.value || '';
            }
          } catch {}
        }

        // Reconhecer mídias sem legenda para acionar fluxo
        if (!text) {
          if (m.audioMessage) text = '[Áudio]';
          else if (m.imageMessage) text = '[Imagem]';
          else if (m.videoMessage) text = '[Vídeo]';
          else if (m.stickerMessage) text = '[Figurinha]';
          else if (m.documentMessage) text = '[Documento]';
          else if (m.locationMessage) text = '[Localização]';
          else if (m.contactMessage || m.contactsArrayMessage) text = '[Contato]';
        }

        const rawPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/@lid$/, '').replace(/\D/g, '');
        const participantPhone = (msg.key.participant || msg.participant || '').replace('@s.whatsapp.net', '').replace(/@lid$/, '').replace(/\D/g, '');
        
        if (remoteJid.includes('@lid') && participantPhone && participantPhone.length >= 10 && participantPhone.length <= 13) {
          registerLidMapping(rawPhone, participantPhone);
        }

        const dbCheck = loadDb();
        const { primaryPhone, allPhones } = resolveLinkedPhones(rawPhone, dbCheck);

        // Identificar telefone real do cliente (prioriza formato celular 10-13 dígitos sobre LID)
        let clientPhone = (primaryPhone && primaryPhone.length >= 10 && primaryPhone.length <= 13)
          ? primaryPhone
          : (participantPhone && participantPhone.length >= 10 && participantPhone.length <= 13)
            ? participantPhone
            : rawPhone;

        const isLid = clientPhone.length >= 14 || clientPhone.startsWith('1686') || clientPhone.startsWith('219');
        if (isLid) {
          for (const p of allPhones) {
            if (p.length >= 10 && p.length <= 13) {
              clientPhone = p;
              break;
            }
          }
        }

        // JID de destino para envio: SEMPRE responder no chat de onde a mensagem veio (ex: @lid ou @s.whatsapp.net)
        const destinationJid = remoteJid;

        // Identificar se o cliente já tem um nome cadastrado pelo fluxo/CRM
        let registeredName = null;
        for (const p of [clientPhone, rawPhone, ...allPhones]) {
          const contact = (typeof dbCheck.contacts === 'object' && !Array.isArray(dbCheck.contacts)) 
            ? dbCheck.contacts[p] 
            : (Array.isArray(dbCheck.contacts) ? dbCheck.contacts.find(c => String(c?.phone || '').replace(/\D/g, '') === p) : null);
          if (contact?.name && !['Cliente WhatsApp', 'Cliente', 'Cliente Pitoco', 'Pitoco Bot', 'Pitoco', 'Bot', 'Assistente', 'Robô', 'Robo', 'Pitoco Atendente', 'undefined', 'null'].includes(contact.name.trim())) {
            registeredName = contact.name.trim();
            break;
          }
          const convKey = `conv-${p}`;
          if (dbCheck.conversations?.[convKey]?.contact_name && !['Cliente WhatsApp', 'Cliente', 'Cliente Pitoco', 'Pitoco Bot', 'Pitoco', 'Bot', 'Assistente', 'Robô', 'Robo', 'Pitoco Atendente', 'undefined', 'null'].includes(dbCheck.conversations[convKey].contact_name.trim())) {
            registeredName = dbCheck.conversations[convKey].contact_name.trim();
            break;
          }
        }

        let clientName = registeredName || msg.pushName || 'Cliente';
        if (['Pitoco Bot', 'Pitoco', 'Bot', 'Assistente', 'Robô', 'Robo', 'Pitoco Atendente', 'Atendente', 'undefined', 'null'].includes(clientName.trim())) {
          clientName = registeredName || 'Cliente';
        }

        console.log(`📩 [WhatsApp Recebido] ${clientPhone} (${clientName}) [${remoteJid}]: "${text}"`);

        // 🛡️ BLINDAGEM DE ATENDIMENTO HUMANO & COMANDOS DE RETORNO AO ROBÔ
        const cleanInputLower = (text || '').toLowerCase().trim();
        const cleanTextOnly = cleanInputLower.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
        const isBotResetCmd = [
          '#bot', '#robo', '#robô', '#sair', '#reiniciar', '#reset', '#menu', '#inicio',
          '/bot', '/sair', '/menu', 'reiniciar', 'menu', 'inicio', 'início', 'começar', 'comecar',
          'voltar', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start', 'bot'
        ].some(cmd => cleanInputLower === cmd || cleanTextOnly === cmd || cleanTextOnly.startsWith(`${cmd} `));

        const convCheck = dbCheck.conversations?.[`conv-${clientPhone}`] || 
                          dbCheck.conversations?.[`conv-${rawPhone}`] ||
                          Object.values(dbCheck.conversations || {}).find(c => {
                            const cp = String(c?.phone || c?.contact_phone || '').replace(/\D/g, '');
                            return cp === clientPhone || cp === rawPhone;
                          });

        if (convCheck) {
          if (convCheck.status === 'closed') {
            convCheck.status = 'bot';
            saveDb(dbCheck);
          }

          if (convCheck.status === 'human' || convCheck.status === 'waiting_human') {
            const isWaitingHuman = convCheck.status === 'waiting_human';
            const isUnassigned = !convCheck.assigned_to || convCheck.assigned_to === 'undefined' || convCheck.assigned_to === null;
            const lastAttendantTime = new Date(convCheck.last_attendant_message_at || convCheck.updated_at || 0).getTime();
            const isHumanExpired = (Date.now() - lastAttendantTime) > (15 * 60 * 1000);

            if (isWaitingHuman || isBotResetCmd || isUnassigned || isHumanExpired) {
              console.log(`🤖 [Atendimento Robô] ${isBotResetCmd ? `Comando/saudação "${text}"` : (isWaitingHuman ? 'Cliente na fila de espera' : (isUnassigned ? 'Sem atendente atribuído' : 'Inatividade (>15min)'))} detectado. Reassumindo atendimento com o robô para ${clientPhone}.`);
              convCheck.status = 'bot';
              convCheck.assigned_to = null;
              convCheck.assigned_attendant_name = null;
              convCheck.assigned_attendant_id = null;
              if (dbCheck.sessions?.[clientPhone]) delete dbCheck.sessions[clientPhone];
              if (dbCheck.sessions?.[rawPhone]) delete dbCheck.sessions[rawPhone];
              saveDb(dbCheck);
            } else {
              console.log(`🛡️ [Atendimento Humano Ativo] Cliente ${clientPhone} está em atendimento humano com "${convCheck.assigned_to}". Robô em pausa para não interferir.`);
              recordRealMessage(clientPhone, clientName, 'inbound', text);
              continue;
            }
          }
        }

        // 🛡️ ANTI-BAN: Marcar mensagem como lida na telemetria oficial do WhatsApp
        try {
          if (msg.key) {
            await sock.readMessages([msg.key]);
          }
        } catch (readErr) {}

        // 🛡️ ANTI-BAN & ANTI-FLOOD: Prevenção contra disparo em rajada e loops de bots
        if (isFloodOrLoop(remoteJid)) {
          console.warn(`🛡️ [Anti-Ban Guard] Taxa excessiva de mensagens de ${remoteJid}. Pausando respostas para proteger a conta e evitar banimento.`);
          continue;
        }

        // Executar o fluxo publicado no Studio / Painel Admin
        try {
          console.log(`⚙️ [Flow Execution] Executando fluxo ativo no bot para ${clientPhone} (${clientName}) [Destino: ${destinationJid}]...`);
          const replies = await executePublishedFlow(destinationJid, text, clientName, clientPhone);

          if (Array.isArray(replies) && replies.length > 0) {
            for (let i = 0; i < replies.length; i++) {
              const reply = replies[i];
              const replyMode = (typeof reply === 'object' && reply?.replyMode) ? reply.replyMode : 'send';
              const quotedToPass = replyMode === 'reply' ? msg : null;
              // skipRecord = true pois executePublishedFlow já gravou a mensagem via recordRealMessage com os dados corretos do cliente
              await sendBotReply(destinationJid, reply, quotedToPass, true);
              if (i < replies.length - 1) {
                // Intervalo natural com digitação simulada entre mensagens consecutivas do bot
                await simulateHumanPresence(destinationJid, 20);
              }
            }
          } else {
            console.log(`ℹ️ [Flow Execution] Nenhum nó restante respondeu para ${clientPhone}.`);
          }
        } catch (botErr) {
          console.error(`❌ [Bot Engine Error] Erro ao processar mensagem para ${clientPhone}:`, botErr);
          await sendBotReply(destinationJid, `Olá, *${clientName}*! Recebemos sua mensagem na *Pitoco de Gente*. Como podemos te ajudar?`, null);
        }
      }
    });
  } catch (err) {
    console.error('❌ [Server] Erro ao iniciar Baileys:', err);
    connectionStatus = 'error';
  }
}

// 🛡️ ANTI-BAN: Rastreamento anti-flood e detecção de loop infinito
const floodTracker = new Map();
function isFloodOrLoop(jid) {
  const now = Date.now();
  const list = floodTracker.get(jid) || [];
  const recent = list.filter(t => now - t < 12000);
  recent.push(now);
  floodTracker.set(jid, recent);
  return recent.length > 5;
}

// 🛡️ ANTI-BAN & HUMANIZAÇÃO: Simulação nativa de digitação humana no WhatsApp
async function simulateHumanPresence(remoteJid, charCount = 30) {
  if (!sock || connectionStatus !== 'connected') return;
  try {
    await sock.sendPresenceUpdate('composing', remoteJid);
    // Tempo natural de digitação (1.2s a 2.6s) para simular operador real no teclado
    const naturalDelay = Math.min(Math.max(1200 + (charCount * 10) + Math.floor(Math.random() * 350), 1300), 2600);
    await new Promise(r => setTimeout(r, naturalDelay));
    await sock.sendPresenceUpdate('paused', remoteJid);
  } catch (e) {
    // Falhas de presença não devem impedir o envio
  }
}

// Enviar resposta gerada pelo motor de fluxo (texto, botões ou mídia)
async function sendBotReply(destinationJid, reply, quotedMsg = null, skipRecord = false) {
  if (!sock || connectionStatus !== 'connected') {
    console.warn(`[SendReply] ⚠️ Baileys não conectado, não foi possível responder para ${destinationJid}`);
    return false;
  }

  const cleanPhone = destinationJid.replace('@s.whatsapp.net', '').replace(/@lid$/, '').replace(/\D/g, '');
  
  // Respeitar a opção do nó: se o card estiver em 'send', desativar citação
  const isSendOnly = (typeof reply === 'object' && reply?.replyMode === 'send');
  
  // Só podemos citar se quotedMsg pertencer EXATAMENTE ao mesmo chat destino!
  const canQuote = quotedMsg && quotedMsg.key?.remoteJid === destinationJid;
  const effectiveQuoted = isSendOnly ? null : (canQuote ? quotedMsg : null);
  const sendOpts = effectiveQuoted ? { quoted: effectiveQuoted } : {};

  // O destino primário é o próprio destinationJid onde o cliente está interagindo
  let targetJid = destinationJid;

  const trySendMessage = async (payload) => {
    try {
      await sock.sendMessage(targetJid, payload, sendOpts);
      return true;
    } catch (err1) {
      console.warn(`[SendReply] Envio para ${targetJid} com quoted falhou (${err1?.message}), tentando sem quoted...`);
      try {
        await sock.sendMessage(targetJid, payload);
        return true;
      } catch (err2) {
        console.error(`❌ [SendReply] Falha ao enviar para ${targetJid}:`, err2?.message || err2);
        
        // Se for LID e falhou, tentar enviar para o telefone real móvel correspondente se conhecido
        if (targetJid.includes('@lid')) {
          const db = loadDb();
          const { primaryPhone } = resolveLinkedPhones(cleanPhone, db);
          if (primaryPhone && primaryPhone.length >= 10 && primaryPhone.length <= 13) {
            const fallbackPhoneJid = `${primaryPhone}@s.whatsapp.net`;
            try {
              await sock.sendMessage(fallbackPhoneJid, payload);
              console.log(`✅ [SendReply] Sucesso via fallback JID Celular: ${fallbackPhoneJid}`);
              return true;
            } catch (err3) {
              console.error(`❌ [SendReply] Fallback JID Celular ${fallbackPhoneJid} falhou:`, err3?.message || err3);
            }
          }
        } else if (targetJid.includes('@s.whatsapp.net')) {
          // Se for telefone móvel e falhou, tentar enviar para o LID correspondente se conhecido
          const db = loadDb();
          const { allPhones } = resolveLinkedPhones(cleanPhone, db);
          const lidPhone = allPhones.find(p => p.length >= 14);
          if (lidPhone) {
            const fallbackLidJid = `${lidPhone}@lid`;
            try {
              await sock.sendMessage(fallbackLidJid, payload);
              console.log(`✅ [SendReply] Sucesso via fallback JID LID: ${fallbackLidJid}`);
              return true;
            } catch (err4) {
              console.error(`❌ [SendReply] Fallback JID LID ${fallbackLidJid} falhou:`, err4?.message || err4);
            }
          }
        }
        return false;
      }
    }
  };

  try {
    // 1. Resposta em Texto Puro (String ou Objeto com .text)
    const textContent = typeof reply === 'string' ? reply : (reply && reply.type === 'text' ? reply.text : null);
    if (textContent) {
      // 🛡️ ANTI-BAN: Simular presença humana de digitação antes do disparo
      await simulateHumanPresence(targetJid, textContent.length);

      const ok = await trySendMessage({ text: textContent });
      if (ok) {
        console.log(`✅ [WhatsApp Enviado] Texto (${isSendOnly ? 'Envio Direto' : 'Com Citação'}) para ${targetJid}: "${textContent.slice(0, 50).replace(/\n/g, ' ')}..."`);
        if (!skipRecord) {
          await recordRealMessage(cleanPhone, null, 'outbound', textContent);
        }
      }
      return ok;
    }

    // 2. Resposta com Botões / Opções Interativas (com fallback amigável numerado)
    if (reply && reply.type === 'buttons') {
      const body = reply.body || 'Escolha uma das opções abaixo:';
      const footer = reply.footer || 'Pitoco de Gente • Atendimento Oficial';
      const buttons = reply.buttons || [];

      let formatted = `${body}\n\n`;
      buttons.forEach((btn, idx) => {
        const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][idx] || `*${idx + 1}.*`;
        const rawTitle = btn.title || btn.text || btn.id || `Opção ${idx + 1}`;
        const title = cleanButtonTitle(rawTitle);
        formatted += `${numEmoji} ${title}\n`;
      });
      if (footer) {
        formatted += `\n_${footer}_\n_👉 Digite o número ou o nome da opção desejada._`;
      }

      // 🛡️ ANTI-BAN: Simular digitação humana
      await simulateHumanPresence(targetJid, formatted.length);

      const ok = await trySendMessage({ text: formatted });
      if (ok) {
        console.log(`✅ [WhatsApp Enviado] Menu (${buttons.length} opções) para ${targetJid}`);
        if (!skipRecord) {
          await recordRealMessage(cleanPhone, null, 'outbound', formatted);
        }
      }
      return ok;
    }

    // 3. Resposta com Mídia (Imagem, Vídeo, Documento, Áudio)
    if (reply && reply.type === 'media') {
      const mediaType = reply.mediaType || 'image';
      const mediaUrl = reply.mediaUrl;
      const caption = reply.caption || '';
      let payload;

      if (mediaType === 'image') {
        payload = { image: { url: mediaUrl }, caption };
      } else if (mediaType === 'video') {
        payload = { video: { url: mediaUrl }, caption };
      } else if (mediaType === 'audio') {
        payload = { audio: { url: mediaUrl }, mimetype: 'audio/mp4', ptt: reply.isPtt !== false };
      } else {
        payload = { document: { url: mediaUrl }, mimetype: 'application/pdf', fileName: reply.fileName || 'documento.pdf', caption };
      }

      // 🛡️ ANTI-BAN: Simular presença antes de envio de mídia
      await simulateHumanPresence(targetJid, 20);

      const ok = await trySendMessage(payload);
      if (ok) {
        console.log(`✅ [WhatsApp Enviado] Mídia (${mediaType}) para ${targetJid}`);
        if (!skipRecord) {
          await recordRealMessage(cleanPhone, null, 'outbound', caption || `[Arquivo ${mediaType}]`);
        }
      }
      return ok;
    }

    return false;
  } catch (err) {
    console.error(`❌ [SendReply] Erro geral ao enviar resposta para ${targetJid}:`, err);
    return false;
  }
}

async function sendWhatsAppMessage(jid, text, quotedMsg = null, skipRecord = false) {
  return sendBotReply(jid, text, quotedMsg, skipRecord);
}

async function recordMessageLocallyAndSupabase(phone, name, direction, content) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  const isLid = cleanPhone.length >= 14 || cleanPhone.startsWith('1686') || cleanPhone.startsWith('219');
  if (isLid) return;

  const botNames = ['pitoco bot', 'pitoco', 'bot', 'assistente', 'robô', 'robo', 'pitoco atendente', 'atendente', 'undefined', 'null'];
  const isBot = !name || botNames.includes(String(name).toLowerCase().trim());
  const safeName = isBot ? null : name;

  return recordRealMessage(cleanPhone, safeName, direction, content);
}

async function recordMessageInSupabase(phone, name, direction, content) {
  if (!supabaseServer) return;
  try {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const isLid = cleanPhone.length >= 14 || cleanPhone.startsWith('1686') || cleanPhone.startsWith('219');

    // NUNCA inserir WhatsApp LID na tabela clients
    if (!isLid) {
      const clientPayload = {
        id: `client-${cleanPhone}`,
        phone: cleanPhone,
        last_interaction: new Date().toISOString(),
      };
      if (name && !['Cliente', 'Cliente Pitoco', 'undefined', 'null', 'Cliente WhatsApp'].includes(name)) {
        clientPayload.name = name;
      }

      await safeSupa(supabaseServer.from('clients').upsert(clientPayload, { onConflict: 'phone' }));
    }

    await safeSupa(supabaseServer.from('conversations').upsert({
      id: convId,
      phone: cleanPhone,
      client_name: name || 'Cliente WhatsApp',
      last_message: content,
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'id' }));

    await safeSupa(supabaseServer.from('chat_messages').insert([{
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      conversation_id: convId,
      direction,
      content,
      author_name: direction === 'inbound' ? (name || 'Cliente') : 'Pitoco Bot',
      created_at: new Date().toISOString(),
    }]));
  } catch (e) {}
}

// Static files from dist if exists
const DIST_PATH = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
}

// REST Endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ==============================================================================
// 0. META WHATSAPP CLOUD API & WEBHOOKS OFICIAIS (GRAPH API)
// ==============================================================================

// Redireciona /webhook para /api/webhook caso seja chamado sem o prefixo /api
app.all('/webhook', (req, res) => res.redirect(307, '/api/webhook'));

// 0.1 Handshake de Verificação do Webhook da Meta e Status da Rota (GET /api/webhook)
app.get(['/api/webhook', '/api/whatsapp/webhook'], (req, res) => {
  // Se for handshake de verificação da Meta (requisição oficial com hub.mode)
  if (req.query['hub.mode']) {
    const result = verifyMetaWebhook(req.query);
    if (result.success) {
      return res.status(200).send(result.challenge);
    } else {
      return res.status(403).send('Forbidden: Token de verificação inválido.');
    }
  }

  // Se for acesso direto via GET (navegador, healthcheck, teste de rota ou diagnóstico)
  const metaConfig = getMetaConfig();
  return res.status(200).json({
    status: 'online',
    endpoint: '/api/webhook',
    service: 'Pitoco Bot — Webhook Gateway Oficial',
    message: 'A rota do Webhook está online, ativa e pronta para receber eventos da Meta WhatsApp Cloud API e integrações externas.',
    timestamp: new Date().toISOString(),
    webhook_url: 'https://pitoco.discloud.app/api/webhook',
    meta_setup: {
      callback_url: 'https://pitoco.discloud.app/api/webhook',
      verify_token: metaConfig.verifyToken || 'pitoco_meta_token_2026',
      supported_tokens: [
        metaConfig.verifyToken,
        'pitoco_meta_token_2026',
        '7assistente_meta_webhook_token_2026'
      ].filter(Boolean),
      fields_to_subscribe: ['messages']
    }
  });
});

// 0.2 Receptor Oficial de Mensagens e Status da Meta (POST /api/webhook)
app.post(['/api/webhook', '/api/whatsapp/webhook'], async (req, res) => {
  // A Meta exige resposta 200 rápida para confirmar o recebimento
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body || {};

    // Caso 1: Evento oficial da Meta Cloud API (WhatsApp Business Account)
    if (body.object === 'whatsapp_business_account' || Array.isArray(body.entry)) {
      const parsed = parseMetaWebhook(body);

      for (const msg of parsed.messages) {
        const clientPhone = String(msg.from).replace(/\D/g, '');
        const clientName = msg.senderName || 'Cliente Pitoco';
        const text = msg.text || '';

        console.log(`📩 [Meta Cloud API Recebido] ${clientPhone} (${clientName}): "${text}"`);
        
        // 1. Marca como lida na Meta (Duplo Check Azul Oficial)
        await markMetaMessageAsRead(msg.id);

        // 2. Grava histórico na base local e Supabase
        await recordMessageLocallyAndSupabase(clientPhone, clientName, 'inbound', text);

        // 3. Comandos de reset e transbordo
        const cleanInputLower = text.toLowerCase().trim();
        const isBotResetCmd = [
          '#bot', '#robo', '#robô', '#sair', '#reiniciar', '#reset', '#menu', '#inicio',
          '/bot', '/sair', '/menu', 'reiniciar', 'menu', 'inicio', 'início', 'começar', 'comecar',
          'voltar', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start'
        ].includes(cleanInputLower);

        const dbCheck = loadDb();
        const convCheck = dbCheck.conversations?.[`conv-${clientPhone}`] || 
                          Object.values(dbCheck.conversations || {}).find(c => 
                            String(c?.phone || c?.contact_phone || '').replace(/\D/g, '') === clientPhone
                          );

        if (convCheck && convCheck.status === 'human') {
          const lastMsgTime = new Date(convCheck.last_message_at || convCheck.updated_at || 0).getTime();
          const isHumanExpired = (Date.now() - lastMsgTime) > (15 * 60 * 1000);

          if (isBotResetCmd || isHumanExpired) {
            console.log(`🤖 [Atendimento Robô Meta] ${isBotResetCmd ? `Comando/saudação "${text}"` : 'Inatividade (>15min)'} detectada. Reassumindo atendimento com o robô para ${clientPhone}.`);
            convCheck.status = 'bot';
            convCheck.assigned_to = null;
            convCheck.assigned_attendant_name = null;
            convCheck.assigned_attendant_id = null;
            if (dbCheck.sessions?.[clientPhone]) delete dbCheck.sessions[clientPhone];
            saveDb(dbCheck);
          } else {
            console.log(`🛡️ [Atendimento Humano Ativo Meta] Cliente ${clientPhone} está em atendimento humano ("${convCheck.assigned_to || convCheck.assigned_attendant_name || 'Atendente'}"). Robô em pausa.`);
            continue;
          }
        }

        // 4. Executar fluxo ativo no bot
        try {
          console.log(`⚙️ [Flow Execution] Executando fluxo via Meta Cloud API para ${clientPhone} (${clientName})...`);
          const remoteJid = `${clientPhone}@s.whatsapp.net`;
          const replies = await executePublishedFlow(remoteJid, text, clientName, clientPhone);

          if (Array.isArray(replies) && replies.length > 0) {
            for (let i = 0; i < replies.length; i++) {
              const reply = replies[i];
              await sendMetaMessage(clientPhone, reply);
              const replyText = typeof reply === 'string' ? reply : (reply?.body || reply?.text || (reply?.type === 'media' ? `[Mídia: ${reply?.mediaType}]` : '[Mensagem com Opções]'));
              await recordMessageLocallyAndSupabase(clientPhone, 'Pitoco Bot', 'outbound', replyText);
            }
          }
        } catch (botErr) {
          console.error(`❌ [Bot Engine Error] Erro ao processar mensagem Meta para ${clientPhone}:`, botErr);
          await sendMetaMessage(clientPhone, `Olá, *${clientName}*! Recebemos sua mensagem na *Pitoco de Gente*. Como podemos te ajudar?`);
        }
      }
    }
    // Caso 2: Disparo de Webhook externo (CRM, Kiwify, Hotmart, n8n, Lead)
    else if (body.phone && (body.text || body.message)) {
      const clientPhone = String(body.phone).replace(/\D/g, '');
      const clientName = body.name || body.clientName || 'Lead Externo';
      const text = body.text || body.message || '';

      console.log(`📩 [Webhook Externo Recebido] ${clientPhone} (${clientName}): "${text}"`);
      await recordMessageLocallyAndSupabase(clientPhone, clientName, 'inbound', text);

      const remoteJid = `${clientPhone}@s.whatsapp.net`;
      const replies = await executePublishedFlow(remoteJid, text, clientName, clientPhone);

      if (Array.isArray(replies) && replies.length > 0) {
        for (let i = 0; i < replies.length; i++) {
          const reply = replies[i];
          await sendMetaMessage(clientPhone, reply);
          const replyText = typeof reply === 'string' ? reply : (reply?.body || reply?.text || '[Opções]');
          await recordMessageLocallyAndSupabase(clientPhone, 'Pitoco Bot', 'outbound', replyText);
        }
      }
    }
  } catch (err) {
    console.error('❌ [Meta Webhook Error]:', err.message);
  }
});

// 0.3 Status da Conexão WhatsApp (Baileys QR Code & Meta Cloud API)
app.get('/api/whatsapp/status', async (req, res) => {
  const metaConfig = getMetaConfig();
  let metaTest = { connected: false, configured: metaConfig.isConfigured };

  if (metaConfig.isConfigured) {
    metaTest = await testMetaConnection();
  }

  const baileysConnected = connectionStatus === 'connected';
  const metaConnected = Boolean(metaTest.connected);
  const isConnected = baileysConnected || metaConnected;

  // Se Baileys estiver conectado, prioriza Baileys (celular real do lojista)
  const activeProvider = baileysConnected
    ? 'baileys'
    : (metaConnected ? 'meta_cloud_api' : (metaConfig.isConfigured ? 'meta_cloud_api' : (connectionStatus !== 'disconnected' ? 'baileys' : 'none')));

  const activePhone = baileysConnected
    ? connectedPhone
    : (metaTest.display_phone_number || connectedPhone || '81996138924');

  const activeName = baileysConnected
    ? (connectedName || 'WhatsApp Business')
    : (metaTest.verified_name || connectedName || 'Pitoco de Gente');

  res.json({
    provider: activeProvider,
    activeProvider,
    configured: metaConfig.isConfigured || isConnected,
    connected: isConnected,
    status: baileysConnected ? 'connected' : (metaConnected ? 'connected' : connectionStatus),
    baileysStatus: connectionStatus,
    baileysConnected,
    metaStatus: metaConnected ? 'connected' : (metaConfig.isConfigured ? 'error' : 'unconfigured'),
    metaConnected,
    phone: activePhone,
    name: activeName,
    verified_name: activeName,
    connectedAt: connectedAt || new Date().toISOString(),
    batteryLevel: 98,
    quality_rating: metaTest.quality_rating || 'GREEN',
    code_verification_status: metaTest.code_verification_status || 'VERIFIED',
    messaging_limit: metaTest.messaging_limit || 'TIER_1K',
    phone_number_id: metaConfig.phoneNumberId,
    waba_id: metaConfig.wabaId,
    webhook_url: 'https://pitoco.discloud.app/api/webhook',
    verify_token: metaConfig.verifyToken,
    error: metaTest.error || null,
    // QR Code ao vivo para conexão por leitura no WhatsApp Business
    qr: currentQR,
    qrDataUrl: currentQRDataUrl,
    hasQr: Boolean(currentQRDataUrl || currentQR),
  });
});

// 0.3.1 Obter QR Code Atual (GET /api/whatsapp/qr)
app.get('/api/whatsapp/qr', async (req, res) => {
  // Se ainda não gerou QR Code e Baileys não está conectado, força inicialização
  if (!currentQR && connectionStatus !== 'connected') {
    restartWhatsApp(false).catch(() => {});
    for (let i = 0; i < 10; i++) {
      if (currentQR || connectionStatus === 'connected') break;
      await new Promise(r => setTimeout(r, 250));
    }
  }

  res.json({
    success: true,
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    phone: connectedPhone,
    name: connectedName,
    qr: currentQR,
    qrDataUrl: currentQRDataUrl,
    hasQr: Boolean(currentQRDataUrl || currentQR),
  });
});

// 0.3.2 Forçar geração de NOVO QR Code ou reconexão limpa (POST /api/whatsapp/qr)
app.post('/api/whatsapp/qr', async (req, res) => {
  try {
    const clearAuth = req.body?.clearAuth ?? false;
    console.log(`📱 [Server] Solicitação para gerar novo QR Code (clearAuth: ${clearAuth})...`);
    await restartWhatsApp(clearAuth);

    // Aguarda até 3.5s pelo novo QR
    for (let i = 0; i < 14; i++) {
      if (currentQR || connectionStatus === 'connected') break;
      await new Promise(r => setTimeout(r, 250));
    }

    res.json({
      success: true,
      status: connectionStatus,
      connected: connectionStatus === 'connected',
      phone: connectedPhone,
      name: connectedName,
      qr: currentQR,
      qrDataUrl: currentQRDataUrl,
      hasQr: Boolean(currentQRDataUrl || currentQR),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 0.4 Salvar Credenciais da Meta Cloud API
app.post('/api/whatsapp/config', async (req, res) => {
  try {
    const updated = updateMetaConfig(req.body);
    const test = await testMetaConnection();
    res.json({
      success: true,
      message: 'Configurações da Meta Cloud API atualizadas com sucesso',
      config: {
        phoneNumberId: updated.phoneNumberId,
        wabaId: updated.wabaId,
        verifyToken: updated.verifyToken,
        isConfigured: updated.isConfigured,
      },
      validation: test,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 0.5 Teste de Conexão ao Vivo com a Graph API da Meta
app.post('/api/whatsapp/test-connection', async (req, res) => {
  try {
    const test = await testMetaConnection();
    res.json({ success: test.connected, result: test });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 0.6 Desconectar / Limpar Sessão do WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const { provider } = req.body || {};
    console.log(`🔌 [Server] Desconectando WhatsApp (provider: ${provider || 'todos'})...`);

    if (provider === 'meta' || provider === 'meta_cloud_api') {
      updateMetaConfig({ accessToken: '', phoneNumberId: '', wabaId: '' });
    } else if (provider === 'baileys') {
      await restartWhatsApp(true);
    } else {
      updateMetaConfig({ accessToken: '', phoneNumberId: '', wabaId: '' });
      await restartWhatsApp(true);
    }

    res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || err });
  }
});

// ==============================================================================
// Helper para persistir botProfile e customVariables no Supabase de forma segura
async function syncBotProfileToSupabase(profile) {
  if (!supabaseServer) return;
  try {
    const now = new Date().toISOString();
    const botPayload = { id: 'default', updated_at: now };
    if (profile.name) { botPayload.name = profile.name; botPayload.bot_name = profile.name; }
    if (profile.company_name) botPayload.store_name = profile.company_name;
    if (profile.tone) botPayload.tone = profile.tone;
    if (profile.avatar_url) botPayload.avatar_url = profile.avatar_url;
    if (profile.support_phone) botPayload.support_phone = profile.support_phone;
    if (profile.support_email) botPayload.support_email = profile.support_email;
    if (profile.business_hours) botPayload.business_hours = profile.business_hours;
    if (profile.website_url) botPayload.website_url = profile.website_url;
    if (profile.company_address) botPayload.company_address = profile.company_address;
    if (profile.pix_key) botPayload.pix_key = profile.pix_key;
    if (profile.pix_owner) { botPayload.pix_owner = profile.pix_owner; botPayload.pix_name = profile.pix_owner; }
    if (typeof profile.notify_new_bookings === 'boolean') botPayload.notify_new_bookings = profile.notify_new_bookings;
    if (profile.notify_phone) botPayload.notify_phone = profile.notify_phone;
    if (typeof profile.play_audio_alerts === 'boolean') botPayload.play_audio_alerts = profile.play_audio_alerts;

    await Promise.all([
      safeSupa(supabaseServer.from('bot_config').upsert(botPayload, { onConflict: 'id' })),
      safeSupa(supabaseServer.from('settings').upsert({
        id: 'default',
        bot_profile: profile,
        updated_at: now,
      }, { onConflict: 'id' }))
    ]);
  } catch (err) {
    console.warn('[Supabase Sync] syncBotProfileToSupabase error:', err.message);
  }
}

async function syncCustomVariablesToSupabase(vars) {
  if (!supabaseServer) return;
  try {
    const now = new Date().toISOString();
    await Promise.all([
      safeSupa(supabaseServer.from('bot_config').upsert({ id: 'default', custom_variables: vars, updated_at: now }, { onConflict: 'id' })),
      safeSupa(supabaseServer.from('settings').upsert({ id: 'default', custom_variables: vars, updated_at: now }, { onConflict: 'id' })),
    ]);
  } catch (err) {
    console.warn('[Supabase Sync] syncCustomVariablesToSupabase error:', err.message);
  }
}

async function syncSettingsToSupabase(settings) {
  if (!supabaseServer) return;
  try {
    const payload = {
      id: 'default',
      ...settings,
      updated_at: new Date().toISOString(),
    };
    await safeSupa(supabaseServer.from('settings').upsert(payload, { onConflict: 'id' }));
  } catch (err) {
    console.warn('[Supabase Sync] syncSettingsToSupabase error:', err.message);
  }
}

app.get('/api/bot-config', async (req, res) => {
  try {
    const db = loadDb();
    if (supabaseServer) {
      const { data } = await safeSupa(supabaseServer.from('bot_config').select('*').eq('id', 'default').maybeSingle());
      if (data) {
        db.botProfile = {
          ...(db.botProfile || {}),
          name: data.name || data.bot_name || db.botProfile?.name,
          company_name: data.store_name || db.botProfile?.company_name,
          tone: data.tone || db.botProfile?.tone,
          avatar_url: data.avatar_url || db.botProfile?.avatar_url,
          support_phone: data.support_phone || db.botProfile?.support_phone,
          support_email: data.support_email || db.botProfile?.support_email,
          business_hours: data.business_hours || db.botProfile?.business_hours,
          website_url: data.website_url || db.botProfile?.website_url,
          company_address: data.company_address || db.botProfile?.company_address,
          pix_key: data.pix_key || db.botProfile?.pix_key,
          pix_owner: data.pix_owner || data.pix_name || db.botProfile?.pix_owner,
        };
        saveDb(db);
      }
    }
    res.json(db.botProfile || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bot-config', (req, res) => {
  try {
    const db = loadDb();
    db.botProfile = { ...(db.botProfile || {}), ...req.body, updated_at: new Date().toISOString() };
    saveDb(db);
    syncBotProfileToSupabase(db.botProfile);
    res.json({ success: true, botProfile: db.botProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot-config', (req, res) => {
  try {
    const db = loadDb();
    db.botProfile = { ...(db.botProfile || {}), ...req.body, updated_at: new Date().toISOString() };
    saveDb(db);
    syncBotProfileToSupabase(db.botProfile);
    res.json({ success: true, botProfile: db.botProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const db = loadDb();
    if (supabaseServer) {
      const { data } = await safeSupa(supabaseServer.from('settings').select('*').eq('id', 'default').maybeSingle());
      if (data) {
        db.settings = { ...(db.settings || {}), ...data };
        saveDb(db);
      }
    }
    res.json(db.settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const db = loadDb();
    db.settings = { ...(db.settings || {}), ...req.body, updated_at: new Date().toISOString() };
    saveDb(db);
    syncSettingsToSupabase(db.settings);
    res.json({ success: true, settings: db.settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const db = loadDb();
    db.settings = { ...(db.settings || {}), ...req.body, updated_at: new Date().toISOString() };
    saveDb(db);
    syncSettingsToSupabase(db.settings);
    res.json({ success: true, settings: db.settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 2. MULTI-LOJAS CRUD
// ==============================================================================
app.get('/api/stores', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.stores || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stores/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const store = (db.stores || []).find(s => s.id === id || s.slug === id);
    if (!store) return res.status(404).json({ error: 'Loja não encontrada' });
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stores', (req, res) => {
  try {
    const db = loadDb();
    if (!db.stores) db.stores = [];
    const storeData = req.body;
    if (!storeData || (!storeData.id && !storeData.name)) {
      return res.status(400).json({ error: 'Dados da loja inválidos' });
    }

    const newStore = {
      id: storeData.id || `store-${Date.now()}`,
      slug: storeData.slug || `loja-${Date.now()}`,
      name: storeData.name || 'Nova Loja',
      address: storeData.address || '',
      phone: storeData.phone || '',
      whatsapp_number: storeData.whatsapp_number || storeData.phone || '',
      is_active: storeData.is_active !== false,
      business_hours: storeData.business_hours || '08:30 às 18:30',
      city: storeData.city || 'Recife - PE',
      monthly_revenue: Number(storeData.monthly_revenue) || 0,
      active_chats: Number(storeData.active_chats) || 0,
      manager_name: storeData.manager_name || 'Gerente',
      created_at: storeData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...storeData,
    };

    const idx = db.stores.findIndex(s => s.id === newStore.id || s.slug === newStore.slug);
    if (idx >= 0) {
      db.stores[idx] = { ...db.stores[idx], ...newStore, updated_at: new Date().toISOString() };
    } else {
      db.stores.push(newStore);
    }

    saveDb(db);
    console.log(`[Stores API] 🏬 Loja salva: "${newStore.name}" (${newStore.id})`);
    res.json({ success: true, store: newStore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stores/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (db.stores) {
      db.stores = db.stores.filter(s => s.id !== id && s.slug !== id);
    }
    saveDb(db);
    console.log(`[Stores API] 🗑️ Loja removida: ${id}`);
    res.json({ success: true, message: `Loja ${id} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 2.5 CLIENTES / CONTATOS CRUD & SINCRONIZAÇÃO CRM
// ==============================================================================
app.get('/api/contacts', async (req, res) => {
  try {
    const db = loadDb();
    let contactsList = [];

    // Prioridade 1: Buscar do Supabase em nuvem
    if (supabaseServer) {
      try {
        let query = supabaseServer.from('clients').select('*').order('last_interaction', { ascending: false });
        if (req.query.store_id) {
          query = query.eq('store_id', req.query.store_id);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          // Filtrar WhatsApp LIDs (>= 14 dígitos ou começando com 1686 / 219) e nomes do bot
          const validClients = data.filter(c => {
            const p = String(c.phone || '').replace(/\D/g, '');
            if (!p || p.length >= 14 || p.startsWith('1686') || p.startsWith('219')) return false;
            const name = (c.name || '').toLowerCase().trim();
            if (name === 'pitoco bot' || name === 'bot') return false;
            return true;
          });
          // Atualizar cache local do db.contacts para refletir a nuvem
          const cloudMap = {};
          validClients.forEach(c => {
            const p = String(c.phone || '').replace(/\D/g, '');
            if (p) cloudMap[p] = c;
          });
          db.contacts = cloudMap;
          saveDb(db);
          return res.json(validClients);
        }
      } catch (cloudErr) {
        console.warn('[Contacts API] Falha ao consultar Supabase, usando cache local:', cloudErr.message);
      }
    }

    // Fallback: Cache local
    if (Array.isArray(db.contacts)) {
      contactsList = [...db.contacts];
    } else if (db.contacts && typeof db.contacts === 'object') {
      contactsList = Object.values(db.contacts);
    }

    contactsList = contactsList.filter(c => {
      const p = String(c.phone || '').replace(/\D/g, '');
      if (!p || p.length >= 14 || p.startsWith('1686') || p.startsWith('219')) return false;
      const name = (c.name || '').toLowerCase().trim();
      if (name === 'pitoco bot' || name === 'bot') return false;
      return true;
    });

    if (req.query.store_id) {
      contactsList = contactsList.filter(c => !c.store_id || c.store_id === req.query.store_id);
    }

    // Ordenar por última interação decrescente
    contactsList.sort((a, b) => new Date(b.last_interaction || b.updated_at || 0) - new Date(a.last_interaction || a.updated_at || 0));

    res.json(contactsList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const db = loadDb();
    const data = req.body || {};
    const cleanPhone = String(data.phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Telefone do contato é obrigatório' });
    }

    const { primaryPhone, allPhones } = resolveLinkedPhones(cleanPhone, db);
    const targetPhone = (primaryPhone && primaryPhone.length >= 10 && primaryPhone.length <= 13) ? primaryPhone : cleanPhone;
    const isTargetLid = targetPhone.length >= 14 || targetPhone.startsWith('1686') || targetPhone.startsWith('219');

    const newContact = {
      id: data.id || `contact-${targetPhone}`,
      name: data.name || 'Cliente WhatsApp',
      phone: targetPhone,
      email: data.email || null,
      store_id: data.store_id || null,
      store_name: data.store_name || null,
      status: data.status || 'active',
      is_registered: true,
      tags: Array.isArray(data.tags) ? data.tags : ['Cliente WhatsApp'],
      baby_name: data.baby_name || null,
      due_date: data.due_date || null,
      notes: data.notes || 'Atualizado via CRM / API',
      custom_fields: data.custom_fields || {},
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
      ...data,
    };

    if (!db.contacts) db.contacts = {};

    // Salvar APENAS no telefone real (nunca em LID)
    if (!isTargetLid) {
      if (Array.isArray(db.contacts)) {
        const idx = db.contacts.findIndex(c => String(c.phone || '').replace(/\D/g, '') === targetPhone);
        if (idx >= 0) db.contacts[idx] = { ...db.contacts[idx], ...newContact, phone: targetPhone };
        else db.contacts.push({ ...newContact, phone: targetPhone });
      } else {
        db.contacts[targetPhone] = { ...(db.contacts[targetPhone] || {}), ...newContact, phone: targetPhone };
      }

      if (db.conversations && db.conversations[`conv-${targetPhone}`]) {
        db.conversations[`conv-${targetPhone}`].contact_name = newContact.name;
        db.conversations[`conv-${targetPhone}`].updated_at = new Date().toISOString();
      }

      await syncContactToSupabase({ ...newContact, phone: targetPhone });
    }

    // Limpar quaisquer registros LID espúrios
    for (const p of allPhones) {
      if (p.length >= 14 || p.startsWith('1686') || p.startsWith('219')) {
        if (Array.isArray(db.contacts)) {
          db.contacts = db.contacts.filter(c => String(c.phone || '').replace(/\D/g, '') !== p);
        } else if (db.contacts) {
          delete db.contacts[p];
        }
        if (db.conversations) delete db.conversations[`conv-${p}`];
        if (supabaseServer) {
          Promise.resolve(supabaseServer.from('clients').delete().eq('phone', p)).catch(() => {});
          Promise.resolve(supabaseServer.from('contacts').delete().eq('phone', p)).catch(() => {});
        }
      }
    }

    saveDb(db);
    res.json({ success: true, contact: newContact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const data = req.body || {};
    const cleanPhone = String(data.phone || id).replace(/\D/g, '');

    const { primaryPhone, allPhones } = resolveLinkedPhones(cleanPhone, db);
    const targetPhone = (primaryPhone && primaryPhone.length >= 10 && primaryPhone.length <= 13) ? primaryPhone : cleanPhone;
    const isTargetLid = targetPhone.length >= 14 || targetPhone.startsWith('1686') || targetPhone.startsWith('219');
    let updatedContact = null;

    if (!db.contacts) db.contacts = {};

    if (!isTargetLid) {
      if (Array.isArray(db.contacts)) {
        const idx = db.contacts.findIndex(c => c.id === id || String(c.phone || '').replace(/\D/g, '') === targetPhone);
        if (idx >= 0) {
          db.contacts[idx] = { ...db.contacts[idx], ...data, phone: targetPhone, updated_at: new Date().toISOString() };
          updatedContact = db.contacts[idx];
        }
      } else {
        db.contacts[targetPhone] = { ...(db.contacts[targetPhone] || {}), ...data, phone: targetPhone, updated_at: new Date().toISOString() };
        updatedContact = db.contacts[targetPhone];
      }

      if (db.conversations && db.conversations[`conv-${targetPhone}`]) {
        if (data.name) db.conversations[`conv-${targetPhone}`].contact_name = data.name;
        db.conversations[`conv-${targetPhone}`].updated_at = new Date().toISOString();
      }

      if (updatedContact) {
        await syncContactToSupabase(updatedContact);
      }
    }

    // Limpar quaisquer registros LID espúrios
    for (const p of allPhones) {
      if (p.length >= 14 || p.startsWith('1686') || p.startsWith('219')) {
        if (Array.isArray(db.contacts)) {
          db.contacts = db.contacts.filter(c => String(c.phone || '').replace(/\D/g, '') !== p);
        } else if (db.contacts) {
          delete db.contacts[p];
        }
        if (db.conversations) delete db.conversations[`conv-${p}`];
        if (supabaseServer) {
          Promise.resolve(supabaseServer.from('clients').delete().eq('phone', p)).catch(() => {});
          Promise.resolve(supabaseServer.from('contacts').delete().eq('phone', p)).catch(() => {});
        }
      }
    }

    saveDb(db);
    res.json({ success: true, contact: updatedContact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts', async (req, res) => {
  try {
    const db = loadDb();
    db.contacts = {};
    db.conversations = {};
    db.messages = {};
    saveDb(db);

    if (supabaseServer) {
      await safeSupa(supabaseServer.from('clients').delete().neq('id', '___none___'));
      await safeSupa(supabaseServer.from('contacts').delete().neq('id', '___none___'));
    }

    console.log('[Contacts API] 🗑️ Todos os contatos e conversas foram removidos.');
    res.json({ success: true, message: 'Todos os contatos foram removidos com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const cleanPhone = String(id || '').replace(/\D/g, '');
    const phoneVariants = new Set([id]);
    if (cleanPhone) {
      phoneVariants.add(cleanPhone);
      phoneVariants.add(`55${cleanPhone}`);
      if (cleanPhone.startsWith('55')) {
        phoneVariants.add(cleanPhone.substring(2));
      }
    }

    // 1. Remover do cache local db.contacts
    if (Array.isArray(db.contacts)) {
      db.contacts = db.contacts.filter(c => {
        const cPhone = String(c.phone || '').replace(/\D/g, '');
        return c.id !== id && !phoneVariants.has(cPhone);
      });
    } else if (db.contacts && typeof db.contacts === 'object') {
      delete db.contacts[id];
      for (const p of phoneVariants) {
        delete db.contacts[p];
        delete db.contacts[`contact-${p}`];
      }
      for (const [key, contact] of Object.entries(db.contacts)) {
        const cPhone = String(contact.phone || '').replace(/\D/g, '');
        if (contact.id === id || phoneVariants.has(cPhone) || phoneVariants.has(key)) {
          delete db.contacts[key];
        }
      }
    }

    // 2. Remover conversas e mensagens vinculadas para evitar ressuscitação
    if (db.conversations && typeof db.conversations === 'object') {
      for (const p of phoneVariants) {
        delete db.conversations[`conv-${p}`];
        delete db.conversations[p];
      }
      for (const [convId, conv] of Object.entries(db.conversations)) {
        const convPhone = String(conv.contact_phone || conv.phone || '').replace(/\D/g, '');
        if (phoneVariants.has(convPhone) || conv.contact_id === id) {
          delete db.conversations[convId];
        }
      }
    }

    if (db.messages && typeof db.messages === 'object') {
      for (const p of phoneVariants) {
        delete db.messages[`conv-${p}`];
      }
    }

    saveDb(db);

    // 3. Remover definitivamente do Supabase
    if (supabaseServer) {
      for (const p of phoneVariants) {
        await safeSupa(supabaseServer.from('clients').delete().eq('phone', p));
        await safeSupa(supabaseServer.from('clients').delete().eq('id', p));
        await safeSupa(supabaseServer.from('clients').delete().eq('id', `contact-${p}`));
        await safeSupa(supabaseServer.from('contacts').delete().eq('phone', p));
        await safeSupa(supabaseServer.from('contacts').delete().eq('id', p));
        await safeSupa(supabaseServer.from('contacts').delete().eq('id', `contact-${p}`));
      }
      await safeSupa(supabaseServer.from('clients').delete().eq('id', id));
      await safeSupa(supabaseServer.from('contacts').delete().eq('id', id));
    }

    console.log(`[Contacts API] 🗑️ Contato ${id} (e telefones ${[...phoneVariants].join(', ')}) removido.`);
    res.json({ success: true, message: `Contato ${id} removido` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 3. CATEGORIAS DO CATÁLOGO CRUD
// ==============================================================================
app.get('/api/categories', (req, res) => {
  try {
    const db = loadDb();
    let categories = db.categories || [];
    if (req.query.store_id) {
      categories = categories.filter(c => !c.store_id || c.store_id === req.query.store_id);
    }
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const db = loadDb();
    if (!db.categories) db.categories = [];
    const catData = req.body;
    const newCat = {
      id: catData.id || `cat-${Date.now()}`,
      name: catData.name || 'Nova Categoria',
      slug: catData.slug || `categoria-${Date.now()}`,
      description: catData.description || '',
      icon: catData.icon || 'tag',
      sort_order: Number(catData.sort_order) || db.categories.length + 1,
      is_active: catData.is_active !== false,
      created_at: catData.created_at || new Date().toISOString(),
      ...catData,
    };

    const idx = db.categories.findIndex(c => c.id === newCat.id || c.slug === newCat.slug);
    if (idx >= 0) {
      db.categories[idx] = { ...db.categories[idx], ...newCat };
    } else {
      db.categories.push(newCat);
    }

    saveDb(db);
    res.json({ success: true, category: newCat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (db.categories) {
      db.categories = db.categories.filter(c => c.id !== id && c.slug !== id);
    }
    saveDb(db);
    res.json({ success: true, message: `Categoria ${id} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 4. PRODUTOS DO CATÁLOGO DE BEBÊ CRUD
// ==============================================================================
app.get('/api/products', (req, res) => {
  try {
    const db = loadDb();
    let prods = db.products || [];
    const { store_id, category_id } = req.query;
    if (store_id) {
      prods = prods.filter(p => !p.store_id || p.store_id === store_id);
    }
    if (category_id) {
      prods = prods.filter(p => p.category_id === category_id);
    }
    res.json(prods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const db = loadDb();
    const prod = (db.products || []).find(p => p.id === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(prod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const db = loadDb();
    if (!db.products) db.products = [];
    const prodData = req.body;
    if (!prodData || (!prodData.id && !prodData.name)) {
      return res.status(400).json({ error: 'Dados do produto inválidos' });
    }

    const newProd = {
      id: prodData.id || `prod-${Date.now()}`,
      category_id: prodData.category_id || 'cat-001',
      category_name: prodData.category_name || 'Roupas & Enxovais',
      name: prodData.name || 'Novo Produto',
      description: prodData.description || '',
      price: Number(prodData.price) || 49.90,
      promotional_price: prodData.promotional_price ? Number(prodData.promotional_price) : undefined,
      sizes: Array.isArray(prodData.sizes) ? prodData.sizes : ['RN', 'P', 'M'],
      colors: Array.isArray(prodData.colors) ? prodData.colors : ['Branco Puro', 'Azul Bebê'],
      stock_quantity: prodData.stock_quantity !== undefined ? Number(prodData.stock_quantity) : 50,
      is_featured: Boolean(prodData.is_featured),
      is_active: prodData.is_active !== false,
      material: prodData.material || 'Algodão Suedine 100%',
      image_url: prodData.image_url || '',
      store_id: prodData.store_id || null,
      created_at: prodData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...prodData,
    };

    const idx = db.products.findIndex(p => p.id === newProd.id);
    if (idx >= 0) {
      db.products[idx] = { ...db.products[idx], ...newProd, updated_at: new Date().toISOString() };
    } else {
      db.products.unshift(newProd);
    }

    saveDb(db);
    console.log(`[Products API] 👶 Produto salvo: "${newProd.name}" (${newProd.id}) - R$ ${newProd.price}`);
    res.json({ success: true, product: newProd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (db.products) {
      db.products = db.products.filter(p => p.id !== id);
    }
    saveDb(db);
    console.log(`[Products API] 🗑️ Produto removido: ${id}`);
    res.json({ success: true, message: `Produto ${id} removido` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==============================================================================
// 6. CONVERSAS & MENSAGENS DO ATENDIMENTO CRUD
// ==============================================================================
app.get('/api/conversations', (req, res) => {
  try {
    const db = loadDb();
    let convs = Object.values(db.conversations || {});

    // 🛡️ FILTRO RIGOROSO: NUNCA retornar conversas com WhatsApp LID ou do próprio robô
    convs = convs.filter(c => {
      const p = String(c.contact_phone || c.phone || '').replace(/\D/g, '');
      if (!p || p.length >= 14 || p.startsWith('1686') || p.startsWith('219')) return false;
      if (c.id && (c.id.includes('1686') || c.id.includes('219') || c.id.length >= 19)) return false;
      const name = (c.contact_name || '').toLowerCase().trim();
      if (name === 'pitoco bot' || name === 'bot') return false;
      return true;
    });

    if (req.query.store_id) {
      convs = convs.filter(c => !c.store_id || c.store_id === req.query.store_id);
    }
    res.json(convs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations', (req, res) => {
  try {
    const db = loadDb();
    if (!db.conversations) db.conversations = {};
    const convData = req.body;
    const id = convData.id || `conv-${Date.now()}`;
    const newConv = {
      id,
      contact_name: convData.contact_name || 'Cliente',
      contact_phone: convData.contact_phone || '',
      phone: convData.phone || convData.contact_phone || '',
      status: convData.status || 'bot',
      unread_count: Number(convData.unread_count) || 0,
      created_at: convData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...convData,
    };
    db.conversations[id] = newConv;
    saveDb(db);
    res.json({ success: true, conversation: newConv });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const cleanId = String(id).replace(/\D/g, '');

    // 1. Delete from db.conversations (matching key, id, phone, or cleanId)
    if (db.conversations) {
      const keysToDelete = Object.keys(db.conversations).filter(k => 
        k === id || 
        db.conversations[k]?.id === id || 
        db.conversations[k]?.phone === id || 
        db.conversations[k]?.contact_phone === id ||
        (cleanId && (
          String(db.conversations[k]?.phone || '').replace(/\D/g, '') === cleanId ||
          String(db.conversations[k]?.contact_phone || '').replace(/\D/g, '') === cleanId ||
          String(k).replace(/\D/g, '') === cleanId
        ))
      );
      for (const k of keysToDelete) {
        delete db.conversations[k];
      }
    }

    // 2. Delete messages
    if (db.messages) {
      delete db.messages[id];
      if (cleanId) {
        delete db.messages[cleanId];
        delete db.messages[`conv-${cleanId}`];
      }
    }

    // 3. Reset bot session if active for this contact
    if (db.sessions && cleanId) {
      delete db.sessions[cleanId];
      delete db.sessions[`55${cleanId}`];
    }

    saveDb(db);

    // 4. Delete from Supabase if connected
    if (supabaseServer) {
      try {
        await supabaseServer.from('chat_messages').delete().or(`conversation_id.eq.${id},conversation_id.eq.conv-${cleanId}`);
        await supabaseServer.from('conversations').delete().or(`id.eq.${id},id.eq.conv-${cleanId}${cleanId ? `,phone.eq.${cleanId}` : ''}`);
      } catch (e) {
        console.warn('[Server] Falha ao deletar do Supabase:', e.message);
      }
    }

    console.log(`[Conversations API] 🗑️ Conversa "${id}" apagada com sucesso`);
    res.json({ success: true, message: `Conversa ${id} removida com sucesso` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback POST route for deleting conversations
app.post('/api/conversations/:id/delete', async (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const cleanId = String(id).replace(/\D/g, '');

    if (db.conversations) {
      const keysToDelete = Object.keys(db.conversations).filter(k => 
        k === id || 
        db.conversations[k]?.id === id || 
        db.conversations[k]?.phone === id || 
        db.conversations[k]?.contact_phone === id ||
        (cleanId && (
          String(db.conversations[k]?.phone || '').replace(/\D/g, '') === cleanId ||
          String(db.conversations[k]?.contact_phone || '').replace(/\D/g, '') === cleanId ||
          String(k).replace(/\D/g, '') === cleanId
        ))
      );
      for (const k of keysToDelete) {
        delete db.conversations[k];
      }
    }

    if (db.messages) {
      delete db.messages[id];
      if (cleanId) {
        delete db.messages[cleanId];
        delete db.messages[`conv-${cleanId}`];
      }
    }

    if (db.sessions && cleanId) {
      delete db.sessions[cleanId];
      delete db.sessions[`55${cleanId}`];
    }

    saveDb(db);

    if (supabaseServer) {
      try {
        await supabaseServer.from('chat_messages').delete().or(`conversation_id.eq.${id},conversation_id.eq.conv-${cleanId}`);
        await supabaseServer.from('conversations').delete().or(`id.eq.${id},id.eq.conv-${cleanId}${cleanId ? `,phone.eq.${cleanId}` : ''}`);
      } catch (e) {}
    }

    res.json({ success: true, message: `Conversa ${id} removida com sucesso` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Purge / Clear all trash conversations
app.delete('/api/conversations', async (req, res) => {
  try {
    const db = loadDb();
    if (req.query.trash === 'true') {
      const trashKeys = Object.keys(db.conversations || {}).filter(k => db.conversations[k]?.is_deleted);
      for (const k of trashKeys) {
        delete db.conversations[k];
        if (db.messages) delete db.messages[k];
      }
      saveDb(db);
      return res.json({ success: true, message: `${trashKeys.length} conversas da lixeira removidas` });
    }
    db.conversations = {};
    db.messages = {};
    saveDb(db);
    res.json({ success: true, message: 'Todas as conversas foram removidas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/conversations/:id/assign', async (req, res) => {
  try {
    const db = loadDb();
    if (!db.conversations) db.conversations = {};
    const id = req.params.id;
    const cleanId = String(id).replace(/\D/g, '');

    let convKey = Object.keys(db.conversations).find(k => 
      k === id || 
      db.conversations[k]?.id === id || 
      db.conversations[k]?.phone === id || 
      db.conversations[k]?.contact_phone === id ||
      (cleanId && (
        String(db.conversations[k]?.phone || '').replace(/\D/g, '') === cleanId ||
        String(db.conversations[k]?.contact_phone || '').replace(/\D/g, '') === cleanId ||
        String(k).replace(/\D/g, '') === cleanId
      ))
    );

    if (!convKey) {
      convKey = id.startsWith('conv-') ? id : `conv-${id}`;
      db.conversations[convKey] = {
        id: convKey,
        phone: cleanId || id,
        contact_phone: cleanId || id,
        contact_name: 'Cliente WhatsApp',
        status: 'human',
        created_at: new Date().toISOString(),
      };
    }

    const { attendant_id, attendant_name } = req.body;
    const finalAttendant = attendant_name || 'Atendente Pitoco';
    db.conversations[convKey].assigned_to = finalAttendant;
    db.conversations[convKey].assigned_attendant_id = attendant_id || null;
    db.conversations[convKey].assigned_attendant_name = finalAttendant;
    db.conversations[convKey].status = 'human';
    db.conversations[convKey].updated_at = new Date().toISOString();
    saveDb(db);

    if (supabaseServer) {
      const convObj = db.conversations[convKey];
      const sRes = await safeSupa(supabaseServer.from('conversations').upsert({
        id: convObj.id || convKey,
        phone: convObj.phone || convObj.contact_phone || cleanId || '558199999999',
        client_name: convObj.contact_name || 'Cliente WhatsApp',
        assigned_to: finalAttendant,
        status: 'human',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }));
      if (sRes.error) {
        console.warn('[Server] Falha ao upsert conversation no Supabase:', sRes.error.message);
      }
    }

    console.log(`[Conversations API] 👤 Conversa "${convKey}" assumida por: ${finalAttendant}`);
    res.json({ success: true, conversation: db.conversations[convKey] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/conversations/:id/status', async (req, res) => {
  try {
    const db = loadDb();
    if (!db.conversations) db.conversations = {};
    const id = req.params.id;
    const cleanId = String(id).replace(/\D/g, '');

    let convKey = Object.keys(db.conversations).find(k => 
      k === id || 
      db.conversations[k]?.id === id || 
      db.conversations[k]?.phone === id || 
      db.conversations[k]?.contact_phone === id ||
      (cleanId && (
        String(db.conversations[k]?.phone || '').replace(/\D/g, '') === cleanId ||
        String(db.conversations[k]?.contact_phone || '').replace(/\D/g, '') === cleanId ||
        String(k).replace(/\D/g, '') === cleanId
      ))
    );

    if (!convKey) {
      convKey = id.startsWith('conv-') ? id : `conv-${id}`;
      db.conversations[convKey] = {
        id: convKey,
        phone: cleanId || id,
        contact_phone: cleanId || id,
        contact_name: 'Cliente WhatsApp',
        status: req.body.status || 'human',
        created_at: new Date().toISOString(),
      };
    }

    const { status, store_id, assigned_to } = req.body;
    if (status) db.conversations[convKey].status = status;
    if (store_id) db.conversations[convKey].store_id = store_id;
    if (assigned_to !== undefined) {
      db.conversations[convKey].assigned_to = assigned_to;
      if (!assigned_to) {
        db.conversations[convKey].assigned_attendant_id = null;
        db.conversations[convKey].assigned_attendant_name = null;
      }
    }
    db.conversations[convKey].updated_at = new Date().toISOString();
    saveDb(db);

    if (supabaseServer) {
      const convObj = db.conversations[convKey];
      const sRes = await safeSupa(supabaseServer.from('conversations').upsert({
        id: convObj.id || convKey,
        phone: convObj.phone || convObj.contact_phone || cleanId || '558199999999',
        client_name: convObj.contact_name || 'Cliente WhatsApp',
        status: db.conversations[convKey].status,
        assigned_to: db.conversations[convKey].assigned_to || null,
        ...(store_id ? { store_id } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }));
      if (sRes.error) {
        console.warn('[Server] Falha ao upsert status no Supabase:', sRes.error.message);
      }
    }

    res.json({ success: true, conversation: db.conversations[convKey] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/conversations/:id/transfer', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (!db.conversations || !db.conversations[id]) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    const { store_id, store_name, attendant_id, attendant_name } = req.body;
    if (store_id) db.conversations[id].store_id = store_id;
    if (store_name) db.conversations[id].store_name = store_name;
    if (attendant_id) db.conversations[id].assigned_attendant_id = attendant_id;
    if (attendant_name) db.conversations[id].assigned_to = attendant_name;
    db.conversations[id].status = 'waiting_human';
    db.conversations[id].updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, conversation: db.conversations[id] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id/messages', (req, res) => {
  try {
    const db = loadDb();
    const msgs = db.messages?.[req.params.id] || [];
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/messages', (req, res) => {
  try {
    const db = loadDb();
    const convId = req.params.id;
    if (!db.messages) db.messages = {};
    if (!db.messages[convId]) db.messages[convId] = [];

    const msgData = req.body;
    const content = (msgData.content || '').trim();

    // Deduplicação: se a última mensagem tiver mesmo conteúdo, direção e foi registrada nos últimos 5 segundos, não insere duplicada
    const lastMsg = db.messages[convId][db.messages[convId].length - 1];
    if (lastMsg && lastMsg.direction === (msgData.direction || 'outbound') && (lastMsg.content || '').trim() === content) {
      const diffMs = Math.abs(Date.now() - new Date(lastMsg.created_at || 0).getTime());
      if (diffMs < 5000) {
        return res.json({ success: true, message: lastMsg, deduplicated: true });
      }
    }

    const newMsg = {
      id: msgData.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      conversation_id: convId,
      direction: msgData.direction || 'outbound',
      message_type: msgData.message_type || 'text',
      content: msgData.content || '',
      media_url: msgData.media_url,
      author_name: msgData.author_name || 'Atendente',
      status: msgData.status || 'delivered',
      created_at: msgData.created_at || new Date().toISOString(),
      ...msgData,
    };

    db.messages[convId].push(newMsg);
    if (db.conversations && db.conversations[convId]) {
      db.conversations[convId].last_message = newMsg.content;
      db.conversations[convId].last_message_at = newMsg.created_at;
      db.conversations[convId].updated_at = new Date().toISOString();
    }

    saveDb(db);
    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id/messages/:msgId', (req, res) => {
  try {
    const db = loadDb();
    const { id, msgId } = req.params;
    if (db.messages && db.messages[id]) {
      db.messages[id] = db.messages[id].filter(m => m.id !== msgId);
      saveDb(db);
    }
    res.json({ success: true, message: `Mensagem ${msgId} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 7. TICKETS DE ATENDIMENTO DAS LOJAS CRUD
// ==============================================================================
app.get('/api/tickets', (req, res) => {
  try {
    const db = loadDb();
    let tickets = db.tickets || [];
    if (req.query.store_id) {
      tickets = tickets.filter(t => !t.store_id || t.store_id === req.query.store_id);
    }
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', (req, res) => {
  try {
    const db = loadDb();
    if (!db.tickets) db.tickets = [];
    const newTkt = {
      id: req.body.id || `tkt-${Date.now()}`,
      protocol: req.body.protocol || `PTC-${Date.now().toString().slice(-6)}`,
      status: 'open',
      priority: 'high',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...req.body,
    };
    db.tickets.unshift(newTkt);
    saveDb(db);
    res.json({ success: true, ticket: newTkt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tickets/:id', (req, res) => {
  try {
    const db = loadDb();
    if (!db.tickets) db.tickets = [];
    const idx = db.tickets.findIndex(t => t.id === req.params.id);
    if (idx >= 0) {
      db.tickets[idx] = { ...db.tickets[idx], ...req.body, updated_at: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, ticket: db.tickets[idx] });
    }
    res.status(404).json({ error: 'Ticket não encontrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tickets/:id', (req, res) => {
  try {
    const db = loadDb();
    if (db.tickets) {
      db.tickets = db.tickets.filter(t => t.id !== req.params.id);
      saveDb(db);
    }
    res.json({ success: true, message: `Ticket ${req.params.id} removido` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 8. CONSULTORIAS VIP & AGENDAMENTOS CRUD
// ==============================================================================
app.get('/api/consultations', (req, res) => {
  try {
    const db = loadDb();
    let list = db.appointments || [];
    if (req.query.store_id) {
      list = list.filter(a => !a.store_id || a.store_id === req.query.store_id);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/consultations', (req, res) => {
  try {
    const db = loadDb();
    if (!db.appointments) db.appointments = [];
    const newCons = {
      id: req.body.id || `cons-${Date.now()}`,
      store_id: req.body.store_id || 'store-001',
      store_name: req.body.store_name || 'Loja Matriz — Centro',
      client_name: req.body.client_name || 'Cliente',
      client_phone: req.body.client_phone || '',
      consultation_type: req.body.consultation_type || 'online_whatsapp',
      consultation_date: req.body.consultation_date || new Date().toISOString().split('T')[0],
      consultation_time: req.body.consultation_time || '14:00',
      status: req.body.status || 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...req.body,
    };
    db.appointments.unshift(newCons);
    saveDb(db);
    res.json({ success: true, consultation: newCons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/consultations/:id', (req, res) => {
  try {
    const db = loadDb();
    if (!db.appointments) db.appointments = [];
    const idx = db.appointments.findIndex(a => a.id === req.params.id);
    if (idx >= 0) {
      db.appointments[idx] = { ...db.appointments[idx], ...req.body, updated_at: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, consultation: db.appointments[idx] });
    }
    res.status(404).json({ error: 'Consultoria não encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/consultations/:id', (req, res) => {
  try {
    const db = loadDb();
    if (db.appointments) {
      db.appointments = db.appointments.filter(a => a.id !== req.params.id);
      saveDb(db);
    }
    res.json({ success: true, message: `Consultoria ${req.params.id} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias appointments
app.get('/api/appointments', (req, res) => res.redirect('/api/consultations'));
app.post('/api/appointments', (req, res) => res.redirect(307, '/api/consultations'));

// ==============================================================================
// 9. AGENDA SETTINGS & SERVIÇOS
// ==============================================================================
app.get('/api/agenda-settings', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.agendaSettings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agenda-settings', (req, res) => {
  try {
    const db = loadDb();
    db.agendaSettings = { ...(db.agendaSettings || {}), ...req.body, updated_at: new Date().toISOString() };
    saveDb(db);
    res.json({ success: true, agendaSettings: db.agendaSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 10. GESTÃO E SINCRONIZAÇÃO DINÂMICA DE FLUXOS NO BOT
// ==============================================================================
app.get('/api/flows', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.flows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flows/active/current', async (req, res) => {
  try {
    const db = loadDb();
    const { publishedFlow, nodes, edges } = await getActiveFlowAndGraph(db);
    res.json({
      activeFlow: publishedFlow,
      nodesCount: nodes ? nodes.length : 0,
      edgesCount: edges ? edges.length : 0,
      nodes: nodes || [],
      edges: edges || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flows/test-execution', async (req, res) => {
  try {
    const { phone, message, name } = req.body;
    const testPhone = String(phone || '558199999999').replace(/\D/g, '');
    const testName = name || 'Cliente Teste';
    const testText = message || 'oi';

    const replies = await executePublishedFlow(`${testPhone}@s.whatsapp.net`, testText, testName, testPhone);
    res.json({ success: true, input: testText, phone: testPhone, replies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/flows/:id', (req, res) => {
  try {
    const db = loadDb();
    const flow = (db.flows || []).find(f => f.id === req.params.id);
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });
    res.json(flow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flows', (req, res) => {
  try {
    const db = loadDb();
    if (!db.flows) db.flows = [];
    const flowData = req.body;
    if (!flowData || !flowData.id) {
      return res.status(400).json({ error: 'Dados do fluxo inválidos ou id ausente' });
    }

    if (flowData.status === 'published' || flowData.is_active === true) {
      flowData.status = 'published';
      flowData.is_active = true;
    }

    const idx = db.flows.findIndex(f => f.id === flowData.id);
    if (idx >= 0) {
      db.flows[idx] = { ...db.flows[idx], ...flowData, updated_at: new Date().toISOString() };
    } else {
      db.flows.unshift({ ...flowData, created_at: flowData.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });
    }

    saveDb(db);
    syncFlowToSupabase(flowData);
    console.log(`[Flows API] 💾 Fluxo salvo e sincronizado com Supabase: "${flowData.name}" (${flowData.id}) - Status: ${flowData.status}`);
    res.json({ success: true, flow: flowData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de sincronização forçada com Supabase em nuvem
app.post('/api/flows/sync-database', async (req, res) => {
  try {
    const db = loadDb();
    if (supabaseServer) {
      const [flowsRes, nodesRes, edgesRes] = await Promise.all([
        supabaseServer.from('flows').select('*'),
        supabaseServer.from('flow_nodes').select('*'),
        supabaseServer.from('flow_edges').select('*'),
      ]);

      if (Array.isArray(flowsRes.data)) {
        db.flows = flowsRes.data;
      }
      if (Array.isArray(nodesRes.data)) {
        if (!db.nodes) db.nodes = {};
        for (const n of nodesRes.data) {
          if (!db.nodes[n.flow_id]) db.nodes[n.flow_id] = [];
          const idx = db.nodes[n.flow_id].findIndex(x => x.id === n.id);
          const mappedNode = {
            id: n.id,
            flow_id: n.flow_id,
            type: n.type,
            position: n.position || { x: 0, y: 0 },
            data: n.data || { label: n.label, nodeType: n.type, config: {} },
          };
          if (idx >= 0) db.nodes[n.flow_id][idx] = mappedNode;
          else db.nodes[n.flow_id].push(mappedNode);
        }
      }
      if (Array.isArray(edgesRes.data)) {
        if (!db.edges) db.edges = {};
        for (const e of edgesRes.data) {
          if (!db.edges[e.flow_id]) db.edges[e.flow_id] = [];
          const idx = db.edges[e.flow_id].findIndex(x => x.id === e.id);
          const mappedEdge = {
            id: e.id,
            flow_id: e.flow_id,
            source: e.source || e.source_node_id,
            target: e.target || e.target_node_id,
            sourceHandle: e.source_handle || e.sourceHandle,
            targetHandle: e.target_handle || e.targetHandle,
            data: e.data || {},
          };
          if (idx >= 0) db.edges[e.flow_id][idx] = mappedEdge;
          else db.edges[e.flow_id].push(mappedEdge);
        }
      }
      saveDb(db);
      console.log(`[Flows Sync] 🔄 Sincronizado com Supabase: ${db.flows?.length || 0} fluxos atualizados.`);
    }
    res.json({ success: true, flowsCount: db.flows?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/flows/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (db.flows) {
      db.flows = db.flows.filter(f => f.id !== id);
    }
    if (db.nodes && db.nodes[id]) {
      delete db.nodes[id];
    }
    if (db.edges && db.edges[id]) {
      delete db.edges[id];
    }
    saveDb(db);
    deleteFlowFromSupabase(id);
    res.json({ success: true, message: `Fluxo ${id} removido e excluído do Supabase` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/flows/:id/toggle', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const flow = (db.flows || []).find(f => f.id === id);
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });

    const newActive = !flow.is_active || flow.status !== 'published';
    flow.status = newActive ? 'published' : 'draft';
    flow.is_active = newActive;
    flow.updated_at = new Date().toISOString();
    saveDb(db);
    syncFlowToSupabase(flow);
    console.log(`[Flows API] 🔄 Status alternado individualmente: "${flow.name}" (${id}) -> ${flow.status} (is_active: ${flow.is_active})`);
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/flows/:id/publish', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const flow = (db.flows || []).find(f => f.id === id);
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });

    flow.status = 'published';
    flow.is_active = true;
    flow.updated_at = new Date().toISOString();
    saveDb(db);
    syncFlowToSupabase(flow);
    console.log(`[Flows API] 🚀 Fluxo publicado no bot e sincronizado com Supabase: "${flow.name}" (${id})`);
    res.json({ success: true, message: `Fluxo ${flow.name} publicado com sucesso no bot WhatsApp`, flow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/sync-flows', (req, res) => {
  try {
    const db = loadDb();
    const { flows } = req.body;
    if (Array.isArray(flows) && flows.length > 0) {
      db.flows = flows;
      saveDb(db);
    }
    res.json({ success: true, count: db.flows?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flows/:id/graph', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const nodes = db.nodes?.[id] || [];
    const edges = db.edges?.[id] || [];
    res.json({ nodes, edges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flows/:id/graph', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const { nodes, edges } = req.body;

    if (!db.nodes) db.nodes = {};
    if (!db.edges) db.edges = {};

    if (Array.isArray(nodes)) {
      db.nodes[id] = nodes;
    }
    if (Array.isArray(edges)) {
      db.edges[id] = edges;
    }

    let targetFlow = null;
    if (db.flows) {
      targetFlow = db.flows.find(f => f.id === id);
      if (targetFlow && Array.isArray(nodes)) {
        targetFlow.node_count = nodes.length;
        targetFlow.updated_at = new Date().toISOString();
      }
    }

    saveDb(db);
    syncFlowGraphToSupabase(id, nodes, edges);
    if (targetFlow) syncFlowToSupabase(targetFlow);
    console.log(`[Flows API] 🎨 Grafo gravado e sincronizado com Supabase para "${id}": ${nodes?.length || 0} nós, ${edges?.length || 0} edges`);
    res.json({ success: true, id, nodesCount: nodes?.length || 0, edgesCount: edges?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 11. GESTÃO DE ACESSOS & USUÁRIOS
// ==============================================================================
app.get('/api/users', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.systemUsers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const db = loadDb();
    if (!db.systemUsers) db.systemUsers = [];
    const userData = req.body;
    const rawUsername = (userData.username || '').trim().toLowerCase();

    const idx = db.systemUsers.findIndex(u => u.id === userData.id || u.username?.toLowerCase() === rawUsername);
    const updatedUser = {
      id: userData.id || `user-${Date.now()}`,
      name: userData.name || rawUsername,
      username: rawUsername,
      password: userData.password || (idx >= 0 ? db.systemUsers[idx].password : '123456'),
      role: userData.role || 'attendant',
      store_id: userData.store_id || null,
      store_name: userData.store_name || (userData.store_id ? 'Filial Vinculada' : 'Toda a Rede (Global)'),
      status: userData.status || 'active',
      created_at: userData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...userData,
    };

    if (idx >= 0) {
      db.systemUsers[idx] = updatedUser;
    } else {
      db.systemUsers.push(updatedUser);
    }

    saveDb(db);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    if (db.systemUsers) {
      db.systemUsers = db.systemUsers.filter(u => u.id !== id && u.username !== id);
      saveDb(db);
    }
    res.json({ success: true, message: `Usuário ${id} removido` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/toggle', (req, res) => {
  try {
    const db = loadDb();
    const id = req.params.id;
    const user = (db.systemUsers || []).find(u => u.id === id || u.username === id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    user.status = user.status === 'active' ? 'inactive' : 'active';
    user.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = String(username || '').toLowerCase().trim();
    const cleanPass = String(password || '').trim();

    const db = loadDb();
    const users = db.systemUsers || [];
    const found = users.find(u => (u.username?.toLowerCase() === cleanUser) && (String(u.password) === cleanPass || String(u.pin) === cleanPass));
    
    // Master emergency logins
    if (found) {
      if (found.status === 'inactive') {
        return res.status(403).json({ success: false, error: 'Usuário inativo no momento.' });
      }
      return res.json({ success: true, user: found });
    }

    if ((cleanUser === 'admin' || cleanUser === 'ceo' || cleanUser === 'malaca') && (cleanPass === '1234' || cleanPass === '123456' || cleanPass === '199425')) {
      const userObj = { id: `user-${cleanUser}`, name: cleanUser.toUpperCase(), role: cleanUser === 'admin' ? 'admin' : 'ceo', username: cleanUser };
      return res.json({ success: true, user: userObj });
    }

    return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 12. ATENDENTES & RESPOSTAS RÁPIDAS
// ==============================================================================
app.get('/api/attendants', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.attendants || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendants', (req, res) => {
  try {
    const db = loadDb();
    if (!db.attendants) db.attendants = [];
    const attData = req.body;
    const newAtt = {
      id: attData.id || `att-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...attData,
    };
    const idx = db.attendants.findIndex(a => a.id === newAtt.id);
    if (idx >= 0) {
      db.attendants[idx] = { ...db.attendants[idx], ...newAtt };
    } else {
      db.attendants.push(newAtt);
    }
    saveDb(db);
    res.json({ success: true, attendant: newAtt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendants/:id', (req, res) => {
  try {
    const db = loadDb();
    if (db.attendants) {
      db.attendants = db.attendants.filter(a => a.id !== req.params.id);
      saveDb(db);
    }
    res.json({ success: true, message: `Atendente ${req.params.id} removido` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/canned-replies', (req, res) => {
  try {
    const db = loadDb();
    res.json(db.cannedReplies || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/canned-replies', (req, res) => {
  try {
    const db = loadDb();
    if (!db.cannedReplies) db.cannedReplies = [];
    const replyData = req.body;
    const newReply = {
      id: replyData.id || `canned-${Date.now()}`,
      ...replyData,
    };
    const idx = db.cannedReplies.findIndex(r => r.id === newReply.id);
    if (idx >= 0) {
      db.cannedReplies[idx] = { ...db.cannedReplies[idx], ...newReply };
    } else {
      db.cannedReplies.push(newReply);
    }
    saveDb(db);
    res.json({ success: true, cannedReply: newReply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/canned-replies/:id', (req, res) => {
  try {
    const db = loadDb();
    if (db.cannedReplies) {
      db.cannedReplies = db.cannedReplies.filter(r => r.id !== req.params.id);
      saveDb(db);
    }
    res.json({ success: true, message: `Resposta rápida ${req.params.id} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 13. VARIÁVEIS CUSTOMIZADAS
// ==============================================================================
app.get('/api/custom-variables', async (req, res) => {
  try {
    const db = loadDb();
    if (supabaseServer && (!db.customVariables || db.customVariables.length === 0)) {
      const { data } = await safeSupa(supabaseServer.from('bot_config').select('custom_variables').eq('id', 'default').maybeSingle());
      if (Array.isArray(data?.custom_variables) && data.custom_variables.length > 0) {
        db.customVariables = data.custom_variables;
        saveDb(db);
      }
    }
    res.json(db.customVariables || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-variables', (req, res) => {
  try {
    const db = loadDb();
    if (!db.customVariables) db.customVariables = [];
    const vData = req.body;
    const newV = {
      id: vData.id || `var-${Date.now()}`,
      ...vData,
    };
    const idx = db.customVariables.findIndex(item => item.id === newV.id || item.key === newV.key);
    if (idx >= 0) {
      db.customVariables[idx] = { ...db.customVariables[idx], ...newV };
    } else {
      db.customVariables.push(newV);
    }
    saveDb(db);
    syncCustomVariablesToSupabase(db.customVariables);
    res.json({ success: true, variable: newV });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/custom-variables/:id', (req, res) => {
  try {
    const db = loadDb();
    if (db.customVariables) {
      db.customVariables = db.customVariables.filter(v => v.id !== req.params.id && v.key !== req.params.id);
      saveDb(db);
      syncCustomVariablesToSupabase(db.customVariables);
    }
    res.json({ success: true, message: `Variável ${req.params.id} removida` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 14. ENVIO DE MENSAGENS WHATSAPP
// ==============================================================================
app.post('/api/send-message', async (req, res) => {
  const { phone, text, message, skipRecord, mediaUrl, mediaType, caption } = req.body;
  const bodyText = text || message;
  if (!phone || (!bodyText && !mediaUrl)) {
    return res.status(400).json({ success: false, error: 'phone e texto ou mídia são obrigatórios' });
  }

  const cleanPhone = String(phone).replace(/\D/g, '');
  const shouldSkipRecord = skipRecord !== undefined ? Boolean(skipRecord) : false;

  // 1. Tentar envio pela Meta WhatsApp Business Cloud API Oficial
  const metaConfig = getMetaConfig();
  if (metaConfig.isConfigured) {
    let replyPayload = bodyText;
    if (mediaUrl) {
      replyPayload = { type: 'media', mediaUrl, mediaType: mediaType || 'image', caption: caption || bodyText };
    }
    const metaRes = await sendMetaMessage(cleanPhone, replyPayload);
    if (metaRes.success) {
      if (!shouldSkipRecord) {
        await recordMessageLocallyAndSupabase(cleanPhone, 'Pitoco Atendente', 'outbound', bodyText || `[Mídia: ${mediaType || 'arquivo'}]`);
      }
      return res.json({ success: true, messageId: metaRes.messageId, status: 'sent', provider: 'meta_cloud_api' });
    }
  }

  // 2. Fallback para Baileys se conectado
  if (connectionStatus === 'connected') {
    const success = await sendWhatsAppMessage(`${cleanPhone}@s.whatsapp.net`, bodyText, null, shouldSkipRecord);
    if (success) {
      return res.json({ success: true, messageId: `msg-${Date.now()}`, status: 'sent', provider: 'baileys' });
    }
  }

  res.status(500).json({
    success: false,
    error: metaConfig.isConfigured
      ? 'Falha ao enviar mensagem pela Meta Cloud API. Verifique seu Access Token e Phone Number ID.'
      : 'WhatsApp desconectado. Configure o token da Meta Cloud API em Conexão WhatsApp.',
    provider: metaConfig.isConfigured ? 'meta_cloud_api' : 'none',
  });
});

// ==============================================================================
// 15. BACKUP, RESTAURAÇÃO E ESTATÍSTICAS DO BANCO CENTRAL
// ==============================================================================
app.get('/api/db/export', (req, res) => {
  try {
    const data = exportDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pitoco_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/import', (req, res) => {
  try {
    const imported = importDatabase(req.body);
    res.json({ success: true, stats: getDatabaseStats() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/stats', (req, res) => {
  try {
    res.json(getDatabaseStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/sync', (req, res) => {
  try {
    const current = loadDb();
    const incoming = req.body || {};
    const merged = {
      ...current,
      ...incoming,
      updated_at: new Date().toISOString(),
    };
    saveDb(merged);
    res.json({ success: true, message: 'Sincronização concluída com sucesso', stats: getDatabaseStats() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/supabase-sync', async (req, res) => {
  try {
    const report = await syncToSupabase();
    res.json({ success: true, message: 'Sincronização Supabase executada', report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// SPA Fallback: Qualquer rota web (exceto /api, /health, /webhook) serve o index.html compilado
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/webhook')) {
    return next();
  }
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({
    app: 'Pitoco de Gente WhatsApp Bot API',
    status: 'online',
    version: '2.0.0',
    whatsapp: connectionStatus,
  });
});

app.listen(PORT, HOST, async () => {
  console.log(`🚀 [Pitoco Server] Rodando em http://${HOST}:${PORT}`);

  const metaConfig = getMetaConfig();
  if (metaConfig.isConfigured) {
    console.log('🌐 [Pitoco Server] Meta WhatsApp Business Cloud API ativa!');
    testMetaConnection()
      .then((res) => {
        if (res.connected) {
          console.log(`✅ [Meta API] Conexão oficial validada com a Meta! Número: ${res.display_phone_number} (${res.verified_name || 'Pitoco de Gente'}) - Tier: ${res.messaging_limit}`);
        } else {
          console.warn(`⚠️ [Meta API] Credenciais da Meta configuradas, mas verificação falhou: ${res.error}`);
        }
      })
      .catch((err) => console.warn('[Meta API] Erro ao testar conexão:', err.message));
  } else {
    console.log('ℹ️ [Pitoco Server] Meta Cloud API aguardando credenciais. Acesse o painel em Conexão WhatsApp para configurar.');
    console.log('🤖 [Pitoco Server] Inicializando conexão WhatsApp Baileys automaticamente no boot...');
    startWhatsApp();
  }

  // Sincronização segura no startup: Carregar estado mais recente do Supabase (Cloud First)
  setTimeout(async () => {
    try {
      if (supabaseServer) {
        const [flowsRes, clientsRes, botRes, setRes] = await Promise.all([
          safeSupa(supabaseServer.from('flows').select('*')),
          safeSupa(supabaseServer.from('clients').select('*')),
          safeSupa(supabaseServer.from('bot_config').select('*').eq('id', 'default').maybeSingle()),
          safeSupa(supabaseServer.from('settings').select('*').eq('id', 'default').maybeSingle()),
        ]);
        const db = loadDb();
        if (Array.isArray(flowsRes.data)) {
          db.flows = flowsRes.data;
        }
        if (Array.isArray(clientsRes.data)) {
          const cloudMap = {};
          clientsRes.data.forEach(c => {
            const p = String(c.phone || '').replace(/\D/g, '');
            if (p) cloudMap[p] = c;
          });
          db.contacts = cloudMap;
        }
        if (botRes.data || setRes.data?.bot_profile) {
          const bData = botRes.data || {};
          const setProfile = setRes.data?.bot_profile || {};
          db.botProfile = {
            ...(db.botProfile || {}),
            ...setProfile,
            name: bData.name || bData.bot_name || setProfile.name || db.botProfile?.name || 'Pitoco Bot',
            company_name: bData.store_name || setProfile.company_name || db.botProfile?.company_name || 'Pitoco de Gente',
            tone: bData.tone || setProfile.tone || db.botProfile?.tone || 'Amigável e Acolhedor',
            avatar_url: bData.avatar_url || setProfile.avatar_url || db.botProfile?.avatar_url || '',
            support_phone: bData.support_phone || setProfile.support_phone || db.botProfile?.support_phone || '',
            support_email: bData.support_email || setProfile.support_email || db.botProfile?.support_email || '',
            business_hours: bData.business_hours || setProfile.business_hours || db.botProfile?.business_hours || '08:00 às 18:00',
            website_url: bData.website_url || setProfile.website_url || db.botProfile?.website_url || 'https://pitoco.malaca.com.br',
            company_address: bData.company_address || setProfile.company_address || db.botProfile?.company_address || '',
            pix_key: bData.pix_key || setProfile.pix_key || db.botProfile?.pix_key || '',
            pix_owner: bData.pix_owner || bData.pix_name || setProfile.pix_owner || db.botProfile?.pix_owner || '',
            notify_new_bookings: typeof bData.notify_new_bookings === 'boolean' ? bData.notify_new_bookings : (setProfile.notify_new_bookings ?? true),
            notify_phone: bData.notify_phone || setProfile.notify_phone || db.botProfile?.notify_phone || '',
            play_audio_alerts: typeof bData.play_audio_alerts === 'boolean' ? bData.play_audio_alerts : (setProfile.play_audio_alerts ?? true),
          };
        }
        if (setRes.data) {
          db.settings = { ...(db.settings || {}), ...setRes.data };
        }
        if (Array.isArray(botRes.data?.custom_variables) && botRes.data.custom_variables.length > 0) {
          db.customVariables = botRes.data.custom_variables;
        } else if (Array.isArray(setRes.data?.custom_variables) && setRes.data.custom_variables.length > 0) {
          db.customVariables = setRes.data.custom_variables;
        }
        saveDb(db);
        console.log(`[Startup Sync] ☁️ Sincronização inicial concluída com Supabase: ${db.flows?.length || 0} fluxos, ${Object.keys(db.contacts || {}).length} clientes, perfil do bot ("${db.botProfile?.name || 'Pitoco Bot'}") e ${db.customVariables?.length || 0} variáveis customizadas.`);
      }
    } catch (e) {
      console.warn('[Startup Sync] Aviso ao sincronizar com Supabase no início:', e.message);
    }
  }, 3000);
});
