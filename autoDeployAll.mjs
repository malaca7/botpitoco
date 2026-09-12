import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { deployToDiscloud } from './deployDiscloud.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para executar comandos assincronamente em paralelo
function execCommand(cmd, cwd = __dirname) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, { cwd, shell: true, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || stdout.trim() || `Exit code ${code}`));
    });
  });
}

// Rotas SPA para gerar diretorios fisicos no dist/ para GitHub Pages
const SPA_ROUTES = [
  'admin', 'gerente', 'gestao', 'atendimento', 'login', 'ceo',
  'lojas', 'fluxos', 'acessos', 'usuarios', 'whatsapp', 'catalogo',
  'enxoval', 'medidas', 'fila', 'conversas', 'clientes', 'dashboard',
  'bot_config', 'configuracoes', 'logs'
];

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build') || args.includes('--quick');
  const ghOnly = args.includes('--gh-only');
  const discloudOnly = args.includes('--discloud-only');

  console.log('===============================================================');
  console.log('⚡ [FastDeploy] Deploy Otimizado Pitoco de Gente');
  console.log('   GitHub Pages: https://pitoco.malaca.com.br/admin');
  console.log('   Discloud API: https://pitoco.discloud.app');
  console.log('===============================================================');

  const overallStartTime = Date.now();

  // -------------------------------------------------------------
  // 1. BUILD DO FRONTEND (Se nao for pulado)
  // -------------------------------------------------------------
  const distDir = path.resolve(__dirname, 'dist');

  if (!discloudOnly && !skipBuild) {
    console.log('\n📦 [1/4] Compilando frontend (Vite build)...');
    const buildStart = Date.now();
    try {
      execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
      console.log(`✅ Build concluído em ${((Date.now() - buildStart) / 1000).toFixed(1)}s!`);
    } catch (err) {
      console.error('❌ Falha na compilação:', err.message);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------
  // 2. PREPARAR ARQUIVOS ESTÁTICOS NO DIST (Sem poluir a raiz!)
  // -------------------------------------------------------------
  if (fs.existsSync(distDir)) {
    // CNAME e .nojekyll
    fs.writeFileSync(path.join(distDir, 'CNAME'), 'pitoco.malaca.com.br\n');
    fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

    // Fallback 404.html
    const distHtmlPath = path.join(distDir, 'index.html');
    if (fs.existsSync(distHtmlPath)) {
      const distHtml = fs.readFileSync(distHtmlPath, 'utf8');
      fs.writeFileSync(path.join(distDir, '404.html'), distHtml, 'utf8');

      // Gerar subdiretórios com index.html apenas dentro de dist/ para rotas limpas no GitHub Pages
      for (const route of SPA_ROUTES) {
        const routeDistDir = path.join(distDir, route);
        if (!fs.existsSync(routeDistDir)) fs.mkdirSync(routeDistDir, { recursive: true });
        fs.writeFileSync(path.join(routeDistDir, 'index.html'), distHtml, 'utf8');
      }
    }
  }

  // -------------------------------------------------------------
  // 3. REGISTRAR ALTERAÇÕES NO GIT LOCAL (Fontes e configs)
  // -------------------------------------------------------------
  if (!discloudOnly) {
    console.log('\n📝 [2/4] Verificando alterações no Git...');
    try {
      execSync('git add -A', { cwd: __dirname, stdio: 'pipe' });
      const status = execSync('git status --porcelain', { cwd: __dirname, encoding: 'utf8' }).trim();
      if (status.length > 0) {
        const msgArgIdx = process.argv.findIndex(a => a === '-m' || a === '--msg');
        const commitMsg = msgArgIdx !== -1 && process.argv[msgArgIdx + 1]
          ? process.argv[msgArgIdx + 1]
          : "feat(flows): auto-sincronizacao em tempo real de fluxos e correcao Input not defined";
        execSync(`git commit -m "${commitMsg}"`, { cwd: __dirname, stdio: 'inherit' });
        console.log(`✅ Commit criado: "${commitMsg}"`);
      } else {
        console.log('ℹ️ Nenhuma alteração pendente de código para commit.');
      }
    } catch (gitErr) {
      console.warn('ℹ️ Informação sobre git commit:', gitErr.message);
    }

    // -------------------------------------------------------------
    // 4. SINCRONIZAÇÃO GIT EM PARALELO (Main & gh-pages)
    // -------------------------------------------------------------
    console.log('\n🌐 [3/4] Enviando atualizações para o GitHub em paralelo...');
    const gitStartTime = Date.now();

    // Descobrir remotes disponíveis
    let remotes = [];
    try {
      remotes = execSync('git remote', { cwd: __dirname, encoding: 'utf8' })
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);
    } catch (e) {
      remotes = ['origin'];
    }

    // Alinhar main com o HEAD atual
    try {
      execSync('git branch -f main HEAD', { cwd: __dirname, stdio: 'pipe' });
    } catch (e) {}

    const pushPromises = [];

    // Push branches de código (main e source) nos remotes em paralelo
    for (const remote of remotes) {
      pushPromises.push(
        execCommand(`git push ${remote} main --force`)
          .then(() => console.log(`  ✅ [Git] ${remote}/main atualizado com sucesso.`))
          .catch((err) => console.warn(`  ⚠️ [Git] Aviso ao enviar ${remote}/main:`, err.message))
      );
      pushPromises.push(
        execCommand(`git push ${remote} source --force`)
          .then(() => console.log(`  ✅ [Git] ${remote}/source atualizado com sucesso.`))
          .catch((err) => console.warn(`  ⚠️ [Git] Aviso ao enviar ${remote}/source:`, err.message))
      );
    }

    // Atualizar branch gh-pages com dist/
    if (fs.existsSync(distDir)) {
      const tempDeployDir = path.join(os.tmpdir(), `gh_deploy_${Date.now()}`);
      try {
        fs.mkdirSync(tempDeployDir, { recursive: true });
        fs.cpSync(distDir, tempDeployDir, { recursive: true });

        execSync('git init', { cwd: tempDeployDir, stdio: 'pipe' });
        execSync('git checkout -b gh-pages', { cwd: tempDeployDir, stdio: 'pipe' });
        execSync('git config user.email "bot@pitoco.malaca.com.br"', { cwd: tempDeployDir, stdio: 'pipe' });
        execSync('git config user.name "Pitoco Bot"', { cwd: tempDeployDir, stdio: 'pipe' });
        execSync('git add -f -A', { cwd: tempDeployDir, stdio: 'pipe' });
        execSync('git commit -m "deploy(pages): producao estatica otimizada pitoco.malaca.com.br"', { cwd: tempDeployDir, stdio: 'pipe' });

        // Adicionar remotes no repo temporário
        if (remotes.includes('botpitoco')) {
          execSync('git remote add botpitoco https://github.com/malaca7/botpitoco.git', { cwd: tempDeployDir, stdio: 'pipe' });
          pushPromises.push(
            execCommand('git push botpitoco gh-pages --force', tempDeployDir)
              .then(() => console.log('  ✅ [Git] botpitoco/gh-pages (site ao vivo) atualizado.'))
              .catch((err) => console.warn('  ⚠️ [Git] Erro em botpitoco gh-pages:', err.message))
          );
        }

        if (remotes.includes('origin')) {
          try {
            const originUrl = execSync('git config --get remote.origin.url', { cwd: __dirname, encoding: 'utf8' }).trim();
            if (originUrl) {
              execSync(`git remote add origin ${originUrl}`, { cwd: tempDeployDir, stdio: 'pipe' });
              pushPromises.push(
                execCommand('git push origin gh-pages --force', tempDeployDir)
                  .then(() => console.log('  ✅ [Git] origin/gh-pages atualizado.'))
                  .catch((err) => console.warn('  ⚠️ [Git] Aviso origin gh-pages:', err.message))
              );
            }
          } catch (e) {}
        }
      } catch (ghErr) {
        console.warn('⚠️ Falha ao preparar gh-pages:', ghErr.message);
      }
    }

    // Aguardar todos os envios Git simultâneos
    await Promise.allSettled(pushPromises);
    console.log(`🚀 Sincronização GitHub finalizada em ${((Date.now() - gitStartTime) / 1000).toFixed(1)}s!`);
  }

  // -------------------------------------------------------------
  // 5. DEPLOY DISCLOUD (Container do Bot & API)
  // -------------------------------------------------------------
  if (!ghOnly) {
    console.log('\n🤖 [4/4] Atualizando bot no Discloud...');
    await deployToDiscloud();
  }

  const totalTimeSeconds = ((Date.now() - overallStartTime) / 1000).toFixed(1);
  console.log('\n===============================================================');
  console.log(`🎉 DEPLOY COMPLETO FINALIZADO EM APENAS ${totalTimeSeconds}s!`);
  console.log(' - Site / Painel: https://pitoco.malaca.com.br/admin');
  console.log(' - API / Bot:     https://pitoco.discloud.app');
  console.log(' - Health Check:  https://pitoco.discloud.app/health');
  console.log('===============================================================');
}

main();
