import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Sparkles, Download, RefreshCw } from 'lucide-react';
import { imageAdapter } from '../../dependencies';
import type { ImageModel, ImageAspectRatio } from '../../domain/ports/OutboundPorts';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorUtils';

export const ImageLab: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ImageModel>('image-01');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('16:9');
  const [promptOptimizer, setPromptOptimizer] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setResultImage(null);
    try {
      const res = await imageAdapter.generateImage({
        prompt,
        model,
        aspectRatio,
        promptOptimizer,
        responseFormat: 'url',
      });
      if (res.imageUrls && res.imageUrls.length > 0) {
        setResultImage(res.imageUrls[0]);
        showToast('success', t('imageLab.generateSuccess', '图片生成成功'));
      } else {
        throw new Error('No image returned');
      }
    } catch (e) {
      console.error(e);
      showToast('error', getErrorMessage(e, t('imageLab.generateFailed', '图片生成失败')));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.1)', borderRadius: 'var(--radius-lg)', color: '#818cf8' }}>
          <ImageIcon size={32} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('imageLab.title', '图片实验室 (Image Lab)')}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            {t('imageLab.desc', '独立使用 MiniMax 图像大模型生成您的专属插画、背景和素材。')}
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label className="form-label">{t('imageLab.prompt', '画面描述 (Prompt)')}</label>
          <textarea
            className="form-input"
            rows={4}
            placeholder={t('imageLab.promptPlaceholder', '描述您想要生成的画面细节，支持中英文...')}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{ fontSize: '1rem', padding: '1rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label">{t('imageLab.model', '生成模型')}</label>
            <select className="form-select" value={model} onChange={e => setModel(e.target.value as ImageModel)}>
              <option value="image-01">image-01 (写实/通用)</option>
              <option value="image-01-live">image-01-live (二次元/动漫)</option>
            </select>
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label">{t('imageLab.aspectRatio', '图片比例')}</label>
            <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)}>
              <option value="16:9">16:9 (横屏视频)</option>
              <option value="9:16">9:16 (竖屏视频)</option>
              <option value="1:1">1:1 (正方形头像)</option>
              <option value="4:3">4:3 (标准)</option>
              <option value="3:4">3:4</option>
              <option value="21:9">21:9 (宽屏电影)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={promptOptimizer} 
                onChange={e => setPromptOptimizer(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
              />
              <span style={{ fontSize: '0.9rem' }}>{t('imageLab.promptOptimizer', '开启提示词智能优化')}</span>
            </label>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ padding: '1rem', fontSize: '1.1rem', justifyContent: 'center' }}
          disabled={!prompt.trim() || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? <RefreshCw className="spin" size={20} /> : <Sparkles size={20} />}
          {isGenerating ? t('imageLab.generating', '正在生成...') : t('imageLab.generateBtn', '立即生成图片')}
        </button>
      </div>

      {resultImage && (
        <div className="glass-panel slide-up" style={{ marginTop: '2rem', padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>{t('imageLab.result', '生成结果')}</h3>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img 
              src={resultImage} 
              alt="Generated" 
              style={{ maxWidth: '100%', maxHeight: '600px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} 
            />
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <a 
                href={resultImage} 
                download="ai-generated-image.jpg" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <Download size={16} /> {t('imageLab.download', '下载图片')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
