import './websocketPolyfill.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
let createClient = null;
try {
  const mod = await import('@supabase/supabase-js');
  createClient = mod.createClient;
} catch (e) {}

const WebSocketClient = globalThis.WebSocket;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, 'flows_db.json');

import {
  initialStores,
  initialCategories,
  initialProducts,
  sampleFlows,
  initialFlowNodes,
  initialFlowEdges,
  initialAccessUsers,
  defaultBotProfile,
  initialSettings,
  initialAttendants,
  defaultCannedReplies,
  DEFAULT_AGENDA_SETTINGS,
  defaultCustomVariables,
  sampleContacts,
  sampleConversations,
  initialTickets
} from './defaultData.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://cbeiguyvoepbcafmxduy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWlndXl2b2VwYmNhZm14ZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzU5NzcsImV4cCI6MjEwNDMxMTk3N30.1XpWL6ns9NlPh4sQ3M8-OJTnKCPH-jf89iFspmBrKxM';

export const supabaseClient = (createClient && SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: WebSocketClient ? { transport: WebSocketClient } : undefined
    }) 
  : null;


// Helper: Resolver correspondência bidirecional entre LID (WhatsApp Privacy ID) e Telefone Real (ex: 558196138924)
export function resolveLinkedPhones(phone, db) {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!clean) return { primaryPhone: '', allPhones: [] };

  const phones = new Set([clean]);

  if (db?.conversations) {
    Object.values(db.conversations).forEach(conv => {
      if (!conv) return;
      const cPhone = String(conv.phone || '').replace(/\D/g, '');
      const cContactPhone = String(conv.contact_phone || '').replace(/\D/g, '');
      if (cPhone === clean && cContactPhone) phones.add(cContactPhone);
      if (cContactPhone === clean && cPhone) phones.add(cPhone);
    });
  }

  if (db?.contacts) {
    const list = Array.isArray(db.contacts) ? db.contacts : Object.values(db.contacts);
    list.forEach(c => {
      if (!c) return;
      const p = String(c.phone || '').replace(/\D/g, '');
      const realP = String(c.real_phone || c.phone_number || c.metadata?.real_phone || '').replace(/\D/g, '');
      if (p === clean && realP) phones.add(realP);
      if (realP === clean && p) phones.add(p);
    });
  }

  const allPhones = Array.from(phones);
  // Priorizar telefone móvel padrão (10 a 13 dígitos) sobre o LID (15+ dígitos)
  let primaryPhone = clean;
  const standardPhone = allPhones.find(p => p.length >= 10 && p.length <= 13);
  if (standardPhone) {
    primaryPhone = standardPhone;
  }

  return { primaryPhone, allPhones };
}

// Async Supabase Sync Helpers
export async function syncContactToSupabase(contact) {
  if (!supabaseClient || !contact) return;
  try {
    const cleanPhone = String(contact.phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;

    // 1. Tabela contacts
    const payload = {
      id: contact.id || `contact-${cleanPhone}`,
      name: contact.name || 'Cliente WhatsApp',
      phone: cleanPhone,
      email: contact.email || null,
      status: contact.status || 'active',
      is_registered: contact.is_registered !== false,
      profile_picture_url: contact.profile_picture_url || null,
      tags: contact.tags || ['Cliente'],
      metadata: contact.custom_fields || contact.metadata || {},
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabaseClient.from('contacts').upsert(payload, { onConflict: 'phone' });

    // 2. Tabela clients (Tabela mestre utilizada pelo CRM e tela de Clientes)
    const clientPayload = {
      id: contact.id || `client-${cleanPhone}`,
      name: contact.name || 'Cliente WhatsApp',
      phone: cleanPhone,
      email: contact.email || null,
      store_id: contact.store_id || null,
      store_name: contact.store_name || null,
      notes: contact.notes || null,
      baby_name: contact.baby_name || null,
      due_date: contact.due_date || null,
      tags: contact.tags || ['Cliente WhatsApp'],
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabaseClient.from('clients').upsert(clientPayload, { onConflict: 'phone' });
  } catch (err) {
    // Non-blocking
  }
}

export async function syncConversationToSupabase(conv) {
  if (!supabaseClient || !conv) return;
  try {
    const cleanPhone = String(conv.contact_phone || conv.phone || '').replace(/\D/g, '');
    const payload = {
      id: conv.id || `conv-${cleanPhone}`,
      contact_id: conv.contact_id || `contact-${cleanPhone}`,
      phone: cleanPhone,
      contact_name: conv.contact_name || 'Cliente',
      last_message: typeof conv.last_message === 'string' ? conv.last_message : (conv.last_message?.body || 'Mensagem'),
      last_message_at: conv.last_message_at || new Date().toISOString(),
      status: conv.status || 'bot',
      unread_count: conv.unread_count || 0,
      tags: conv.tags || ['WhatsApp'],
      updated_at: new Date().toISOString(),
    };
    await supabaseClient.from('conversations').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    // Non-blocking
  }
}

export async function syncMessageToSupabase(msg, phone) {
  if (!supabaseClient || !msg) return;
  try {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const payload = {
      id: msg.id,
      conversation_id: msg.conversation_id || `conv-${cleanPhone}`,
      contact_id: `contact-${cleanPhone}`,
      phone: cleanPhone,
      sender: msg.direction === 'inbound' ? 'user' : (msg.sender || 'bot'),
      text: typeof msg.content === 'string' ? msg.content : (msg.content?.body || 'Mensagem'),
      type: msg.message_type || 'text',
      status: msg.status || 'delivered',
      timestamp: msg.created_at || new Date().toISOString(),
      created_at: msg.created_at || new Date().toISOString(),
    };
    await supabaseClient.from('messages').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    // Non-blocking
  }
}

export async function syncAppointmentToSupabase(apt) {
  if (!supabaseClient || !apt) return;
  try {
    const cleanPhone = String(apt.contact_phone || apt.phone || '').replace(/\D/g, '');
    const payload = {
      id: apt.id || `apt-${Date.now()}`,
      contact_id: apt.contact_id || `contact-${cleanPhone}`,
      contact_name: apt.contact_name || 'Cliente',
      phone: cleanPhone,
      service_name: apt.service_name || 'Consultoria VIP de Enxoval',
      professional_name: apt.professional_name || 'Sofia',
      date: apt.appointment_date || apt.date || new Date().toISOString().split('T')[0],
      time: apt.appointment_time || apt.time || '08:00',
      duration_minutes: apt.duration_minutes || 30,
      price: apt.price || 0,
      status: apt.status || 'confirmed',
      notes: apt.notes || null,
      updated_at: new Date().toISOString(),
    };
    await supabaseClient.from('appointments').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    // Non-blocking
  }
}




function migrateLidContacts(db) {
  if (!db || !db.contacts) return;
  const authDir = path.resolve(__dirname, 'whatsapp_auth');

  for (const key of Object.keys(db.contacts)) {
    if (key.length >= 14 && (key.startsWith('168') || key.startsWith('219'))) {
      const reverseFile = path.resolve(authDir, `lid-mapping-${key}_reverse.json`);
      if (fs.existsSync(reverseFile)) {
        try {
          const realPhone = String(JSON.parse(fs.readFileSync(reverseFile, 'utf8'))).replace(/\D/g, '');
          if (realPhone && realPhone.length >= 8) {
            const oldContact = db.contacts[key];
            db.contacts[realPhone] = {
              ...oldContact,
              id: `contact-${realPhone}`,
              phone: realPhone,
              updated_at: new Date().toISOString(),
            };
            delete db.contacts[key];

            if (db.conversations && db.conversations[`conv-${key}`]) {
              const oldConv = db.conversations[`conv-${key}`];
              db.conversations[`conv-${realPhone}`] = {
                ...oldConv,
                id: `conv-${realPhone}`,
                contact_id: `contact-${realPhone}`,
                contact_phone: realPhone,
              };
              delete db.conversations[`conv-${key}`];
            }

            if (db.messages && db.messages[`conv-${key}`]) {
              db.messages[`conv-${realPhone}`] = db.messages[`conv-${key}`].map((m) => ({
                ...m,
                conversation_id: `conv-${realPhone}`,
              }));
              delete db.messages[`conv-${key}`];
            }
            console.log(`[FlowRunner] 🔄 Contato migrado de LID ${key} para o número real: ${realPhone}`);
          }
        } catch (e) {}
      }
    }
  }
}

const DATA_DIR = path.resolve(__dirname, 'data');
const PRIMARY_DB_PATH = path.resolve(DATA_DIR, 'pitoco_database.json');
const AUTH_DIR = path.resolve(__dirname, 'whatsapp_auth');
const MASTER_BACKUP_PATH = path.resolve(AUTH_DIR, 'database_master_backup.json');
const LEGACY_BACKUP_PATH = path.resolve(AUTH_DIR, 'flows_db_backup.json');
const LEGACY_DB_PATH = path.resolve(__dirname, 'flows_db.json');

export const DEFAULT_SYSTEM_USERS = initialAccessUsers;

function readJsonFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn(`[DB Engine] Aviso ao ler ${filePath}:`, err.message);
  }
  return null;
}

export function loadDb() {
  const primaryDb = readJsonFileSafe(PRIMARY_DB_PATH);
  const masterBackup = readJsonFileSafe(MASTER_BACKUP_PATH);
  const legacyBackup = readJsonFileSafe(LEGACY_BACKUP_PATH);
  const legacyDb = readJsonFileSafe(LEGACY_DB_PATH);

  // Fonte principal com prioridade de integridade
  const mainSource = primaryDb || masterBackup || legacyBackup || legacyDb;
  const isBrandNew = !mainSource;

  const result = {
    stores: Array.isArray(mainSource?.stores) && mainSource.stores.length > 0 ? mainSource.stores : (isBrandNew ? [...initialStores] : (mainSource?.stores || [...initialStores])),
    categories: Array.isArray(mainSource?.categories) && mainSource.categories.length > 0 ? mainSource.categories : (isBrandNew ? [...initialCategories] : (mainSource?.categories || [...initialCategories])),
    products: Array.isArray(mainSource?.products) && mainSource.products.length > 0 ? mainSource.products : (isBrandNew ? [...initialProducts] : (mainSource?.products || [...initialProducts])),
    flows: Array.isArray(mainSource?.flows) ? mainSource.flows : (isBrandNew ? [...sampleFlows] : []),
    nodes: mainSource?.nodes && typeof mainSource.nodes === 'object' ? { ...mainSource.nodes } : (isBrandNew ? { 'flow-pitoco-001': initialFlowNodes } : {}),
    edges: mainSource?.edges && typeof mainSource.edges === 'object' ? { ...mainSource.edges } : (isBrandNew ? { 'flow-pitoco-001': initialFlowEdges } : {}),
    contacts: mainSource?.contacts && typeof mainSource.contacts === 'object' ? { ...mainSource.contacts } : {},
    conversations: mainSource?.conversations && typeof mainSource.conversations === 'object' ? { ...mainSource.conversations } : {},
    messages: mainSource?.messages && typeof mainSource.messages === 'object' ? { ...mainSource.messages } : {},
    tickets: Array.isArray(mainSource?.tickets) ? mainSource.tickets : (isBrandNew ? [...initialTickets] : []),
    appointments: Array.isArray(mainSource?.appointments) ? mainSource.appointments : [],
    agendaSettings: mainSource?.agendaSettings || DEFAULT_AGENDA_SETTINGS,
    systemUsers: mainSource?.systemUsers || DEFAULT_SYSTEM_USERS,
    attendants: mainSource?.attendants || initialAttendants,
    cannedReplies: mainSource?.cannedReplies || defaultCannedReplies,
    botProfile: mainSource?.botProfile ? { ...defaultBotProfile, ...mainSource.botProfile } : defaultBotProfile,
    settings: mainSource?.settings ? { ...initialSettings, ...mainSource.settings } : initialSettings,
    customVariables: mainSource?.customVariables || defaultCustomVariables,
    auditLogs: Array.isArray(mainSource?.auditLogs) ? mainSource.auditLogs : [],
    sessions: mainSource?.sessions || {},
    rolePermissions: mainSource?.rolePermissions || {},
  };

  migrateLidContacts(result);
  return result;
}

export function saveDb(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const payload = JSON.stringify(data, null, 2);

    // 1. Arquivo principal no data/
    fs.writeFileSync(PRIMARY_DB_PATH, payload, 'utf-8');

    // 2. Master Backup dentro de whatsapp_auth (imune a commits/deploys na Discloud)
    fs.writeFileSync(MASTER_BACKUP_PATH, payload, 'utf-8');
    fs.writeFileSync(LEGACY_BACKUP_PATH, payload, 'utf-8');

    // 3. Fallback legado para compatibilidade com rotinas antigas
    fs.writeFileSync(LEGACY_DB_PATH, payload, 'utf-8');

    console.log(`[DB Engine] 💾 Banco salvo com sucesso (${data.stores?.length || 0} lojas, ${data.products?.length || 0} produtos, ${data.flows?.length || 0} fluxos)`);
  } catch (err) {
    console.error('[DB Engine] ❌ Erro ao salvar banco persistente:', err);
  }
}

export function exportDatabase() {
  return loadDb();
}

export function importDatabase(incomingData) {
  if (!incomingData || typeof incomingData !== 'object') {
    throw new Error('Dados para importação inválidos');
  }
  const current = loadDb();
  const merged = {
    ...current,
    ...incomingData,
    updated_at: new Date().toISOString(),
  };
  saveDb(merged);
  return merged;
}

export function getDatabaseStats() {
  const db = loadDb();
  return {
    storesCount: db.stores?.length || 0,
    categoriesCount: db.categories?.length || 0,
    productsCount: db.products?.length || 0,
    flowsCount: db.flows?.length || 0,
    contactsCount: Object.keys(db.contacts || {}).length,
    conversationsCount: Object.keys(db.conversations || {}).length,
    ticketsCount: db.tickets?.length || 0,
    appointmentsCount: db.appointments?.length || 0,
    usersCount: db.systemUsers?.length || 0,
    updatedAt: new Date().toISOString(),
  };
}


// Generate available time slots for a given date based on Agenda Settings and Booked Appointments
// Generate available time slots for a given date based on Agenda Settings and Booked Appointments
// Supports multi-slot services, ensuring all consecutive slots required by the service are joined as 1.
export function getAvailableSlots(dateStr, db, requiredDuration = null) {
  const settings = db.agendaSettings || DEFAULT_AGENDA_SETTINGS;

  const targetDate = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = String(targetDate.getDay());

  const dayConfig = (settings.day_schedules && settings.day_schedules[dayOfWeek])
    ? settings.day_schedules[dayOfWeek]
    : {
        enabled: settings.business_days ? settings.business_days.includes(dayOfWeek) : true,
        start_time: settings.start_time || '08:00',
        end_time: settings.end_time || '19:00',
        has_break: Boolean(settings.break_start_time && settings.break_end_time),
        break_start_time: settings.break_start_time || '12:00',
        break_end_time: settings.break_end_time || '13:00',
      };

  if (!dayConfig.enabled) {
    return [];
  }

  const [startHour, startMin] = (dayConfig.start_time || settings.start_time || '08:00').split(':').map(Number);
  const [endHour, endMin] = (dayConfig.end_time || settings.end_time || '19:00').split(':').map(Number);
  const baseSlotDuration = settings.slot_duration_minutes || 30;
  const neededDuration = Number(requiredDuration) || baseSlotDuration;

  const hasBreak = dayConfig.has_break !== false;
  const breakStart = dayConfig.break_start_time || settings.break_start_time || '12:00';
  const breakEnd = dayConfig.break_end_time || settings.break_end_time || '13:00';
  const maxChairs = Math.max(1, Number(settings.simultaneous_barbers) || 1);

  const bookedRanges = (db.appointments || [])
    .filter((a) => a.appointment_date === dateStr && a.status !== 'cancelled' && a.status !== 'no_show')
    .map((a) => {
      const sHour = parseInt(a.appointment_time.split(':')[0], 10) || 0;
      const sMin = parseInt(a.appointment_time.split(':')[1] || '0', 10) || 0;
      const srvName = a.service_name || '';
      const srv = (settings.services || []).find(
        (s) =>
          s.name?.trim().toLowerCase() === srvName.trim().toLowerCase() ||
          srvName.toLowerCase().includes(s.name?.toLowerCase()) ||
          s.name?.toLowerCase().includes(srvName.toLowerCase())
      );
      const srvDuration = Number(a.duration_minutes) || srv?.duration_minutes || baseSlotDuration;
      const startM = sHour * 60 + sMin;
      const endM = startM + srvDuration;
      return { startM, endM };
    });

  const slots = [];
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const breakStartMin = parseInt(breakStart.split(':')[0], 10) * 60 + parseInt(breakStart.split(':')[1] || '0', 10);
  const breakEndMin = parseInt(breakEnd.split(':')[0], 10) * 60 + parseInt(breakEnd.split(':')[1] || '0', 10);

  while (currentMinutes + neededDuration <= endMinutes) {
    const slotStart = currentMinutes;
    const slotEnd = currentMinutes + neededDuration;

    // Check if slot collides with lunch/break interval
    const overlapsBreak = hasBreak && (slotStart < breakEndMin && slotEnd > breakStartMin);

    // Check if overlapping with existing appointments exceeding simultaneous capacity
    const overlappingCount = bookedRanges.filter((r) => slotStart < r.endM && slotEnd > r.startM).length;
    const isOverlapping = overlapsBreak || (overlappingCount >= maxChairs);

    if (!isOverlapping) {
      const h = Math.floor(slotStart / 60);
      const m = slotStart % 60;
      const timeFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(timeFormatted);
    }

    currentMinutes += baseSlotDuration;
  }

  // If requesting today, only return slots with at least 1 hour (60 min) advance notice
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dateStr === todayStr) {
    const minM = now.getHours() * 60 + now.getMinutes() + 60;
    return slots.filter((s) => {
      const [sh, sm] = s.split(':').map(Number);
      return (sh * 60 + sm) >= minM;
    });
  }

  return slots;
}

export function isSlotBooked(dateStr, timeStr, durationMinutes = 30, db) {
  if (!db || !db.appointments) return false;
  const sHour = parseInt(timeStr.split(':')[0], 10) || 0;
  const sMin = parseInt(timeStr.split(':')[1] || '0', 10) || 0;
  const targetStart = sHour * 60 + sMin;
  const targetEnd = targetStart + durationMinutes;

  return db.appointments.some((a) => {
    if (a.appointment_date !== dateStr) return false;
    if (a.status === 'cancelled' || a.status === 'no_show') return false;

    const aHour = parseInt(a.appointment_time.split(':')[0], 10) || 0;
    const aMin = parseInt(a.appointment_time.split(':')[1] || '0', 10) || 0;
    const aDur = Number(a.duration_minutes) || 30;
    const aStart = aHour * 60 + aMin;
    const aEnd = aStart + aDur;

    return targetStart < aEnd && targetEnd > aStart;
  });
}

export function getNextAvailableSlot(dateStr, requestedTime, db, duration = 30) {
  const [rh, rm] = (requestedTime || '09:00').split(':').map(Number);
  const reqMin = (rh || 0) * 60 + (rm || 0);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // Search from requested date up to 14 days ahead
  const [startYear, startMonth, startDay] = (dateStr || todayStr).split('-').map(Number);
  const baseDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDate = new Date(baseDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const curDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    const slots = getAvailableSlots(curDateStr, db, duration);
    if (!slots || slots.length === 0) continue;

    const isCheckingToday = curDateStr === todayStr;
    const validSlots = slots.filter((slot) => {
      const timeStr = typeof slot === 'string' ? slot : slot.time;
      if (!isCheckingToday) return true;
      const [sh, sm] = timeStr.split(':').map(Number);
      return (sh || 0) * 60 + (sm || 0) > nowMin + 5;
    });

    if (validSlots.length === 0) continue;

    let chosenSlot = null;

    if (dayOffset === 0) {
      const laterSlots = validSlots.filter((slot) => {
        const timeStr = typeof slot === 'string' ? slot : slot.time;
        const [sh, sm] = timeStr.split(':').map(Number);
        return (sh || 0) * 60 + (sm || 0) > reqMin;
      });

      if (laterSlots.length > 0) {
        const slot = laterSlots[0];
        chosenSlot = typeof slot === 'string' ? slot : slot.time;
      } else {
        const sorted = [...validSlots].sort((a, b) => {
          const tA = typeof a === 'string' ? a : a.time;
          const tB = typeof b === 'string' ? b : b.time;
          const [ah, am] = tA.split(':').map(Number);
          const [bh, bm] = tB.split(':').map(Number);
          const distA = Math.abs((ah * 60 + am) - reqMin);
          const distB = Math.abs((bh * 60 + bm) - reqMin);
          return distA - distB;
        });
        const slot = sorted[0];
        chosenSlot = typeof slot === 'string' ? slot : slot.time;
      }
    } else {
      const sorted = [...validSlots].sort((a, b) => {
        const tA = typeof a === 'string' ? a : a.time;
        const tB = typeof b === 'string' ? b : b.time;
        const [ah, am] = tA.split(':').map(Number);
        const [bh, bm] = tB.split(':').map(Number);
        const distA = Math.abs((ah * 60 + am) - reqMin);
        const distB = Math.abs((bh * 60 + bm) - reqMin);
        if (distA === distB) {
          return (ah * 60 + am) - (bh * 60 + bm);
        }
        return distA - distB;
      });
      const slot = sorted[0];
      chosenSlot = typeof slot === 'string' ? slot : slot.time;
    }

    if (chosenSlot) {
      const d = checkDate.getDate();
      const m = checkDate.getMonth() + 1;
      const y = checkDate.getFullYear();
      const dayOfWeek = dayNames[checkDate.getDay()];
      const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      const isSameDate = curDateStr === dateStr;
      const isToday = curDateStr === todayStr;

      const displayFull = isToday
        ? `Hoje (${dayOfWeek}, ${formattedDate}) às ${chosenSlot}`
        : `${dayOfWeek} (${formattedDate}) às ${chosenSlot}`;

      const displayShort = isSameDate
        ? `${chosenSlot}`
        : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${chosenSlot}`;

      return {
        date: curDateStr,
        time: chosenSlot,
        formattedDate,
        dayOfWeek,
        displayFull,
        displayShort,
        isSameDate,
        toString() { return displayFull; }
      };
    }
  }

  return null;
}

// Remove duplicate numbers, emojis and prefixes from button/option texts
export function cleanButtonTitle(title) {
  let res = String(title || '').trim();
  let prev = '';
  while (res !== prev) {
    prev = res;
    res = res
      .replace(/^[0-9]+[️⃣\ufe0f\u20e3]+/g, '')
      .replace(/^([1-9]|10)️⃣\s*/g, '')
      .replace(/^[0-9]+[\.\-\)\:\s]+/g, '')
      .replace(/^\[[0-9]+\]\s*/g, '')
      .replace(/^\([0-9]+\)\s*/g, '')
      .replace(/^[0-9]+\s+/g, '')
      .trim();
  }
  return res || String(title || '').trim();
}

// Substitute template variables {{var_name}}
export function replaceVars(text, vars = {}, botProfile = {}, customVariables = []) {
  if (!text) return '';
  let res = text;

  res = res.replace(/\{\{bot_nome\}\}/gi, botProfile.name || 'Pitoco Bot');
  res = res.replace(/\{\{empresa\}\}/gi, botProfile.company_name || 'Pitoco de Gente');
  res = res.replace(/\{\{bot_genero\}\}/gi, botProfile.gender === 'female' ? 'Feminino' : 'Masculino');
  res = res.replace(/\{\{bot_tom\}\}/gi, botProfile.tone || 'Carinhoso, Acolhedor e Profissional');
  res = res.replace(/\{\{suporte_telefone\}\}/gi, botProfile.support_phone || '81996138924');
  res = res.replace(/\{\{suporte_email\}\}/gi, botProfile.support_email || 'contato@pitoco.malaca.com.br');
  res = res.replace(/\{\{horario_atendimento\}\}/gi, botProfile.business_hours || '08:00 às 19:00');
  res = res.replace(/\{\{site_empresa\}\}/gi, botProfile.website_url || 'https://pitoco.malaca.com.br');
  res = res.replace(/\{\{mensagem_boas_vindas\}\}/gi, botProfile.welcome_message || 'Olá! Seja bem-vindo(a) à Pitoco de Gente - Roupas de Bebê e Enxovais.');

  // Custom variables dynamically substituted from database / botProfile
  const allCustom = [
    ...(Array.isArray(customVariables) ? customVariables : []),
    ...(Array.isArray(botProfile.custom_variables) ? botProfile.custom_variables : [])
  ];
  allCustom.forEach((cv) => {
    if (cv && cv.name) {
      const rawKey = String(cv.name).replace(/^\{\{|\}\}$/g, '').trim();
      if (rawKey) {
        const regex = new RegExp(`\\{\\{${rawKey}\\}\\}`, 'gi');
        res = res.replace(regex, String(cv.value ?? ''));
      }
    }
  });

  Object.keys(vars).forEach((key) => {
    const cleanKey = key.replace(/^\{+|\}+$/g, '').trim();
    if (!cleanKey) return;
    const val = vars[key];
    const regex = new RegExp(`\\{\\{${cleanKey}\\}\\}`, 'gi');
    res = res.replace(regex, String(val ?? ''));
  });

  return res;
}

// Intelligent executor for Variable assignments in backend flow runner
export function executeVariableAssignment(assignment, variables, contact = {}, botProfile = {}) {
  const varName = assignment?.varName ? String(assignment.varName).trim() : '';
  if (!varName) return;

  const op = assignment.operation || 'set_value';

  switch (op) {
    case 'set_value': {
      const rawVal = assignment.value !== undefined ? assignment.value : (assignment.varValue ?? '');
      variables[varName] = replaceVars(String(rawVal), variables, botProfile);
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
        const full = contact?.name || contact?.whatsapp_pushname || contact?.phone || 'Cliente';
        variables[varName] = full.trim().split(/\s+/)[0] || full;
      } else if (field === 'name') {
        variables[varName] = contact?.name || contact?.whatsapp_pushname || 'Cliente';
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

// Record an incoming or outgoing message into real database
export function recordRealMessage(phone, senderName, direction, content, explicitTags = null, profilePicUrl = null) {
  const db = loadDb();
  const cleanPhone = phone.replace(/\D/g, '');
  const convId = `conv-${cleanPhone}`;
  const now = new Date().toISOString();

  // 1. Upsert Contact
  if (!db.contacts) db.contacts = {};
  const existingContact = db.contacts[cleanPhone] || {
    id: `contact-${cleanPhone}`,
    phone: cleanPhone,
    name: (senderName && senderName !== 'Cliente') ? senderName : 'Cliente WhatsApp',
    whatsapp_pushname: senderName || undefined,
    profile_picture_url: profilePicUrl || undefined,
    status: 'lead',
    tags: explicitTags || ['Lead'],
    is_registered: false,
    metadata: {},
    created_at: now,
  };

  if (senderName && senderName !== 'Cliente') {
    existingContact.whatsapp_pushname = senderName;
    if (!existingContact.name || existingContact.name === 'Cliente WhatsApp' || existingContact.name === 'Cliente') {
      existingContact.name = senderName;
    }
  }
  if (profilePicUrl && !existingContact.profile_picture_url) {
    existingContact.profile_picture_url = profilePicUrl;
  }
  if (explicitTags && Array.isArray(explicitTags)) {
    existingContact.tags = explicitTags;
  }

  existingContact.updated_at = now;
  db.contacts[cleanPhone] = existingContact;

  // 2. Upsert Conversation
  if (!db.conversations) db.conversations = {};
  const prevConv = db.conversations[convId] || {};
  const existingConv = {
    ...prevConv,
    id: convId,
    contact_id: existingContact.id,
    contact_name: existingContact.name || prevConv.contact_name || 'Cliente WhatsApp',
    contact_phone: cleanPhone,
    status: prevConv.status || 'bot',
    assigned_to: prevConv.assigned_to || undefined,
    assigned_attendant_name: prevConv.assigned_attendant_name || undefined,
    assigned_attendant_id: prevConv.assigned_attendant_id || undefined,
    store_id: prevConv.store_id || undefined,
    store_name: prevConv.store_name || 'Pitoco de Gente',
    sector: prevConv.sector || undefined,
    started_at: prevConv.started_at || now,
    unread_count: Number(prevConv.unread_count || 0),
    created_at: prevConv.created_at || now,
    last_message: typeof content === 'string' ? content : content.body || 'Mensagem Interativa',
    last_message_at: now,
    updated_at: now,
  };
  db.conversations[convId] = existingConv;

  // 3. Append to Messages
  if (!db.messages) db.messages = {};
  if (!db.messages[convId]) db.messages[convId] = [];
  const msgObj = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    conversation_id: convId,
    direction: direction,
    message_type: typeof content === 'string' ? 'text' : 'button',
    content: typeof content === 'string' ? content : content.body || 'Opções Interativas',
    status: 'delivered',
    created_at: now,
  };
  db.messages[convId].push(msgObj);

  saveDb(db);

  // Real-time sync to Supabase Database
  syncContactToSupabase(existingContact);
  syncConversationToSupabase(existingConv);
  syncMessageToSupabase(msgObj, cleanPhone);

  recordLiveLog(
    direction === 'inbound' ? 'message_inbound' : 'message_outbound',
    direction === 'inbound' ? `Mensagem de ${senderName}` : `Resposta para ${senderName}`,
    typeof content === 'string' ? (content.length > 90 ? content.substring(0, 90) + '...' : content) : 'Mensagem Interativa',
    cleanPhone,
    senderName,
    { direction, messageId: msgObj.id }
  );

  return { contact: existingContact, conversation: existingConv, message: msgObj };
}

export function getLiveConversations() {
  const db = loadDb();
  const convs = Object.values(db.conversations || {});
  convs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  return convs;
}

export function getLiveMessages(convId) {
  const db = loadDb();
  const cleanPhone = (convId || '').replace('conv-', '').replace(/\D/g, '');
  return db.messages?.[convId] || db.messages?.[`conv-${cleanPhone}`] || db.messages?.[cleanPhone] || [];
}

export function clearLiveMessages(convId) {
  const db = loadDb();
  const cleanPhone = (convId || '').replace('conv-', '').replace(/\D/g, '');
  if (db.messages) {
    delete db.messages[convId];
    if (cleanPhone) {
      delete db.messages[`conv-${cleanPhone}`];
      delete db.messages[cleanPhone];
    }
  }
  const convKey = db.conversations?.[convId] ? convId : (db.conversations?.[`conv-${cleanPhone}`] ? `conv-${cleanPhone}` : null);
  if (convKey && db.conversations[convKey]) {
    db.conversations[convKey].last_message = '';
    db.conversations[convKey].updated_at = new Date().toISOString();
  }
  saveDb(db);
  return true;
}

export function deleteLiveMessage(convId, messageId) {
  const db = loadDb();
  const cleanPhone = (convId || '').replace('conv-', '').replace(/\D/g, '');
  const targets = [convId, `conv-${cleanPhone}`, cleanPhone].filter(Boolean);

  let deleted = false;
  if (db.messages) {
    for (const key of Object.keys(db.messages)) {
      if (!convId || targets.includes(key)) {
        const initialLen = db.messages[key].length;
        db.messages[key] = db.messages[key].filter(m => m.id !== messageId);
        if (db.messages[key].length < initialLen) {
          deleted = true;
        }
      }
    }
  }
  if (deleted) {
    saveDb(db);
  }
  return deleted;
}

// 7. Audit & Event Logs System
export function recordLiveLog(type, title, description, contactPhone = null, contactName = null, details = null) {
  try {
    const db = loadDb();
    if (!db.logs) db.logs = [];

    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type, // 'appointment_created' | 'appointment_status' | 'bot_flow' | 'message_inbound' | 'message_outbound' | 'system'
      title,
      description,
      contact_phone: contactPhone || '',
      contact_name: contactName || '',
      details: details || {},
      created_at: new Date().toISOString(),
    };

    db.logs.unshift(newLog);
    if (db.logs.length > 500) {
      db.logs = db.logs.slice(0, 500);
    }
    saveDb(db);

    if (supabaseClient) {
      Promise.resolve(supabaseClient.from('audit_logs').insert(newLog)).catch(() => {});
    }

    return newLog;
  } catch (e) {
    console.warn('[FlowRunner] Erro ao registrar log:', e?.message || e);
    return null;
  }
}

export function getLiveLogs() {
  const db = loadDb();
  let logs = db.logs || [];

  if (logs.length === 0) {
    const synthesized = [];
    (db.appointments || []).forEach((apt) => {
      synthesized.push({
        id: `synth-apt-${apt.id}`,
        type: apt.status === 'completed' || apt.status === 'in_progress' ? 'appointment_status' : 'appointment_created',
        title: `Agendamento: ${apt.service_name || 'Serviço'}`,
        description: `Cliente ${apt.contact_name || apt.contact_phone} para ${apt.appointment_date} às ${apt.appointment_time} (Status: ${apt.status})`,
        contact_phone: apt.contact_phone,
        contact_name: apt.contact_name,
        details: apt,
        created_at: apt.created_at || new Date().toISOString(),
      });
    });

    Object.keys(db.messages || {}).forEach((key) => {
      const msgs = db.messages[key] || [];
      const recent = msgs.slice(-5);
      recent.forEach((m) => {
        synthesized.push({
          id: `synth-msg-${m.id}`,
          type: m.direction === 'inbound' ? 'message_inbound' : 'message_outbound',
          title: m.direction === 'inbound' ? 'Mensagem Recebida do Cliente' : 'Resposta Enviada pelo WhatsApp',
          description: m.content ? (m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content) : 'Mídia / Interativa',
          contact_phone: m.sender_phone || key,
          contact_name: m.sender_name || 'Cliente',
          details: { messageId: m.id, status: m.status },
          created_at: m.created_at || m.timestamp || new Date().toISOString(),
        });
      });
    });

    synthesized.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return synthesized.slice(0, 200);
  }

  return logs;
}

export function clearLiveLogs() {
  const db = loadDb();
  db.logs = [];
  saveDb(db);
  return true;
}

export function getLiveContacts() {
  const db = loadDb();
  const contacts = Object.values(db.contacts || {});
  contacts.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  return contacts;
}

// Function to find if a contact is already registered (in Supabase or Local DB)
export async function findRegisteredContact(cleanPhone, senderName, db, checkCriteria = 'crm_or_name') {
  const digitsOnly = (cleanPhone || '').replace(/\D/g, '');
  if (!digitsOnly) return { isRegistered: false, contact: null };

  // Generate phone variations: with 55, without 55, with/without 9th digit
  const variations = new Set();
  variations.add(digitsOnly);

  let withoutDdi = digitsOnly;
  if (digitsOnly.startsWith('55') && digitsOnly.length >= 12) {
    withoutDdi = digitsOnly.substring(2);
    variations.add(withoutDdi);
  } else if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    variations.add(`55${digitsOnly}`);
  }

  // 9th digit variations for Brazilian numbers (e.g. 81 99613-8924 vs 81 9613-8924)
  if (withoutDdi.length === 11 && withoutDdi[2] === '9') {
    const without9 = withoutDdi.substring(0, 2) + withoutDdi.substring(3);
    variations.add(without9);
    variations.add(`55${without9}`);
  } else if (withoutDdi.length === 10) {
    const with9 = withoutDdi.substring(0, 2) + '9' + withoutDdi.substring(2);
    variations.add(with9);
    variations.add(`55${with9}`);
  }

  // Helper to determine if contact has verified client status
  const isVerifiedClient = (c) => {
    if (!c) return false;
    // Explicitly unverified/leads or unregistered contacts are NEVER existing clients
    if (c.status === 'lead' || c.is_registered === false) return false;
    if (c.is_registered === true || c.is_verified === true) return true;
    
    // Check tags: safely parse tags if string or array
    const rawTags = c.tags;
    const tagList = Array.isArray(rawTags)
      ? rawTags.map((t) => String(t).toLowerCase().trim())
      : typeof rawTags === 'string'
      ? rawTags.split(',').map((t) => t.toLowerCase().trim())
      : [];

    const hasClientTag = tagList.some((t) => 
      t.includes('cliente') || t.includes('vip') || t.includes('recorrente') || t.includes('mensalista') || t.includes('salvo') || t.includes('cadastrado')
    );

    if (checkCriteria === 'tag') {
      return hasClientTag;
    }

    if (hasClientTag) {
      return true;
    }

    // Check orders / purchases / appointments
    if ((Number(c.total_orders) || 0) > 0 || (Number(c.total_spent) || 0) > 0 || (Number(c.orders_count) || 0) > 0) {
      return true;
    }

    if (checkCriteria === 'appointment_or_order') {
      return false;
    }

    // Clean Real Name check:
    const cleanName = String(c.name || '').trim();
    const isRealName = Boolean(
      cleanName && 
      cleanName.toLowerCase() !== 'cliente' && 
      cleanName.toLowerCase() !== 'cliente whatsapp' && 
      cleanName.toLowerCase() !== 'nome_cliente' && 
      cleanName.toLowerCase() !== 'undefined' && 
      cleanName.toLowerCase() !== 'null' && 
      !cleanName.includes('{{')
    );

    // If contact has a real name in CRM/Database and status is active (or undefined/not lead), they are a saved contact!
    if (isRealName && (c.status === 'active' || !c.status)) {
      return true;
    }

    if (c.custom_fields && Object.keys(c.custom_fields).length > 0) {
      return true;
    }

    return false;
  };

  // 1. Search in memory / db.contacts
  const contactsList = Object.values(db.contacts || {});
  for (const c of contactsList) {
    const cDigits = (c.phone || c.id || '').replace(/\D/g, '');
    for (const v of variations) {
      if (cDigits && (cDigits === v || cDigits.endsWith(v) || v.endsWith(cDigits))) {
        if (isVerifiedClient(c)) {
          return { isRegistered: true, contact: c, hasRealName: true };
        }
      }
    }
  }

  // 2. Search in Supabase Cloud Database (Single Source of Truth)
  if (supabaseClient) {
    try {
      for (const v of variations) {
        const { data, error } = await supabaseClient
          .from('contacts')
          .select('*')
          .or(`phone.eq.${v},phone.ilike.%${v}%`)
          .limit(1)
          .maybeSingle();

        if (data && !error && isVerifiedClient(data)) {
          if (!db.contacts) db.contacts = {};
          db.contacts[cleanPhone] = data;
          db.contacts[data.phone] = data;
          saveDb(db);
          return { isRegistered: true, contact: data, hasRealName: true };
        }
      }
    } catch (e) {
      console.warn('[FlowRunner] Erro ao consultar contato no Supabase:', e.message);
    }
  }

  // 3. Search in Appointments (Historic bookings)
  // Only consider appointment if contact is active in db.contacts and not deleted
  const apts = (db.appointments || []).filter(a => a.status === 'confirmed' || a.status === 'completed');
  const aptMatch = apts.find((a) => {
    const aDigits = (a.contact_phone || a.phone || '').replace(/\D/g, '');
    for (const v of variations) {
      if (aDigits && (aDigits === v || aDigits.endsWith(v) || v.endsWith(aDigits))) return true;
    }
    return false;
  });

  if (aptMatch && aptMatch.contact_name && aptMatch.contact_name.toLowerCase() !== 'cliente' && !aptMatch.contact_name.includes('{{')) {
    // Cross-check with db.contacts: if contact was marked as lead or unregistered, do NOT consider as registered client
    const existingContact = contactsList.find(c => {
      const cd = (c.phone || c.id || '').replace(/\D/g, '');
      return cd && variations.has(cd);
    });

    if (!existingContact || (existingContact.status !== 'lead' && existingContact.is_registered !== false)) {
      return {
        isRegistered: true,
        contact: { name: aptMatch.contact_name, phone: cleanPhone, is_registered: true },
        hasRealName: true,
      };
    }
  }

  return { isRegistered: false, contact: null, hasRealName: false };
}

let supabaseHasFlowsTable = null;

// Helper functions to sync flows directly with Supabase
export async function syncFlowToSupabase(flow) {
  if (!supabaseClient || !flow || !flow.id) return;
  try {
    const isPublishing = flow.status === 'published' || flow.is_active === true;
    // Permite múltiplos fluxos ativos: não desativa outros fluxos no Supabase!
    await supabaseClient.from('flows').upsert({
      id: flow.id,
      name: flow.name || 'Fluxo',
      description: flow.description || '',
      status: flow.status || (flow.is_active ? 'published' : 'draft'),
      is_active: isPublishing,
      version: flow.version || 1,
      trigger_type: flow.trigger_type || 'Qualquer Mensagem Recebida',
      keywords: flow.keywords || '',
      trigger_keywords: flow.trigger_keywords || flow.keywords || '',
      store_id: flow.store_id || null,
      store_name: flow.store_name || null,
      node_count: flow.node_count || 0,
      steps: flow.steps || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[FlowRunner] syncFlowToSupabase warning:', err.message);
  }
}

export async function deleteFlowFromSupabase(flowId) {
  if (!supabaseClient || !flowId) return;
  try {
    await Promise.all([
      supabaseClient.from('flow_nodes').delete().eq('flow_id', flowId),
      supabaseClient.from('flow_edges').delete().eq('flow_id', flowId),
      supabaseClient.from('flows').delete().eq('id', flowId),
    ]);
  } catch (err) {
    console.warn('[FlowRunner] deleteFlowFromSupabase warning:', err.message);
  }
}

export async function syncFlowGraphToSupabase(flowId, nodes, edges) {
  if (!supabaseClient || !flowId) return;
  try {
    const nodeIds = (nodes || []).map(n => n.id);
    const edgeIds = (edges || []).map(e => e.id);

    // Remove nós e arestas que foram excluídos pelo usuário no Studio
    if (nodeIds.length > 0) {
      await supabaseClient.from('flow_nodes').delete().eq('flow_id', flowId).not('id', 'in', `(${nodeIds.map(id => `"${id}"`).join(',')})`);
    } else {
      await supabaseClient.from('flow_nodes').delete().eq('flow_id', flowId);
    }

    if (edgeIds.length > 0) {
      await supabaseClient.from('flow_edges').delete().eq('flow_id', flowId).not('id', 'in', `(${edgeIds.map(id => `"${id}"`).join(',')})`);
    } else {
      await supabaseClient.from('flow_edges').delete().eq('flow_id', flowId);
    }

    if (Array.isArray(nodes) && nodes.length > 0) {
      const nodeRecords = nodes.map((n) => ({
        id: n.id,
        flow_id: flowId,
        type: n.type || 'message',
        label: n.data?.label || n.label || 'Nó',
        data: n.data || {},
        position: n.position || { x: 0, y: 0 },
        updated_at: new Date().toISOString(),
      }));
      await supabaseClient.from('flow_nodes').upsert(nodeRecords, { onConflict: 'id' });
    }
    if (Array.isArray(edges) && edges.length > 0) {
      const edgeRecords = edges.map((e) => ({
        id: e.id,
        flow_id: flowId,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle || null,
        target_handle: e.targetHandle || null,
        data: e.data || {},
        updated_at: new Date().toISOString(),
      }));
      await supabaseClient.from('flow_edges').upsert(edgeRecords, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('[FlowRunner] syncFlowGraphToSupabase warning:', err.message);
  }
}

export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function extractFlowKeywords(flow, flowNodes = [], dbNodes = []) {
  if (!flow) return [];

  // Se o trigger_type for explicitamente "Qualquer Mensagem Recebida" / any_message,
  // este fluxo é estritamente de atendimento geral e NUNCA deve capturar palavras-chave!
  const trigType = String(flow.trigger_type || '').toLowerCase().trim();
  const isAnyMessage = trigType.includes('qualquer') || trigType.includes('any_message') || trigType === 'mensagem recebida';
  if (isAnyMessage) {
    return [];
  }

  const keywordsSet = new Set();

  // 1. Do próprio objeto do fluxo: flow.keywords ou flow.trigger_keywords
  if (flow.keywords) {
    const raw = Array.isArray(flow.keywords) ? flow.keywords.join(',') : String(flow.keywords);
    raw.split(',').forEach(k => {
      const clean = normalizeText(k);
      if (clean) keywordsSet.add(clean);
    });
  }
  if (flow.trigger_keywords) {
    const raw = Array.isArray(flow.trigger_keywords) ? flow.trigger_keywords.join(',') : String(flow.trigger_keywords);
    raw.split(',').forEach(k => {
      const clean = normalizeText(k);
      if (clean) keywordsSet.add(clean);
    });
  }

  // 2. Dos nós do fluxo (trigger node)
  const allNodes = [...(flowNodes || []), ...(dbNodes || [])];
  for (const n of allNodes) {
    const nType = n.data?.nodeType || n.type || n.node_type;
    if (nType === 'trigger') {
      let nodeData = n.data;
      if (typeof nodeData === 'string') {
        try { nodeData = JSON.parse(nodeData); } catch {}
      }
      const cfg = nodeData?.config || n.config || {};
      if (cfg.eventType !== 'any_message') {
        const kwString = cfg.keywords || nodeData?.keywords || '';
        if (kwString) {
          String(kwString).split(',').forEach(k => {
            const clean = normalizeText(k);
            if (clean) keywordsSet.add(clean);
          });
        }
      }
    }
  }

  // 3. Se trigger_type contiver dois pontos com palavras (ex: "Palavra-Chave: enxoval, berco")
  if (flow.trigger_type && trigType.includes(':')) {
    const colonMatch = String(flow.trigger_type).split(':')[1];
    if (colonMatch) {
      colonMatch.split(',').forEach(k => {
        const clean = normalizeText(k);
        if (clean && clean.length >= 2) keywordsSet.add(clean);
      });
    }
  }

  return Array.from(keywordsSet);
}

// Obter dinamicamente os fluxos e nós publicados diretamente do Supabase em tempo real
export async function getActiveFlowAndGraph(db, preferredFlowId = null, incomingText = '', isWaitingForInput = false) {
  let activeFlows = [];

  // 1. Consultar diretamente TODOS os fluxos com status ATIVO no Supabase
  if (supabaseClient && supabaseHasFlowsTable !== false) {
    try {
      const { data, error } = await supabaseClient
        .from('flows')
        .select('*')
        .or('is_active.eq.true,status.eq.published');

      if (error && (error.code === 'PGRST205' || String(error.message || '').includes('Could not find the table'))) {
        supabaseHasFlowsTable = false;
      } else if (!error && Array.isArray(data)) {
        supabaseHasFlowsTable = true;
        activeFlows = data.filter((f) => f.is_active === true || f.status === 'published');
        // Mesclar com fluxos locais ativos
        const localActives = (db.flows || []).filter((f) => f.status === 'published' || f.is_active === true);
        for (const lf of localActives) {
          if (!activeFlows.some(af => af.id === lf.id)) {
            activeFlows.push(lf);
          }
        }
      }
    } catch (e) {
      console.warn('[FlowRunner] Aviso ao consultar fluxos ativos no Supabase:', e.message);
    }
  }

  // 2. Se o Supabase estiver offline, consultar db local estritamente ativos
  if (activeFlows.length === 0) {
    activeFlows = (db.flows || []).filter((f) => f.status === 'published' || f.is_active === true);
  }

  if (activeFlows.length === 0) {
    console.log('[FlowRunner] ⏸️ Nenhum fluxo ativo configurado no sistema. Robô aguardando ativação.');
    return { publishedFlow: null, nodes: [], edges: [], isKeywordMatch: false };
  }

  // Ordenar pela ordem configurada dos cards (order_index estável)
  activeFlows.sort((a, b) => {
    const oA = typeof a.order_index === 'number' ? a.order_index : 9999;
    const oB = typeof b.order_index === 'number' ? b.order_index : 9999;
    if (oA !== oB) return oA - oB;
    return (a.name || '').localeCompare(b.name || '');
  });

  const activeFlowIds = activeFlows.map(f => f.id);

  // 3. Carregar nós e arestas de todos os fluxos ativos para conferir palavras-chave e disparos
  let allActiveNodes = [];
  let allActiveEdges = [];
  if (supabaseClient && supabaseHasFlowsTable !== false) {
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabaseClient.from('flow_nodes').select('*').in('flow_id', activeFlowIds),
        supabaseClient.from('flow_edges').select('*').in('flow_id', activeFlowIds),
      ]);
      if (Array.isArray(nodesRes.data)) allActiveNodes = nodesRes.data;
      if (Array.isArray(edgesRes.data)) allActiveEdges = edgesRes.data;
    } catch (e) {}
  }

  // Mesclar com nós e arestas locais
  if (Array.isArray(db.flow_nodes)) {
    for (const ln of db.flow_nodes) {
      if (activeFlowIds.includes(ln.flow_id) && !allActiveNodes.some(n => n.id === ln.id)) {
        allActiveNodes.push(ln);
      }
    }
  }
  if (Array.isArray(db.flow_edges)) {
    for (const le of db.flow_edges) {
      if (activeFlowIds.includes(le.flow_id) && !allActiveEdges.some(e => e.id === le.id)) {
        allActiveEdges.push(le);
      }
    }
  }
  if (db.nodes) {
    for (const [fId, nList] of Object.entries(db.nodes)) {
      if (activeFlowIds.includes(fId) && Array.isArray(nList)) {
        for (const ln of nList) {
          if (!allActiveNodes.some(n => n.id === ln.id)) allActiveNodes.push({ ...ln, flow_id: fId });
        }
      }
    }
  }
  if (db.edges) {
    for (const [fId, eList] of Object.entries(db.edges)) {
      if (activeFlowIds.includes(fId) && Array.isArray(eList)) {
        for (const le of eList) {
          if (!allActiveEdges.some(e => e.id === le.id)) allActiveEdges.push({ ...le, flow_id: fId });
        }
      }
    }
  }

  // 4. Selecionar o melhor fluxo para a mensagem recebida:
  let candidateFlow = null;
  let isKeywordMatch = false;
  const normIncoming = normalizeText(incomingText);

  // A) PRIORIDADE 1: VERIFICAR SE A MENSAGEM BATE COM PALAVRAS-CHAVE DE QUALQUER FLUXO ATIVO!
  if (normIncoming) {
    // Filtrar apenas fluxos que são de palavra-chave (não são "Qualquer Mensagem Recebida")
    const keywordFlows = activeFlows.filter(flow => {
      const trig = String(flow.trigger_type || '').toLowerCase();
      if (trig.includes('qualquer') || trig.includes('any_message') || trig === 'mensagem recebida') {
        return false;
      }
      const flowNodes = allActiveNodes.filter(n => n.flow_id === flow.id);
      const kws = extractFlowKeywords(flow, flowNodes, db.nodes?.[flow.id]);
      return kws.length > 0;
    });

    // Helper para descobrir se o fluxo é de correspondência 'exact' ou 'contains'
    const getMatchType = (flow) => {
      if (flow.keyword_match_type) return flow.keyword_match_type;
      const flowNodes = allActiveNodes.filter(n => n.flow_id === flow.id);
      const allNodes = [...flowNodes, ...(db.nodes?.[flow.id] || [])];
      for (const n of allNodes) {
        const nType = n.data?.nodeType || n.type || n.node_type;
        if (nType === 'trigger') {
          let nodeData = n.data;
          if (typeof nodeData === 'string') {
            try { nodeData = JSON.parse(nodeData); } catch {}
          }
          const cfg = nodeData?.config || n.config || {};
          if (cfg.keywordMatchType) return cfg.keywordMatchType;
        }
      }
      return 'exact'; // Padrão: específica / exata
    };

    // Separar em fluxos de correspondência exata (específica) e correspondência de contenção
    const exactFlows = keywordFlows.filter(f => getMatchType(f) === 'exact');
    const containsFlows = keywordFlows.filter(f => getMatchType(f) === 'contains');

    // 1. Verificar primeiro fluxos com correspondência ESPECÍFICA (EXATA)
    for (const flow of exactFlows) {
      const flowNodes = allActiveNodes.filter(n => n.flow_id === flow.id);
      const kws = extractFlowKeywords(flow, flowNodes, db.nodes?.[flow.id]);

      const matched = kws.some(kw => {
        if (!kw) return false;
        // Bate exatamente a mensagem do usuário (sem espaços extras/acentos)
        if (normIncoming === kw) return true;
        // Se a palavra-chave tiver hashtag (ex: #enxoval), busca exata com/sem hashtag
        if (kw.startsWith('#') && (normIncoming === kw || normIncoming === kw.slice(1))) return true;
        return false;
      });

      if (matched) {
        candidateFlow = flow;
        isKeywordMatch = true;
        console.log(`[FlowRunner] 🎯 [PALAVRA-CHAVE ESPECÍFICA/EXATA] Mensagem "${incomingText}" ativou fluxo: "${flow.name}" (${flow.id})`);
        break;
      }
    }

    // 2. Se nenhum fluxo exato bateu, verificar fluxos com correspondência CONTÉM NA INTERAÇÃO
    if (!candidateFlow) {
      for (const flow of containsFlows) {
        const flowNodes = allActiveNodes.filter(n => n.flow_id === flow.id);
        const kws = extractFlowKeywords(flow, flowNodes, db.nodes?.[flow.id]);

        const matched = kws.some(kw => {
          if (!kw) return false;
          // Bate exato
          if (normIncoming === kw) return true;
          // Se a palavra-chave tiver hashtag (ex: #enxoval)
          if (kw.startsWith('#') && normIncoming.includes(kw)) return true;
          // Busca por palavra inteira com regex
          try {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordRegex = new RegExp(`(^|\\s|[.,!?;])${escaped}(\\s|[.,!?;]|$)`, 'i');
            if (wordRegex.test(normIncoming)) return true;
          } catch {}
          // Se a keyword tiver tamanho significativo (>= 3 letras), aceita contido na frase
          if (kw.length >= 3 && normIncoming.includes(kw)) return true;
          return false;
        });

        if (matched) {
          candidateFlow = flow;
          isKeywordMatch = true;
          console.log(`[FlowRunner] 🔍 [PALAVRA-CHAVE CONTÉM NA FRASE] Mensagem "${incomingText}" ativou fluxo: "${flow.name}" (${flow.id})`);
          break;
        }
      }
    }
  }

  // B) Se NÃO bateu palavra-chave, mas o usuário está no meio de uma pergunta/input de fluxo anterior:
  if (!candidateFlow && isWaitingForInput && preferredFlowId) {
    const prefFlow = activeFlows.find(f => f.id === preferredFlowId);
    if (prefFlow) {
      candidateFlow = prefFlow;
      console.log(`[FlowRunner] 💬 [INPUT EM ANDAMENTO] Mantendo fluxo ativo "${prefFlow.name}" (${prefFlow.id}) para captura de resposta.`);
    }
  }

  // C) Caso contrário (interação que não é palavra-chave e não está respondendo pergunta):
  // Executar o fluxo configurado para "Qualquer Mensagem Recebida"
  if (!candidateFlow) {
    // 1. Procura fluxo explicitamente configurado com "Qualquer Mensagem"
    candidateFlow = activeFlows.find(f => {
      const trigType = (f.trigger_type || '').toLowerCase();
      return trigType.includes('qualquer') || trigType.includes('mensagem recebida') || trigType === 'any_message';
    });

    // 2. Se não encontrou por nome do gatilho, seleciona o primeiro que NÃO tenha palavras-chave obrigatórias
    if (!candidateFlow) {
      candidateFlow = activeFlows.find(f => {
        const kws = extractFlowKeywords(f, allActiveNodes.filter(n => n.flow_id === f.id), db.nodes?.[f.id]);
        return kws.length === 0;
      });
    }

    // 3. Último fallback seguro
    if (!candidateFlow) {
      candidateFlow = activeFlows[0];
    }

    console.log(`[FlowRunner] 💬 [QUALQUER MENSAGEM] Mensagem "${incomingText}" não acionou palavra-chave. Executando fluxo padrão: "${candidateFlow.name}" (${candidateFlow.id})`);
  }

  const flowId = candidateFlow.id;
  let nodes = [];
  let edges = [];

  const rawFlowNodes = allActiveNodes.filter(n => n.flow_id === flowId);
  const rawFlowEdges = allActiveEdges.filter(e => e.flow_id === flowId);

  if (rawFlowNodes.length > 0) {
    nodes = rawFlowNodes.map((d) => ({
      id: d.id,
      flow_id: d.flow_id,
      type: d.type || d.node_type || 'message',
      position: d.position || { x: Number(d.position_x || 0), y: Number(d.position_y || 0) },
      data: typeof d.data === 'string' ? JSON.parse(d.data) : (d.data || { label: d.label, nodeType: d.type, config: {} }),
    }));
    if (!db.nodes) db.nodes = {};
    db.nodes[flowId] = nodes;
  }

  if (rawFlowEdges.length > 0) {
    edges = rawFlowEdges.map((e) => ({
      id: e.id,
      flow_id: e.flow_id,
      source: e.source || e.source_node_id,
      target: e.target || e.target_node_id,
      sourceHandle: e.source_handle || e.sourceHandle,
      targetHandle: e.target_handle || e.targetHandle,
      data: typeof e.data === 'string' ? JSON.parse(e.data) : (e.data || e.condition || {}),
    }));
    if (!db.edges) db.edges = {};
    db.edges[flowId] = edges;
  }

  // Fallback para cache local de nós/arestas caso a rede falhe
  if (nodes.length === 0 && db.nodes?.[flowId]) {
    nodes = db.nodes[flowId];
  }
  if (edges.length === 0 && db.edges?.[flowId]) {
    edges = db.edges[flowId];
  }

  console.log(`[FlowRunner] 🚀 Rodando fluxo ATIVO: "${candidateFlow.name}" (${flowId}) [KeywordMatch: ${isKeywordMatch}] com ${nodes.length} nós e ${edges.length} conexões.`);
  return { publishedFlow: candidateFlow, nodes, edges, isKeywordMatch };
}

// Execute published flow
export async function executePublishedFlow(senderJid, messageText, pushName, realPhoneNumber = null, profilePicUrl = null) {
  const db = loadDb();
  const rawId = senderJid.split('@')[0].split(':')[0];
  const cleanPhone = (realPhoneNumber || rawId).replace(/\D/g, '');
  const senderName = pushName || 'Cliente';
  const cleanInput = (messageText || '').trim();

  // Record incoming message in real database
  recordRealMessage(cleanPhone, senderName, 'inbound', cleanInput, null, profilePicUrl);

  const convId = `conv-${cleanPhone}`;
  const currentConv = db.conversations?.[convId] || Object.values(db.conversations || {}).find(c => 
    String(c?.phone || c?.contact_phone || '').replace(/\D/g, '') === cleanPhone
  );

  // Obter sessão atual para preservar fluxo em andamento se estiver aguardando resposta
  const existingSession = db.sessions?.[cleanPhone] || db.sessions?.[rawId];
  const isExistingSessionExpired = Boolean(
    existingSession?.lastInteractionAt && (Date.now() - existingSession.lastInteractionAt) > (15 * 60 * 1000)
  );
  const isCleanGreetingEarly = [
    'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'menu', 'inicio', 'início'
  ].includes(cleanInput.toLowerCase().trim());

  const isSessionWaitingInput = !isExistingSessionExpired && !isCleanGreetingEarly && Boolean(
    existingSession?.waitingForVar ||
    (existingSession?.activeButtons && existingSession.activeButtons.length > 0)
  );

  // Dynamically resolve published flow, nodes, and edges
  const { publishedFlow, nodes, edges, isKeywordMatch } = await getActiveFlowAndGraph(
    db, 
    existingSession?.flowId, 
    cleanInput, 
    isSessionWaitingInput
  );

  // 🛡️ BLINDAGEM INTELIGENTE DE ATENDIMENTO HUMANO:
  // Se o cliente digitou uma palavra-chave registrada OU um comando de reinício/saudação, o robô assume imediatamente!
  const cleanLower = cleanInput.toLowerCase().trim();
  const cleanTextOnly = cleanLower.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const isBotResetCmd = [
    '#bot', '#robo', '#robô', '#sair', '#reiniciar', '#reset', '#menu', '#inicio',
    '/bot', '/sair', '/menu', 'reiniciar', 'menu', 'inicio', 'início', 'começar', 'comecar',
    'voltar', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start', 'bot'
  ].some(cmd => cleanLower === cmd || cleanTextOnly === cmd || cleanTextOnly.startsWith(`${cmd} `));

  if (currentConv) {
    if (currentConv.status === 'closed') {
      currentConv.status = 'bot';
      saveDb(db);
    }

    if (currentConv.status === 'human') {
      const isUnassigned = !currentConv.assigned_to || currentConv.assigned_to === 'undefined' || currentConv.assigned_to === null;
      const lastAttendantTime = new Date(currentConv.last_attendant_message_at || currentConv.updated_at || 0).getTime();
      const isHumanExpired = (Date.now() - lastAttendantTime) > (15 * 60 * 1000);

      if (isKeywordMatch || isBotResetCmd || isUnassigned || isHumanExpired) {
        console.log(`🤖 [FlowRunner] ${isBotResetCmd ? `Comando/saudação "${cleanInput}"` : (isUnassigned ? 'Sem atendente atribuído' : 'Inatividade (>15min)')} detectado. Reassumindo atendimento com o robô para ${cleanPhone}.`);
        currentConv.status = 'bot';
        currentConv.assigned_to = null;
        currentConv.assigned_attendant_name = null;
        currentConv.assigned_attendant_id = null;
        if (db.sessions?.[cleanPhone]) delete db.sessions[cleanPhone];
        saveDb(db);
      } else {
        console.log(`🛡️ [FlowRunner] Conversa ${cleanPhone} está em Atendimento Humano com "${currentConv.assigned_to}". Robô em pausa para não interferir.`);
        return [];
      }
    }
  }

  if (!publishedFlow) {
    const defaultReply = `Olá, *${senderName}*! Recebi sua mensagem: "${cleanInput}".\n\nNo momento, não há nenhum fluxo ativo publicado no painel administrativo.`;
    recordRealMessage(cleanPhone, senderName, 'outbound', defaultReply);
    return [defaultReply];
  }

  const flowId = publishedFlow.id;

  if (!nodes || nodes.length === 0) {
    const noNodesReply = `Olá! O fluxo *${publishedFlow.name}* está publicado, mas ainda não possui nós configurados.`;
    recordRealMessage(cleanPhone, senderName, 'outbound', noNodesReply);
    return [noNodesReply];
  }

  let session = db.sessions?.[cleanPhone] || db.sessions?.[rawId] || {
    flowId,
    currentNodeId: null,
    variables: {},
    lastFlowTriggerAt: null,
  };

  if (isKeywordMatch || session.flowId !== flowId || (session.currentNodeId && !nodes.some(n => n.id === session.currentNodeId))) {
    session.flowId = flowId;
    session.currentNodeId = null;
    session.waitingForVar = null;
  }

  session.variables = {
    ...session.variables,
    whatsapp_pushname: senderName || '',
    telefone_cliente: cleanPhone,
    telefone_whatsapp: cleanPhone,
    ultima_mensagem: cleanInput,
  };
  if (!session.variables.nome_cliente) {
    session.variables.nome_cliente = '';
  }

  const botProfile = { ...(db.botProfile || {}) };
  if (!botProfile.custom_variables && db.customVariables) {
    botProfile.custom_variables = db.customVariables;
  }
  const replies = [];

function parseCustomDateString(input) {
  const clean = (input || '').toLowerCase().trim();
  const today = new Date();
  
  if (clean === 'hoje' || clean === '1' || clean.includes('hoje') || clean === 'date_today') {
    return today.toISOString().split('T')[0];
  }
  if (clean === 'amanha' || clean === 'amanhã' || clean === '2' || clean.includes('amanh') || clean === 'date_tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Format DD/MM or DD/MM/YYYY
  const ddmmyyyy = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3] ? (ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3]) : today.getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  // Format YYYY-MM-DD
  const yyyymmdd = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
  }

  return today.toISOString().split('T')[0];
}

  const isExplicitReset =
    cleanInput.toLowerCase() === 'menu' ||
    cleanInput.toLowerCase() === 'inicio' ||
    cleanInput.toLowerCase() === 'início' ||
    cleanInput.toLowerCase() === 'reiniciar' ||
    cleanInput.toLowerCase() === 'cancelar' ||
    cleanInput.toLowerCase() === 'voltar' ||
    cleanInput.toLowerCase() === 'comecar' ||
    cleanInput.toLowerCase() === 'começar' ||
    cleanInput.toLowerCase() === 'start';

  const isGreeting =
    cleanInput.toLowerCase() === 'oi' ||
    cleanInput.toLowerCase() === 'olá' ||
    cleanInput.toLowerCase() === 'ola' ||
    cleanInput.toLowerCase() === 'bom dia' ||
    cleanInput.toLowerCase() === 'boa tarde' ||
    cleanInput.toLowerCase() === 'boa noite';

  const prevNode = session.currentNodeId ? nodes.find((n) => n.id === session.currentNodeId) : null;
  const prevType = prevNode?.data?.nodeType || prevNode?.type;
  const hasOutgoingEdges = prevNode ? edges.some((e) => e.source === prevNode.id) : false;

  const interactiveTypes = [
    'question',
    'buttons',
    'store_selector',
    'select_service',
    'services_catalog',
    'select_date',
    'ask_date',
    'select_time_slot',
    'schedule_contact',
    'select_product',
    'shipping_calculator',
    'pix_payment',
    'vip_consultation',
    'promotional_coupon',
  ];

  // Inatividade de sessão (> 15 min de inatividade expira o estado intermediário e reinicia o atendimento)
  const isSessionExpired = Boolean(
    session.lastInteractionAt && (Date.now() - session.lastInteractionAt) > (15 * 60 * 1000)
  );

  const isWaitingForInput = !isSessionExpired && !isGreeting && !isExplicitReset && Boolean(
    session.waitingForVar ||
    (session.activeButtons && session.activeButtons.length > 0) ||
    (prevNode && interactiveTypes.includes(prevType))
  );

  // -------------------------------------------------------------
  // ⏳ CONTROLE DE COOLDOWN / DELAY DO ROBÔ PARA O MESMO NÚMERO
  // -------------------------------------------------------------
  // Palavras-chave, saudações (oi, olá), comandos de reinício e fluxos já concluídos NUNCA sofrem cooldown.
  // Usuário respondendo a uma pergunta / botão ativo também NÃO sofre cooldown.
  const isTerminalPrevious = Boolean(prevNode && !hasOutgoingEdges && !isWaitingForInput);
  const shouldBypassCooldown = isKeywordMatch || isExplicitReset || isWaitingForInput || isGreeting || isTerminalPrevious || !session.currentNodeId;

  if (!shouldBypassCooldown) {
    const cooldownMinutes = Number(botProfile.flow_cooldown_minutes ?? db.settings?.flow_cooldown_minutes ?? 0);
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const lastTrigger = session.lastFlowTriggerAt || 0;
    const timeSinceLast = Date.now() - lastTrigger;

    if (cooldownMinutes > 0 && lastTrigger > 0 && timeSinceLast < cooldownMs) {
      const remainingSec = Math.round((cooldownMs - timeSinceLast) / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      console.log(`⏳ [FlowRunner] Cooldown ativo para ${cleanPhone}. Último disparo foi há ${Math.round(timeSinceLast / 60000)}m (cooldown configurado: ${cooldownMinutes}m, restam ~${remainingMin}m). Robô silenciado para não repetir o fluxo de saudação.`);
      session.lastInteractionAt = Date.now();
      if (!db.sessions) db.sessions = {};
      db.sessions[cleanPhone] = session;
      db.sessions[rawId] = session;
      saveDb(db);
      return [];
    }
  }

  // Registra o timestamp deste disparo de fluxo
  session.lastFlowTriggerAt = Date.now();
  session.lastInteractionAt = Date.now();

  // Se o nó anterior era terminal (sem saídas) e não está aguardando input do usuário,
  // ou se o cliente não está no meio de uma resposta de pergunta/botão,
  // qualquer nova mensagem do cliente executa o fluxo a partir do gatilho!
  const isTerminalNode = Boolean(prevNode && !hasOutgoingEdges && !isWaitingForInput);

  const isReset = isKeywordMatch || isExplicitReset || isGreeting || isSessionExpired || isTerminalNode || !session.currentNodeId || !isWaitingForInput;

  let currentNode = null;

  if (isReset) {
    currentNode = nodes.find((n) => (n.data?.nodeType || n.type) === 'trigger') || nodes[0];
    session.currentNodeId = currentNode.id;
    session.waitingForVar = null;
    session.activeButtons = null;
  } else {
    const prevNode = nodes.find((n) => n.id === session.currentNodeId);
    const prevType = prevNode?.data?.nodeType || prevNode?.type;

    // 1. Question response
    if ((prevNode && prevType === 'question') || session.waitingForVar) {
      const activeQuestionNode = (prevNode && prevType === 'question') ? prevNode : nodes.find((n) => (n.data?.nodeType || n.type) === 'question');
      const qConfig = activeQuestionNode?.data?.config || {};
      let varKey = qConfig.variableName || session.waitingForVar || 'resposta_usuario';
      varKey = varKey.replace(/[{}]/g, '').trim();

      // Clean up conversational prefixes if user typed "Me chamo Carlos" or "Meu nome é Carlos"
      let extractedName = cleanInput;
      const lowerInput = cleanInput.toLowerCase().trim();
      if (lowerInput.startsWith('me chamo ')) {
        extractedName = cleanInput.substring(9).trim();
      } else if (lowerInput.startsWith('meu nome é ') || lowerInput.startsWith('meu nome e ')) {
        extractedName = cleanInput.substring(11).trim();
      } else if (lowerInput.startsWith('sou o ') || lowerInput.startsWith('sou a ')) {
        extractedName = cleanInput.substring(6).trim();
      }

      const isNameVar = varKey.toLowerCase().includes('nome') || varKey === 'name' || varKey === 'cliente' || qConfig.expectedType === 'text';
      const finalVal = isNameVar ? extractedName : cleanInput;

      session.variables[varKey] = finalVal;
      session.variables[`{{${varKey}}}`] = finalVal;
      session.variables['resposta_usuario'] = finalVal;
      session.waitingForVar = null;
      if (isNameVar && extractedName) {
        // Propagar em todas as variáveis de nomes possíveis para compatibilidade com qualquer nó
        session.variables[varKey] = extractedName;
        session.variables[`{{${varKey}}}`] = extractedName;
        session.variables['nome_clientenovo'] = extractedName;
        session.variables['{{nome_clientenovo}}'] = extractedName;
        session.variables['nome_cliente'] = extractedName;
        session.variables['{{nome_cliente}}'] = extractedName;
        session.variables['cliente_nome'] = extractedName;
        session.variables['{{cliente_nome}}'] = extractedName;
        session.variables['nome'] = extractedName;
        session.variables['{{nome}}'] = extractedName;
        session.variables['primeiro_nome'] = extractedName.split(' ')[0] || extractedName;
        session.variables['{{primeiro_nome}}'] = extractedName.split(' ')[0] || extractedName;
        session.variables['resposta_usuario'] = extractedName;
        session.variables['{{resposta_usuario}}'] = extractedName;

        if (!db.contacts) db.contacts = {};
        const { primaryPhone, allPhones } = resolveLinkedPhones(cleanPhone, db);

        for (const phoneToSave of allPhones) {
          if (!db.contacts[phoneToSave]) {
            db.contacts[phoneToSave] = {
              id: `contact-${phoneToSave}`,
              phone: phoneToSave,
              name: extractedName,
              status: 'active',
              tags: ['Lead', 'Cliente', 'Cliente WhatsApp', 'Bot'],
              is_registered: true,
              notes: 'Cadastrado e atualizado pelo fluxo do bot',
              custom_fields: { nome_cliente: extractedName, [varKey]: extractedName },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          } else {
            db.contacts[phoneToSave].name = extractedName;
            db.contacts[phoneToSave].status = 'active';
            db.contacts[phoneToSave].is_registered = true;
            if (!db.contacts[phoneToSave].tags) db.contacts[phoneToSave].tags = [];
            ['Lead', 'Cliente', 'Cliente WhatsApp', 'Bot'].forEach(t => {
              if (!db.contacts[phoneToSave].tags.includes(t)) db.contacts[phoneToSave].tags.push(t);
            });
            if (!db.contacts[phoneToSave].custom_fields) db.contacts[phoneToSave].custom_fields = {};
            db.contacts[phoneToSave].custom_fields.nome_cliente = extractedName;
            db.contacts[phoneToSave].custom_fields[varKey] = extractedName;
            db.contacts[phoneToSave].updated_at = new Date().toISOString();
          }

          if (db.conversations && db.conversations[`conv-${phoneToSave}`]) {
            db.conversations[`conv-${phoneToSave}`].contact_name = extractedName;
            db.conversations[`conv-${phoneToSave}`].updated_at = new Date().toISOString();
            syncConversationToSupabase(db.conversations[`conv-${phoneToSave}`]);
          }

          syncContactToSupabase(db.contacts[phoneToSave]);
        }

        try {
          fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
        } catch (err) {}

        console.log(`[FlowRunner] 👤 Nome do cliente gravado e vinculado para ${allPhones.join(', ')}: "${extractedName}"`);
      }

      if (varKey.toLowerCase().includes('email')) {
        session.variables.email_cliente = cleanInput;
        if (db.contacts && db.contacts[cleanPhone]) {
          db.contacts[cleanPhone].email = cleanInput;
          syncContactToSupabase(db.contacts[cleanPhone]);
        }
      }

      if (db.contacts && db.contacts[cleanPhone]) {
        if (!db.contacts[cleanPhone].custom_fields) db.contacts[cleanPhone].custom_fields = {};
        db.contacts[cleanPhone].custom_fields[varKey] = cleanInput;
        syncContactToSupabase(db.contacts[cleanPhone]);
      }

      saveDb(db);

      const effectiveQuestionNode = activeQuestionNode || prevNode;
      const nextEdge = effectiveQuestionNode ? edges.find((e) => e.source === effectiveQuestionNode.id) : null;
      if (nextEdge) {
        currentNode = nodes.find((n) => n.id === nextEdge.target);
        session.currentNodeId = currentNode?.id || null;
      }
    }

    // 1.1 Ask Date response
    else if (prevNode && prevType === 'ask_date') {
      const parsedDate = parseCustomDateString(cleanInput);
      session.variables['data_agendamento'] = parsedDate;
      const parts = parsedDate.split('-');
      session.variables['data_formatada'] = `${parts[2]}/${parts[1]}/${parts[0]}`;
      console.log(`[FlowRunner] 📅 Data de agendamento selecionada: ${parsedDate} (${session.variables['data_formatada']})`);

      const nextEdge = edges.find((e) => e.source === prevNode.id);
      if (nextEdge) {
        currentNode = nodes.find((n) => n.id === nextEdge.target);
        session.currentNodeId = currentNode?.id || null;
      }
    }

    // 1.2 Show Services continuation (if client sends a message after catalog exhibition)
    else if (prevNode && (prevType === 'show_services' || (prevType === 'services_catalog' && prevNode.data?.config?.displayFormat !== 'buttons'))) {
      const nextEdge = edges.find((e) => e.source === prevNode.id);
      if (nextEdge) {
        currentNode = nodes.find((n) => n.id === nextEdge.target);
        session.currentNodeId = currentNode?.id || null;
      }
    }

    // 2. Buttons / Available slots / Services Catalog / Date selection / Store Selection
    else if (
      prevNode &&
      (prevType === 'buttons' ||
        prevType === 'store_selector' ||
        prevType === 'select_service' ||
        prevType === 'services_catalog' ||
        prevType === 'select_date' ||
        prevType === 'ask_date' ||
        prevType === 'select_time_slot' ||
        prevType === 'schedule_contact' ||
        prevType === 'select_product' ||
        prevType === 'shipping_calculator' ||
        prevType === 'pix_payment' ||
        prevType === 'vip_consultation' ||
        prevType === 'promotional_coupon')
    ) {
      const btnConfig = prevNode.data?.config || {};
      const buttons = session.activeButtons || btnConfig.buttons || [];
      let matchedBtnIndex = -1;

      const normalize = (str) =>
        String(str || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

      const normInput = normalize(cleanInput);
      const cleanDigits = normInput.replace(/\D/g, '');

      // 1. Exact numeric index match (e.g. '1', '2', '1.', '#1')
      if (cleanDigits) {
        const num = parseInt(cleanDigits, 10);
        if (!isNaN(num) && num >= 1 && num <= buttons.length) {
          matchedBtnIndex = num - 1;
        }
      }

      // 2. ID match (e.g. 'btn_1', 'btn_2', 'srv_1')
      if (matchedBtnIndex === -1) {
        matchedBtnIndex = buttons.findIndex(
          (b) => b.id === cleanInput || b.id === normInput || (b.id && normInput.includes(b.id))
        );
      }

      // 3. Exact, keyword, or substring title match
      if (matchedBtnIndex === -1) {
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          const rawTitle = b.title || b.text || '';
          const normTitle = normalize(rawTitle);
          const cleanTitle = normalize(cleanButtonTitle(rawTitle));

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

      // Date input typing (if user typed DD/MM or a custom date on a date node)
      if (matchedBtnIndex === -1 && (prevType === 'select_date' || prevType === 'ask_date')) {
        const parsedDate = parseCustomDateString(cleanInput);
        session.variables['data_agendamento'] = parsedDate;
        session.variables['data_formatada'] = parsedDate.split('-').reverse().join('/');
        console.log(`[FlowRunner] 📅 Data digitada pelo cliente: ${parsedDate}`);

        const nextEdge = edges.find((e) => e.source === prevNode.id);
        if (nextEdge) {
          currentNode = nodes.find((n) => n.id === nextEdge.target);
          session.currentNodeId = currentNode?.id || null;
        }
      } else if (matchedBtnIndex >= 0) {
        const matchedBtn = buttons[matchedBtnIndex];
        session.variables['opcao_selecionada'] = matchedBtn.title;
        session.variables['botao_id'] = matchedBtn.id;

        // If from date button selection (Hoje / Amanhã)
        if (prevType === 'select_date' || prevType === 'ask_date') {
          let chosenDate = '';
          if (matchedBtn.id === 'date_tomorrow' || matchedBtn.title.toLowerCase().includes('amanh')) {
            const tm = new Date();
            tm.setDate(tm.getDate() + 1);
            chosenDate = tm.toISOString().split('T')[0];
          } else {
            chosenDate = new Date().toISOString().split('T')[0];
          }
          session.variables['data_agendamento'] = chosenDate;
          session.variables['data_formatada'] = chosenDate.split('-').reverse().join('/');
          console.log(`[FlowRunner] 📅 Data selecionada via botão: ${chosenDate}`);
        }

        // If from schedule slot selection
        if ((prevType === 'select_time_slot' || prevType === 'schedule_contact') && (matchedBtn.id.startsWith('slot_') || matchedBtn.slotTime)) {
          const selectedTime = matchedBtn.slotTime || matchedBtn.title.replace('🕒', '').trim();
          session.variables['horario_agendamento'] = selectedTime;
          session.variables['horario_escolhido'] = selectedTime;
          console.log(`[FlowRunner] 🕒 Horário selecionado pelo cliente: "${selectedTime}"`);
        }

        // If from select_service / services_catalog button selection
        if (prevType === 'select_service' || prevType === 'services_catalog') {
          const srv =
            matchedBtn.fullService ||
            (db.agendaSettings?.services || []).find(
              (s) =>
                s.id === matchedBtn.id.replace('srv_', '') ||
                s.name?.toLowerCase().trim() === (matchedBtn.serviceName || '').toLowerCase().trim()
            ) || {
              name: matchedBtn.serviceName || matchedBtn.title.split('(')[0].trim(),
              price: matchedBtn.price || 0,
              duration_minutes: matchedBtn.duration_minutes || 30,
            };

          const srvName = srv.name || matchedBtn.serviceName || matchedBtn.title.split('(')[0].trim();
          const srvPrice = srv.price ? `R$ ${Number(srv.price).toFixed(2).replace('.', ',')}` : '';
          const srvDur = srv.duration_minutes || 30;

          session.variables['servico_selecionado'] = srvName;
          session.variables['valor_servico'] = srvPrice;
          session.variables['duracao_servico'] = `${srvDur} min`;
          session.variables['duracao_minutos'] = srvDur;
          session.variables['opcao_selecionada'] = srvName;
          console.log(`[FlowRunner] 🏷️ Serviço selecionado pelo cliente: "${srvName}" (${srvPrice}, ${srvDur} min)`);
        }

        // If from store_selector
        if (prevType === 'store_selector') {
          const storeFromDb = (db.stores || []).find(
            (s) => s.id === matchedBtn.id || s.slug === matchedBtn.id || s.name === matchedBtn.title || matchedBtn.id.includes(s.id) || (s.id && matchedBtn.storeId === s.id)
          );
          const storeMap = {
            store_matriz: 'Loja Matriz — Centro',
            store_ipojuca: 'Loja Ipojuca - Filial',
            store_boulevard: 'Loja Ipojuca - Filial',
            store_ecommerce: 'Loja Virtual & E-commerce',
            'store-001': 'Loja Matriz — Centro',
            'store-002': 'Loja Ipojuca - Filial',
            'store-003': 'Loja Virtual & E-commerce',
          };
          const storeName = storeFromDb?.name || storeMap[matchedBtn.id] || matchedBtn.storeName || matchedBtn.title || 'Loja Matriz — Centro';
          const storeId = storeFromDb?.id || matchedBtn.storeId || matchedBtn.id || 'store-001';
          const storeWhatsApp = storeFromDb?.whatsapp_number || storeFromDb?.phone || '';

          session.variables['loja_escolhida'] = storeName;
          session.variables['loja_id'] = storeId;
          session.variables['loja_nome'] = storeName;
          session.variables['loja_whatsapp'] = storeWhatsApp;
          session.variables['opcao_selecionada'] = storeName;
          session.variables['resposta_usuario'] = storeName;
          console.log(`[FlowRunner] 🏬 Loja selecionada pelo cliente: "${storeName}" (ID: ${storeId})`);
        }

        // If from shipping_calculator
        if (prevType === 'shipping_calculator') {
          const shipMap = {
            shipping_motoboy: { label: 'Motoboy Express (Recife)', price: 'R$ 15,00', days: 'Hoje' },
            shipping_correios: { label: 'Correios SEDEX / PAC', price: 'R$ 24,90', days: '2 a 5 dias úteis' },
            shipping_pickup: { label: 'Retirada Grátis em Loja', price: 'Grátis', days: 'Pronto em 2h' },
          };
          const sInfo = shipMap[matchedBtn.id] || { label: matchedBtn.title, price: 'R$ 15,00', days: '1 dia' };
          session.variables['tipo_frete'] = sInfo.label;
          session.variables['valor_frete'] = sInfo.price;
          session.variables['prazo_entrega'] = sInfo.days;
          session.variables['tipo_frete_id'] = matchedBtn.id;
          console.log(`[FlowRunner] 🚚 Frete selecionado: "${sInfo.label}" (${sInfo.price})`);
        }

        // If from pix_payment
        if (prevType === 'pix_payment') {
          session.variables['status_pagamento'] = matchedBtn.id === 'pix_paid' ? 'comprovante_enviado' : 'ajuda_solicitada';
          console.log(`[FlowRunner] 💳 PIX status: ${session.variables['status_pagamento']}`);
        }

        // If from vip_consultation
        if (prevType === 'vip_consultation') {
          session.variables['tipo_consultoria'] = matchedBtn.id === 'consult_online' ? 'Online (Vídeo / WhatsApp)' : 'Presencial na Loja Física';
          session.variables['consultoria_id'] = matchedBtn.id;
          console.log(`[FlowRunner] ✨ Consultoria selecionada: ${session.variables['tipo_consultoria']}`);
        }

        // If from promotional_coupon
        if (prevType === 'promotional_coupon') {
          session.variables['cupom_aplicado'] = matchedBtn.id === 'coupon_valid' ? 'BEMVINDO10' : '';
          session.variables['desconto_valor'] = matchedBtn.id === 'coupon_valid' ? '10%' : '0%';
          console.log(`[FlowRunner] 🎟️ Cupom aplicado: ${session.variables['cupom_aplicado']}`);
        }

        // If from select_product
        if (prevType === 'select_product') {
          const pName = matchedBtn.title.split('(')[0].trim();
          session.variables['produto_selecionado'] = pName;
          session.variables['opcao_selecionada'] = pName;
          if (matchedBtn.title.includes('49')) session.variables['valor_produto'] = 'R$ 49,90';
          else if (matchedBtn.title.includes('89')) session.variables['valor_produto'] = 'R$ 89,90';
          else if (matchedBtn.title.includes('199')) session.variables['valor_produto'] = 'R$ 199,90';
          else session.variables['valor_produto'] = 'R$ 79,90';
          session.variables['valor_total'] = session.variables['valor_produto'];
          console.log(`[FlowRunner] 🛍️ Produto selecionado: ${pName}`);
        }

        const targetEdge =
          edges.find(
            (e) =>
              e.source === prevNode.id &&
              (e.sourceHandle === matchedBtn.id ||
                e.sourceHandle === `btn_${matchedBtnIndex + 1}` ||
                e.sourceHandle === `btn_${matchedBtnIndex}` ||
                (matchedBtn.storeId && e.sourceHandle === matchedBtn.storeId) ||
                (matchedBtn.slug && e.sourceHandle === matchedBtn.slug) ||
                (matchedBtn.slug && e.sourceHandle === `store_${matchedBtn.slug}`) ||
                (matchedBtn.id === 'store-001' && (e.sourceHandle === 'store_matriz' || e.sourceHandle === 'matriz' || e.sourceHandle === 'store-001')) ||
                (matchedBtn.id === 'store_matriz' && (e.sourceHandle === 'store-001' || e.sourceHandle === 'matriz')) ||
                (matchedBtn.id === 'store-002' && (e.sourceHandle === 'store_ipojuca' || e.sourceHandle === 'store_boulevard' || e.sourceHandle === 'ipojuca' || e.sourceHandle === 'store-002')) ||
                (matchedBtn.id === 'store_ipojuca' && (e.sourceHandle === 'store-002' || e.sourceHandle === 'store_boulevard' || e.sourceHandle === 'ipojuca')) ||
                (matchedBtn.id === 'store-003' && (e.sourceHandle === 'store_ecommerce' || e.sourceHandle === 'ecommerce' || e.sourceHandle === 'store-003')) ||
                (matchedBtn.id === 'store_ecommerce' && (e.sourceHandle === 'store-003' || e.sourceHandle === 'ecommerce')) ||
                (e.sourceHandle === `store-${String(matchedBtnIndex + 1).padStart(3, '0')}`) ||
                (e.sourceHandle === `store_${matchedBtnIndex + 1}`))
          ) ||
          (matchedBtnIndex >= 0 ? edges.filter((e) => e.source === prevNode.id)[matchedBtnIndex] : null) ||
          edges.find((e) => e.source === prevNode.id);

        if (targetEdge) {
          currentNode = nodes.find((n) => n.id === targetEdge.target);
          session.currentNodeId = currentNode?.id || null;
        }
      } else {
        // If user typed something unrelated while on buttons node
        const retryLines = buttons.map((b, i) => {
          const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i] || `*${i + 1}*`;
          const cleanTitle = cleanButtonTitle(b.title || b.text || `Opção ${i + 1}`);
          return `${numEmoji} *${cleanTitle}*`;
        }).join('\n\n');

        const retryMsg = `*Opção não reconhecida.*\n\nPor favor, escolha uma das opções abaixo:\n\n${retryLines}\n\n_👉 Digite o número ou o nome da opção desejada:_`;
        replies.push(retryMsg);
        session.currentNodeId = prevNode.id;
        session.activeButtons = buttons;
        
        // Save session & return
        if (!db.sessions) db.sessions = {};
        db.sessions[cleanPhone] = session;
        db.sessions[rawId] = session;
        saveDb(db);
        for (const rep of replies) {
          recordRealMessage(cleanPhone, senderName, 'outbound', rep);
        }
        return replies;
      }
    }

    if (!currentNode) {
      currentNode = prevNode || nodes.find((n) => (n.data?.nodeType || n.type) === 'trigger') || nodes[0];
      session.currentNodeId = currentNode?.id || null;
    }
  }

  let stepLimit = 15;

  while (currentNode && stepLimit > 0) {
    stepLimit--;
    const nodeType = currentNode.data?.nodeType || currentNode.type;
    const config = currentNode.data?.config || {};

    // 0. Trigger Node
    if (nodeType === 'trigger') {
      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 1. Message Node
    else if (nodeType === 'message') {
      const text = replaceVars(config.text || 'Olá!', session.variables, botProfile);
      if (text) {
        replies.push({
          type: 'text',
          text,
          replyMode: config.replyMode || 'send',
        });
      }
    }

    // 2. Buttons Node (Native Interactive Buttons)
    else if (nodeType === 'buttons') {
      const body = replaceVars(config.bodyText || 'Escolha uma opção:', session.variables, botProfile);
      const rawButtons = config.buttons || [
        { id: 'btn_1', title: 'Opção 1' },
        { id: 'btn_2', title: 'Opção 2' },
      ];
      const footer = config.footerText ? replaceVars(config.footerText, session.variables, botProfile) : '';

      const sanitizedButtons = rawButtons.map((btn) => ({
        ...btn,
        title: cleanButtonTitle(btn.title || btn.text || btn.id),
      }));

      session.activeButtons = sanitizedButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body,
        footer,
        buttons: sanitizedButtons,
        replyMode: config.replyMode || 'send',
      });
      break;
    }

    // 3. Question Node
    else if (nodeType === 'question') {
      const qText = replaceVars(config.questionText || 'Por favor, informe seu dado:', session.variables, botProfile);
      replies.push({
        type: 'text',
        text: qText,
        replyMode: config.replyMode || 'send',
      });
      session.currentNodeId = currentNode.id;
      session.waitingForVar = config.variableName || 'resposta_usuario';
      break;
    }

    // 4.1 Client Lookup Node (Consultar Cliente CRM no Bot)
    else if (nodeType === 'client_lookup') {
      const lookupPhoneVar = config.phoneVar || 'telefone_whatsapp';
      const targetPhone = String(session.variables[lookupPhoneVar] || cleanPhone).replace(/\D/g, '');
      const contactInfo = await findRegisteredContact(targetPhone, senderName, db);
      const isFound = contactInfo.isRegistered;
      const contact = contactInfo.contact;

      session.variables['cliente_encontrado'] = isFound;
      session.variables['is_primeiro_contato'] = !isFound;
      session.variables['tipo_cliente'] = isFound ? 'recorrente' : 'novo';
      session.variables['telefone_whatsapp'] = targetPhone || cleanPhone;

      if (isFound && contact) {
        session.variables['cliente_nome'] = contact.name || senderName;
        session.variables['nome_cliente'] = contact.name || senderName;
        session.variables['cliente_telefone'] = contact.phone || targetPhone;
        session.variables['cliente_email'] = contact.email || '';
        session.variables['cliente_bebe'] = contact.baby_name || contact.custom_fields?.baby_name || '';
        session.variables['cliente_dpp'] = contact.due_date || contact.custom_fields?.due_date || '';
        session.variables['cliente_tags'] = (contact.tags || []).join(', ');
        if (contact.custom_fields) {
          Object.assign(session.variables, contact.custom_fields);
        }
      }

      console.log(`[FlowRunner] 🔍 [Client Lookup] Busca por ${targetPhone}: ${isFound ? `✅ Localizado: "${contact?.name}"` : '❌ Não encontrado na base'}`);

      const targetHandle = isFound ? 'found' : 'not_found';
      let branchEdge = edges.find((e) => e.source === currentNode.id && (e.sourceHandle === targetHandle || (isFound ? e.sourceHandle === 'is_existing' : e.sourceHandle === 'is_new')));
      if (!branchEdge) {
        branchEdge = edges.find((e) => e.source === currentNode.id && (isFound ? e.sourceHandle?.includes('found') || e.sourceHandle?.includes('exist') : e.sourceHandle?.includes('not') || e.sourceHandle?.includes('new')));
      }
      if (!branchEdge) {
        const nodeEdges = edges.filter((e) => e.source === currentNode.id);
        branchEdge = isFound ? nodeEdges[0] : (nodeEdges[1] || nodeEdges[0]);
      }

      if (branchEdge) {
        currentNode = nodes.find((n) => n.id === branchEdge.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 4.2 Salvar / Vincular Dados do Cliente (CRM & WhatsApp Profile)
    else if (nodeType === 'client_upsert' || nodeType === 'update_contact') {
      // 1. Resolver Nome do Cliente (Digitado ou Variável)
      let resolvedName = '';
      const rawNameConfig = config.contactName || config.nameField;
      if (rawNameConfig) {
        // Limpar possíveis caracteres anexados como typos: '{{nome_cliente}}n' -> '{{nome_cliente}}'
        let cleanRaw = String(rawNameConfig).trim();
        const bracketMatch = cleanRaw.match(/\{\{([^}]+)\}\}/);
        if (bracketMatch) {
          const varInside = bracketMatch[1].trim();
          resolvedName = session.variables[varInside] || session.variables[`{{${varInside}}}`] || '';
        }
        if (!resolvedName) {
          resolvedName = replaceVars(cleanRaw, session.variables, botProfile);
        }
        if (resolvedName === rawNameConfig && !rawNameConfig.includes('{{')) {
          resolvedName = session.variables[rawNameConfig] || rawNameConfig;
        }
      }

      // Fallback robusto se a variável não foi substituída ou contiver valores genéricos
      const isUnresolved = !resolvedName || 
                           resolvedName.startsWith('{{') || 
                           resolvedName.endsWith('}}') || 
                           ['nome_cliente', 'cliente_nome', 'nome', 'resposta_usuario', 'nome_clientenovo', 'undefined', 'null', 'Cliente WhatsApp', 'Cliente', 'Cliente Pitoco'].includes(resolvedName.trim());

      if (isUnresolved) {
        resolvedName = session.variables['nome_clientenovo'] || 
                       session.variables['nome_cliente'] || 
                       session.variables['cliente_nome'] || 
                       session.variables['nome'] || 
                       session.variables['resposta_usuario'] || 
                       (senderName && senderName !== 'Cliente' && senderName !== 'Cliente Pitoco' ? senderName : '') || 
                       'Cliente WhatsApp';
      }
      resolvedName = String(resolvedName).replace(/[{}]/g, '').trim();

      // 2. Resolver Telefone do Cliente (Interagindo, Variável ou Fixo)
      let targetPhone = cleanPhone;
      if (config.phoneMode === 'fixed' && config.fixedPhone) {
        targetPhone = String(config.fixedPhone).replace(/\D/g, '');
      } else if (config.phoneMode === 'variable' && config.phoneVariable) {
        const varKey = config.phoneVariable.replace(/[{}]/g, '').trim();
        const extracted = session.variables[varKey] || session.variables[config.phoneVariable] || replaceVars(config.phoneVariable, session.variables, botProfile);
        const cleanExt = String(extracted || '').replace(/\D/g, '');
        if (cleanExt.length >= 8) targetPhone = cleanExt;
      } else if (config.phoneField) {
        const rawPhone = replaceVars(config.phoneField, session.variables, botProfile);
        const cleanExt = String(rawPhone || '').replace(/\D/g, '');
        if (cleanExt.length >= 8) targetPhone = cleanExt;
      }
      if (!targetPhone) targetPhone = cleanPhone;

      const { primaryPhone, allPhones } = resolveLinkedPhones(targetPhone, db);
      if (primaryPhone && primaryPhone.length >= 10 && primaryPhone.length <= 13) {
        targetPhone = primaryPhone;
      }

      // Gravar na variável de saída do telefone
      const phoneVarKey = (config.phoneVarName || 'telefone_whatsapp').replace(/[{}]/g, '').trim();
      session.variables[phoneVarKey] = targetPhone;
      session.variables['telefone_whatsapp'] = targetPhone;
      session.variables['telefone_cliente'] = targetPhone;
      session.variables['cliente_telefone'] = targetPhone;

      // 3. Resolver Foto do Perfil do WhatsApp
      let resolvedPhoto = '';
      if (config.saveProfilePicture !== false) {
        resolvedPhoto = profilePicUrl || (db.conversations && (db.conversations[`conv-${targetPhone}`]?.profile_pic || db.conversations[`conv-${cleanPhone}`]?.profile_pic)) || '';
      }
      if (config.customPhotoUrl) {
        const customP = replaceVars(config.customPhotoUrl, session.variables, botProfile);
        if (customP) resolvedPhoto = customP;
      }

      // 4. Resolver Campos do Bebê, DPP, E-mail, Tags e Notas
      const babyName = replaceVars(config.babyNameField || session.variables['nome_bebe'] || session.variables['baby_name'] || '', session.variables, botProfile);
      const dueDate = replaceVars(config.dueDateField || session.variables['data_parto'] || session.variables['due_date'] || '', session.variables, botProfile);
      const email = replaceVars(config.emailField || session.variables['email_cliente'] || '', session.variables, botProfile);
      const rawTags = config.tags || config.tagsField || 'Cliente WhatsApp, Bot';
      const tagsList = typeof rawTags === 'string' 
        ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) 
        : (rawTags || []);
      const notes = replaceVars(config.notesField || 'Cadastrado e atualizado pelo fluxo do bot', session.variables, botProfile);

      // Campos customizados adicionais
      const customFields = {};
      if (config.customFieldKey) {
        const fKey = config.customFieldKey.replace(/[{}]/g, '').trim();
        let fVal = config.customFieldValue || '';
        fVal = replaceVars(fVal, session.variables, botProfile);
        customFields[fKey] = fVal;
        session.variables[fKey] = fVal;
      }

      // 5. Atualizar no Banco de Dados em todos os telefones vinculados (Telefone Real + LID)
      if (!db.contacts) db.contacts = {};
      let savedContact = null;

      for (const phoneKey of allPhones) {
        const existing = (typeof db.contacts === 'object' && !Array.isArray(db.contacts)) ? (db.contacts[phoneKey] || {}) : {};
        const contactObj = {
          id: existing.id || `contact-${phoneKey}`,
          name: resolvedName || existing.name || 'Cliente WhatsApp',
          phone: phoneKey,
          profile_picture_url: resolvedPhoto || existing.profile_picture_url,
          baby_name: babyName || existing.baby_name,
          due_date: dueDate || existing.due_date,
          email: email || existing.email,
          tags: Array.from(new Set([...(existing.tags || []), ...tagsList])),
          status: 'active',
          is_registered: true,
          notes: notes || existing.notes || 'Cadastrado e atualizado pelo fluxo do bot',
          custom_fields: { ...(existing.custom_fields || {}), ...customFields, nome_cliente: resolvedName },
          created_at: existing.created_at || new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (Array.isArray(db.contacts)) {
          const idx = db.contacts.findIndex(c => String(c.phone || '').replace(/\D/g, '') === phoneKey);
          if (idx >= 0) db.contacts[idx] = contactObj;
          else db.contacts.push(contactObj);
        } else {
          db.contacts[phoneKey] = contactObj;
        }

        if (phoneKey === targetPhone || !savedContact) {
          savedContact = contactObj;
        }

        // 6. Atualizar Conversa Ativa na Central de Atendimento
        if (config.updateActiveConversation !== false && db.conversations) {
          const convKey = `conv-${phoneKey}`;
          if (db.conversations[convKey]) {
            db.conversations[convKey].contact_name = resolvedName;
            if (resolvedPhoto) db.conversations[convKey].profile_pic = resolvedPhoto;
            db.conversations[convKey].updated_at = new Date().toISOString();
            syncConversationToSupabase(db.conversations[convKey]);
          }
        }

        // 7. Persistência em Nuvem (Supabase contacts + clients)
        await syncContactToSupabase(contactObj);
      }

      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
      } catch (err) {}

      // 8. Variáveis no Contexto da Conversa com todos os aliases
      session.variables['cliente_salvo'] = true;
      session.variables['cliente_id'] = savedContact?.id;
      session.variables['cliente_nome'] = resolvedName;
      session.variables['nome_cliente'] = resolvedName;
      session.variables['primeiro_nome'] = resolvedName.split(' ')[0] || resolvedName;
      session.variables['nome'] = resolvedName;
      session.variables['nome_clientenovo'] = resolvedName;
      session.variables['resposta_usuario'] = resolvedName;
      session.variables['{{cliente_nome}}'] = resolvedName;
      session.variables['{{nome_cliente}}'] = resolvedName;
      session.variables['{{primeiro_nome}}'] = resolvedName.split(' ')[0] || resolvedName;
      session.variables['{{nome}}'] = resolvedName;
      session.variables['{{nome_clientenovo}}'] = resolvedName;
      session.variables['{{resposta_usuario}}'] = resolvedName;
      session.variables['is_primeiro_contato'] = false;
      session.variables['is_novo_contato'] = false;
      session.variables['is_existing_contact'] = true;
      session.variables['cliente_telefone'] = targetPhone;
      session.variables['telefone_whatsapp'] = targetPhone;
      session.variables['cliente_foto'] = resolvedPhoto;
      session.variables['foto_cliente'] = resolvedPhoto;
      if (babyName) session.variables['cliente_bebe'] = babyName;
      if (dueDate) session.variables['cliente_dpp'] = dueDate;

      console.log(`[FlowRunner] 💾 [Salvar Dados] Contato salvo: "${resolvedName}" (${targetPhone}) | Foto: ${resolvedPhoto ? 'Sim' : 'Não'} | Tags: [${tagsList.join(', ')}]`);

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 4. Check Contact Node (Primeiro Contato vs Contato Salvo / Recorrente)
    else if (nodeType === 'check_contact') {
      let checkPhone = cleanPhone;
      if (config.phoneMode === 'variable' && config.phoneVariable) {
        const varKey = config.phoneVariable.replace(/[{}]/g, '').trim();
        const extracted = session.variables[varKey] || session.variables[config.phoneVariable] || replaceVars(config.phoneVariable, session.variables, botProfile);
        const cleanExt = String(extracted || '').replace(/\D/g, '');
        if (cleanExt.length >= 8) checkPhone = cleanExt;
      }

      const contactInfo = await findRegisteredContact(checkPhone, senderName, db, config.checkCriteria || 'crm_or_name');
      const isNew = !contactInfo.isRegistered;
      const contact = contactInfo.contact;

      // Populate rich context variables
      session.variables['is_primeiro_contato'] = isNew;
      session.variables['is_novo_contato'] = isNew;
      session.variables['is_existing_contact'] = !isNew;
      session.variables['tipo_cliente'] = isNew ? 'novo' : 'recorrente';
      session.variables['telefone_whatsapp'] = checkPhone;

      if (contact?.custom_fields) {
        Object.assign(session.variables, contact.custom_fields);
      }
      if (!isNew && contact?.name) {
        session.variables['nome_cliente'] = contact.name;
        session.variables['cliente_nome'] = contact.name;
        session.variables['nome'] = contact.name;
        const firstName = String(contact.name).trim().split(' ')[0] || contact.name;
        session.variables['primeiro_nome'] = firstName;
      }
      if (contact?.tags) {
        const rawTags = contact.tags;
        const tagsStr = Array.isArray(rawTags) ? rawTags.join(', ') : String(rawTags || '');
        session.variables['tags_contato'] = tagsStr;
      }

      console.log(`[FlowRunner] 👥 [Check Contact] Verificação para ${checkPhone}: ${isNew ? '🆕 NOVO CONTATO (1ª Vez)' : `✅ CONTATO JÁ CADASTRADO ("${contact?.name || 'Cliente'}")`}`);

      // Follow edge from 'is_new' or 'is_existing' handle
      const targetHandle = isNew ? 'is_new' : 'is_existing';
      let branchEdge = edges.find((e) => e.source === currentNode.id && e.sourceHandle === targetHandle);

      if (!branchEdge) {
        branchEdge = edges.find(
          (e) =>
            e.source === currentNode.id &&
            (isNew
              ? e.sourceHandle?.includes('new') || e.sourceHandle?.includes('novo')
              : e.sourceHandle?.includes('exist') || e.sourceHandle?.includes('salvo') || e.sourceHandle?.includes('recorrente'))
        );
      }

      if (!branchEdge) {
        const nodeEdges = edges.filter((e) => e.source === currentNode.id);
        if (nodeEdges.length >= 2) {
          branchEdge = isNew ? nodeEdges[0] : nodeEdges[1];
        } else {
          branchEdge = nodeEdges[0];
        }
      }

      if (branchEdge) {
        currentNode = nodes.find((n) => n.id === branchEdge.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5. Show Services Node (Apenas Exibição / Leitura do Catálogo)
    else if (nodeType === 'show_services' || (nodeType === 'services_catalog' && config.displayFormat !== 'buttons')) {
      const rawServices = (db.agendaSettings?.services && db.agendaSettings.services.length > 0) ? db.agendaSettings.services : [
        { id: 'srv-1', name: 'Body Suedine 100% Algodão', duration_minutes: 30, price: 49.9 },
        { id: 'srv-2', name: 'Macacão Zíper Duplo Confort', duration_minutes: 30, price: 89.9 },
        { id: 'srv-3', name: 'Saída Maternidade Tricot Luxo', duration_minutes: 30, price: 199.9 },
        { id: 'srv-4', name: 'Kit de Berço 9 Peças 200 Fios', duration_minutes: 30, price: 389.0 },
        { id: 'srv-5', name: 'Consultoria VIP de Enxoval', duration_minutes: 45, price: 0.0 },
      ];
      const activeServices = rawServices.filter((s) => s.active !== false && s.is_active !== false);
      const services = activeServices.length > 0 ? activeServices : rawServices;

      const header = replaceVars(config.headerText || '🍼 *Catálogo Pitoco de Gente - Bebê & Enxovais*', session.variables, botProfile);
      const footer = config.footerText ? `\n\n_${replaceVars(config.footerText, session.variables, botProfile)}_` : '';

      const serviceLines = services
        .map((s, idx) => {
          const priceStr = Number(s.price || 0).toFixed(2).replace('.', ',');
          const descStr = s.description ? `\n   _${s.description}_` : '';
          return `*${idx + 1}️⃣* *${s.name}*\n   💰 R$ ${priceStr} • ⏱️ ${s.duration_minutes || 30} min${descStr}`;
        })
        .join('\n\n');

      const fullCatalogText = `${header}\n\n${serviceLines}${footer}`;
      session.variables['catalogo_servicos_texto'] = fullCatalogText;
      session.variables['catalogo_servicos'] = fullCatalogText;
      replies.push(fullCatalogText);

      // Continues straight to the next connected node
      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      session.currentNodeId = currentNode.id;
      break;
    }

    // 5.2 Select Service Node (Escolha de Serviço via Botões Interativos)
    else if (nodeType === 'select_service' || (nodeType === 'services_catalog' && config.displayFormat === 'buttons')) {
      const rawServices = (db.agendaSettings?.services && db.agendaSettings.services.length > 0) ? db.agendaSettings.services : [
        { id: 'srv-1', name: 'Body Suedine 100% Algodão', duration_minutes: 30, price: 49.9 },
        { id: 'srv-2', name: 'Macacão Zíper Duplo Confort', duration_minutes: 30, price: 89.9 },
        { id: 'srv-3', name: 'Saída Maternidade Tricot Luxo', duration_minutes: 30, price: 199.9 },
        { id: 'srv-4', name: 'Kit de Berço 9 Peças 200 Fios', duration_minutes: 30, price: 389.0 },
        { id: 'srv-5', name: 'Consultoria VIP de Enxoval', duration_minutes: 45, price: 0.0 },
      ];
      const activeServices = rawServices.filter((s) => s.active !== false && s.is_active !== false);
      const services = activeServices.length > 0 ? activeServices : rawServices;

      const intro = replaceVars(config.introMessage || 'Qual peça ou atendimento você deseja escolher hoje?', session.variables, botProfile);
      const footer = config.footerText ? replaceVars(config.footerText, session.variables, botProfile) : 'Toque no serviço desejado:';

      const serviceButtons = services.map((s, idx) => ({
        id: `srv_${s.id || idx + 1}`,
        title: `${s.name} (R$ ${Number(s.price || 0).toFixed(2).replace('.', ',')})`,
        serviceName: s.name,
        price: Number(s.price || 0),
        duration_minutes: s.duration_minutes || 30,
        fullService: s,
      }));

      session.activeButtons = serviceButtons;
      session.currentNodeId = currentNode.id;

      if (services.length <= 3) {
        replies.push({
          type: 'buttons',
          body: `🍼 *Escolha o Produto / Atendimento:*\n\n${intro}`,
          footer,
          buttons: serviceButtons.map((b) => ({
            id: b.id,
            title: cleanButtonTitle(b.title).slice(0, 20),
          })),
        });
      } else {
        const listLines = services
          .map((s) => `• *${s.name}*\n   💰 R$ ${Number(s.price || 0).toFixed(2).replace('.', ',')} • ⏱️ ${s.duration_minutes || 30} min`)
          .join('\n\n');

        replies.push({
          type: 'buttons',
          body: `🍼 *Escolha o Produto / Atendimento:*\n\n${intro}\n\n${listLines}`,
          footer: '👉 Toque no botão ou digite a opção desejada:',
          buttons: serviceButtons.slice(0, 3).map((b) => ({
            id: b.id,
            title: cleanButtonTitle(b.title).slice(0, 20),
          })),
        });
      }
      break;
    }

    // 6. Select Date Node (Escolha de Data do Agendamento)
    else if (nodeType === 'select_date' || nodeType === 'ask_date') {
      const qText = config.questionText ? replaceVars(config.questionText, session.variables, botProfile) : 'Para qual dia você gostaria de agendar?';
      const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const tomDate = new Date();
      tomDate.setDate(tomDate.getDate() + 1);
      const tomStr = tomDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const dateButtons = [
        { id: 'date_today', title: `Hoje (${todayStr})` },
        { id: 'date_tomorrow', title: `Amanhã (${tomStr})` },
        { id: 'date_custom', title: 'Outra Data' },
      ];

      session.activeButtons = dateButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `📅 *Escolha a Data do Agendamento*\n\n${qText}`,
        footer: 'Toque em uma das opções ou digite a data desejada (ex: 25/08):',
        buttons: dateButtons,
      });
      break;
    }

    // 6.2 Select Time Slot Node (Escolha de Horário Disponível na Data)
    else if (nodeType === 'select_time_slot' || nodeType === 'schedule_contact') {
      const dateVar = config.dateVariable || 'data_agendamento';
      const dateVal = session.variables[dateVar] || session.variables['data_agendamento'] || new Date().toISOString().split('T')[0];
      const srvName = config.serviceName ? replaceVars(config.serviceName, session.variables, botProfile) : (session.variables['servico_selecionado'] || 'Atendimento Especializado');

      const srvObj = (db.agendaSettings?.services || []).find((s) => 
        s.name?.trim().toLowerCase() === srvName.trim().toLowerCase() ||
        srvName.toLowerCase().includes(s.name?.toLowerCase()) ||
        s.name?.toLowerCase().includes(srvName.toLowerCase())
      );
      const baseSlotDur = db.agendaSettings?.slot_duration_minutes || 30;
      const srvDuration = Number(srvObj?.duration_minutes) || Number(session.variables['duracao_minutos']) || baseSlotDur;

      const slots = getAvailableSlots(dateVal, db, srvDuration);

      if (slots.length === 0) {
        replies.push(`📅 *Agenda Completa para ${dateVal}*\n\nNão encontramos horários livres disponíveis com tempo contínuo para este serviço (${srvDuration} min). Por favor, envie outra data para agendar.`);
        session.currentNodeId = currentNode.id;
        break;
      }

      const slotsCount = Math.max(1, Math.ceil(srvDuration / baseSlotDur));

      // Present available slots as Clickable Buttons (showing unified range if multi-slot)
      const slotButtons = slots.slice(0, 3).map((slot) => {
        const timeStr = typeof slot === 'string' ? slot : slot.time;
        const [sh, sm] = timeStr.split(':').map(Number);
        const endMin = sh * 60 + sm + srvDuration;
        const endH = Math.floor(endMin / 60);
        const endM = endMin % 60;
        const endTimeFormatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        const titleStr = slotsCount > 1 ? `🕒 ${timeStr}-${endTimeFormatted}` : `🕒 ${timeStr}`;

        return {
          id: `slot_${timeStr}`,
          title: titleStr.length > 20 ? titleStr.substring(0, 20) : titleStr,
          slotTime: timeStr,
          endTime: endTimeFormatted,
          duration: srvDuration,
          slotsCount
        };
      });

      session.activeButtons = slotButtons;
      session.variables['data_agendamento'] = dateVal;
      session.variables['servico_selecionado'] = srvName;
      session.variables['duracao_minutos'] = srvDuration;
      session.currentNodeId = currentNode.id;

      const slotNotice = slotsCount > 1 ? `\n• Duração: *${srvDuration} min* (${slotsCount} slots unidos como 1 só)` : `\n• Duração: *${srvDuration} min*`;
      const intro = config.introMessage ? replaceVars(config.introMessage, session.variables, botProfile) : 'Estes são os horários livres com tempo completo disponível para seu atendimento. Toque no seu horário preferido:';

      replies.push({
        type: 'buttons',
        body: `🕒 *Horários Livres na Agenda (${dateVal}):*\n\n• Serviço: *${srvName}*${slotNotice}\n\n${intro}`,
        footer: 'Toque no horário desejado para agendar:',
        buttons: slotButtons,
      });
      break;
    }

    // 4.4 Confirm Booking Node
    else if (nodeType === 'confirm_booking') {
      const srvName = session.variables['servico_selecionado'] || config.serviceName || 'Atendimento Geral';
      const srvPrice = session.variables['valor_servico'] || '';
      const dateVal = session.variables['data_agendamento'] || new Date().toISOString().split('T')[0];
      const timeVal = session.variables['horario_agendamento'] || session.variables['horario_escolhido'] || '09:00';
      const clientName = session.variables.nome_cliente || senderName;

      const srvObj = (db.agendaSettings?.services || []).find((s) => s.name?.toLowerCase().trim() === srvName.toLowerCase().trim());
      const baseSlotDur = db.agendaSettings?.slot_duration_minutes || 30;
      const srvDur = srvObj?.duration_minutes || session.variables['duracao_minutos'] || baseSlotDur;
      const slotsCount = Math.max(1, Math.ceil(srvDur / baseSlotDur));

      // Calculate endTime
      const [sh, sm] = timeVal.split(':').map(Number);
      const endMin = (sh || 0) * 60 + (sm || 0) + srvDur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endTimeVal = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      // Check for slot collision: do not allow booking if slot is already occupied!
      const isOccupied = isSlotBooked(dateVal, timeVal, srvDur, db);
      if (isOccupied) {
        const nextSlot = getNextAvailableSlot(dateVal, timeVal, db, srvDur);
        const freeSlots = getAvailableSlots(dateVal, db, srvDur);
        const suggestedSlots = freeSlots.slice(0, 3).map((slot) => {
          const slotTime = typeof slot === 'string' ? slot : slot.time;
          return {
            id: `slot_${slotTime}`,
            title: `🕒 ${slotTime}`,
            slotTime: slotTime,
          };
        });

        session.activeButtons = suggestedSlots;
        session.variables['data_agendamento'] = dateVal;
        session.currentNodeId = currentNode.id;

        recordLiveLog(
          'appointment_status',
          `Conflito Evitado: ${timeVal}`,
          `Cliente ${clientName} tentou agendar ${timeVal} que já estava ocupado. Sugerido: ${nextSlot || 'outro dia'}.`,
          cleanPhone,
          clientName,
          { attemptedTime: timeVal, date: dateVal, suggestedSlot: nextSlot }
        );

        if (suggestedSlots.length > 0) {
          replies.push({
            type: 'buttons',
            body: `⚠️ *Horário das ${timeVal} já está Ocupado!*\n\nOlá *${clientName}*, o horário das *${timeVal}* no dia *${dateVal}* já foi reservado por outro cliente.\n\n👉 *Sugerimos o próximo horário livre disponível com tempo suficiente (${srvDur} min):* *${nextSlot || suggestedSlots[0].slotTime}*`,
            footer: 'Toque em um dos horários livres abaixo para agendar:',
            buttons: suggestedSlots,
          });
        } else {
          replies.push(`⚠️ *Agenda Lotada para ${dateVal}*\n\nOlá *${clientName}*, o horário das *${timeVal}* já foi reservado e não há outros horários com ${srvDur} min disponíveis nesta data. Por favor, digite outra data para agendamento.`);
        }
        break;
      }

      const newApt = {
        id: `apt-${Date.now()}`,
        contact_phone: cleanPhone,
        contact_name: clientName,
        service_name: srvName,
        duration_minutes: srvDur,
        appointment_date: dateVal,
        appointment_time: timeVal,
        end_time: endTimeVal,
        slots_count: slotsCount,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      };

      if (!db.appointments) db.appointments = [];
      db.appointments.push(newApt);

      recordLiveLog(
        'appointment_created',
        `Agendamento Confirmado: ${srvName}`,
        `${clientName} agendou para ${dateVal} às ${timeVal}`,
        cleanPhone,
        clientName,
        newApt
      );

      if (db.contacts[cleanPhone]) {
        const curTags = db.contacts[cleanPhone].tags || [];
        if (!curTags.includes('Agendado')) db.contacts[cleanPhone].tags = [...curTags, 'Agendado'];
      }

      session.variables['data_agendamento'] = dateVal;
      session.variables['horario_agendamento'] = timeVal;
      session.variables['servico_agendado'] = srvName;

      const defaultConfirm = `✅ *Agendamento Confirmado com Sucesso!*\n\n• *Cliente:* ${clientName}\n• *Serviço:* ${srvName}${srvPrice ? ` (${srvPrice})` : ''}\n• *Data:* ${dateVal}\n• *Horário:* ${timeVal}\n\nSeu horário foi reservado em nossa Agenda com sucesso!`;
      const confirmText = config.confirmMessage ? replaceVars(config.confirmMessage, session.variables, botProfile) : defaultConfirm;
      replies.push(confirmText);
    }


    // 5.3 Store Selector Node (Multi-Filiais dinâmico baseado em db.stores)
    else if (nodeType === 'store_selector') {
      const intro = config.introMessage
        ? replaceVars(config.introMessage, session.variables, botProfile)
        : 'Olá! Seja bem-vinda à *Pitoco de Gente*. 🍼 Com qual de nossas lojas você deseja falar hoje?';

      // Carregar lojas ativas do banco ou lista padrão real
      const activeStores = Array.isArray(db.stores) && db.stores.length > 0
        ? db.stores.filter((s) => s.is_active !== false && s.status !== 'inactive')
        : [
            { id: 'store-001', name: 'Loja Matriz — Centro', slug: 'matriz' },
            { id: 'store-002', name: 'Loja Ipojuca - Filial', slug: 'ipojuca' },
            { id: 'store-003', name: 'Atendimento Geral / E-commerce', slug: 'ecommerce' },
          ];

      const storeButtons = activeStores.slice(0, 3).map((st) => {
        const cleanName = st.name.replace(/^Loja\s+/i, '').trim();
        const shortName = cleanName.length > 20 ? cleanName.slice(0, 20) : cleanName;
        return {
          id: st.id,
          title: cleanButtonTitle(shortName),
          storeId: st.id,
          slug: st.slug,
          storeName: st.name,
        };
      });

      session.activeButtons = storeButtons;
      session.currentNodeId = currentNode.id;

      const storesListText = activeStores
        .map((st) => `• *${st.name}*${st.city ? ` (${st.city})` : ''}`)
        .join('\n');

      replies.push({
        type: 'buttons',
        body: `🏬 *Escolha de Filial / Loja:*\n\n${intro}\n\n${storesListText}`,
        footer: 'Toque no botão ou digite a opção desejada:',
        buttons: storeButtons,
      });
      break;
    }

    // 5.4 Show Catalog Node (Vitrine de Moda Bebê & Enxovais)
    else if (nodeType === 'show_catalog') {
      const header = config.headerText
        ? replaceVars(config.headerText, session.variables, botProfile)
        : '🍼 *Vitrine Pitoco de Gente — Moda Bebê & Enxovais*\n\nConheça nossas peças mais amadas pelas mamães:';
      const footer = config.footerText
        ? `\n\n_${replaceVars(config.footerText, session.variables, botProfile)}_`
        : '\n\n_✨ Trabalhamos do RN ao 3 anos. Peças 100% algodão suedine e tricot antialérgico._';

      const catalogBody = `${header}\n\n` +
        `• *Body Suedine 100% Algodão*\n   💰 R$ 49,90 • 👶 RN a GG (Cores Lisas & Estampadas)\n\n` +
        `• *Macacão Confort Zíper Duplo*\n   💰 R$ 89,90 • 👶 RN ao 3 Anos (Proteção no Queixo)\n\n` +
        `• *Saída Maternidade Tricot Luxo (5 Peças)*\n   💰 R$ 199,90 • 👶 RN e P (Macacão + Manta + Body + Faixinha)\n\n` +
        `• *Kit de Berço 9 Peças 200 Fios*\n   💰 R$ 389,00 • 🛏️ Padrão Americano (100% Algodão Hipoalergênico)` +
        `${footer}`;

      session.variables['catalogo_produtos'] = catalogBody;
      replies.push(catalogBody);

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5.5 Select Product Node
    else if (nodeType === 'select_product') {
      const intro = config.introMessage
        ? replaceVars(config.introMessage, session.variables, botProfile)
        : 'Qual peça da Pitoco de Gente você gostaria de escolher agora?';

      const prodButtons = [
        { id: 'prod_body', title: 'Body Suedine (R$ 49)' },
        { id: 'prod_macacao', title: 'Macacão Zíper (R$ 89)' },
        { id: 'prod_saida', title: 'Saída Luxo (R$ 199)' },
      ];

      session.activeButtons = prodButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `🛍️ *Escolha seu Produto Pitoco de Gente:*\n\n${intro}\n\n• Body Suedine Algodão (R$ 49,90)\n• Macacão Confort Zíper (R$ 89,90)\n• Saída Maternidade Luxo (R$ 199,90)`,
        footer: 'Toque na opção desejada:',
        buttons: prodButtons,
      });
      break;
    }

    // 5.6 Shipping Calculator Node (3 Saídas: Motoboy, Correios, Retirada)
    else if (nodeType === 'shipping_calculator') {
      const intro = config.introMessage
        ? replaceVars(config.introMessage, session.variables, botProfile)
        : 'Como você prefere receber seu pedido da Pitoco de Gente?';

      const motoboyPrice = Number(config.motoboyPrice || 15).toFixed(2).replace('.', ',');
      const correiosPrice = Number(config.correiosPrice || 24.90).toFixed(2).replace('.', ',');

      const shipButtons = [
        { id: 'shipping_motoboy', title: `Motoboy (R$ ${motoboyPrice})` },
        { id: 'shipping_correios', title: `Correios (R$ ${correiosPrice})` },
        { id: 'shipping_pickup', title: 'Retirada em Loja (Grátis)' },
      ];

      session.activeButtons = shipButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `🚚 *Calculadora de Frete & Entrega:*\n\n${intro}\n\n• *Motoboy Express:* R$ ${motoboyPrice} (Recife e RMR - Chega hoje)\n• *Correios PAC/SEDEX:* R$ ${correiosPrice} (Todo o Brasil)\n• *Retirada em Loja:* Grátis (Matriz Centro ou Loja Ipojuca)`,
        footer: 'Toque em uma opção ou envie sua preferência:',
        buttons: shipButtons,
      });
      break;
    }

    // 5.7 Pix Payment Node (Cobrança PIX Automática: 2 Saídas)
    else if (nodeType === 'pix_payment') {
      const total = session.variables['valor_total'] || session.variables['valor_produto'] || 'R$ 89,90';
      const pixKey = config.pixKey || 'financeiro@pitocodegente.com.br';
      const beneficiary = config.pixBeneficiary || 'Pitoco de Gente Bebê e Criança LTDA';
      const copiaCola = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865405${total.replace(/\D/g, '')}5802BR5925${beneficiary.substring(0, 25)}6009RECIFE62070503***6304`;

      session.variables['pix_copia_cola'] = copiaCola;

      const pixButtons = [
        { id: 'pix_paid', title: '✅ Já Fiz o PIX' },
        { id: 'pix_help', title: '❓ Ajuda / Outra Forma' },
      ];

      session.activeButtons = pixButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `⚡ *Cobrança PIX Pitoco de Gente*\n\n• *Titular:* ${beneficiary}\n• *Chave PIX (E-mail):* \`${pixKey}\`\n• *Valor Total:* *${total}*\n\n📋 *Código Copia e Cola (toque para copiar):*\n\`\`\`\n${copiaCola}\n\`\`\`\n\n_Após efetuar o pagamento, toque no botão abaixo ou envie a foto do comprovante:_`,
        footer: 'Toque para confirmar o pagamento:',
        buttons: pixButtons,
      });
      break;
    }

    // 5.8 Cart Order Node (Criar Pedido de Venda Online)
    else if (nodeType === 'cart_order') {
      const orderNum = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
      const clientName = session.variables.nome_cliente || senderName || 'Cliente';
      const product = session.variables.produto_selecionado || 'Saída Maternidade Tricot Luxo';
      const total = session.variables.valor_total || session.variables.valor_produto || 'R$ 199,90';
      const shipping = session.variables.tipo_frete || 'Motoboy Express (Recife)';

      session.variables['numero_pedido'] = orderNum;
      session.variables['total_pedido'] = total;
      session.variables['status_pedido'] = 'Aguardando Pagamento';

      const newOrder = {
        id: orderNum,
        phone: cleanPhone,
        client_name: clientName,
        product,
        shipping,
        total,
        status: 'pending_payment',
        created_at: new Date().toISOString(),
      };

      if (!db.orders) db.orders = [];
      db.orders.push(newOrder);

      recordLiveLog(
        'order_created',
        `Pedido Criado: ${orderNum}`,
        `${clientName} realizou pedido de ${product} (${total})`,
        cleanPhone,
        clientName,
        newOrder
      );

      const defaultSummary = `🎉 *Pedido Realizado com Sucesso!*\n\n• *Protocolo:* *${orderNum}*\n• *Cliente:* ${clientName}\n• *Peça:* ${product}\n• *Entrega:* ${shipping}\n• *Valor Total:* *${total}*\n\nNossa equipe já está separando com todo carinho para envio! 💕`;
      const summaryText = config.summaryMessage ? replaceVars(config.summaryMessage, session.variables, botProfile) : defaultSummary;
      replies.push(summaryText);

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5.9 Measure Guide Node (Tabela de Medidas RN a 3 Anos)
    else if (nodeType === 'measure_guide') {
      const intro = config.introText
        ? replaceVars(config.introText, session.variables, botProfile)
        : '📏 *Tabela de Medidas Pitoco de Gente (RN a 3 Anos)*\n\nConfira as referências para escolher o tamanho certinho:';
      const footer = config.footerTips
        ? `\n\n_${replaceVars(config.footerTips, session.variables, botProfile)}_`
        : '\n\n💡 _Dica da Pitoco: Bebês crescem muito rápido nos primeiros 3 meses! Se tiver em dúvida entre 2 tamanhos, prefira sempre o maior._';

      const tableText = `${intro}\n\n` +
        `• *RN:* Até 52 cm | Até 3,5 kg (Mala Maternidade)\n` +
        `• *P (0 a 3m):* 52 a 62 cm | 3,5 a 5,5 kg\n` +
        `• *M (3 a 6m):* 62 a 67 cm | 5,5 a 7,5 kg\n` +
        `• *G (6 a 9m):* 67 a 72 cm | 7,5 a 9,5 kg\n` +
        `• *GG / 1 Ano:* 72 a 77 cm | 9,5 a 11,5 kg\n` +
        `• *2 Anos:* 77 a 88 cm | 11,5 a 13,5 kg\n` +
        `• *3 Anos:* 88 a 98 cm | 13,5 a 15,5 kg` +
        `${footer}`;

      replies.push(tableText);

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5.10 Layette Checklist Node (Mala de Maternidade)
    else if (nodeType === 'layette_checklist') {
      const intro = config.introText
        ? replaceVars(config.introText, session.variables, botProfile)
        : '🧳 *Checklist da Mala de Maternidade — Pitoco de Gente*\n\nTudo o que você precisa levar para as primeiras 48 horas no hospital:';
      const footer = config.footerTips
        ? `\n\n_${replaceVars(config.footerTips, session.variables, botProfile)}_`
        : '\n\n💖 _Temos todas as peças disponíveis em pronta entrega na loja física e online!_';

      const checklistText = `${intro}\n\n` +
        `1. 🍼 *6 Bodies Suedine 100% Algodão* (mangas longas e curtas)\n` +
        `2. 👶 *6 Culotes / Mijõezinhos* com pé reversível\n` +
        `3. 🧸 *4 Macacões Confort* com zíper duplo frontal\n` +
        `4. ✨ *2 Saídas Maternidade completas* com mantas em tricot\n` +
        `5. 🧤 *3 Pares de luvinhas e meinhas* de algodão\n` +
        `6. 🧣 *6 Fraldinhas de boca* em algodão duplo macio\n` +
        `7. 🛁 *2 Toalhas de banho soft* com capuz e fralda\n` +
        `8. 🧼 *1 Kit higiene do bebê* (escovinha, sabonete glicerina)\n` +
        `9. 🛏️ *3 Cueiros flanelados* para enrolar o recém-nascido\n` +
        `10. 🎀 *1 Ninho redutor de berço* para descanso aconchegante` +
        `${footer}`;

      replies.push(checklistText);

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5.11 VIP Consultation Node (Online vs Loja Física: 2 Saídas)
    else if (nodeType === 'vip_consultation') {
      const intro = config.introMessage
        ? replaceVars(config.introMessage, session.variables, botProfile)
        : '✨ Que alegria poder fazer parte desse momento mágico! Nossa consultoria de enxoval é 100% personalizada e gratuita.\n\nComo você prefere ser atendida?';

      const consultButtons = [
        { id: 'consult_online', title: '📱 Online (Vídeo)' },
        { id: 'consult_store', title: '🏬 Presencial Loja' },
      ];

      session.activeButtons = consultButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `✨ *Consultoria VIP de Enxoval:*\n\n${intro}`,
        footer: 'Toque para escolher o formato:',
        buttons: consultButtons,
      });
      break;
    }

    // 5.12 Order Tracking Node (Rastreamento de Pedido Online)
    else if (nodeType === 'order_tracking') {
      const userOrders = (db.orders || []).filter((o) => String(o.phone).replace(/\D/g, '') === cleanPhone);
      if (userOrders.length > 0) {
        const latestOrder = userOrders[userOrders.length - 1];
        replies.push(
          `📦 *Rastreamento de Pedido Pitoco de Gente*\n\n• *Protocolo:* *${latestOrder.id}*\n• *Item:* ${latestOrder.product}\n• *Entrega:* ${latestOrder.shipping}\n• *Status:* 🚚 *Em Trânsito / Saiu para Entrega*\n• *Previsão:* Hoje até as 18h\n\nQualquer dúvida, basta nos responder aqui! 💕`
        );
      } else {
        const notFound = config.notFoundMessage
          ? replaceVars(config.notFoundMessage, session.variables, botProfile)
          : 'Não encontramos nenhum pedido pendente vinculado ao seu número do WhatsApp. Digite *0* para falar com uma consultora ou nos envie o número do protocolo.';
        replies.push(`📦 *Rastreamento de Pedido*\n\n${notFound}`);
      }

      const outgoing = edges.find((e) => e.source === currentNode.id);
      if (outgoing) {
        currentNode = nodes.find((n) => n.id === outgoing.target);
        if (currentNode) {
          session.currentNodeId = currentNode.id;
          continue;
        }
      }
      break;
    }

    // 5.13 Promotional Coupon Node (2 Saídas: Válido vs Inválido)
    else if (nodeType === 'promotional_coupon') {
      const coupon = config.couponCode || 'BEMVINDO10';
      const couponButtons = [
        { id: 'coupon_valid', title: `✅ Aplicar ${coupon}` },
        { id: 'coupon_invalid', title: '❌ Sem Cupom' },
      ];

      session.activeButtons = couponButtons;
      session.currentNodeId = currentNode.id;

      replies.push({
        type: 'buttons',
        body: `🎟️ *Cupom de Desconto Especial:*\n\nGanhe *10% OFF* na sua compra na Pitoco de Gente com o cupom *${coupon}*!\n\nDeseja aplicar agora ao seu pedido?`,
        footer: 'Toque em uma das opções:',
        buttons: couponButtons,
      });
      break;
    }

    // 6. Condition Node
    else if (nodeType === 'condition') {
      const varVal = String(session.variables[config.variable] || '').toLowerCase();
      const targetVal = String(config.value || '').toLowerCase();
      const op = config.operator || '==';
      let isTrue = false;

      if (op === '==' || op === 'equals') isTrue = varVal === targetVal;
      else if (op === '!=' || op === 'not_equals') isTrue = varVal !== targetVal;
      else if (op === 'contains') isTrue = varVal.includes(targetVal);

      const conditionEdge =
        edges.find((e) => e.source === currentNode.id && e.sourceHandle === (isTrue ? 'true' : 'false')) ||
        edges.find((e) => e.source === currentNode.id);

      if (conditionEdge) {
        currentNode = nodes.find((n) => n.id === conditionEdge.target);
        continue;
      }
      break;
    }

    // 6.5 Delay / Pause Node
    else if (nodeType === 'delay') {
      const waitSeconds = Math.min(Math.max(Number(config.amount || config.seconds || 2), 1), 10);
      console.log(`[FlowRunner] ⏳ Pausa / Delay de ${waitSeconds}s no fluxo...`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    }

    // 7. AI Agent Node
    else if (nodeType === 'ai_agent') {
      const pName = botProfile.name || 'Pitoco Bot';
      const company = botProfile.company_name || 'Pitoco de Gente';
      const customReply = config.systemPrompt ? replaceVars(config.systemPrompt, session.variables, botProfile) : null;
      const responseText = customReply || `✨ *${pName} (${company}):*\nRecebi sua mensagem: "${cleanInput}". Como posso te auxiliar a escolher os melhores itens para o enxoval do seu bebê? 💕`;
      replies.push(responseText);
    }

    // 7.2 HTTP Request / Webhook Node (Execução Completa com Variáveis, Headers e Resposta)
    else if (nodeType === 'http_request' || nodeType === 'webhook') {
      let rawUrl = config.url || config.webhookUrl || '';
      if (!rawUrl && config.endpoint) {
        rawUrl = config.endpoint.startsWith('http') ? config.endpoint : `/api/wh/${config.endpoint.replace(/^\/+/, '')}`;
      }

      let targetUrl = replaceVars(rawUrl, session.variables, botProfile);
      if (targetUrl && targetUrl.startsWith('/')) {
        const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
        targetUrl = `${baseUrl.replace(/\/+$/, '')}${targetUrl}`;
      }

      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        try {
          const method = (config.method || 'POST').toUpperCase();
          const reqHeaders = { 'Content-Type': 'application/json' };

          // 1. Processar Headers em lista ou objeto
          if (Array.isArray(config.headersList)) {
            for (const h of config.headersList) {
              if (h && h.key && h.key.trim()) {
                const k = replaceVars(h.key.trim(), session.variables, botProfile);
                const v = replaceVars(h.value || '', session.variables, botProfile);
                reqHeaders[k] = v;
              }
            }
          } else if (config.headers && typeof config.headers === 'object') {
            for (const [k, v] of Object.entries(config.headers)) {
              const resK = replaceVars(k, session.variables, botProfile);
              const resV = replaceVars(String(v), session.variables, botProfile);
              reqHeaders[resK] = resV;
            }
          }

          // 2. Processar Corpo / Body
          let reqBody = undefined;
          if (method !== 'GET' && method !== 'HEAD') {
            if (config.payloadMode === 'custom' && config.customPayload) {
              reqBody = replaceVars(config.customPayload, session.variables, botProfile);
            } else if (config.body) {
              reqBody = replaceVars(config.body, session.variables, botProfile);
            } else {
              // Payload automático completo com dados do cliente e variáveis
              const contactName = session.variables['nome_cliente'] || session.variables['cliente_nome'] || senderName || 'Cliente';
              reqBody = JSON.stringify({
                event: nodeType === 'webhook' ? 'flow_webhook_dispatch' : 'flow_http_request',
                node_id: currentNode.id,
                flow_id: session.flowId || null,
                timestamp: new Date().toISOString(),
                contact: {
                  phone: cleanPhone,
                  name: contactName,
                },
                input: cleanInput,
                variables: session.variables,
                ...(config.payload || {}),
              });
            }
          }

          console.log(`[FlowRunner] 🌐 Disparando [${nodeType.toUpperCase()}] ${method} -> ${targetUrl}`);
          
          const controller = new AbortController();
          const timeoutMs = (parseInt(config.timeoutSeconds) || 10) * 1000;
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const apiResp = await fetch(targetUrl, {
            method,
            headers: reqHeaders,
            body: reqBody,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const statusVarKey = (config.statusVar || config.statusVariable || (nodeType === 'webhook' ? 'webhook_status' : 'status_api')).replace(/[{}]/g, '').trim();
          session.variables[statusVarKey] = apiResp.status;

          const respText = await apiResp.text();
          const responseVarKey = (config.responseVar || config.responseVariable || (nodeType === 'webhook' ? 'webhook_res' : 'resposta_api')).replace(/[{}]/g, '').trim();

          try {
            const respJson = JSON.parse(respText);
            session.variables[responseVarKey] = JSON.stringify(respJson);
            // Salvar campos de primeiro nível para acesso direto em variáveis
            if (respJson && typeof respJson === 'object' && !Array.isArray(respJson)) {
              for (const [jk, jv] of Object.entries(respJson)) {
                if (typeof jv === 'string' || typeof jv === 'number' || typeof jv === 'boolean') {
                  session.variables[`${responseVarKey}_${jk}`] = jv;
                }
              }
            }
          } catch {
            session.variables[responseVarKey] = respText;
          }

          console.log(`[FlowRunner] ✅ [${nodeType.toUpperCase()}] Sucesso (${apiResp.status}): salvo em {{${responseVarKey}}}`);
        } catch (apiErr) {
          const statusVarKey = (config.statusVar || config.statusVariable || (nodeType === 'webhook' ? 'webhook_status' : 'status_api')).replace(/[{}]/g, '').trim();
          session.variables[statusVarKey] = apiErr.name === 'AbortError' ? 408 : 500;
          console.warn(`[FlowRunner] ⚠️ [${nodeType.toUpperCase()}] Erro ao requisitar ${targetUrl}:`, apiErr.message);
        }
      }
    }

    // 7.5 Media Node (Image, Video, Audio/PTT, Document)
    else if (nodeType === 'media') {
      if (config.mediaUrl) {
        replies.push({
          type: 'media',
          mediaType: config.mediaType || 'image',
          mediaUrl: config.mediaUrl,
          caption: replaceVars(config.caption || '', session.variables, botProfile),
          fileName: config.fileName || 'documento.pdf',
          isPtt: config.isPtt !== false,
        });
      }
    }

    // 8. Human Handoff Node
    else if (nodeType === 'human_handoff') {
      const handoffText = config.notifyMessage ? replaceVars(config.notifyMessage, session.variables, botProfile) : '👨‍💼 *Atendimento Humano:*\n\nVocê foi transferido para nossa equipe de atendimento. Um consultor responderá em breve!';
      replies.push(handoffText);
      if (db.conversations[`conv-${cleanPhone}`]) {
        db.conversations[`conv-${cleanPhone}`].status = 'waiting_human';
      }
      session.currentNodeId = null;
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
        executeVariableAssignment(item, session.variables, {
          name: senderName || 'Cliente',
          whatsapp_pushname: senderName || 'Cliente',
          phone: cleanPhone,
        }, botProfile);
      }
    }

    // 10. End Flow Node (Finalizar Fluxo / Conclusão de Atendimento)
    else if (nodeType === 'end_flow' || nodeType === 'finish_flow' || nodeType === 'end') {
      const defaultMsg = '🏁 *Atendimento finalizado com sucesso!*\n\nSe precisar de algo mais, basta nos enviar uma nova mensagem. Até logo!';
      const finalMsg = config.message !== undefined 
        ? (config.message ? replaceVars(config.message, session.variables, botProfile) : '') 
        : defaultMsg;

      if (finalMsg) {
        replies.push(finalMsg);
      }

      session.currentNodeId = null;
      session.activeButtons = null;
      session.waitingForVar = null;

      if (config.clearVariables !== false) {
        session.variables = {
          whatsapp_pushname: senderName || '',
          telefone_cliente: cleanPhone,
          telefone_whatsapp: cleanPhone,
        };
      }

      if (config.closeConversation !== false && db.conversations && db.conversations[`conv-${cleanPhone}`]) {
        db.conversations[`conv-${cleanPhone}`].status = 'closed';
        db.conversations[`conv-${cleanPhone}`].updated_at = new Date().toISOString();
        syncConversationToSupabase(db.conversations[`conv-${cleanPhone}`]);
      }

      console.log(`[FlowRunner] 🏁 [Finalizar Fluxo] Atendimento concluído e sessão resetada para ${cleanPhone}.`);
      break;
    }

    // Move to next connected node
    const outgoing = edges.find((e) => e.source === currentNode.id);
    if (outgoing) {
      currentNode = nodes.find((n) => n.id === outgoing.target);
      if (currentNode) {
        session.currentNodeId = currentNode.id;
        continue;
      }
    }

    break;
  }

  // Save session in DB
  if (!db.sessions) db.sessions = {};
  db.sessions[cleanPhone] = session;
  db.sessions[rawId] = session;
  saveDb(db);

  // Record all outbound replies
  for (const rep of replies) {
    recordRealMessage(cleanPhone, senderName, 'outbound', rep);
  }

  return replies.length > 0 ? replies : [`Mensagem processada pelo fluxo *${publishedFlow.name}*!`];
}
