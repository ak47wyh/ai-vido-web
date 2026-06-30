/**
 * MediaPanel —— 剪辑工作台左侧素材面板
 *
 * 列出当前空间的素材库：
 * - 已保存视频（SavedVideo）
 * - 成片（FinalCut）
 * - 已保存语音（SavedVoice）
 *
 * 用户可点击素材"添加到时间线"，或未来支持拖拽（drag to timeline）。
 * 当前 MVP：点击 → 调用 onAddToTimeline(sourceRef)。
 */

import React, { useMemo, useState } from 'react';
import { Film, Mic, FolderOpen, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpaceScopedFinalCuts } from '../../hooks/useSpaceScopedQuery';
import { useSavedVoices, useSavedVideos } from '../../hooks/useSavedAssets';
import type { TimelineClipSource } from '../../../domain/ports/PostProcessPorts';

interface MediaPanelProps {
  spaceId: string;
  onAddToTimeline: (source: TimelineClipSource, label: string, durationSec: number) => void;
}

type Tab = 'videos' | 'finalcuts' | 'voices';

export const MediaPanel: React.FC<MediaPanelProps> = ({ spaceId, onAddToTimeline }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('videos');

  const { videos } = useSavedVideos(spaceId);
  const { voices } = useSavedVoices(spaceId);
  const finalCuts = useSpaceScopedFinalCuts();

  // 派生 finalCuts 的 duration（来自 finalCut.duration，毫秒）
  const cutDurations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of finalCuts) {
      if (c.duration > 0) map[c.id] = c.duration / 1000;
    }
    return map;
  }, [finalCuts]);

  return (
    <div style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TabBtn active={tab === 'videos'} onClick={() => setTab('videos')} icon={<Film size={14} />} label={t('editor.media.videos', '视频')} />
        <TabBtn active={tab === 'finalcuts'} onClick={() => setTab('finalcuts')} icon={<FolderOpen size={14} />} label={t('editor.media.finalCuts', '成片')} />
        <TabBtn active={tab === 'voices'} onClick={() => setTab('voices')} icon={<Mic size={14} />} label={t('editor.media.voices', '语音')} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {tab === 'videos' && (
          <MediaList
            items={videos.map(v => ({
              id: v.id,
              label: v.name,
              sub: `${Math.round(v.durationSec)}s · ${v.width}x${v.height}`,
              onAdd: () => onAddToTimeline(
                { kind: 'savedVideo', refId: v.id, storagePath: v.blobKey },
                v.name,
                v.durationSec,
              ),
            }))}
            emptyText={t('editor.media.noVideos', '暂无视频素材')}
          />
        )}

        {tab === 'finalcuts' && (
          <MediaList
            items={finalCuts.map(c => ({
              id: c.id,
              label: t('editor.media.finalCutLabel', '成片') + ' · ' + new Date(c.createdAt).toLocaleDateString(),
              sub: `${(cutDurations[c.id] ?? 0).toFixed(1)}s`,
              onAdd: () => onAddToTimeline(
                { kind: 'finalCut', refId: c.id, storagePath: c.videoStoragePath },
                t('editor.media.finalCutLabel', '成片'),
                cutDurations[c.id] ?? 0,
              ),
            }))}
            emptyText={t('editor.media.noFinalCuts', '暂无成片')}
          />
        )}

        {tab === 'voices' && (
          <MediaList
            items={voices.map(v => ({
              id: v.id,
              label: v.name,
              sub: v.sampleText?.slice(0, 30) ?? '',
              onAdd: () => onAddToTimeline(
                { kind: 'savedVoice', refId: v.id, storagePath: v.audioBlobKey },
                v.name,
                0,
              ),
            }))}
            emptyText={t('editor.media.noVoices', '暂无语音素材')}
          />
        )}
      </div>
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
      fontSize: '0.75rem', color: active ? 'var(--primary-color)' : 'var(--text-muted)',
      background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
      border: 'none', borderBottom: active ? '2px solid var(--primary-color)' : '2px solid transparent',
      cursor: 'pointer',
    }}
  >
    {icon}
    {label}
  </button>
);

interface MediaItem {
  id: string;
  label: string;
  sub?: string;
  onAdd: () => void;
}

const MediaList: React.FC<{ items: MediaItem[]; emptyText: string }> = ({ items, emptyText }) => {
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem 0.5rem' }}>{emptyText}</div>;
  }
  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
            background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', marginBottom: '0.3rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
            {item.sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.sub}</div>}
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.4rem', flexShrink: 0 }}
            onClick={item.onAdd}
            title="添加到时间线"
          >
            <Plus size={12} />
          </button>
        </div>
      ))}
    </>
  );
};

// 扩展 useSavedVideos / useSavedVoices 的导入（如未导出则需在 useSavedAssets.ts 中补充）
