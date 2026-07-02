/**
 * WelcomePanel —— 未选故事时的引导面板
 *
 * 在用户未选择故事、未创建时间线时展示，提供：
 * - 醒目的导入入口（本地上传 + 链接导入）
 * - 最近素材列表（快速开始）
 * - 引导文案说明如何开始剪辑
 */

import React, { useState, useEffect } from 'react';
import { Film, Upload, Link, Play, Clock, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSavedVideos } from '../../hooks/useSavedAssets';
import { getFileStorage } from '../../../dependencies';
import type { SavedVideo } from '../../../domain/entities/models';

interface WelcomePanelProps {
  spaceId: string;
  onImportClick: () => void;
  onVideoSelect: (video: SavedVideo) => void;
}

const VideoThumbnail: React.FC<{ blobKey?: string }> = ({ blobKey }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let createdUrl: string | null = null;
    if (!blobKey) return;
    (async () => {
      try {
        const u = await getFileStorage().getObjectUrl(blobKey);
        if (!revoked) {
          createdUrl = u;
          setUrl(u);
        }
      } catch {
        setUrl(null);
      }
    })();
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [blobKey]);

  if (!blobKey) return null;

  return (
    <img
      src={url || ''}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }}
      onError={e => (e.target as HTMLImageElement).style.display = 'none'}
    />
  );
};

export const WelcomePanel: React.FC<WelcomePanelProps> = ({ spaceId, onImportClick, onVideoSelect }) => {
  const { t } = useTranslation();
  const { videos, loading } = useSavedVideos(spaceId, { limit: 6 });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem', background: 'rgba(0,0,0,0.08)',
    }}>
      <div style={{
        width: '100%', maxWidth: 600, textAlign: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-color), rgba(255,255,255,0.2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <Film size={36} style={{ color: '#fff' }} />
        </div>

        <h1 style={{
          margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: '600',
          color: 'var(--text-primary)',
        }}>
          {t('editor.welcome.title', '开始视频剪辑')}
        </h1>

        <p style={{
          margin: '0 0 2rem', fontSize: '0.9rem', color: 'var(--text-muted)',
        }}>
          {t('editor.welcome.subtitle', '导入本地视频或粘贴分享链接，一键开始创作')}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '3rem' }}>
          <button
            className="btn btn-primary"
            onClick={onImportClick}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Upload size={16} />
            {t('editor.welcome.importLocal', '本地上传')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onImportClick}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Link size={16} />
            {t('editor.welcome.importLink', '链接导入')}
          </button>
        </div>

        {spaceId && (
          <div style={{ textAlign: 'left' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
              <Clock size={12} />
              {t('editor.welcome.recentAssets', '最近素材')}
            </div>

            {loading ? (
              <div style={{
                padding: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)',
              }}>
                {t('editor.welcome.loading', '加载中...')}
              </div>
            ) : videos.length > 0 ? (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
              }}>
                {videos.map(video => (
                  <div
                    key={video.id}
                    onClick={() => onVideoSelect(video)}
                    style={{
                      cursor: 'pointer', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                      background: 'rgba(255,255,255,0.05)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                  >
                    <div style={{ position: 'relative', aspectRatio: '16/9' }}>
                      <VideoThumbnail blobKey={video.thumbnailBlobKey} />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Play size={20} style={{ color: '#fff', opacity: 0.8 }} />
                      </div>
                      <div style={{
                        position: 'absolute', bottom: '0.25rem', right: '0.25rem',
                        fontSize: '0.6rem', color: '#fff',
                        background: 'rgba(0,0,0,0.6)', padding: '0.1rem 0.25rem',
                        borderRadius: '2px',
                      }}>
                        {formatDuration(video.durationSec)}
                      </div>
                    </div>
                    <div style={{ padding: '0.3rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {video.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)',
              }}>
                {t('editor.welcome.noAssets', '暂无素材，请先导入视频')}
              </div>
            )}
          </div>
        )}

        <div style={{
          marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem',
          fontSize: '0.7rem', color: 'var(--text-muted)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Film size={12} />
            {t('editor.welcome.supportVideo', '支持 MP4/WebM/MOV')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Link size={12} />
            {t('editor.welcome.supportLink', '支持抖音等平台')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <FileText size={12} />
            {t('editor.welcome.maxSize', '最大 500MB')}
          </span>
        </div>
      </div>
    </div>
  );
};
