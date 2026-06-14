import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Key, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { ApiConfigStore, type ApiConfig } from '../../adapters/outbound/config/ApiConfigStore';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ApiConfig>(() => ApiConfigStore.load());
  const [saved, setSaved] = useState(false);

  const handleChange = (field: keyof ApiConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    ApiConfigStore.save(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isLive = config.minimaxApiKey.trim().length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ maxWidth: '720px' }}>

        {/* ── MiniMax Section ──────────────────────────────────── */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Key size={20} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('settings.minimaxSection')}</h2>
            {/* Live / Mock badge */}
            <span style={{
              marginLeft: 'auto',
              padding: '0.2rem 0.7rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: isLive ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
              color: isLive ? '#34d399' : '#fbbf24',
              border: `1px solid ${isLive ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
            }}>
              {isLive ? t('settings.liveBadge') : t('settings.mockBadge')}
            </span>
          </div>

          {/* Status hint */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.75rem',
            background: isLive ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)',
            border: `1px solid ${isLive ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}>
            {isLive
              ? <CheckCircle size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }} />
              : <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '1px' }} />
            }
            <span>{isLive ? t('settings.liveHint') : t('settings.mockHint')}</span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {t('settings.minimaxDesc')}
          </p>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label">{t('settings.apiKeyLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="settings-minimax-api-key"
                className="form-input"
                type="password"
                value={config.minimaxApiKey}
                onChange={e => handleChange('minimaxApiKey', e.target.value)}
                placeholder={t('settings.apiKeyPlaceholder')}
                autoComplete="off"
                style={{ paddingRight: '2.5rem' }}
              />
              <Key size={15} style={{
                position: 'absolute', right: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* Group ID */}
          <div className="form-group">
            <label className="form-label">{t('settings.groupIdLabel')}</label>
            <input
              id="settings-minimax-group-id"
              className="form-input"
              type="text"
              value={config.minimaxGroupId}
              onChange={e => handleChange('minimaxGroupId', e.target.value)}
              placeholder={t('settings.groupIdPlaceholder')}
              autoComplete="off"
            />
          </div>

          {/* Base URL */}
          <div className="form-group">
            <label className="form-label">{t('settings.baseUrlLabel')}</label>
            <input
              id="settings-minimax-base-url"
              className="form-input"
              type="url"
              value={config.minimaxBaseUrl}
              onChange={e => handleChange('minimaxBaseUrl', e.target.value)}
              placeholder={t('settings.baseUrlPlaceholder')}
            />
          </div>

          {/* External link */}
          <a
            href="https://platform.minimaxi.com/user-center/basic-information/interface-key"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.85rem', color: 'var(--primary-color)',
              textDecoration: 'none', marginTop: '0.25rem'
            }}
          >
            <ExternalLink size={14} />
            {t('settings.getTokenLink')}
          </a>
        </div>

        {/* ── Save button ──────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            id="settings-save-btn"
            type="submit"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} />
            {t('settings.saveBtn')}
          </button>

          {saved && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              color: '#34d399', fontSize: '0.9rem', fontWeight: 500,
              animation: 'fadeIn 0.3s ease'
            }}>
              <CheckCircle size={16} />
              {t('settings.savedMsg')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
