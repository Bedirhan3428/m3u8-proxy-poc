'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, RefreshCw, Layers, Activity, AlertCircle, UserCheck, Server } from 'lucide-react';

interface M3u8PlayerProps {
  originalUrl: string;
  proxyEndpoint: string; // '/api/m3u8' or 'direct'
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
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({
    chunksLoaded: 0,
    currentBitrate: 0,
    manifestsCount: 0
  });

  const isDirectMode = proxyEndpoint === 'direct';

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);
    setLogs(prev => [
      { id: Math.random().toString(36).substring(2, 9), timestamp: time, type, message },
      ...prev.slice(0, 49)
    ]);
  };

  const getTargetPlaybackUrl = (): string => {
    if (isDirectMode) {
      return originalUrl;
    }
    if (proxyEndpoint.includes('?url=')) {
      return `${proxyEndpoint}${encodeURIComponent(originalUrl)}`;
    }
    return `/api/m3u8?url=${encodeURIComponent(originalUrl)}`;
  };

  const targetPlaybackUrl = getTargetPlaybackUrl();

  const initPlayer = () => {
    if (!originalUrl) return;

    setStatus('loading');
    setErrorMessage(null);
    setLevels([]);
    setStats({ chunksLoaded: 0, currentBitrate: 0, manifestsCount: 0 });

    if (isDirectMode) {
      addLog('info', `[DOĞRUDAN İSTEMCİ MODU] İstemci doğrudan hedef CDN tarafına istek atıyor.`);
    } else {
      addLog('info', `[API PROXY MODU] İstek Vercel Next.js API rotaları üzerinden tünelleniyor.`);
    }

    addLog('manifest', `REQ: ${targetPlaybackUrl}`);

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

      hls.loadSource(targetPlaybackUrl);
      hls.attachMedia(videoNode);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setStatus('playing');
        addLog('info', `Manifest yüklendi ve çözümlendi (${data.levels.length} kalite seviyesi tespit edildi).`);
        setStats(prev => ({ ...prev, manifestsCount: prev.manifestsCount + 1 }));

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
          addLog('info', `Kalite Seviyesi: ${levelObj.height || 'Auto'}p (${(levelObj.bitrate / 1000).toFixed(0)} kbps)`);
          setStats(prev => ({ ...prev, currentBitrate: levelObj.bitrate }));
        }
      });

      hls.on(Hls.Events.FRAG_LOADING, (_, data) => {
        const chunkUrl = data.frag.relurl || data.frag.url;
        addLog('chunk', `CHUNK REQ: ${chunkUrl}`);
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setStats(prev => ({ ...prev, chunksLoaded: prev.chunksLoaded + 1 }));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data);
          setStatus('error');

          let errorDesc = `HATA: ${data.details}`;
          if (isDirectMode && (data.details.includes('manifestLoadError') || data.details.includes('fragLoadError'))) {
            errorDesc += ` -> Hedef CDN sunucusu Access-Control-Allow-Origin başlığı vermediği için tarayıcınız isteği engelledi. Dilerseniz API Proxy moduna geçebilirsiniz.`;
          }

          setErrorMessage(errorDesc);
          addLog('error', `Kritik HLS Hatası: ${data.details}`);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addLog('error', `Ağ hatası oluştu, yeniden deneniyor...`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addLog('error', `Medya hatası oluştu, kurtarılıyor...`);
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
      addLog('info', `Yerel Safari HLS oynatıcısı kullanılıyor.`);
      videoNode.src = targetPlaybackUrl;
      videoNode.addEventListener('loadedmetadata', () => {
        setStatus('playing');
        videoNode.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    } else {
      setStatus('error');
      setErrorMessage(`Bu tarayıcı HLS oynatmayı desteklemiyor.`);
      addLog('error', `HLS desteksiz tarayıcı.`);
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
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%',
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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {isDirectMode ? 'Doğrudan İstemci Üzerinden Yükleniyor...' : 'API Proxy Üzerinden Yükleniyor...'}
              </p>
            </div>
          )}

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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '550px' }}>{errorMessage}</p>
              <button className="btn-secondary" onClick={initPlayer}>
                <RefreshCw size={16} /> Tekrar Deneyin
              </button>
            </div>
          )}
        </div>

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

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
            Trafik ve İstemci Analizi (Client Network)
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isDirectMode ? (
              <span className="badge badge-success">
                <UserCheck size={12} /> İstemci (Kullanıcı IP): Doğrudan CDN
              </span>
            ) : (
              <span className="badge badge-warning">
                <Server size={12} /> API Proxy Modu: Aktif (/api/m3u8)
              </span>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manifest İstekleri</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
              {stats.manifestsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {isDirectMode ? '(Tarayıcı ➔ CDN)' : '(Next.js API /api/m3u8)'}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Yüklenen TS Chunks</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>
              {stats.chunksLoaded}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {isDirectMode ? '(Kullanıcı İstemcisi)' : '(Next.js API /api/segment)'}
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
              if (log.type === 'manifest') color = '#a855f7';
              if (log.type === 'chunk') color = '#10b981';
              if (log.type === 'error') color = '#ef4444';

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
    </div>
  );
};
