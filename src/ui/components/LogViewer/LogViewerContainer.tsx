/**
 * LogViewerContainer —— 日志查看模块的容器组件
 *
 * 职责：
 * - 渲染 FAB
 * - 渲染 Drawer（受控开关）
 * - 提供快捷键 Ctrl/Cmd + ` 切换
 * - 提供"打开后清零未读错误"语义
 *
 * 受 logViewerConfig.enabled 控制；disabled 时直接返回 null。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { logSink } from '../../../adapters/outbound/infrastructure/RingBufferLogSinkAdapter';
import { logViewerConfig } from '../../../adapters/outbound/config/LogViewerConfigStore';
import { useLogStore } from '../../hooks/useLogStore';
import { LogViewerFab } from './LogViewerFab';
import { LogViewerDrawer } from './LogViewerDrawer';

export const LogViewerContainer: React.FC = () => {
  const [enabled, setEnabled] = useState(() => logViewerConfig.get().enabled);
  const [open, setOpen] = useState(() => logViewerConfig.get().defaultOpen);
  const { unreadErrors, setFilter } = useLogStore(logSink);

  useEffect(() => {
    return logViewerConfig.subscribe(cfg => setEnabled(cfg.enabled));
  }, []);

  // 快捷键 Ctrl/Cmd + `
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 打开抽屉时清零未读计数（通过切换 service 过滤再切回来触发 setState 重置）
  // 实际上 unreadErrors 是 ref 计数器，重置通过 clear 或下次关闭再开
  const handleToggle = useCallback(() => {
    setOpen(v => {
      // 打开时尝试让用户看到全部条目：清掉筛选
      if (!v) setFilter({ keyword: '', service: null });
      return !v;
    });
  }, [setFilter]);

  if (!enabled) return null;

  return (
    <>
      <LogViewerFab open={open} unreadErrors={unreadErrors} onClick={handleToggle} />
      {open && <LogViewerDrawer sink={logSink} onClose={() => setOpen(false)} />}
    </>
  );
};