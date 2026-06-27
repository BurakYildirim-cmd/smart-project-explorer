# Smart Project Explorer

Electron tabanlı masaüstü uygulaması. Proje dosyalarını hızlı ve basit şekilde keşfetmek için geliştirilmiştir.

---

##  Özellikler

-  Proje dosya yapısı görüntüleme  
-  Hızlı Electron arayüzü  
-  Modüler yapı (main / preload)  
-  Cross-platform destek (Windows / Linux)  
-  Portable build desteği  

---

##  Requirements

| Tool | Version |
|------|--------|
| Node.js | 20.x LTS (recommended) |
| npm | Latest (comes with Node) |
| Git | Latest |

###  Notes
- Node 20 LTS önerilir
- Node 22+ bazı native Electron build paketlerinde uyumsuzluk çıkarabilir

##  Installation

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
