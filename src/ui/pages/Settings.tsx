import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, ExternalLink, RefreshCw, Cpu, Trash2, FolderOpen, Zap, CheckCircle, Palette } from 'lucide-react';
import { ApiConfigStore, type ApiConfig, type PlatformId } from '../../adapters/outbound/config/ApiConfigStore';
import { useToast } from '../contexts/ToastContext';
import { modelManagementService, fileManagementService } from '../../dependencies';
import type { ModelInfo, FileItem } from '../../domain/ports/OutboundPorts';
import { getErrorMessage } from '../utils/errorUtils';

// Settings Components
import { SettingsSection } from '../components/settings/SettingsSection';
import { FormField } from '../components/settings/FormField';
import { StatusBadge } from '../components/settings/StatusBadge';
import { ValidationButton } from '../components/settings/ValidationButton';
import { ThemeSelector } from '../components/settings/ThemeSelector';

// ===== Token 校验函数 =====

async function validateArkToken(apiKey: string, baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `校验失败 (HTTP ${response.status})：${errText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `网络错误：${err instanceof Error ? err.message : String(err)}` };
  }
}

async function validateCozeToken(token: string, baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/v1/bots/list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_index: 1, page_size: 1 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `校验失败 (HTTP ${response.status})：${errText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `网络错误：${err instanceof Error ? err.message : String(err)}` };
  }
}

// ===== 平台配置卡片组件 =====

interface PlatformCardProps {
  id: PlatformId;
  icon: React.ReactNode;
  name: string;
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  children: React.ReactNode;
  onActivate: () => void;
  onValidate: () => Promise<void>;
  validateLabel: string;
  externalLink?: string;
  externalLinkLabel?: string;
  accentColor?: string;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  id,
  icon,
  name,
  description,
  isActive,
  isConfigured,
  children,
  onActivate,
  onValidate,
  validateLabel,
  externalLink,
  externalLinkLabel,
  accentColor = 'var(--primary-color)',
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem',
        marginBottom: '0.75rem',
        border: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
        transition: 'all var(--transition-normal)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{name}</h3>
            {isActive && (
              <StatusBadge status="connected" label="已激活" />
            )}
            {!isConfigured && !isActive && (
              <StatusBadge status="inactive" label="未配置" />
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {children}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 激活按钮 */}
        <button
          type="button"
          className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onActivate}
          disabled={!isConfigured && !isActive}
          style={{
            background: isActive ? accentColor : undefined,
            borderColor: isActive ? accentColor : undefined,
          }}
        >
          {isActive ? (
            <>
              <CheckCircle size={14} />
              已激活
            </>
          ) : (
            '激活此平台'
          )}
        </button>

        {/* 验证按钮 */}
        {isConfigured && (
          <ValidationButton
            onValidate={onValidate}
            label={validateLabel}
          />
        )}

        {/* 外部链接 */}
        {externalLink && (
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.85rem', color: 'var(--primary-color)',
              textDecoration: 'none', marginLeft: 'auto'
            }}
          >
            <ExternalLink size={14} />
            {externalLinkLabel}
          </a>
        )}
      </div>
    </div>
  );
};

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [config, setConfig] = useState<ApiConfig>(() => ApiConfigStore.load());

  // 监听配置变化，自动保存
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      ApiConfigStore.autoSave(config);
    }, 500); // 防抖 500ms
    return () => clearTimeout(timeoutId);
  }, [config]);

  const handleChange = useCallback((field: keyof ApiConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleActivate = useCallback((platform: PlatformId) => {
    setConfig(prev => ({ ...prev, activePlatform: platform }));
    showToast('success', `已切换到${platform === 'minimax' ? 'MiniMax' : platform === 'volcengine' ? '火山引擎' : 'Coze'}平台`);
  }, [showToast]);

  // Model management state
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

  const handleVolcValidate = async () => {
    const result = await validateArkToken(config.volcArkApiKey, config.volcArkBaseUrl);
    if (result.ok) {
      showToast('success', t('settings.volcValidateSuccess'));
    } else {
      showToast('error', t('settings.volcValidateFailed', { error: result.error }));
    }
  };

  const handleCozeValidate = async () => {
    const result = await validateCozeToken(config.cozePatToken, config.cozeBaseUrl);
    if (result.ok) {
      showToast('success', t('settings.cozeValidateSuccess'));
    } else {
      showToast('error', t('settings.cozeValidateFailed', { error: result.error }));
    }
  };

  // 检查平台是否已配置
  const isMiniMaxConfigured = !!config.minimaxApiKey.trim();
  const isVolcConfigured = !!config.volcArkApiKey.trim();
  const isCozeConfigured = !!config.cozePatToken.trim();

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

      {/* ── Appearance Section ─────────────────────────────── */}
      <SettingsSection
        icon={<Palette size={20} />}
        title={t('settings.appearanceSection')}
        badge={undefined}
        defaultExpanded={true}
      >
        <ThemeSelector />
      </SettingsSection>

      {/* ── Platform Configuration ─────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          marginBottom: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          平台配置
        </h2>

        {/* MiniMax */}
        <PlatformCard
          id="minimax"
          icon="🎬"
          name="MiniMax"
          description="视频、图片、文本生成"
          isActive={config.activePlatform === 'minimax'}
          isConfigured={isMiniMaxConfigured}
          onActivate={() => handleActivate('minimax')}
          onValidate={async () => showToast('info', 'MiniMax 无需验证')}
          validateLabel="验证"
          externalLink="https://platform.minimaxi.com/user-center/basic-information/interface-key"
          externalLinkLabel="获取 Token"
          accentColor="#6366f1"
        >
          <FormField
            label={t('settings.apiKeyLabel')}
            value={config.minimaxApiKey}
            onChange={v => handleChange('minimaxApiKey', v)}
            type="password"
            placeholder={t('settings.apiKeyPlaceholder')}
            autoComplete="off"
            showKeyIcon
          />
          <FormField
            label={t('settings.groupIdLabel')}
            value={config.minimaxGroupId}
            onChange={v => handleChange('minimaxGroupId', v)}
            placeholder={t('settings.groupIdPlaceholder')}
          />
          <FormField
            label={t('settings.baseUrlLabel')}
            value={config.minimaxBaseUrl}
            onChange={v => handleChange('minimaxBaseUrl', v)}
            placeholder={t('settings.baseUrlPlaceholder')}
          />
          <FormField
            label={t('settings.anthropicBaseUrlLabel')}
            value={config.minimaxAnthropicBaseUrl}
            onChange={v => handleChange('minimaxAnthropicBaseUrl', v)}
            placeholder={t('settings.anthropicBaseUrlPlaceholder')}
            hint={t('settings.anthropicBaseUrlHint')}
          />
        </PlatformCard>

        {/* Volcano Engine */}
        <PlatformCard
          id="volcengine"
          icon="🌋"
          name="火山引擎"
          description="方舟大模型 · 视频/图片/文本/3D 生成"
          isActive={config.activePlatform === 'volcengine'}
          isConfigured={isVolcConfigured}
          onActivate={() => handleActivate('volcengine')}
          onValidate={handleVolcValidate}
          validateLabel={t('settings.volcValidateBtn')}
          externalLink="https://console.volcengine.com/ark"
          externalLinkLabel="获取 Token"
          accentColor="#f97316"
        >
          <FormField
            label={t('settings.volcArkApiKeyLabel')}
            value={config.volcArkApiKey}
            onChange={v => handleChange('volcArkApiKey', v)}
            type="password"
            placeholder={t('settings.volcArkApiKeyPlaceholder')}
            autoComplete="off"
            showKeyIcon
          />
          <FormField
            label={t('settings.volcArkBaseUrlLabel')}
            value={config.volcArkBaseUrl}
            onChange={v => handleChange('volcArkBaseUrl', v)}
            placeholder={t('settings.volcArkBaseUrlPlaceholder')}
          />
        </PlatformCard>

        {/* Coze */}
        <PlatformCard
          id="coze"
          icon="🤖"
          name="Coze"
          description="Bot 应用 · 对话管理"
          isActive={config.activePlatform === 'coze'}
          isConfigured={isCozeConfigured}
          onActivate={() => handleActivate('coze')}
          onValidate={handleCozeValidate}
          validateLabel={t('settings.cozeValidateBtn')}
          externalLink="https://www.coze.cn"
          externalLinkLabel="获取 Token"
          accentColor="#8b5cf6"
        >
          <FormField
            label={t('settings.cozePatTokenLabel')}
            value={config.cozePatToken}
            onChange={v => handleChange('cozePatToken', v)}
            type="password"
            placeholder={t('settings.cozePatTokenPlaceholder')}
            autoComplete="off"
            showKeyIcon
          />
          <FormField
            label={t('settings.cozeBaseUrlLabel')}
            value={config.cozeBaseUrl}
            onChange={v => handleChange('cozeBaseUrl', v)}
            placeholder={t('settings.cozeBaseUrlPlaceholder')}
          />
          <FormField
            label={t('settings.cozeSpaceIdLabel')}
            value={config.cozeSpaceId}
            onChange={v => handleChange('cozeSpaceId', v)}
            placeholder={t('settings.cozeSpaceIdPlaceholder')}
          />
        </PlatformCard>
      </div>

      {/* ── Available Models Section ────────────────────── */}
      <SettingsSection
        icon={<Cpu size={20} />}
        title={t('models.title')}
        badge={undefined}
        defaultExpanded={false}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          {cachedAt && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('models.cachedAt', { time: cachedAt })}
            </p>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            disabled={isLoadingModels}
            onClick={handleRefreshModels}
          >
            {isLoadingModels ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />}
            {isLoadingModels ? t('models.refreshing') : t('models.refreshBtn')}
          </button>
        </div>

        {/* Text Models */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
            {t('models.textModels')}
          </h4>
          {textModels.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {textModels.map(m => (
                <span key={m.id} className="lab-chip" style={{ fontSize: '0.75rem' }}>
                  {m.displayName}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('models.noModels')}</p>
          )}
        </div>

        {/* Video Models */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
            {t('models.videoModels')}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {staticVideoModels.map(m => (
              <span key={m.id} className="lab-chip" style={{ fontSize: '0.75rem' }}>
                {m.displayName}
              </span>
            ))}
          </div>
        </div>

        {/* Image Models */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
            {t('models.imageModels')}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {staticImageModels.map(m => (
              <span key={m.id} className="lab-chip" style={{ fontSize: '0.75rem' }}>
                {m.displayName}
              </span>
            ))}
          </div>
        </div>

        {/* Music Models */}
        <div>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
            {t('models.musicModels')}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {staticMusicModels.map(m => (
              <span key={m.id} className="lab-chip" style={{ fontSize: '0.75rem' }}>
                {m.displayName}
              </span>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ── File Management Section ──────────────────────── */}
      <SettingsSection
        icon={<FolderOpen size={20} />}
        title={t('settings.fileManagement')}
        badge={undefined}
        defaultExpanded={false}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
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
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('settings.fileName')}</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('settings.filePurpose')}</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>{t('settings.fileSize')}</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem' }}>{t('settings.fileAction')}</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.fileId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.filename || f.fileId}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{f.purpose}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{(f.bytes / 1024).toFixed(1)} KB</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            {isLoadingFiles ? t('models.refreshing') : t('settings.noFiles')}
          </p>
        )}
      </SettingsSection>

      {/* ── Auto-save indicator ─────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-full)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(8px)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <CheckCircle size={12} style={{ color: 'var(--primary-color)' }} />
        自动保存已开启
      </div>
    </div>
  );
};