const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
  return scanFolder(result.filePaths[0]);
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

function formatMod(ms) {
  const d = Date.now()-ms, m=Math.floor(d/60000);
  if(m<1)return 'az önce';
  if(m<60)return `${m} dk önce`;
  const h=Math.floor(m/60);
  if(h<24)return `${h} saat önce`;
  return `${Math.floor(h/24)} gün önce`;
}
