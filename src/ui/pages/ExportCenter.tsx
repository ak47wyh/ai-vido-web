import React, { useState } from 'react';
import { Download, Trash2, Film, Filter, RefreshCw, FilmIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { finalCutRepo } from '../../dependencies';
import { useSpaceScopedStories, useSpaceScopedFinalCuts } from '../hooks/useSpaceScopedQuery';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getErrorMessage } from '../utils/errorUtils';
import { PostProductionPanel } from '../components/PostProductionPanel';
import type { FinalCut } from '../../domain/entities/models';

type FilterRange = 'all' | 'today' | 'week' | 'month';

export const ExportCenter: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewCutId, setPreviewCutId] = useState<string | null>(null);

  const stories = useSpaceScopedStories();
  const allCuts = useSpaceScopedFinalCuts();

  const filteredCuts = filterCuts(allCuts, filterRange);

  const handleDownload = (cut: FinalCut) => {
    try {
      const url = URL.createObjectURL(cut.videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `final-cut-${cut.storyId}-${cut.createdAt}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('success', t('export.downloadStarted'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('export.downloadFailed')));
    }
  };

  const handleDelete = async (cut: FinalCut) => {
    const ok = await confirm({
      title: t('export.confirmDeleteTitle'),
      message: t('export.confirmDelete'),
      confirmLabel: t('export.deleteBtn'),
      danger: true
    });
    if (!ok) return;
    setDeletingId(cut.id);
    try {
      await finalCutRepo.delete(cut.id);
      showToast('success', t('export.deleted'));
      if (previewCutId === cut.id) setPreviewCutId(null);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('export.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = () => {
    setPreviewCutId(p => p);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

  const getStoryTitle = (storyId: string): string => {
    return stories.find(s => s.id === storyId)?.title || t('export.untitledStory');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('export.title')}</h1>
          <p>{t('export.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Filter size={16} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('export.filter')}:</span>
        {(['all', 'today', 'week', 'month'] as FilterRange[]).map(range => (
          <button
            key={range}
            className={filterRange === range ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
            onClick={() => setFilterRange(range)}
          >
            {t(`export.range.${range}`)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('export.totalCount', { count: filteredCuts.length })}
        </span>
      </div>

      {previewCutId && (() => {
        const cut = filteredCuts.find(c => c.id === previewCutId);
        if (!cut) return null;
        const videoUrl = URL.createObjectURL(cut.videoBlob);
        return (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Film size={18} />
              <h3 style={{ margin: 0 }}>{getStoryTitle(cut.storyId)}</h3>
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                onClick={() => setPreviewCutId(null)}
              >
                {t('export.closePreview')}
              </button>
            </div>
            <video
              src={videoUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '480px', borderRadius: 'var(--radius-md)', background: '#000' }}
            />
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {formatSize(cut.size)} · {formatDuration(cut.duration)} · {cut.hasSubtitles ? t('export.withSubs') : t('export.noSubs')} · {formatDate(cut.createdAt)}
            </div>
            <div style={{ marginTop: '1rem' }}>
              <PostProductionPanel
                videoBlob={cut.videoBlob}
                videoUrl={null}
                onVideoProcessed={({ blob }) => {
                  cut.videoBlob = blob;
                  finalCutRepo.save(cut);
                  showToast('success', t('export.videoUpdated'));
                }}
              />
            </div>
          </div>
        );
      })()}

      {filteredCuts.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <FilmIcon size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t('export.empty')}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('export.emptyHint')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredCuts.map(cut => (
            <div
              key={cut.id}
              className="glass-panel"
              style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  background: '#000',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => setPreviewCutId(cut.id)}
              >
                {cut.thumbnailUrl ? (
                  <img
                    src={cut.thumbnailUrl}
                    alt={getStoryTitle(cut.storyId)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                ) : (
                  <Film size={32} style={{ color: 'rgba(255,255,255,0.5)' }} />
                )}
              </div>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{getStoryTitle(cut.storyId)}</h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatSize(cut.size)} · {formatDuration(cut.duration)} · {formatDate(cut.createdAt)}
              </div>
              {cut.hasSubtitles && (
                <div style={{ fontSize: '0.7rem', color: '#34d399' }}>
                  ✓ {t('export.withSubs')}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={() => handleDownload(cut)}
                >
                  <Download size={14} /> {t('export.downloadBtn')}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.6rem', color: '#f87171' }}
                  onClick={() => handleDelete(cut)}
                  disabled={deletingId === cut.id}
                >
                  {deletingId === cut.id ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function filterCuts(cuts: FinalCut[], range: FilterRange): FinalCut[] {
  const now = Date.now();
  const ranges: Record<FilterRange, number> = {
    all: 0,
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  };
  const threshold = ranges[range];
  if (threshold === 0) return cuts.sort((a, b) => b.createdAt - a.createdAt);
  return cuts
    .filter(c => now - c.createdAt <= threshold)
    .sort((a, b) => b.createdAt - a.createdAt);
}
