# Smart Project Explorer

An Electron-based, AI-powered desktop code explorer. Built to quickly browse and edit project files, and to learn code step by step with the help of a local AI model.

---

## Features

-  View your project's file structure in a tree view
-  Create, rename, and delete files/folders — all from within the UI
-  Code editor (CodeMirror) - syntax highlighting, search, line numbers
-  In-file search and a preview strip of classes/functions/imports (click to jump to the relevant line)
-  **AI Chat** - ask questions about your project using a local AI model
-  **Learning Mode** - teaches a topic step by step; shows code for each step, validates the code you write in your file, and advances to the next step. Choose step detail level: **Normal** (logical chunks) or **Atomic** (line by line)
-  Built-in terminal - run commands in the project directory
-  Light / dark theme support
-  Custom title bar (frameless window)
-  Modular structure (main / preload / renderer)
-  Cross-platform support (Windows / Linux)
-  Portable build support

### Connecting an AI Model

To use a local AI model, just install [Ollama](https://ollama.com):

```bash
ollama run <model-name>
```

Once the model is running, select and connect it from the **Settings** screen in the app. No external API key or internet connection required - everything runs locally.

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 20.x LTS (recommended) |
| npm | Latest (comes with Node) |
| Git | Latest |

### Notes

- Node 20 LTS is recommended
- Node 22+ may cause incompatibility with some native Electron build packages

---

## Installation

```bash
git clone https://github.com/BurakYildirim-cmd/smart-project-explorer.git
cd smart-project-explorer
npm ci
npm start
```

### Development Mode

```bash
npm run dev
```

### Build (Windows)

```bash
npm run build
```

### Linux Build

```bash
npm run build-linux
```

