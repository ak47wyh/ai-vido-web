import React, { useState } from 'react';
import { Play, Pause, Trash2, SplitSquareHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface VideoVersion {
  taskId: string;
  videoUrl: string;
  createdAt: number;
  model?: string;
  prompt?: string;
  mode?: string;
  duration?: number;
}

export interface VideoCompareProps {
  versions: VideoVersion[];
  onSelect?: (version: VideoVersion) => void;
  onDelete?: (taskId: string) => void;
}

export const VideoCompare: React.FC<VideoCompareProps> = ({ versions, onSelect, onDelete }) => {
  const { t } = useTranslation();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const [sideBySide, setSideBySide] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleVersion = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  };

  const handlePlay = (v: VideoVersion) => {
    if (playingId === v.taskId) {
      const el = audioRefs.current.get(v.taskId);
      el?.pause();
      setPlayingId(null);
    } else {
      // Stop others first
      audioRefs.current.forEach(el => el.pause());
      setPlayingId(v.taskId);
      const el = audioRefs.current.get(v.taskId);
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => {});
      }
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  if (versions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {t('videoCompare.noVersions')}
      </div>
    );
  }

  const selectedVersions = versions.filter(v => selectedIds.has(v.taskId));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
          {t('videoCompare.selectForCompare', { count: selectedIds.size })}
        </span>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          disabled={selectedIds.size < 2}
          onClick={() => setSideBySide(s => !s)}
        >
          <SplitSquareHorizontal size={12} />
          {t('videoCompare.sideBySide')}
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {versions.length} {t('videoCompare.versionCount')}
        </span>
      </div>

      {/* Side-by-side comparison mode */}
      {sideBySide && selectedVersions.length === 2 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem',
          padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)'
        }}>
          {selectedVersions.map(v => (
            <div key={v.taskId} style={{ position: 'relative' }}>
              <video
                key={v.taskId}
                src={v.videoUrl}
                controls
                style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000' }}
              />
              <div style={{
                position: 'absolute', top: '0.5rem', left: '0.5rem',
                background: 'rgba(0,0,0,0.7)', borderRadius: '4px',
                padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: '#fff'
              }}>
                {v.model || t('videoCompare.version')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Version cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr)', gap: '0.75rem' }}>
        {versions.map(v => (
          <div
            key={v.taskId}
            style={{
              background: selectedIds.has(v.taskId) ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.05)',
              border: selectedIds.has(v.taskId) ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              cursor: 'pointer',
            }}
            onClick={() => toggleVersion(v.taskId)}
          >
            <div style={{ position: 'relative' }}>
              <video
                ref={el => { if (el) audioRefs.current.set(v.taskId, el); }}
                src={v.videoUrl}
                muted
                style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block', background: '#000' }}
              />
              {playingId === v.taskId && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.5)',
                }}>
                  <button
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { e.stopPropagation(); handlePlay(v); }}
                  >
                    {playingId === v.taskId ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
                  </button>
                </div>
              )}
              {selectedIds.has(v.taskId) && (
                <div style={{
                  position: 'absolute', top: '0.25rem', right: '0.25rem',
                  background: '#818cf8', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff'
                }}>
                  ✓
                </div>
              )}
            </div>
            <div style={{ padding: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {v.model || t('videoCompare.version')}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {formatTime(v.createdAt)}
              </div>
              {v.prompt && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.prompt}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                  onClick={e => { e.stopPropagation(); onSelect?.(v); }}
                >
                  <Play size={10} /> {t('videoCompare.apply')}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.3rem', color: '#f87171' }}
                  onClick={e => { e.stopPropagation(); onDelete?.(v.taskId); }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
