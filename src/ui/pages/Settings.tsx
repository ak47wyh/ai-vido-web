import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCw, Cpu, Trash2, FolderOpen, Palette, CheckCircle, ChevronDown, Zap } from 'lucide-react';
import { ApiConfigStore, type ApiConfig, type PlatformId } from '../../adapters/outbound/config/ApiConfigStore';
import { useToast } from '../contexts/ToastContext';
import { modelManagementService, fileManagementService } from '../../dependencies';
import type { ModelInfo, FileItem } from '../../domain/ports/OutboundPorts';
import { getErrorMessage } from '../utils/errorUtils';
import { PLATFORM_METADATA, getCapabilitySummary, type Capability } from '../../domain/services/platformCapabilities';

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

// ===== 能力标签映射 =====
const CAPABILITY_LABELS: Record<Capability, string> = {
  video: '视频',
  videoFl2v: '首尾帧',
  videoS2v: '参考生',
  image: '图片',
  text: '文本',
  voice: '语音',
  music: '音乐',
};

/** 能力小标签 */
const CapabilityChips: React.FC<{ platform: PlatformId; accentColor: string }> = ({ platform, accentColor }) => {
  const caps = PLATFORM_METADATA[platform]?.capabilities ?? [];
  if (caps.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
      {caps.map(c => (
        <span
          key={c}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.1rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.68rem',
            fontWeight: 600,
            background: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}33`,
          }}
        >
          {CAPABILITY_LABELS[c]}
        </span>
      ))}
    </div>
  );
};

// ===== 平台配置卡片组件（可折叠 + 能力标签） =====

interface PlatformCardProps {
  id: PlatformId;
  icon: React.ReactNode;
  name: string;
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
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
  expanded,
  onToggleExpand,
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
        padding: 0,
        border: isActive ? `1px solid ${accentColor}` : '1px solid var(--border-color)',
        borderLeft: `3px solid ${isActive ? accentColor : 'transparent'}`,
        transition: 'all var(--transition-normal)',
        boxShadow: isActive ? `0 4px 16px ${accentColor}22` : 'var(--shadow-md)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header（可点击折叠） ── */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-panel-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* 图标方块（带品牌色底） */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            background: `${accentColor}1a`,
            border: `1px solid ${accentColor}33`,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        {/* 名称 + 状态 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>{name}</h3>
            {isActive && <StatusBadge status="connected" label="已激活" />}
            {!isConfigured && !isActive && <StatusBadge status="inactive" label="未配置" />}
          </div>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {description}
          </p>
        </div>

        {/* 折叠箭头 */}
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform var(--transition-fast)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </div>

      {/* ── 能力标签栏（始终显示） ── */}
      <div style={{ padding: '0 1rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <CapabilityChips platform={id} accentColor={accentColor} />
      </div>

      {/* ── 展开内容：配置字段 + 操作 ── */}
      {expanded && (
        <div
          style={{
            padding: '0 1rem 1rem',
            borderTop: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* 配置字段 */}
          <div style={{ display: 'grid', gap: '0.65rem', paddingTop: '0.85rem' }}>
            {children}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 激活按钮 */}
            <button
              type="button"
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={onActivate}
              disabled={!isConfigured && !isActive}
              style={{
                background: isActive ? accentColor : undefined,
                borderColor: isActive ? accentColor : undefined,
                fontSize: '0.82rem',
                padding: '0.5rem 1rem',
              }}
            >
              {isActive ? (
                <>
                  <CheckCircle size={14} />
                  已激活
                </>
              ) : (
                <>
                  <Zap size={14} />
                  激活此平台
                </>
              )}
            </button>

            {/* 验证按钮 */}
            {isConfigured && (
              <ValidationButton onValidate={onValidate} label={validateLabel} />
            )}

            {/* 外部链接 */}
            {externalLink && (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.78rem', color: 'var(--primary-color)',
                  textDecoration: 'none', marginLeft: 'auto',
                }}
              >
                <ExternalLink size={13} />
                {externalLinkLabel}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [config, setConfig] = useState<ApiConfig>(() => ApiConfigStore.load());

  // 当前展开的平台卡片（默认展开激活平台）
  const [expandedPlatform, setExpandedPlatform] = useState<PlatformId | null>(
    () => ApiConfigStore.load().activePlatform,
  );
  const toggleExpand = useCallback((platform: PlatformId) => {
    setExpandedPlatform(prev => (prev === platform ? null : platform));
  }, []);

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
    setExpandedPlatform(platform); // 激活后自动展开该平台
    const meta = PLATFORM_METADATA[platform];
    showToast('success', `已切换到${meta?.name ?? platform}平台`);
  }, [showToast]);

  // 当前激活平台元信息
  const activeMeta = PLATFORM_METADATA[config.activePlatform];

  // Model management state
  const [textModels, setTextModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  // 初始化时读取缓存
  useEffect(() => {
    modelManagementService.getCachedModels().then(cached => {
      if (cached) {
        setTextModels(cached.models);
        setCachedAt(new Date(cached.cachedAt).toLocaleString());
      }
    });
  }, []);

  // File management state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const handleRefreshModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await modelManagementService.refreshModels();
      setTextModels(models);
      const cached = await modelManagementService.getCachedModels();
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
  const isKlingConfigured = !!config.klingAccessKey.trim() && !!config.klingSecretKey.trim();
  const isWanConfigured = !!config.wanApiKey.trim();
  const isHunyuanConfigured = !!config.hunyuanSecretId.trim() && !!config.hunyuanSecretKey.trim();
  const isZhipuConfigured = !!config.zhipuApiKey.trim();
  const isViduConfigured = !!config.viduApiKey.trim();

  const staticVideoModels = modelManagementService.getStaticVideoModels();
  const staticImageModels = modelManagementService.getStaticImageModels();
  const staticMusicModels = modelManagementService.getStaticMusicModels();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
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

        {/* ── 当前激活平台 Hero Banner ── */}
        {activeMeta && (
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.25rem',
              marginBottom: '0.75rem',
              border: `1px solid ${activeMeta.accentColor}44`,
              borderLeft: `4px solid ${activeMeta.accentColor}`,
              background: `linear-gradient(135deg, ${activeMeta.accentColor}10, var(--bg-panel))`,
              boxShadow: `0 4px 20px ${activeMeta.accentColor}1a`,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                background: `${activeMeta.accentColor}1f`,
                border: `1px solid ${activeMeta.accentColor}40`,
                flexShrink: 0,
              }}
            >
              {activeMeta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: activeMeta.accentColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  当前激活
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {activeMeta.name} · {activeMeta.brand}
                </h3>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {activeMeta.description} · 能力：{getCapabilitySummary(config.activePlatform)}
              </p>
            </div>
            <a
              href={activeMeta.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.78rem', color: activeMeta.accentColor,
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              <ExternalLink size={14} />
              文档
            </a>
          </div>
        )}

        {/* ── 平台卡片网格（2 列） ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '0.75rem',
        }}>
          {/* MiniMax */}
          <PlatformCard
            id="minimax"
            icon="🎬"
            name="MiniMax · 海螺"
            description="全模态 · 视频/图片/文本/语音/音乐"
            isActive={config.activePlatform === 'minimax'}
            isConfigured={isMiniMaxConfigured}
            expanded={expandedPlatform === 'minimax'}
            onToggleExpand={() => toggleExpand('minimax')}
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
            name="火山引擎 · 即梦"
            description="Seedance · 视频/图片/文本/3D"
            isActive={config.activePlatform === 'volcengine'}
            isConfigured={isVolcConfigured}
            expanded={expandedPlatform === 'volcengine'}
            onToggleExpand={() => toggleExpand('volcengine')}
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
            expanded={expandedPlatform === 'coze'}
            onToggleExpand={() => toggleExpand('coze')}
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

          {/* 可灵 Kling */}
          <PlatformCard
            id="kling"
            icon={PLATFORM_METADATA.kling.icon}
            name={`${PLATFORM_METADATA.kling.name} · ${PLATFORM_METADATA.kling.brand}`}
            description={PLATFORM_METADATA.kling.description}
            isActive={config.activePlatform === 'kling'}
            isConfigured={isKlingConfigured}
            expanded={expandedPlatform === 'kling'}
            onToggleExpand={() => toggleExpand('kling')}
            onActivate={() => handleActivate('kling')}
            onValidate={async () => showToast('info', '可灵：保存配置后在视频实验室发起任务即可验证')}
            validateLabel="验证"
            externalLink={PLATFORM_METADATA.kling.externalLink}
            externalLinkLabel="获取 Key"
            accentColor={PLATFORM_METADATA.kling.accentColor}
          >
            <FormField
              label="AccessKey"
              value={config.klingAccessKey}
              onChange={v => handleChange('klingAccessKey', v)}
              type="password"
              placeholder="可灵 AccessKey"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="SecretKey"
              value={config.klingSecretKey}
              onChange={v => handleChange('klingSecretKey', v)}
              type="password"
              placeholder="可灵 SecretKey"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="Base URL"
              value={config.klingBaseUrl}
              onChange={v => handleChange('klingBaseUrl', v)}
              placeholder="https://api.klingai.com"
            />
          </PlatformCard>

          {/* 通义万相 Wan */}
          <PlatformCard
            id="wan"
            icon={PLATFORM_METADATA.wan.icon}
            name={`${PLATFORM_METADATA.wan.name} · ${PLATFORM_METADATA.wan.brand}`}
            description={PLATFORM_METADATA.wan.description}
            isActive={config.activePlatform === 'wan'}
            isConfigured={isWanConfigured}
            expanded={expandedPlatform === 'wan'}
            onToggleExpand={() => toggleExpand('wan')}
            onActivate={() => handleActivate('wan')}
            onValidate={async () => showToast('info', '万相：保存配置后在视频实验室发起任务即可验证')}
            validateLabel="验证"
            externalLink={PLATFORM_METADATA.wan.externalLink}
            externalLinkLabel="获取 Key"
            accentColor={PLATFORM_METADATA.wan.accentColor}
          >
            <FormField
              label="API-Key"
              value={config.wanApiKey}
              onChange={v => handleChange('wanApiKey', v)}
              type="password"
              placeholder="DashScope API-Key"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="Base URL"
              value={config.wanBaseUrl}
              onChange={v => handleChange('wanBaseUrl', v)}
              placeholder="https://dashscope.aliyuncs.com/api/v1"
            />
          </PlatformCard>

          {/* 腾讯混元 Hunyuan */}
          <PlatformCard
            id="hunyuan"
            icon={PLATFORM_METADATA.hunyuan.icon}
            name={`${PLATFORM_METADATA.hunyuan.name} · ${PLATFORM_METADATA.hunyuan.brand}`}
            description={PLATFORM_METADATA.hunyuan.description}
            isActive={config.activePlatform === 'hunyuan'}
            isConfigured={isHunyuanConfigured}
            expanded={expandedPlatform === 'hunyuan'}
            onToggleExpand={() => toggleExpand('hunyuan')}
            onActivate={() => handleActivate('hunyuan')}
            onValidate={async () => showToast('info', '混元：保存配置后在视频实验室发起任务即可验证')}
            validateLabel="验证"
            externalLink={PLATFORM_METADATA.hunyuan.externalLink}
            externalLinkLabel="获取 Key"
            accentColor={PLATFORM_METADATA.hunyuan.accentColor}
          >
            <FormField
              label="SecretId"
              value={config.hunyuanSecretId}
              onChange={v => handleChange('hunyuanSecretId', v)}
              type="password"
              placeholder="腾讯云 SecretId"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="SecretKey"
              value={config.hunyuanSecretKey}
              onChange={v => handleChange('hunyuanSecretKey', v)}
              type="password"
              placeholder="腾讯云 SecretKey"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="Base URL"
              value={config.hunyuanBaseUrl}
              onChange={v => handleChange('hunyuanBaseUrl', v)}
              placeholder="https://hunyuan.tencentcloudapi.com"
            />
          </PlatformCard>

          {/* 智谱 Zhipu */}
          <PlatformCard
            id="zhipu"
            icon={PLATFORM_METADATA.zhipu.icon}
            name={`${PLATFORM_METADATA.zhipu.name} · ${PLATFORM_METADATA.zhipu.brand}`}
            description={PLATFORM_METADATA.zhipu.description}
            isActive={config.activePlatform === 'zhipu'}
            isConfigured={isZhipuConfigured}
            expanded={expandedPlatform === 'zhipu'}
            onToggleExpand={() => toggleExpand('zhipu')}
            onActivate={() => handleActivate('zhipu')}
            onValidate={async () => showToast('info', '智谱：保存配置后在视频实验室发起任务即可验证')}
            validateLabel="验证"
            externalLink={PLATFORM_METADATA.zhipu.externalLink}
            externalLinkLabel="获取 Key"
            accentColor={PLATFORM_METADATA.zhipu.accentColor}
          >
            <FormField
              label="API-Key"
              value={config.zhipuApiKey}
              onChange={v => handleChange('zhipuApiKey', v)}
              type="password"
              placeholder="智谱 API-Key"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="Base URL"
              value={config.zhipuBaseUrl}
              onChange={v => handleChange('zhipuBaseUrl', v)}
              placeholder="https://open.bigmodel.cn/api/paas/v4"
            />
          </PlatformCard>

          {/* Vidu */}
          <PlatformCard
            id="vidu"
            icon={PLATFORM_METADATA.vidu.icon}
            name={`${PLATFORM_METADATA.vidu.name} · ${PLATFORM_METADATA.vidu.brand}`}
            description={PLATFORM_METADATA.vidu.description}
            isActive={config.activePlatform === 'vidu'}
            isConfigured={isViduConfigured}
            expanded={expandedPlatform === 'vidu'}
            onToggleExpand={() => toggleExpand('vidu')}
            onActivate={() => handleActivate('vidu')}
            onValidate={async () => showToast('info', 'Vidu：保存配置后在视频实验室发起任务即可验证')}
            validateLabel="验证"
            externalLink={PLATFORM_METADATA.vidu.externalLink}
            externalLinkLabel="获取 Key"
            accentColor={PLATFORM_METADATA.vidu.accentColor}
          >
            <FormField
              label="API-Key"
              value={config.viduApiKey}
              onChange={v => handleChange('viduApiKey', v)}
              type="password"
              placeholder="Vidu API-Key"
              autoComplete="off"
              showKeyIcon
            />
            <FormField
              label="Base URL"
              value={config.viduBaseUrl}
              onChange={v => handleChange('viduBaseUrl', v)}
              placeholder="https://api.vidu.cn"
            />
          </PlatformCard>
        </div>
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