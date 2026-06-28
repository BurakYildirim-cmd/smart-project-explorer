const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#0D1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => { createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-maximize', () => { const w=BrowserWindow.getFocusedWindow(); w?.isMaximized()?w.unmaximize():w?.maximize(); });
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Proje Klasörü Seç' });
  if (result.canceled || !result.filePaths[0]) return null;
  const rootPath = result.filePaths[0];
  return { files: scanFolder(rootPath), rootPath };
});

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'], title: 'Dosya Aç',
    filters: [
      { name: 'Tüm Dosyalar', extensions: ['*'] },
      { name: 'Kod', extensions: ['py','js','ts','jsx','tsx','json','md','txt','log','toml','yaml','yml','ini','css','html','xml'] },
      { name: 'Görseller', extensions: ['png','jpg','jpeg','gif','svg','webp'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return readSingleFile(result.filePaths[0]);
});

ipcMain.handle('read-file', (_event, filePath) => readSingleFile(filePath));

ipcMain.handle('save-file', (_event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── Settings persistence ────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')); } catch (e) { return {}; }
}
function saveSettingsToDisk(s) {
  try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf-8'); return true; } catch (e) { return false; }
}

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, settings) => {
  const ok = saveSettingsToDisk(settings);
  return { ok };
});

// ── Local AI model discovery ─────────────────────────────
// We don't scan the filesystem for raw weight files (unreliable, slow,
// and a .gguf alone isn't usable without a server). Instead we probe the
// well-known local inference servers' HTTP APIs on their default ports.
async function fetchWithTimeout(url, opts = {}, ms = 1500) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

ipcMain.handle('scan-local-models', async () => {
  const found = [];

  // Ollama — http://localhost:11434
  try {
    const r = await fetchWithTimeout('http://localhost:11434/api/tags');
    if (r.ok) {
      const d = await r.json();
      for (const m of d.models || []) {
        found.push({ provider: 'ollama', id: m.name, label: m.name, baseUrl: 'http://localhost:11434' });
      }
    }
  } catch (e) {}

  // LM Studio — http://localhost:1234 (OpenAI-compatible)
  try {
    const r = await fetchWithTimeout('http://localhost:1234/v1/models');
    if (r.ok) {
      const d = await r.json();
      for (const m of d.data || []) {
        found.push({ provider: 'lmstudio', id: m.id, label: m.id, baseUrl: 'http://localhost:1234' });
      }
    }
  } catch (e) {}

  // text-generation-webui / LocalAI / other OpenAI-compatible servers on common ports
  for (const baseUrl of ['http://localhost:5000', 'http://localhost:8080']) {
    try {
      const r = await fetchWithTimeout(`${baseUrl}/v1/models`);
      if (r.ok) {
        const d = await r.json();
        for (const m of d.data || []) {
          found.push({ provider: 'custom', id: m.id, label: m.id, baseUrl });
        }
      }
    } catch (e) {}
  }

  return found;
});

// ── Chat with the configured local model ────────────────
ipcMain.handle('ai-chat', async (_e, { provider, baseUrl, model, messages, system }) => {
  try {
    // `system` taşıyıcı mesaj listesine en başa eklenir; aksi halde (önceki
    // davranışta olduğu gibi) tamamen yok sayılır ve küçük modeller "SADECE
    // JSON döndür" gibi katı talimatları hiç görmeden yanıt üretir.
    const fullMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;
    if (provider === 'ollama') {
      const r = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: fullMessages, stream: false }),
      });
      const d = await r.json();
      if (!r.ok) return { ok: false, error: d.error || `HTTP ${r.status}` };
      return { ok: true, content: d.message?.content || '' };
    }
    // lmstudio / custom: OpenAI-compatible chat completions
    const r = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: fullMessages }),
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d.error?.message || `HTTP ${r.status}` };
    return { ok: true, content: d.choices?.[0]?.message?.content || '' };
  } catch (e) {
    return { ok: false, error: e.message || 'Bağlantı hatası' };
  }
});

// ── File type detection ──────────────────────────────────
function getFileType(ext) {
  const m = {
    py:'python', js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
    json:'json', md:'markdown', mdx:'markdown',
    png:'images', jpg:'images', jpeg:'images', gif:'images', svg:'images', webp:'images', ico:'images',
    mp3:'audio', wav:'audio', ogg:'audio', flac:'audio',
    css:'config', html:'config', xml:'config', yaml:'config', yml:'config',
    toml:'config', ini:'config', env:'config',
    txt:'text', log:'text', csv:'text',
  };
  return m[ext] || 'text';
}

const BINARY_TYPES = new Set(['images','audio']);

// ── Simple regex-based AST for Python/JS/TS ─────────────
function dedupeByName(arr) {
  const seen = new Set(), out = [];
  for (const item of arr) {
    if (item && item.name && !seen.has(item.name)) { seen.add(item.name); out.push(item); }
  }
  return out;
}

function extractAst(code, ft) {
  if (!code) return null;
  const lineOf = idx => code.slice(0, idx).split('\n').length;
  try {
    if (ft === 'python') {
      const classes = [...code.matchAll(/^class\s+(\w+)/gm)].map(m=>({name:m[1], line:lineOf(m.index)}));
      const funcs   = [...code.matchAll(/^(?:async\s+)?def\s+(\w+)/gm)].map(m=>({name:m[1], line:lineOf(m.index)}));
      const imports = [
        ...[...code.matchAll(/^import\s+([\w,\s]+)/gm)].flatMap(m=>m[1].split(',').map(s=>({name:s.trim(), line:lineOf(m.index)}))),
        ...[...code.matchAll(/^from\s+(\w[\w.]*)\s+import/gm)].map(m=>({name:m[1], line:lineOf(m.index)})),
      ].filter(x=>x.name);
      if (!classes.length && !funcs.length && !imports.length) return null;
      return { classes:dedupeByName(classes), funcs:dedupeByName(funcs), imports:dedupeByName(imports) };
    }
    if (ft === 'javascript' || ft === 'typescript') {
      const classes = [...code.matchAll(/class\s+(\w+)/g)].map(m=>({name:m[1], line:lineOf(m.index)}));
      const funcsRaw = [...code.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g)]
        .map(m=>({name:m[1]||m[2], line:lineOf(m.index)}));
      const imports = [...code.matchAll(/(?:import|require)\s*(?:\{[^}]*\}\s*from\s*)?['"]([^'"]+)['"]/g)].map(m=>({name:m[1], line:lineOf(m.index)}));
      const funcs = funcsRaw.filter(f=>f.name);
      if (!classes.length && !funcs.length && !imports.length) return null;
      return { classes:dedupeByName(classes), funcs:dedupeByName(funcs), imports:dedupeByName(imports) };
    }
  } catch(e){}
  return null;
}

function readSingleFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const name = path.basename(filePath);
    const ext  = path.extname(name).slice(1).toLowerCase();
    const ft   = getFileType(ext);
    const size = stat.size > 1048576
      ? `${(stat.size/1048576).toFixed(1)} MB`
      : `${(stat.size/1024).toFixed(1)} KB`;

    let code=null, lines=null, ast=null;
    if (!BINARY_TYPES.has(ft)) {
      code  = fs.readFileSync(filePath, 'utf-8');
      lines = code.split('\n').length;
      ast   = extractAst(code, ft);
    }

    return { id:filePath, name, path:filePath, ft, size, mod:formatMod(stat.mtimeMs), lines, code, ast };
  } catch(e) { return null; }
}

function scanFolder(folderPath, maxDepth=5, depth=0) {
  const files = [];
  if (depth > maxDepth) return files;
  let entries;
  try { entries = fs.readdirSync(folderPath, { withFileTypes:true }); } catch { return files; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ['node_modules','__pycache__','dist','build','.git'].includes(entry.name)) continue;
    const full = path.join(folderPath, entry.name);
    if (entry.isDirectory()) files.push(...scanFolder(full, maxDepth, depth+1));
    else if (entry.isFile()) { const f=readSingleFile(full); if(f) files.push(f); }
  }
  return files;
}

ipcMain.handle('run-command', async (_e, cmd) => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, maxBuffer: 1024*1024*5 }, (err, stdout, stderr) => {
      resolve({ stdout: stdout||'', stderr: stderr||(err&&err.message)||'' });
    });
  });
});
ipcMain.handle('show-in-folder', (_e, filePath) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});

ipcMain.handle('rename-file', (_e, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    return readSingleFile(newPath);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('delete-file', (_e, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('create-file', (_e, { dirPath, name }) => {
  try {
    // Uzantı yoksa .txt ekle
    let safeName = (name || '').trim();
    if (safeName && !path.extname(safeName)) safeName += '.txt';
    if (!safeName) return { ok: false, error: 'Geçersiz dosya adı' };

    // dirPath bir dizin mi kontrol et; değilse kendi dizinine düş
    let dir = dirPath || '';
    if (dir) {
      try {
        const st = fs.statSync(dir);
        if (!st.isDirectory()) dir = path.dirname(dir);
      } catch (e) { /* dirPath henüz yok, olduğu gibi kullan */ }
    }

    const fullPath = path.join(dir, safeName);

    // Hedef yolun bir dizin olmadığından emin ol
    try {
      const st2 = fs.statSync(fullPath);
      if (st2.isDirectory()) return { ok: false, error: 'Bu isimde zaten bir klasör var' };
    } catch (e) { /* dosya yok, sorun değil */ }

    fs.writeFileSync(fullPath, '', 'utf-8');
    const result = readSingleFile(fullPath);
    if (!result) return { ok: false, error: 'Dosya oluşturuldu ama okunamadı: ' + fullPath };
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('create-folder', (_e, { dirPath, name }) => {
  try {
    const fullPath = path.join(dirPath || '', name);
    fs.mkdirSync(fullPath, { recursive: true });
    return { ok: true, path: fullPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('rename-folder', (_e, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    return { ok: true, newPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('delete-folder', (_e, folderPath) => {
  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function formatMod(ms) {
  const d = Date.now()-ms, m=Math.floor(d/60000);
  if(m<1)return 'az önce';
  if(m<60)return `${m} dk önce`;
  const h=Math.floor(m/60);
  if(h<24)return `${h} saat önce`;
  return `${Math.floor(h/24)} gün önce`;
}
