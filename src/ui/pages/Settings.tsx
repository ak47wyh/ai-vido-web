import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Key, ExternalLink, CheckCircle, AlertCircle, RefreshCw, Cpu, Trash2, FolderOpen } from 'lucide-react';
import { ApiConfigStore, type ApiConfig } from '../../adapters/outbound/config/ApiConfigStore';
import { useToast } from '../contexts/ToastContext';
import { modelManagementService, fileManagementService } from '../../dependencies';
import type { ModelInfo, FileItem } from '../../domain/ports/OutboundPorts';
import { getErrorMessage } from '../utils/errorUtils';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [config, setConfig] = useState<ApiConfig>(() => ApiConfigStore.load());

  // Model management state — initialize from cache
  const [textModels, setTextModels] = useState<ModelInfo[]>(() => {
    const cached = modelManagementService.getCachedModels();
    return cached?.models ?? [];
  });
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(() => {
    const cached = modelManagementService.getCachedModels();
    return cached ? new Date(cached.cachedAt).toLocaleString() : null;
  });

  // File management state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const handleChange = (field: keyof ApiConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    ApiConfigStore.save(config);
    showToast('success', t('settings.savedMsg'));
  };

  const handleRefreshModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await modelManagementService.refreshModels();
      setTextModels(models);
      const cached = modelManagementService.getCachedModels();
      setCachedAt(cached ? new Date(cached.cachedAt).toLocaleString() : null);
      showToast('success', t('models.refreshSuccess'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('models.refreshFailed')));
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleLoadFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const result = await fileManagementService.listFiles();
      setFiles(result.files);
    } catch (e) {
      showToast('error', getErrorMessage(e, t('models.refreshFailed')));
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    setDeletingFileId(fileId);
    try {
      await fileManagementService.deleteFile(fileId);
      setFiles(prev => prev.filter(f => f.fileId !== fileId));
      showToast('success', t('settings.fileDeleted'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('settings.fileDeleteFailed')));
    } finally {
      setDeletingFileId(null);
    }
  };

  const isLive = config.minimaxApiKey.trim().length > 0;

  const staticVideoModels = modelManagementService.getStaticVideoModels();
  const staticImageModels = modelManagementService.getStaticImageModels();
  const staticMusicModels = modelManagementService.getStaticMusicModels();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ width: '100%' }}>

        {/* ── MiniMax Section ──────────────────────────────────── */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>

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

          {/* Anthropic Base URL */}
          <div className="form-group">
            <label className="form-label">{t('settings.anthropicBaseUrlLabel')}</label>
            <input
              id="settings-minimax-anthropic-base-url"
              className="form-input"
              type="url"
              value={config.minimaxAnthropicBaseUrl}
              onChange={e => handleChange('minimaxAnthropicBaseUrl', e.target.value)}
              placeholder={t('settings.anthropicBaseUrlPlaceholder')}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('settings.anthropicBaseUrlHint')}</p>
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

        {/* ── Available Models Section ──────────────────────────── */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Cpu size={20} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('models.title')}</h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              disabled={isLoadingModels}
              onClick={handleRefreshModels}
            >
              {isLoadingModels ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />}
              {isLoadingModels ? t('models.refreshing') : t('models.refreshBtn')}
            </button>
          </div>

          {cachedAt && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {t('models.cachedAt', { time: cachedAt })}
            </p>
          )}

          {/* Text Models (dynamic) */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#818cf8' }}>
              {t('models.textModels')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({t('models.dynamic')})</span>
            </h4>
            {textModels.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {textModels.map(m => (
                  <div key={m.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle size={12} style={{ color: '#34d399' }} />
                    <span>{m.displayName}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({m.id})</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('models.noModels')}</p>
            )}
          </div>

          {/* Video Models (static) */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#818cf8' }}>
              {t('models.videoModels')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({t('models.static')})</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {staticVideoModels.map(m => (
                <div key={m.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                  <span>{m.displayName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Image Models (static) */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#818cf8' }}>
              {t('models.imageModels')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({t('models.static')})</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {staticImageModels.map(m => (
                <div key={m.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                  <span>{m.displayName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Music Models (static) */}
          <div>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#818cf8' }}>
              {t('models.musicModels')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({t('models.static')})</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {staticMusicModels.map(m => (
                <div key={m.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                  <span>{m.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── File Management Section ───────────────────────────── */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FolderOpen size={20} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('settings.fileManagement')}</h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              disabled={isLoadingFiles}
              onClick={handleLoadFiles}
            >
              {isLoadingFiles ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />}
              {t('settings.loadFilesBtn')}
            </button>
          </div>

          {files.length > 0 ? (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>{t('settings.fileName')}</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>{t('settings.filePurpose')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem' }}>{t('settings.fileSize')}</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem' }}>{t('settings.fileAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.fileId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename || f.fileId}</td>
                      <td style={{ padding: '0.4rem' }}>{f.purpose}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{(f.bytes / 1024).toFixed(1)} KB</td>
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: '#f87171' }}
                          disabled={deletingFileId === f.fileId}
                          onClick={() => handleDeleteFile(f.fileId)}
                        >
                          {deletingFileId === f.fileId ? <RefreshCw size={10} className="spin" /> : <Trash2 size={10} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isLoadingFiles ? t('models.refreshing') : t('settings.noFiles')}
            </p>
          )}
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
        </div>
      </form>
    </div>
  );
};
