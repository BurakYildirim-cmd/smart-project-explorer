🚀 Smart Project Explorer

Electron tabanlı masaüstü uygulaması. Proje dosyalarını hızlı ve basit şekilde keşfetmek için geliştirilmiştir.

⚡ Özellikler
📁 Proje dosya yapısı görüntüleme
⚡ Hızlı Electron arayüzü
🧩 Modüler yapı (main / preload)
💻 Cross-platform destek (Windows / Linux)
📦 Portable build desteği
🛠️ Gereksinimler
Node.js 18 veya 20 (ÖNERİLİR)
npm

👉 Node 22+ veya 26 önerilmez (Electron uyumsuzluğu olabilir)

🚀 Kurulum
1. Repoyu klonla
git clone https://github.com/BurakYildirim-cmd/smart-project-explorer.git
cd smart-project-explorer
2. Bağımlılıkları yükle (PRO yöntem)
npm ci

⚠️ npm install yerine npm ci kullanılır
Çünkü bu proje lockfile bazlı stabil kurulum kullanır.

3. Uygulamayı başlat
npm start
💻 Development Mode
npm run dev
📦 Build (Windows)
npm run build

Portable .exe çıktısı:

dist/
🐧 Linux Build
npm run build-linux

Çıktı:

.AppImage
