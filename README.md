# M3U8 Video Stream Player (Next.js Full-Stack App Router)

Next.js App Router API rotaları (`/api/m3u8` & `/api/segment`) üzerinden M3U8 manifestlerini ve gizli video parçacıklarını (`.jpeg`, `.png`, `.ts`) CORS/Referer engellerini aşacak şekilde tünelleyen HTML5 HLS video oynatıcı uygulaması.

---

## 🚀 Hızlı Başlangıç (Quickstart)

Harici bir Node.js/Express sunucusuna ihtiyaç **yoktur**.

### 1. Bağımlılıkları Yükleyin:
```bash
npm install
```

### 2. Uygulamayı Başlatın:
```bash
npm run dev
```
> Uygulama `http://localhost:3000` adresinde çalışacaktır.

---

## 🏗️ Mimari ve Çalışma Mantığı

- **`/api/m3u8?url=<M3U8_URL>`**: Target manifest dosyasını indirir. Manifest içindeki tüm gizli segment linklerini (`file000.jpeg`, `.ts` vb.) `/api/segment` endpoint'ine rewritelar.
- **`/api/segment?url=<TS_URL>`**: Segment verisini tüneller ve `Content-Type: video/MP2T` başlığı ile `hls.js` player'a sunar.
- **`hls.js`**: Akışı çözümler ve oynatır.
