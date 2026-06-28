/**
 * LogToolbar —— 复制 / 导出 / 清空 / 自动滚动 切换
 */

import React, { useState } from 'react';
import { Copy, Download, Trash2, ArrowDown, X } from 'lucide-react';
import type { LogEntry } from '../../../domain/ports/LoggingPorts';
import { formatEntries } from './logFormatter';

interface Props {
  visible: LogEntry[];
  total: number;
  onClear: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClose: () => void;
}

export const LogToolbar: React.FC<Props> = ({
  visible,
  total,
  onClear,
  autoScroll,
  onToggleAutoScroll,
  onClose,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 1500);
  };

  const handleCopyVisible = async () => {
    const text = formatEntries(visible, { includeStack: true });
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(`已复制 ${visible.length} 条`);
    } catch {
      showFeedback('复制失败：剪贴板不可用');
    }
  };

  const handleExport = () => {
    const text = formatEntries(visible, { includeStack: true });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `log-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback(`已导出 ${visible.length} 条`);
  };

  return (
    <div className="log-filter-bar" style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
      <button
        className={`log-toolbar-btn ${autoScroll ? '' : ''}`}
        onClick={onToggleAutoScroll}
        aria-pressed={autoScroll}
        title={autoScroll ? '关闭自动滚动' : '开启自动滚动'}
        style={autoScroll ? { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } : undefined}
      >
        <ArrowDown size={12} />
        自动滚动
      </button>

      <button className="log-toolbar-btn" onClick={handleCopyVisible} title="复制当前筛选下的全部条目到剪贴板">
        <Copy size={12} />
        复制可见 ({visible.length})
      </button>

      <button className="log-toolbar-btn" onClick={handleExport} title="导出当前筛选下的全部条目为 .txt">
        <Download size={12} />
        导出
      </button>

      <button className="log-toolbar-btn danger" onClick={onClear} title="清空内存缓冲（不可恢复）">
        <Trash2 size={12} />
        清空
      </button>

      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
        {feedback ?? `共 ${total} 条 / 显示 ${visible.length} 条`}
      </span>

      <button className="log-toolbar-btn" onClick={onClose} title="关闭日志面板" aria-label="关闭">
        <X size={14} />
      </button>
    </div>
  );
};