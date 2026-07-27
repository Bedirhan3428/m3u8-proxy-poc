'use client';

import React, { useState } from 'react';
import { M3u8Player } from '../components/M3u8Player';
import { Play, Video, Server, Globe, Link2, Sparkles, Info } from 'lucide-react';

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
  const [proxyBackendUrl, setProxyBackendUrl] = useState<string>('/api/m3u8');

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
          <Sparkles size={16} /> Next.js Full-Stack App Router Proxy Architecture
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          M3U8 Video Stream <span className="gradient-text">Player</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto', fontSize: '1rem' }}>
          Next.js App Router API rotaları (`/api/m3u8` & `/api/segment`) üzerinden harici Node.js sunucusuna ihtiyaç duymadan
          M3U8 manifest ve gizli segment parçalarını tüneller.
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
                <Server size={14} /> Internal API Proxy Endpoint:
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
              <Server size={18} /> 1. Next.js App Router `/api/m3u8`
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Master `.m3u8` manifest isteğini `/api/m3u8` endpoint'ine atar.
              Manifest içindeki `.jpeg`, `.png`, `.ts` gizli parçaları `/api/segment` endpoint'ine rewritelar.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>
              <Globe size={18} /> 2. Next.js App Router `/api/segment`
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Segment isteklerini indirir ve Content-Type başlığını `video/MP2T` olarak tarayıcıya iletir.
              Harici Node.js sunucusuna gerek kalmaz.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--info)', marginBottom: '0.5rem' }}>
              <Video size={18} /> 3. HLS.js HTML5 Player
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Adaptive Bitrate Streaming (ABR) desteği sayesinde çözünürlük geçişleri ve oynatma sağlanır.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
