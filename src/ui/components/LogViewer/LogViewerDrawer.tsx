/**
 * LogViewerDrawer —— 日志查看器抽屉容器
 *
 * 包含：标题栏（可拖拽调整高度）、筛选栏、工具栏、日志列表
 *
 * Phase 3 性能优化：
 * - 日志列表使用 react-window 的 FixedSizeList 虚拟滚动，
 *   即使缓冲区塞满 1000+ 条日志也保持稳定渲染性能。
 * - 仅渲染视口内的行，DOM 节点数恒定 (~10-20)。
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { Terminal } from 'lucide-react';
import { useLogStore } from '../../hooks/useLogStore';
import type { ILogSinkPort } from '../../../domain/ports/LoggingPorts';
import { LogFilterBar } from './LogFilterBar';
import { LogToolbar } from './LogToolbar';
import { LogEntryRow } from './LogEntryRow';
import type { LogEntry } from '../../../domain/ports/LoggingPorts';
import './LogViewer.css';

interface Props {
  sink: ILogSinkPort;
  onClose: () => void;
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT_RATIO = 0.9;
const DEFAULT_HEIGHT_RATIO = 0.4;

/** 单行固定高度 —— 必须与 CSS 中 .log-entry 的实际渲染高度保持一致 */
const LOG_ROW_HEIGHT = 28;

export const LogViewerDrawer: React.FC<Props> = ({ sink, onClose }) => {
  const { entries, filtered, filter, setFilter, clear } = useLogStore(sink);
  const [heightPx, setHeightPx] = useState(() =>
    Math.round(window.innerHeight * DEFAULT_HEIGHT_RATIO)
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const listRef = useRef<FixedSizeList>(null);

  // 收集所有出现过的服务名供筛选下拉
  const services = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const s = e.context?.service;
      if (typeof s === 'string') set.add(s);
    }
    return Array.from(set).sort();
  }, [entries]);

  // 自动滚动 —— 当新日志到达且 autoScroll=true 时，滚动到列表底部
  useEffect(() => {
    if (!autoScroll) return;
    const list = listRef.current;
    if (!list) return;
    // 滚到最新一条（filtered.length - 1），对齐列表末尾
    if (filtered.length > 0) {
      list.scrollToItem(filtered.length - 1, 'end');
    }
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

  // 虚拟列表行渲染器 —— memoized 避免 row props 变化触发 React.memo 子组件不必要重渲染
  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const entry: LogEntry = filtered[index];
    return (
      <div style={style}>
        <LogEntryRow entry={entry} />
      </div>
    );
  }, [filtered]);

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
          <FixedSizeList
            ref={listRef}
            height={Math.max(0, heightPx - 110)}
            width="100%"
            itemCount={filtered.length}
            itemSize={LOG_ROW_HEIGHT}
            overscanCount={5}
            className="log-viewer-virtual-list"
          >
            {Row}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
};