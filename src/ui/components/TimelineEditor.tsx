import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, ZoomIn, ZoomOut, Scissors, Volume2, VolumeX, Lock, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Timeline, TimelineClip, TransitionType } from '../../domain/ports/PostProcessPorts';

export interface TimelineEditorProps {
  timeline: Timeline;
  onChange: (timeline: Timeline) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onClipSelect?: (clip: TimelineClip | null) => void;
}

const DEFAULT_PX_PER_SECOND = 60;
const MIN_PX_PER_SECOND = 20;
const MAX_PX_PER_SECOND = 240;

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  timeline,
  onChange,
  onPlay,
  onPause,
  onClipSelect
}) => {
  const { t } = useTranslation();
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 持有 currentTimeMs 的最新值，供 rAF tick 读取（避免 effect 依赖该值导致重建）
  const currentTimeMsRef = useRef(currentTimeMs);
  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  const totalWidth = Math.max(timeline.duration, 5000) / 1000 * pxPerSecond;

  const sortedTracks = useMemo(() => {
    return [...timeline.tracks].sort((a, b) => {
      const order = { video: 0, subtitle: 1, audio: 2 };
      return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });
  }, [timeline.tracks]);

  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const milli = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${milli}`;
  };

  const handleZoomIn = () => setPxPerSecond(p => Math.min(p * 1.5, MAX_PX_PER_SECOND));
  const handleZoomOut = () => setPxPerSecond(p => Math.max(p / 1.5, MIN_PX_PER_SECOND));

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      onPause?.();
    } else {
      setIsPlaying(true);
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause]);

  useEffect(() => {
    if (!isPlaying) return;
    // 用 ref 持有 currentTimeMs 最新值，避免被列入依赖数组导致 effect 反复重建
    let rafId: number;
    let lastFrameTime = performance.now();
    const tick = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      const next = currentTimeMsRef.current + delta;
      if (next >= timeline.duration) {
        currentTimeMsRef.current = timeline.duration;
        setCurrentTimeMs(timeline.duration);
        setIsPlaying(false);
        onPause?.();
        return;
      }
      currentTimeMsRef.current = next;
      setCurrentTimeMs(next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, timeline.duration, onPause]);

  const updateClipStartTime = (clipId: string, newStartTime: number) => {
    const newTracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(c => c.id === clipId ? { ...c, startTime: newStartTime } : c)
    }));
    onChange({ ...timeline, tracks: newTracks });
  };

  const updateClipDuration = (clipId: string, newDuration: number) => {
    const newTracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(c => c.id === clipId ? { ...c, duration: Math.max(100, newDuration) } : c)
    }));
    onChange({ ...timeline, tracks: newTracks });
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setDraggingClipId(clip.id);
    setDragStartX(e.clientX);
    setDragStartTime(clip.startTime);
    setSelectedClipId(clip.id);
    onClipSelect?.(clip);
  };

  useEffect(() => {
    if (!draggingClipId) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragStartX;
      const deltaMs = (deltaPx / pxPerSecond) * 1000;
      const newStartTime = Math.max(0, dragStartTime + deltaMs);
      updateClipStartTime(draggingClipId, newStartTime);
    };
    const handleMouseUp = () => {
      setDraggingClipId(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingClipId, dragStartX, dragStartTime, pxPerSecond]);

  const removeClip = (clipId: string) => {
    const newTracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(c => c.id !== clipId)
    }));
    onChange({ ...timeline, tracks: newTracks });
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
      onClipSelect?.(null);
    }
  };

  const toggleTrackMute = (trackId: string) => {
    const newTracks = timeline.tracks.map(t =>
      t.id === trackId ? { ...t, muted: !t.muted } : t
    );
    onChange({ ...timeline, tracks: newTracks });
  };

  const toggleTrackLock = (trackId: string) => {
    const newTracks = timeline.tracks.map(t =>
      t.id === trackId ? { ...t, locked: !t.locked } : t
    );
    onChange({ ...timeline, tracks: newTracks });
  };

  const splitClipAtPlayhead = () => {
    if (!selectedClipId) return;
    const newTracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.flatMap(c => {
        if (c.id !== selectedClipId) return [c];
        if (currentTimeMs <= c.startTime || currentTimeMs >= c.startTime + c.duration) return [c];
        const splitOffset = currentTimeMs - c.startTime;
        return [
          { ...c, duration: splitOffset },
          { ...c, id: `${c.id}_split_${Date.now()}`, startTime: currentTimeMs, duration: c.duration - splitOffset }
        ];
      })
    }));
    onChange({ ...timeline, tracks: newTracks });
  };

  const setTransition = (clipId: string, transition: TransitionType) => {
    const newTracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(c => c.id === clipId ? { ...c, transition } : c)
    }));
    onChange({ ...timeline, tracks: newTracks });
  };

  const renderRuler = () => {
    const ticks: React.ReactElement[] = [];
    const totalSec = Math.max(Math.ceil(timeline.duration / 1000), 10);
    const tickInterval = pxPerSecond >= 80 ? 1 : pxPerSecond >= 40 ? 2 : 5;
    for (let s = 0; s <= totalSec; s += tickInterval) {
      const x = s * pxPerSecond;
      ticks.push(
        <div key={s} style={{
          position: 'absolute',
          left: x,
          top: 0,
          height: '100%',
          borderLeft: s % (tickInterval * 5) === 0 ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.5)',
          paddingLeft: '4px'
        }}>
          {formatTime(s * 1000)}
        </div>
      );
    }
    return ticks;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)' }}>
        <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem' }} onClick={handlePlayPause}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '5rem' }}>
          {formatTime(currentTimeMs)} / {formatTime(timeline.duration)}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={splitClipAtPlayhead} disabled={!selectedClipId} title={t('timeline.splitAtPlayhead')}>
          <Scissors size={14} />
        </button>
        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={handleZoomOut} title={t('timeline.zoomOut')}>
          <ZoomOut size={14} />
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pxPerSecond}px/s</span>
        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={handleZoomIn} title={t('timeline.zoomIn')}>
          <ZoomIn size={14} />
        </button>
      </div>

      <div ref={containerRef} style={{ overflowX: 'auto', overflowY: 'hidden', padding: '0.5rem' }}>
        <div style={{ minWidth: totalWidth, position: 'relative' }}>
          <div style={{
            position: 'relative',
            height: '24px',
            background: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '0.5rem'
          }}>
            {renderRuler()}
          </div>

          {sortedTracks.map(track => (
            <div key={track.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
              <div style={{
                width: '100px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 'var(--radius-sm)',
                marginRight: '0.5rem'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{track.type}</span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.3rem', border: 'none' }}
                  onClick={() => toggleTrackMute(track.id)}
                  title={track.muted ? t('timeline.unmute') : t('timeline.mute')}
                >
                  {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.3rem', border: 'none' }}
                  onClick={() => toggleTrackLock(track.id)}
                  title={track.locked ? t('timeline.unlock') : t('timeline.lock')}
                >
                  {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
              </div>
              <div style={{
                position: 'relative',
                flex: 1,
                height: '50px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                opacity: track.muted ? 0.4 : 1
              }}>
                {track.clips.map(clip => (
                  <ClipView
                    key={clip.id}
                    clip={clip}
                    pxPerSecond={pxPerSecond}
                    selected={selectedClipId === clip.id}
                    onMouseDown={(e) => handleClipMouseDown(e, clip)}
                    onResizeStart={() => { /* future: handle resize */ }}
                    onTransitionChange={(tr) => setTransition(clip.id, tr)}
                    onRemove={() => removeClip(clip.id)}
                    onResize={(newDuration) => updateClipDuration(clip.id, newDuration)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div style={{
            position: 'absolute',
            top: 0,
            left: (currentTimeMs / 1000) * pxPerSecond,
            width: '2px',
            height: '100%',
            background: '#ef4444',
            pointerEvents: 'none',
            zIndex: 10
          }} />
        </div>
      </div>
    </div>
  );
};

interface ClipViewProps {
  clip: TimelineClip;
  pxPerSecond: number;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: () => void;
  onResize: (newDuration: number) => void;
  onRemove: () => void;
  onTransitionChange: (transition: TransitionType) => void;
}

const ClipView: React.FC<ClipViewProps> = ({
  clip,
  pxPerSecond,
  selected,
  onMouseDown,
  onResize,
  onRemove
}) => {
  const left = (clip.startTime / 1000) * pxPerSecond;
  const width = (clip.duration / 1000) * pxPerSecond;
  const [resizing, setResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, duration: 0 });

  const colorByType: Record<string, string> = {
    video: 'rgba(99,102,241,0.6)',
    audio: 'rgba(34,197,94,0.6)',
    subtitle: 'rgba(234,179,8,0.6)',
    transition: 'rgba(236,72,153,0.6)'
  };
  const color = colorByType[clip.type] || 'rgba(99,102,241,0.6)';

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    setResizeStart({ x: e.clientX, duration: clip.duration });
  };

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - resizeStart.x;
      const deltaMs = (deltaPx / pxPerSecond) * 1000;
      onResize(Math.max(100, resizeStart.duration + deltaMs));
    };
    const handleMouseUp = () => setResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, resizeStart, pxPerSecond, onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      onContextMenu={(e) => { e.preventDefault(); onRemove(); }}
      style={{
        position: 'absolute',
        left,
        top: 4,
        width: Math.max(20, width),
        height: 42,
        background: color,
        border: selected ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'grab',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '0 0.5rem',
        overflow: 'hidden',
        fontSize: '0.7rem',
        color: '#fff',
        boxShadow: selected ? '0 0 0 2px rgba(251,191,36,0.3)' : undefined
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {clip.text || clip.source || clip.type}
      </span>
      {clip.transition && clip.transition !== 'none' && (
        <span style={{ fontSize: '0.6rem', opacity: 0.7, marginLeft: '0.25rem' }}>
          ↪ {clip.transition}
        </span>
      )}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '6px',
          height: '100%',
          cursor: 'ew-resize',
          background: 'rgba(0,0,0,0.3)'
        }}
      />
    </div>
  );
};
