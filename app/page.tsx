'use client';

import React, { useState } from 'react';
import { M3u8Player } from '../components/M3u8Player';
import { Play, Video, Server, Globe, Link2, Sparkles, Info, UserCheck } from 'lucide-react';

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
  }
];

export default function Home() {
  const [inputUrl, setInputUrl] = useState<string>('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  const [activeUrl, setActiveUrl] = useState<string>('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
  // Set default mode to '/api/m3u8' (API Proxy) for guaranteed CORS & disguised segment bypass
  const [playbackMode, setPlaybackMode] = useState<string>('/api/m3u8');

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
          <Sparkles size={16} /> Next.js API Proxy Stream Player
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          M3U8 Video Stream <span className="gradient-text">Player</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto', fontSize: '1rem' }}>
          Next.js API rotaları (`/api/m3u8` & `/api/segment`) üzerinden M3U8 ve gizli `.jpeg` segment parçalarını tüneller.
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

          {/* Mode Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                <UserCheck size={14} /> İletim Modu (Trafik Kaynağı):
              </label>
              <select
                className="input-field"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem', cursor: 'pointer' }}
                value={playbackMode}
                onChange={(e) => setPlaybackMode(e.target.value)}
              >
                <option value="/api/m3u8">🛡️ API Proxy Modu (Önerilen - CORS & Gizli Segment Tüneli)</option>
                <option value="direct">⚡ Doğrudan İstemci Modu (Kullanıcı IP - CORS'suz CDN'ler)</option>
                <option value="cors-gateway">🌐 Genel İstemci CORS Gateway Modu</option>
              </select>
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
          proxyEndpoint={playbackMode}
        />
      </section>

      {/* Architecture Explanation Card */}
      <section className="glass-panel" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={20} style={{ color: 'var(--accent-primary)' }} /> İletim Modları ve Çalışma Şekli
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
              <Server size={18} /> 1. API Proxy Modu (Önerilen)
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              `/api/m3u8` ve `/api/segment` Next.js rotaları üzerinden CORS engellerini ve gizli `.jpeg` parçalarını tüneller.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>
              <UserCheck size={18} /> 2. Doğrudan İstemci Modu
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              `hls.js` doğrudan kullanıcı IP'si ile isteği atar. CORS başlığı sağlayan açık CDN'lerde çalışır.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--info)', marginBottom: '0.5rem' }}>
              <Globe size={18} /> 3. Genel CORS Gateway
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Genel istemci proxy tünelleri üzerinden isteği iletir.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
