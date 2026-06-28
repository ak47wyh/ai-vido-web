/**
 * useLogStore —— React Hook，订阅 ILogSinkPort 的实时日志流
 *
 * 职责：
 * - 初始加载 snapshot（避免漏掉页面刷新前的日志）
 * - subscribe 增量更新
 * - 提供 filter / search 派生 selector
 * - 提供 actions：clear / append（直接调用 sink 接口）
 *
 * 设计：
 * - 仅依赖 ILogSinkPort 抽象，便于单测
 * - 筛选/搜索状态保存在 hook 内（不持久化，避免耦合 LogViewerConfig）
 * - 大数据量时筛选走 useMemo，避免重复遍历
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ILogSinkPort, LogEntry } from '../../domain/ports/LoggingPorts';
import type { LogLevel } from '../../domain/ports/CrossCuttingPorts';

export interface LogFilter {
  levels: Set<LogLevel>;
  keyword: string;
  service: string | null;
}

export const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function defaultFilter(): LogFilter {
  return {
    levels: new Set<LogLevel>(['debug', 'info', 'warn', 'error']),
    keyword: '',
    service: null,
  };
}

export interface UseLogStoreResult {
  entries: LogEntry[];
  filtered: LogEntry[];
  unreadErrors: number;
  filter: LogFilter;
  setFilter: (patch: Partial<LogFilter>) => void;
  clear: () => void;
}

export function useLogStore(sink: ILogSinkPort): UseLogStoreResult {
  const [entries, setEntries] = useState<LogEntry[]>(() => sink.snapshot());
  const [filter, setFilterState] = useState<LogFilter>(defaultFilter);
  const [unreadErrors, setUnreadErrors] = useState(0);

  useEffect(() => {
    // 订阅增量更新
    const unsub = sink.subscribe(entry => {
      setEntries(sink.snapshot());
      if (entry.level === 'error') {
        setUnreadErrors(n => n + 1);
      }
    });
    return unsub;
  }, [sink]);

  const filtered = useMemo(() => applyFilter(entries, filter), [entries, filter]);

  const setFilter = useCallback((patch: Partial<LogFilter>) => {
    setFilterState(prev => ({
      levels: patch.levels ?? prev.levels,
      keyword: patch.keyword ?? prev.keyword,
      service: patch.service === undefined ? prev.service : patch.service,
    }));
  }, []);

  const clear = useCallback(() => {
    sink.clear();
    setEntries([]);
    setUnreadErrors(0);
  }, [sink]);

  return {
    entries,
    filtered,
    unreadErrors,
    filter,
    setFilter,
    clear,
  };
}

export function applyFilter(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  const kw = filter.keyword.trim().toLowerCase();
  const matchService = filter.service;
  return entries.filter(e => {
    if (!filter.levels.has(e.level)) return false;
    if (matchService && e.context?.service !== matchService) return false;
    if (kw) {
      const haystack = `${e.message} ${serializeContext(e.context)}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });
}

function serializeContext(ctx: LogEntry['context']): string {
  if (!ctx) return '';
  try {
    return JSON.stringify(ctx);
  } catch {
    return '';
  }
}