/**
 * LogViewerFab —— 悬浮按钮
 *
 * 行为：
 * - 点击切换抽屉展开/收起
 * - 有未读错误时显示红点 + 数量徽标
 * - 点击打开抽屉时清零未读数
 */

import React from 'react';
import { Terminal } from 'lucide-react';
import './LogViewer.css';

interface Props {
  open: boolean;
  unreadErrors: number;
  onClick: () => void;
}

export const LogViewerFab: React.FC<Props> = ({ open, unreadErrors, onClick }) => {
  return (
    <button
      className="log-viewer-fab"
      onClick={onClick}
      title={open ? '关闭日志面板' : '打开日志面板'}
      aria-label={open ? '关闭日志面板' : '打开日志面板'}
    >
      <Terminal size={20} />
      {unreadErrors > 0 && !open && (
        <span className="log-viewer-fab-badge">
          {unreadErrors > 99 ? '99+' : unreadErrors}
        </span>
      )}
    </button>
  );
};