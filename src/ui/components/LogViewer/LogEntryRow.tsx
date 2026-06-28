/**
 * LogEntryRow —— 单条日志的渲染组件
 *
 * 行为：
 * - 默认折叠 context / error.stack
 * - 单击展开
 * - 行内提供"复制此条"按钮
 */

import React, { useState } from 'react';
import { Copy, ChevronRight } from 'lucide-react';
import type { LogEntry } from '../../../domain/ports/LoggingPorts';
import { formatLogEntry } from './logFormatter';

interface Props {
  entry: LogEntry;
}

export const LogEntryRow: React.FC<Props> = React.memo(({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatLogEntry(entry, { includeStack: true });
    void navigator.clipboard.writeText(text);
  };

  const hasDetail = !!entry.context || !!entry.error;

  return (
    <div
      className={`log-entry level-${entry.level}`}
      onClick={() => hasDetail && setExpanded(v => !v)}
      role={hasDetail ? 'button' : undefined}
      aria-expanded={hasDetail ? expanded : undefined}
    >
      <span className="log-entry-time">{formatTime(entry.timestamp)}</span>
      <span className={`log-entry-level level-${entry.level}`}>
        {entry.level.toUpperCase()}
      </span>
      <span className="log-entry-message">{entry.message}</span>

      {hasDetail && expanded && (
        <div className="log-entry-detail">
          {entry.context && (
            <div>
              <span className="log-entry-detail-label">context:</span>
              {JSON.stringify(entry.context, null, 2)}
            </div>
          )}
          {entry.error && (
            <div style={{ marginTop: entry.context ? '0.5rem' : 0 }}>
              <span className="log-entry-detail-label">error:</span>
              {entry.error.name}: {entry.error.message}
              {entry.error.stack && (
                <pre style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>
                  {entry.error.stack}
                </pre>
              )}
            </div>
          )}
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem' }}>
            <button className="log-toolbar-btn" onClick={handleCopy}>
              <Copy size={12} /> 复制此条
            </button>
          </div>
        </div>
      )}

      {hasDetail && !expanded && (
        <ChevronRight size={12} style={{ gridColumn: 3, justifySelf: 'end', color: 'var(--text-muted)' }} />
      )}
    </div>
  );
});

LogEntryRow.displayName = 'LogEntryRow';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}