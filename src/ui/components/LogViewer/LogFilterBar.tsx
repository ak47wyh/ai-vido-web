/**
 * LogFilterBar —— 级别筛选 + 关键字搜索 + 服务下拉
 */

import React from 'react';
import { ALL_LEVELS, type LogFilter } from '../../hooks/useLogStore';
import type { LogLevel } from '../../../domain/ports/CrossCuttingPorts';

interface Props {
  filter: LogFilter;
  onChange: (patch: Partial<LogFilter>) => void;
  services: string[];
}

export const LogFilterBar: React.FC<Props> = ({ filter, onChange, services }) => {
  const toggleLevel = (level: LogLevel) => {
    const next = new Set(filter.levels);
    if (next.has(level)) {
      next.delete(level);
    } else {
      next.add(level);
    }
    onChange({ levels: next });
  };

  return (
    <div className="log-filter-bar">
      <input
        type="text"
        className="log-filter-search"
        placeholder="搜索 message / context 关键字..."
        value={filter.keyword}
        onChange={e => onChange({ keyword: e.target.value })}
      />

      {ALL_LEVELS.map(level => (
        <button
          key={level}
          className={`log-level-chip ${filter.levels.has(level) ? 'active' : ''} level-${level}`}
          onClick={() => toggleLevel(level)}
          aria-pressed={filter.levels.has(level)}
          title={filter.levels.has(level) ? `点击隐藏 ${level}` : `点击显示 ${level}`}
        >
          {level.toUpperCase()}
        </button>
      ))}

      {services.length > 1 && (
        <select
          className="log-filter-search"
          style={{ flex: 'unset', minWidth: 120 }}
          value={filter.service ?? ''}
          onChange={e => onChange({ service: e.target.value || null })}
        >
          <option value="">全部服务</option>
          {services.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
    </div>
  );
};