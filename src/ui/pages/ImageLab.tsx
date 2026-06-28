import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Sparkles, RefreshCw, Type, ImagePlus } from 'lucide-react';
import { imageAdapter, assetLibraryService } from '../../dependencies';
import type { ImageModel, ImageAspectRatio, ImageGenerationContext } from '../../domain/ports/OutboundPorts';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';
import { useSpace } from '../contexts/SpaceContext';
import { AssetSaveDialog } from '../components/AssetPicker';
import { ImageUploadField } from '../components/ImageUploadField';
import { ImageGallery, type GalleryImage } from '../components/ImageGallery';
import { ImageAdvancedSettings, type ImageAdvancedSettingsValue } from '../components/ImageAdvancedSettings';
import { LabPageLayout } from '../components/LabPageLayout';
import {
  getCachedMediaBlob,
  triggerNativeDownload,
} from '../../utils/imageCache';

type ImageLabTab = 't2i' | 'i2i';

const DEFAULT_ADVANCED: ImageAdvancedSettingsValue = {
  n: 1,
  seed: '',
  watermark: false,
  customSizeEnabled: false,
  customWidth: 1024,
  customHeight: 1024,
  style: '',
};

// 语义化下载文件名
const buildDownloadFilename = (prompt: string): string => {
  const prefix = prompt.substring(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return `${prefix || 'ai-image'}_${Date.now()}.jpg`;
};

export const ImageLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentSpaceId } = useSpace();

  const [activeTab, setActiveTab] = useState<ImageLabTab>('t2i');

  // ==================== 共享 State ====================
  const [model, setModel] = useState<ImageModel>('image-01');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('16:9');
  const [promptOptimizer, setPromptOptimizer] = useState(false);
  const [advanced, setAdvanced] = useState<ImageAdvancedSettingsValue>(DEFAULT_ADVANCED);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTargetImage, setSaveTargetImage] = useState<GalleryImage | null>(null);

  // ==================== I2I 专用 State ====================
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // ==================== T2I 专用 State ====================
  const [t2iPrompt, setT2iPrompt] = useState('');

  // ==================== I2I 专用 State ====================
  const [i2iPrompt, setI2iPrompt] = useState('');

  // ==================== 模型联动 ====================
  const handleModelChange = (newModel: ImageModel) => {
    setModel(newModel);
    // image-01-live 不支持 21:9
    if (newModel === 'image-01-live' && aspectRatio === '21:9') {
      setAspectRatio('16:9');
    }
    // 切换模型时重置自定义尺寸（仅 image-01 支持）
    if (newModel === 'image-01-live') {
      setAdvanced(prev => ({ ...prev, customSizeEnabled: false }));
    }
  };

  // ==================== 构建生成上下文 ====================
  const buildContext = useCallback((prompt: string, isI2I: boolean): ImageGenerationContext => {
    const context: ImageGenerationContext = {
      prompt,
      model,
      aspectRatio,
      promptOptimizer,
      responseFormat: 'url',
      n: advanced.n,
      aigcWatermark: advanced.watermark,
    };

    // 种子
    if (advanced.seed.trim()) {
      context.seed = Number(advanced.seed);
    }

    // 自定义尺寸（仅 image-01）
    if (model === 'image-01' && advanced.customSizeEnabled && advanced.customWidth && advanced.customHeight) {
      context.width = advanced.customWidth;
      context.height = advanced.customHeight;
    }

    // 画风（仅 image-01-live）
    if (model === 'image-01-live' && advanced.style) {
      context.style = { style: advanced.style };
    }

    // I2I 主体参考
    if (isI2I && referenceImage) {
      context.subjectReference = [{ type: 'character', image_file: referenceImage }];
    }

    return context;
  }, [model, aspectRatio, promptOptimizer, advanced, referenceImage]);

  // ==================== 生成 ====================
  const handleGenerate = async (prompt: string, isI2I: boolean) => {
    if (!prompt.trim()) return;
    if (isI2I && !referenceImage) {
      showToast('error', '请先上传参考图片');
      return;
    }
    setIsGenerating(true);
    try {
      const context = buildContext(prompt, isI2I);
      const res = await imageAdapter.generateImage(context);

      const urls = res.imageUrls || (res.imageDataUri ? [res.imageDataUri] : []);
      if (urls.length === 0) {
        throw new Error('No image returned');
      }

      const newImages: GalleryImage[] = urls.map(url => ({
        url,
        prompt,
        model,
        aspectRatio,
        seed: advanced.seed.trim() ? Number(advanced.seed) : undefined,
        createdAt: Date.now(),
      }));

      setGallery(prev => [...newImages, ...prev]);
      showToast('success', t('imageLab.generateSuccess', '图片生成成功'));

      // 内容安全部分失败提示
      if (res.metadata?.failedCount && Number(res.metadata.failedCount) > 0) {
        showToast('info', `${res.metadata.failedCount} 张图片因内容安全未返回`);
      }
    } catch (e) {
      console.error(e);
      showToast('error', getErrorMessage(e, t('imageLab.generateFailed', '图片生成失败')));
    } finally {
      setIsGenerating(false);
    }
  };

  // ==================== 下载 ====================
  const handleDownload = useCallback((image: GalleryImage) => {
    const filename = buildDownloadFilename(image.prompt);
    const a = document.createElement('a');
    a.href = image.url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ==================== 保存到素材库 ====================
  const handleSaveClick = useCallback((image: GalleryImage) => {
    setSaveTargetImage(image);
    setShowSaveDialog(true);
  }, []);

  const handleSaveConfirm = async (name: string, tags: string) => {
    if (!saveTargetImage || !currentSpaceId) return;
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // ==================== 路径 A：Service Worker 缓存命中 ====================
    // 优先级最高。SW 在 <img> 加载时已经把跨域媒体写入 CacheStorage，
    // 主线程读缓存 → Blob → saveImageFromBlob，**0 网络请求**。
    if (saveTargetImage.url.startsWith('http')) {
      const cached = await getCachedMediaBlob(saveTargetImage.url);
      if (cached) {
        try {
          const saved = await assetLibraryService.saveImageFromBlob({
            spaceId: currentSpaceId,
            name,
            blob: cached,
            prompt: saveTargetImage.prompt,
            model: saveTargetImage.model || '',
            aspectRatio: saveTargetImage.aspectRatio || '',
            tags: tagList,
            sourceType: 'lab',
          });
          showToast(
            'success',
            t(
              'assetLibrary.saveSuccessFromCache',
              '素材已从浏览器缓存保存，0 网络请求。\n文件名：{{name}}',
              { name: saved.name }
            )
          );
          setShowSaveDialog(false);
          setSaveTargetImage(null);
          return;
        } catch (e) {
          console.warn('[ImageLab] SW cache save failed, falling back:', e);
        }
      }
    }

    // ==================== 主路径：saveImageFromUrl（data URI / CORS 友好 URL） ====================
    // data URI 直接 atob 转 Blob（0 网络请求）；
    // http(s) URL 走 fetch（受 CORS 限制，OSS 会失败）。
    try {
      const saved = await assetLibraryService.saveImageFromUrl({
        spaceId: currentSpaceId,
        name,
        imageUrl: saveTargetImage.url,
        prompt: saveTargetImage.prompt,
        model: saveTargetImage.model || '',
        aspectRatio: saveTargetImage.aspectRatio || '',
        tags: tagList,
        sourceType: 'lab',
      });
      const storageType = assetLibraryService.getStorageType();
      const locationHint = storageType === 'local'
        ? t(
            'assetLibrary.saveSuccessLocal',
            '素材已直接保存到本地磁盘「{{path}}」，无需调用任何外部 API。',
            { path: 'docs/files/images/' }
          )
        : t(
            'assetLibrary.saveSuccessWithLocation',
            '素材已保存到当前故事空间的「图片素材库」，可在「角色与背景」页面查看。'
          );
      showToast('success', `${locationHint}\n文件名：${saved.name}`);
      setShowSaveDialog(false);
      setSaveTargetImage(null);
      return;
    } catch (_innerErr) {
      // 主路径失败（CORS 阻断），尝试路径 B：从 <img> 元素提取
      if (saveTargetImage.url.startsWith('http')) {
        const recovered = await tryExtractBlobFromDomImage(saveTargetImage.url);
        if (recovered) {
          try {
            const saved = await assetLibraryService.saveImageFromBlob({
              spaceId: currentSpaceId,
              name,
              blob: recovered.blob,
              prompt: saveTargetImage.prompt,
              model: saveTargetImage.model || '',
              aspectRatio: saveTargetImage.aspectRatio || '',
              tags: tagList,
              sourceType: 'lab',
            });
            showToast(
              'success',
              t(
                'assetLibrary.saveSuccessFromCanvas',
                '素材已从 DOM 画布提取保存。\n文件名：{{name}}',
                { name: saved.name }
              )
            );
            setShowSaveDialog(false);
            setSaveTargetImage(null);
            return;
          } catch {
            // fall through to download fallback
          }
        }
      }
    }

    // ==================== 路径 C：浏览器原生下载兜底 ====================
    // 缓存未命中 + CORS 阻断 + Canvas 提取失败 → 触发浏览器原生下载
    const filename = buildDownloadFilename(saveTargetImage.prompt);
    const ok = triggerNativeDownload(saveTargetImage.url, filename);
    if (ok) {
      showToast(
        'info',
        t(
          'assetLibrary.saveFallbackDownload',
          '由于 CORS 限制无法保存到素材库，已触发浏览器下载。请检查下载文件夹。'
        )
      );
    } else {
      const reason = getErrorMessage(
        new Error('all save paths failed'),
        t('assetLibrary.saveFailed', '素材保存失败')
      );
      showToast('error', reason);
    }
    setShowSaveDialog(false);
    setSaveTargetImage(null);
  };

  /**
   * 从已经渲染到 DOM 的 <img> 元素提取图片 Blob。
   * 绕开 fetch 拦截：浏览器渲染跨域图片不需要 CORS，但 canvas 读取需要图片"未污染"。
   * - 如果图片加载时带了 crossorigin 属性（且服务端允许），canvas 可读
   * - 否则只能拿到一个"被污染"的 canvas，无法 toBlob
   *
   * 因此本方法只能"碰运气"：只有图片加载时未污染（通常是 data URI / 同源）才能成功。
   * 对 OSS 等 CORS-tainted 图片，本方法会抛错，调用方应回退到 data URI 流程。
   */
  const tryExtractBlobFromDomImage = async (url: string): Promise<{ blob: Blob } | null> => {
    try {
      // 查找页面上所有 <img src={url}>；匹配 url 完全相等的元素
      const imgs = Array.from(document.images);
      const img = imgs.find(el => el.src === url || el.currentSrc === url);
      if (!img || !img.complete || img.naturalWidth === 0) return null;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      return blob ? { blob } : null;
    } catch {
      // 跨域图片导致 SecurityError
      return null;
    }
  };

  // ==================== 业务闭环: 用作 I2I 参考图 ====================
  const handleUseAsReference = useCallback((image: GalleryImage) => {
    setReferenceImage(image.url);
    setActiveTab('i2i');
    showToast('success', '已切换到图生图，参考图已填入');
  }, [showToast]);

  // ==================== Tab 配置 ====================
  const tabs: { key: ImageLabTab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 't2i', label: t('imageLab.tabT2I', '文生图'), icon: <Type size={16} />, color: '#818cf8' },
    { key: 'i2i', label: t('imageLab.tabI2I', '图生图'), icon: <ImagePlus size={16} />, color: '#3b82f6' },
  ];



  return (
    <LabPageLayout
      icon={<ImageIcon size={32} />}
      iconBg="rgba(99,102,241,0.1)"
      iconColor="#818cf8"
      title={t('imageLab.title', '图片实验室 (Image Lab)')}
      subtitle={t('imageLab.desc', '文生图、图生图，支持多模型、多比例、批量生成')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as ImageLabTab)}
    >
    <>
      {/* ==================== T2I Tab ==================== */}
      {activeTab === 't2i' && (
        <div className="glass-panel slide-up lab-tab-panel">
          <div>
            <label className="form-label">{t('imageLab.prompt', '画面描述 (Prompt)')}</label>
            <textarea
              className="form-input lab-textarea-compact"
              rows={4}
              placeholder={t('imageLab.promptPlaceholder', '描述您想要生成的画面细节，支持中英文...')}
              value={t2iPrompt}
              onChange={e => setT2iPrompt(e.target.value)}
              maxLength={1500}
            />
            <div className="lab-char-count">{t2iPrompt.length} / 1500</div>
          </div>

          <div className="lab-model-config">
            <div className="lab-model-config-item" style={{ minWidth: '180px' }}>
              <label className="form-label">{t('imageLab.model', '生成模型')}</label>
              <select className="form-select" value={model} onChange={e => handleModelChange(e.target.value as ImageModel)}>
                <option value="image-01">image-01 (写实/通用)</option>
                <option value="image-01-live">image-01-live (二次元/动漫)</option>
              </select>
            </div>
            <div className="lab-model-config-item" style={{ minWidth: '140px' }}>
              <label className="form-label">{t('imageLab.aspectRatio', '图片比例')}</label>
              <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)}>
                <option value="16:9">16:9 (横屏视频)</option>
                <option value="9:16">9:16 (竖屏视频)</option>
                <option value="1:1">1:1 (正方形)</option>
                <option value="4:3">4:3 (标准)</option>
                <option value="3:4">3:4</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
                {model === 'image-01' && <option value="21:9">21:9 (宽屏电影)</option>}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="lab-checkbox-label">
              <input
                type="checkbox"
                checked={promptOptimizer}
                onChange={e => setPromptOptimizer(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              {t('imageLab.promptOptimizer', '开启提示词智能优化')}
            </label>
          </div>

          <ImageAdvancedSettings
            value={advanced}
            onChange={setAdvanced}
            model={model}
          />

          <button
            className="btn btn-primary btn-generate"
            disabled={!t2iPrompt.trim() || isGenerating}
            onClick={() => handleGenerate(t2iPrompt, false)}
          >
            {isGenerating ? <RefreshCw className="spin" size={20} /> : <Sparkles size={20} />}
            {isGenerating ? t('imageLab.generating', '正在生成...') : t('imageLab.generateBtn', '立即生成图片')}
          </button>
        </div>
      )}

      {/* ==================== I2I Tab ==================== */}
      {activeTab === 'i2i' && (
        <div className="glass-panel slide-up lab-tab-panel">
          <ImageUploadField
            label={t('imageLab.referenceImage', '参考图片 (必填)')}
            value={referenceImage}
            onChange={setReferenceImage}
            borderColor="rgba(59,130,246,0.3)"
            bgColor="rgba(59,130,246,0.05)"
            placeholder="上传参考图片，用于图生图"
          />

          <div>
            <label className="form-label">{t('imageLab.prompt', '画面描述 (Prompt)')}</label>
            <textarea
              className="form-input lab-textarea-compact"
              rows={4}
              placeholder={t('imageLab.promptPlaceholder', '描述您想要生成的画面细节，支持中英文...')}
              value={i2iPrompt}
              onChange={e => setI2iPrompt(e.target.value)}
              maxLength={1500}
            />
            <div className="lab-char-count">{i2iPrompt.length} / 1500</div>
          </div>

          <div className="lab-model-config">
            <div className="lab-model-config-item" style={{ minWidth: '180px' }}>
              <label className="form-label">{t('imageLab.model', '生成模型')}</label>
              <select className="form-select" value={model} onChange={e => handleModelChange(e.target.value as ImageModel)}>
                <option value="image-01">image-01 (写实/通用)</option>
                <option value="image-01-live">image-01-live (二次元/动漫)</option>
              </select>
            </div>
            <div className="lab-model-config-item" style={{ minWidth: '140px' }}>
              <label className="form-label">{t('imageLab.aspectRatio', '图片比例')}</label>
              <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)}>
                <option value="16:9">16:9 (横屏视频)</option>
                <option value="9:16">9:16 (竖屏视频)</option>
                <option value="1:1">1:1 (正方形)</option>
                <option value="4:3">4:3 (标准)</option>
                <option value="3:4">3:4</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
                {model === 'image-01' && <option value="21:9">21:9 (宽屏电影)</option>}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="lab-checkbox-label">
              <input
                type="checkbox"
                checked={promptOptimizer}
                onChange={e => setPromptOptimizer(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              {t('imageLab.promptOptimizer', '开启提示词智能优化')}
            </label>
          </div>

          <ImageAdvancedSettings
            value={advanced}
            onChange={setAdvanced}
            model={model}
          />

          <button
            className="btn btn-primary btn-generate"
            style={{ background: '#3b82f6' }}
            disabled={!i2iPrompt.trim() || !referenceImage || isGenerating}
            onClick={() => handleGenerate(i2iPrompt, true)}
          >
            {isGenerating ? <RefreshCw className="spin" size={20} /> : <ImagePlus size={20} />}
            {isGenerating ? t('imageLab.generating', '正在生成...') : t('imageLab.generateBtn', '立即生成图片')}
          </button>
        </div>
      )}

      {/* ==================== 生成结果画廊 ==================== */}
      {gallery.length > 0 && (
        <div className="result-panel">
          <div className="result-panel-header">
            <h3 className="result-panel-title">{t('imageLab.gallery', '生成结果')} ({gallery.length})</h3>
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => setGallery([])}
            >清空</button>
          </div>
          <ImageGallery
            images={gallery}
            onDownload={handleDownload}
            onSave={handleSaveClick}
            onUseAsReference={handleUseAsReference}
          />
        </div>
      )}

      {/* ==================== 保存对话框 ==================== */}
      {showSaveDialog && saveTargetImage && (
        <AssetSaveDialog
          title={t('assetLibrary.saveBtn', '保存到素材库')}
          defaultName={saveTargetImage.prompt.slice(0, 20) + (saveTargetImage.prompt.length > 20 ? '...' : '')}
          onSave={handleSaveConfirm}
          onCancel={() => { setShowSaveDialog(false); setSaveTargetImage(null); }}
        />
      )}
    </>
    </LabPageLayout>
  );
};
