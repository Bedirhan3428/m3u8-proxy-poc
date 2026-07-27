'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, RefreshCw, Layers, ShieldCheck, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

interface M3u8PlayerProps {
  originalUrl: string;
  proxyEndpoint: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'manifest' | 'chunk' | 'info' | 'error';
  message: string;
}

interface LevelOption {
  index: number;
  height: number;
  bitrate: number;
}

export const M3u8Player: React.FC<M3u8PlayerProps> = ({ originalUrl, proxyEndpoint }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    chunksLoaded: 0,
    currentBitrate: 0,
    proxyManifestsCount: 0
  });

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);
    setLogs(prev => [
      { id: Math.random().toString(36).substring(2, 9), timestamp: time, type, message },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  const proxiedUrl = `${proxyEndpoint}?url=${encodeURIComponent(originalUrl)}`;

  const initPlayer = () => {
    if (!originalUrl) return;

    setStatus('loading');
    setErrorMessage(null);
    setLevels([]);
    setStats({ chunksLoaded: 0, currentBitrate: 0, proxyManifestsCount: 0 });

    addLog('info', `İstek başlatıldı. Proxy Endpoint: ${proxyEndpoint}`);
    addLog('manifest', `PROXIED MANIFEST REQ: ${proxiedUrl}`);

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const videoNode = videoRef.current;
    if (!videoNode) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60
      });

      hlsRef.current = hls;

      hls.loadSource(proxiedUrl);
      hls.attachMedia(videoNode);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setStatus('playing');
        addLog('info', `Manifest başarıyla yüklendi ve çözümlendi (${data.levels.length} yayın seviyesi bulundu).`);
        setStats(prev => ({ ...prev, proxyManifestsCount: prev.proxyManifestsCount + 1 }));

        const parsedLevels: LevelOption[] = data.levels.map((lvl, index) => ({
          index,
          height: lvl.height,
          bitrate: lvl.bitrate
        }));
        setLevels(parsedLevels);

        videoNode.play().then(() => setIsPlaying(true)).catch(err => {
          console.warn('Autoplay prevented:', err);
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const levelObj = hls.levels[data.level];
        if (levelObj) {
          addLog('info', `Yayın Kalitesi Değiştirildi: ${levelObj.height || 'Auto'}p (${(levelObj.bitrate / 1000).toFixed(0)} kbps)`);
          setStats(prev => ({ ...prev, currentBitrate: levelObj.bitrate }));
        }
      });

      // Track TS chunk loading from target CDN
      hls.on(Hls.Events.FRAG_LOADING, (_, data) => {
        const chunkUrl = data.frag.relurl || data.frag.url;
        addLog('chunk', `DIRECT CDN CHUNK REQ: ${chunkUrl}`);
      });

      hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
        setStats(prev => ({ ...prev, chunksLoaded: prev.chunksLoaded + 1 }));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data);
          setStatus('error');
          setErrorMessage(`FATAL ERROR: ${data.details}`);
          addLog('error', `Kritik HLS Hatası: ${data.details}`);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addLog('error', 'Ağ hatası oluştu, yeniden bağlanılıyor...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addLog('error', 'Medya hatası oluştu, kurtarılmaya çalışılıyor...');
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        } else {
          addLog('error', `HLS Uyarısı: ${data.details}`);
        }
      });

    } else if (videoNode.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      addLog('info', 'Hls.js desteklenmiyor, yerel Safari HLS oynatıcısı kullanılıyor.');
      videoNode.src = proxiedUrl;
      videoNode.addEventListener('loadedmetadata', () => {
        setStatus('playing');
        videoNode.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    } else {
      setStatus('error');
      setErrorMessage('Bu tarayıcı HLS (M3U8) oynatmayı desteklemiyor.');
      addLog('error', 'HLS desteksiz tarayıcı.');
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [originalUrl, proxyEndpoint]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeLevel = (levelIndex: number) => {
    if (!hlsRef.current) return;
    setCurrentLevel(levelIndex);
    hlsRef.current.currentLevel = levelIndex;
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
      {/* Video Container Card */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%', // 16:9 Aspect Ratio
          backgroundColor: '#000'
        }}>
          <video
            ref={videoRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
            playsInline
          />

          {/* Loading Overlay */}
          {status === 'loading' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(10, 12, 16, 0.85)',
              backdropFilter: 'blur(4px)',
              gap: '1rem'
            }}>
              <RefreshCw className="animate-spin" size={40} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Manifest Türkiye Proxy Üzerinden Çekiliyor...</p>
            </div>
          )}

          {/* Error Overlay */}
          {status === 'error' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.95)',
              padding: '2rem',
              textAlign: 'center',
              gap: '1rem'
            }}>
              <AlertCircle size={48} style={{ color: 'var(--danger)' }} />
              <h3 style={{ color: 'var(--danger)', fontSize: '1.2rem', fontWeight: 600 }}>Akış Başlatılamadı</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px' }}>{errorMessage}</p>
              <button className="btn-secondary" onClick={initPlayer}>
                <RefreshCw size={16} /> Tekrar Deneyin
              </button>
            </div>
          )}
        </div>

        {/* Video Control Bar */}
        <div style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-secondary" onClick={togglePlay} disabled={status !== 'playing'}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Durdur' : 'Oynat'}
            </button>

            <button className="btn-secondary" onClick={toggleMute} disabled={status !== 'playing'}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Quality Selector */}
            {levels.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} style={{ color: 'var(--text-secondary)' }} />
                <select
                  value={currentLevel}
                  onChange={(e) => changeLevel(Number(e.target.value))}
                  style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={-1}>Otomatik Kalite (Auto)</option>
                  {levels.map(lvl => (
                    <option key={lvl.index} value={lvl.index}>
                      {lvl.height ? `${lvl.height}p` : `Seviye ${lvl.index}`} ({Math.round(lvl.bitrate / 1000)} kbps)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button className="btn-secondary" onClick={toggleFullscreen}>
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Traffic Diagnostics & Live Logs Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
            Trafik ve Akış Analizi (PoC Verification)
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="badge badge-success">
              <ShieldCheck size={12} /> Manifest Proxy: Aktif
            </span>
            <span className="badge badge-info">
              <CheckCircle2 size={12} /> TS Segmentler: Doğrudan CDN
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proxy Manifest İstekleri</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
              {stats.proxyManifestsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              (Backend Node.js Üzerinden)
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Yüklenen TS Chunks</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>
              {stats.chunksLoaded}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              (Doğrudan İstemci ➔ CDN)
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mevcut Bitrate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--info)', marginTop: '0.2rem' }}>
              {stats.currentBitrate ? `${Math.round(stats.currentBitrate / 1000)} kbps` : '-'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              (Adaptive Bitrate)
            </div>
          </div>
        </div>

        {/* Live Logs Terminal Output */}
        <div style={{
          background: '#07090e',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          maxHeight: '220px',
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
              Henüz network olayı tetiklenmedi. Oynat butonuna basınız.
            </div>
          ) : (
            logs.map(log => {
              let color = 'var(--text-secondary)';
              if (log.type === 'manifest') color = '#a855f7'; // Purple for Proxy Manifest
              if (log.type === 'chunk') color = '#10b981'; // Green for Direct CDN Chunk
              if (log.type === 'error') color = '#ef4444'; // Red for Errors

              return (
                <div key={log.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', lineHeight: '1.4' }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{log.timestamp}]</span>
                  <span style={{ color, wordBreak: 'break-all' }}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
