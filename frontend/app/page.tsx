'use client';

import React, { useState } from 'react';
import { M3u8Player } from '../components/M3u8Player';
import { Play, Video, Server, Globe, Link2, Sparkles, CheckCircle, Info } from 'lucide-react';

const PRESET_STREAMS = [
  {
    name: 'Mux HLS Test Stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    description: 'Çoklu kalite seviyeli standart M3U8 Master manifest örneği'
  },
  {
    name: 'Apple Basic Stream',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    description: 'Apple test CDN üzerinden standart HLS akışı'
  },
  {
    name: 'Akamai Advanced Stream',
    url: 'https://akamai-a2048.gvt1.com/videoplayback/id/da8e45300e8bcbb6/itag/0/source/gvs/requi/yes/ratebypass/yes/live/1/mdev/1/sver/3/os/1/gcr/tr/ip/0.0.0.0/ipbits/0/expire/1700000000/sparams/id,itag,source,requi,ratebypass,live,mdev,sver,os,gcr,ip,ipbits,expire/signature/sample.m3u8',
    description: 'Özel proxy / geoblock testi için örnek URL'
  }
];

export default function Home() {
  const [inputUrl, setInputUrl] = useState<string>('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  const [activeUrl, setActiveUrl] = useState<string>('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  const [proxyBackendUrl, setProxyBackendUrl] = useState<string>('http://localhost:5000/api/proxy-m3u8');

  const handlePlaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setActiveUrl(inputUrl.trim());
  };

  const handleSelectPreset = (presetUrl: string) => {
    setInputUrl(presetUrl);
    setActiveUrl(presetUrl);
  };

  return (
    <main className="container">
      {/* Header Banner */}
      <header style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 1rem',
          borderRadius: '30px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--accent-primary)',
          marginBottom: '1rem'
        }}>
          <Sparkles size={16} /> Proof of Concept (PoC) Architecture
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          M3U8 Video Stream <span className="gradient-text">Proxy Player</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto', fontSize: '1rem' }}>
          Node.js/Express Türkiye Proxy Backend üzerinden Master M3U8 çeker, `.ts` video parçalarını
          doğrudan hedef CDN'den client-side (`hls.js`) olarak oynatır.
        </p>
      </header>

      {/* Input Form & Controls */}
      <section className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <form onSubmit={handlePlaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* M3U8 URL Input */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              <Link2 size={16} style={{ color: 'var(--accent-primary)' }} />
              Hedef M3U8 Stream URL:
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="url"
                className="input-field"
                placeholder="https://example.com/stream/master.m3u8"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
                <Play size={18} /> Play / Yükle
              </button>
            </div>
          </div>

          {/* Backend Proxy Endpoint Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                <Server size={14} /> Express Proxy Backend Endpoint:
              </label>
              <input
                type="text"
                className="input-field"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                value={proxyBackendUrl}
                onChange={(e) => setProxyBackendUrl(e.target.value)}
                required
              />
            </div>

            {/* Presets List */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Hızlı Test Akışları (Presets):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {PRESET_STREAMS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleSelectPreset(preset.url)}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Main Video Player & Analytics */}
      <section style={{ marginBottom: '2.5rem' }}>
        <M3u8Player
          originalUrl={activeUrl}
          proxyEndpoint={proxyBackendUrl}
        />
      </section>

      {/* Architecture Explanation Card */}
      <section className="glass-panel" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={20} style={{ color: 'var(--accent-primary)' }} /> Mimari Çalışma Mantığı ve Teknik Akış
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              <Server size={18} /> 1. Express Proxy Backend
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Frontend tarafı Master `.m3u8` manifest isteğini `/api/proxy-m3u8?url=...` endpoint'ine atar.
              Node.js sunucusu Türkiye IP'li HTTP/SOCKS5 proxy üzerinden manifest dosyasını indirir.
              Göreli (relative) `.ts` ve alt playlist yollarını CDN mutlak URL'lerine dönüştürür.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>
              <Globe size={18} /> 2. Client-Side Chunk Delivery
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              `hls.js` manifest'i çözümler ve video parçacıklarını (`.ts` chunks) doğrudan hedef CDN'e istek
              atarak çeker. Backend proxy sunucusu video bandwidth trafiğinden tamamen baypas edilir.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--info)', marginBottom: '0.5rem' }}>
              <Video size={18} /> 3. HLS.js HTML5 Player
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Adaptive Bitrate Streaming (ABR) desteği sayesinde bant genişliğine göre otomatik veya manuel
              çözünürlük (1080p, 720p, 480p) geçişleri gerçekleştirir.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
