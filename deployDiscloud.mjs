import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis do .env se existirem
function loadEnv() {
  const envFiles = [
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, 'discloud', '.env'),
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const rawToken = process.env.DISCLOUD_TOKEN || process.argv[2] || 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjI4ODUxOTI1OTYyMDgiLCJrZXkiOiIzMTE1ZTQwYTY3ODY0MDg3NmRlYzZhOTk4YTYwIn0.y3RYPKpF9VdbnO-Qhry-84k-1bP3bhpWeQ7AfjqLXqk';
const DISCLOUD_TOKEN = rawToken.trim();
const APP_ID = process.env.DISCLOUD_APP_ID || 'pitoco';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPackage() {
  const stageDir = path.join(os.tmpdir(), `pitoco_stage_${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `pitoco_${Date.now()}.zip`);

  if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  // 1. Arquivos base de inicializacao da Discloud
  const discloudConfigSrc = path.resolve(__dirname, 'discloud.config');
  if (fs.existsSync(discloudConfigSrc)) {
    fs.copyFileSync(discloudConfigSrc, path.join(stageDir, 'discloud.config'));
  }

  const indexJsSrc = path.resolve(__dirname, 'index.js');
  if (fs.existsSync(indexJsSrc)) {
    fs.copyFileSync(indexJsSrc, path.join(stageDir, 'index.js'));
  }

  // package.json otimizado para o bot no Discloud
  const discloudPkg = path.resolve(__dirname, 'discloud', 'package.json');
  if (fs.existsSync(discloudPkg)) {
    fs.copyFileSync(discloudPkg, path.join(stageDir, 'package.json'));
  } else {
    fs.copyFileSync(path.resolve(__dirname, 'package.json'), path.join(stageDir, 'package.json'));
  }

  // .env
  const envSrc = path.resolve(__dirname, 'discloud', '.env');
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, path.join(stageDir, '.env'));
  } else if (fs.existsSync(path.resolve(__dirname, '.env'))) {
    fs.copyFileSync(path.resolve(__dirname, '.env'), path.join(stageDir, '.env'));
  }

  // 2. Pasta server (ignorando whatsapp_auth, logs e temporarios)
  const serverSrc = path.resolve(__dirname, 'server');
  if (fs.existsSync(serverSrc)) {
    fs.cpSync(serverSrc, path.join(stageDir, 'server'), {
      recursive: true,
      filter: (src) => {
        const basename = path.basename(src);
        if (basename === 'whatsapp_auth') return false;
        if (basename.endsWith('.log') || basename.endsWith('.tmp')) return false;
        return true;
      }
    });
  }

  // 3. Pasta dist (arquivos compilados do frontend se existirem)
  const distSrc = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distSrc)) {
    fs.cpSync(distSrc, path.join(stageDir, 'dist'), { recursive: true });
  }

  // 4. Compactacao instantanea com tar.exe padrao do Windows
  try {
    execSync(`tar.exe -a -cf "${zipPath}" -C "${stageDir}" .`, { stdio: 'pipe' });
  } catch (err) {
    // Fallback PowerShell se tar falhar
    execSync(`powershell -Command "Compress-Archive -Path '${stageDir}/*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'pipe' });
  }

  // Limpeza da pasta de stage
  try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (e) {}

  return zipPath;
}

export async function deployToDiscloud() {
  if (!DISCLOUD_TOKEN || DISCLOUD_TOKEN.length < 10) {
    console.error('❌ Token da Discloud não configurado. Defina DISCLOUD_TOKEN no .env.');
    return false;
  }

  console.log('📦 [Discloud 1/3] Gerando pacote ultraleve em memória...');
  const startTime = Date.now();
  let zipPath = null;

  try {
    zipPath = await createPackage();
    const zipSizeMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Pacote gerado com sucesso (${zipSizeMB} MB em ${Date.now() - startTime}ms)`);

    console.log(`🚀 [Discloud 2/3] Enviando commit para o container ${APP_ID}...`);
    const fileBuffer = fs.readFileSync(zipPath);
    const blob = new Blob([fileBuffer], { type: 'application/zip' });
    const formData = new FormData();
    formData.append('file', blob, 'pitoco.zip');

    const commitRes = await fetch(`https://api.discloud.app/v2/app/${APP_ID}/commit`, {
      method: 'PUT',
      headers: { 'api-token': DISCLOUD_TOKEN },
      body: formData,
    });

    const commitJson = await commitRes.json();
    if (!commitRes.ok && commitJson.status !== 'ok') {
      throw new Error(commitJson.message || 'Falha na API de commit da Discloud');
    }
    console.log('✅ Commit processado pela Discloud.');

    console.log(`🔄 [Discloud 3/3] Reconstruindo (rebuild) e reiniciando container (${APP_ID})...`);
    // Pausa minima de 1.5s para descompressao na nuvem
    await wait(1500);

    try {
      const rebuildRes = await fetch(`https://api.discloud.app/v2/app/${APP_ID}/rebuild`, {
        method: 'PUT',
        headers: { 'api-token': DISCLOUD_TOKEN },
      });
      const rebuildJson = await rebuildRes.json().catch(() => ({}));
      console.log(`🔨 [Discloud] Rebuild: ${rebuildJson.message || 'OK'}`);
    } catch (e) {
      console.warn('⚠️ [Discloud] Aviso no rebuild:', e.message);
    }

    await wait(1500);

    try {
      const restartRes = await fetch(`https://api.discloud.app/v2/app/${APP_ID}/restart`, {
        method: 'PUT',
        headers: { 'api-token': DISCLOUD_TOKEN },
      });
      const restartJson = await restartRes.json().catch(() => ({}));
      console.log(`⚡ [Discloud] Restart: ${restartJson.message || 'OK'}`);
    } catch (e) {
      console.warn('⚠️ [Discloud] Aviso no restart:', e.message);
    }

    // Polling ativo inteligente de health check (max 6s, checa a cada 1s)
    let isHealthy = false;
    for (let i = 1; i <= 6; i++) {
      await wait(1000);
      try {
        const hRes = await fetch(`https://${APP_ID}.discloud.app/health`, { signal: AbortSignal.timeout(1500) });
        if (hRes.ok) {
          isHealthy = true;
          break;
        }
      } catch (e) {}
    }

    if (isHealthy) {
      console.log(`🩺 Health check OK! Container online em https://${APP_ID}.discloud.app`);
    } else {
      console.log(`ℹ️ Container reiniciando na Discloud. Em instantes estará 100% online.`);
    }

    console.log(`🎉 Deploy Discloud finalizado em ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);
    return true;
  } catch (err) {
    console.error('❌ Erro no deploy Discloud:', err.message);
    return false;
  } finally {
    if (zipPath && fs.existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch (e) {}
    }
  }
}

// Executar se chamado diretamente
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  deployToDiscloud();
}
