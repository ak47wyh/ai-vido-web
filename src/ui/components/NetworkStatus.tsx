import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Database, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { offlineCache, registerServiceWorker } from '../../utils/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { CacheEntry } from '../../utils/offlineCache';

export const NetworkStatusBadge: React.FC = () => {
  const { online } = useNetworkStatus();
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)',
      background: online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      color: online ? '#22c55e' : '#ef4444', fontSize: '0.75rem',
    }}>
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span>{online ? t('network.online') : t('network.offline')}</span>
    </div>
  );
};

export const OfflineCachePanel: React.FC = () => {
  const { t } = useTranslation();
  const { online } = useNetworkStatus();
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker().then(reg => {
        if (reg) setSwRegistered(true);
      });
    }
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const all = await offlineCache.getAllEntries();
      setEntries(all.sort((a, b) => b.lastAccessed - a.lastAccessed));
      setTotalSize(all.reduce((sum, e) => sum + e.size, 0));
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = async () => {
    if (!confirm(t('network.confirmClear'))) return;
    await offlineCache.clearAll();
    await refresh();
  };

  const removeOne = async (key: string) => {
    await offlineCache.removeCached(key);
    await refresh();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Database size={18} style={{ color: '#818cf8' }} />
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{t('network.cacheTitle')}</h3>
        <span style={{ flex: 1 }} />
        <NetworkStatusBadge />
        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={refresh} disabled={isLoading}>
          <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
        </button>
        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', color: '#f87171' }} onClick={clearAll}>
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        {t('network.totalCacheSize', { size: formatSize(totalSize), count: entries.length })}
        {!online && <span style={{ marginLeft: '0.5rem', color: '#fbbf24' }}>· {t('network.offlineMode')}</span>}
        {swRegistered && <span style={{ marginLeft: '0.5rem', color: '#22c55e' }}>· {t('network.swActive')}</span>}
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
          {t('network.noCache')}
        </div>
      ) : (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {entries.map(entry => (
            <div key={entry.key} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.5rem', borderRadius: 'var(--radius-sm)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatSize(entry.size)}
              </span>
              <span style={{ fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.key}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.15rem 0.3rem' }}
                onClick={() => removeOne(entry.key)}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
