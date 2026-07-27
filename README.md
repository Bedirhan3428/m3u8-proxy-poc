# Minimalist M3U8 Video Stream PoC

Bu proje, Türkiye IP Proxy destekli M3U8 HLS Master Manifest akışlarını çekip Next.js istemcisinde `hls.js` ile oynatan Proof of Concept (PoC) mimarisidir.

---

## 🏗️ Mimari ve Çalışma Mantığı

```
[ Next.js İstemcisi (hls.js) ]
       │
       ├── 1. Master Manifest İstegi ──> [ Node.js/Express Proxy Backend ] ──> [ TR Proxy ] ──> [ Hedef CDN ]
       │                                  (M3U8 indirilir, görece URL'ler mutlak CDN URL'sine dönüştürülür)
       │
       └── 2. TS Video Chunks ───────────────────────────────────────────────────────────────> [ Hedef CDN ]
                                          (Doğrudan İstemci ➔ CDN, Backend Baypas Edilir)
```

---

## 🚀 Hızlı Başlangıç (Quickstart)

### 1. Backend Kurulumu & Çalıştırılması (Node.js / Express)

```bash
cd backend
npm install
```

#### Türkiye Proxy Konfigürasyonu (İsteğe Bağlı)
`backend/.env` dosyasını açıp proxy bilgilerinizi ekleyebilirsiniz:
```env
PORT=5000
# Örnek HTTP Proxy: http://kullanici:sifre@185.xxx.xxx.xxx:8080
# Örnek SOCKS5 Proxy: socks5://185.xxx.xxx.xxx:1080
PROXY_URL=http://user:pass@turkey-proxy-ip:port
CORS_ORIGIN=*
```

#### Backend Sunucusunu Başlatma:
```bash
npm run dev
```
> Sunucu `http://localhost:5000` adresinde çalışmaya başlayacaktır.

---

### 2. Frontend Kurulumu & Çalıştırılması (Next.js)

```bash
cd ../frontend
npm install
npm run dev
```
> İstemci `http://localhost:3000` adresinde çalışmaya başlayacaktır.

---

## 🧪 PoC Test ve Doğrulama Adımları

1. Tarayıcıda `http://localhost:3000` adresini açın.
2. Form alanına test etmek istediğiniz M3U8 URL'ini girin veya **Presets** (Örnek Akışlar) butonlarından birini seçin.
3. **Play / Yükle** butonuna basın.
4. Sayfadaki **Trafik ve Akış Analizi** panelinde:
   - **Proxy Manifest İstekleri**: Master M3U8 dosyasının Node.js proxy sunucusu üzerinden çekildiğini doğrular.
   - **Yüklenen TS Chunks**: `.ts` video parçacıklarının doğrudan hedef CDN'den çekildiğini doğrular.
5. Tarayıcının Network (Geliştirici Araçları) sekmesinden istekleri inceleyebilirsiniz.
