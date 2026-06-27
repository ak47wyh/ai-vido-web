/**
 * LogViewerDrawer —— 日志查看器抽屉容器
 *
 * 包含：标题栏（可拖拽调整高度）、筛选栏、工具栏、日志列表
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { useLogStore } from '../../hooks/useLogStore';
import type { ILogSinkPort } from '../../../domain/ports/LoggingPorts';
import { LogFilterBar } from './LogFilterBar';
import { LogToolbar } from './LogToolbar';
import { LogEntryRow } from './LogEntryRow';
import './LogViewer.css';

interface Props {
  sink: ILogSinkPort;
  onClose: () => void;
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT_RATIO = 0.9;
const DEFAULT_HEIGHT_RATIO = 0.4;

export const LogViewerDrawer: React.FC<Props> = ({ sink, onClose }) => {
  const { entries, filtered, filter, setFilter, clear } = useLogStore(sink);
  const [heightPx, setHeightPx] = useState(() =>
    Math.round(window.innerHeight * DEFAULT_HEIGHT_RATIO)
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // 收集所有出现过的服务名供筛选下拉
  const services = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const s = e.context?.service;
      if (typeof s === 'string') set.add(s);
    }
    return Array.from(set).sort();
  }, [entries]);

  // 自动滚动
  useEffect(() => {
    if (!autoScroll) return;
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [filtered, autoScroll]);

  // 拖拽调整高度
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const max = window.innerHeight * MAX_HEIGHT_RATIO;
      const next = Math.max(MIN_HEIGHT, Math.min(max, dragRef.current.startHeight + delta));
      setHeightPx(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startHeight: heightPx };
    document.body.style.cursor = 'ns-resize';
  };

  return (
    <div className="log-viewer-drawer" style={{ height: heightPx }} role="region" aria-label="应用内日志查看器">
      <div className="log-viewer-drawer-header" onMouseDown={startDrag}>
        <span className="log-viewer-drawer-title">
          <Terminal size={14} />
          日志查看器
          <span className="log-viewer-drawer-count">
            ({filtered.length}/{entries.length})
          </span>
        </span>
      </div>

      <LogFilterBar filter={filter} onChange={setFilter} services={services} />

      <LogToolbar
        visible={filtered}
        total={entries.length}
        onClear={clear}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(v => !v)}
        onClose={onClose}
      />

      <div className="log-viewer-drawer-body" ref={bodyRef}>
        {filtered.length === 0 ? (
          <div className="log-empty">
            {entries.length === 0 ? '暂无日志' : '当前筛选条件下无日志'}
          </div>
        ) : (
          filtered.map(entry => <LogEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
};