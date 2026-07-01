import React, { useState, useCallback } from 'react';
import { Film } from 'lucide-react';
import { useEnhancement, buildVideoOptions } from '../../hooks/useEnhancement';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSpace } from '../../contexts/SpaceContext';
import { assetLibraryService } from '../../../dependencies';
import {
  EnhanceUploadZone,
  EnhanceParamSlider,
  EnhanceProgressBar,
  EnhanceRetryHint,
  EnhanceActionButtons,
  EnhanceAsyncWrapper,
} from '../../components/enhance/EnhanceParts';
import type { EnhanceMode, VideoScale, VideoOutputCodec } from '../../../domain/ports/EnhancementPorts';

const MAX_DIMENSION = 600;

export const VideoEnhancePanel: React.FC = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentSpaceId } = useSpace();
  const {
    progress, isProcessing, error, resultUrl, resultBlob,
    processVideo, cancel, reset, retry, retryCount, isFallbackRetry,
  } = useEnhancement();

  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 480, h: 270 });
  const [mode, setMode] = useState<EnhanceMode>('all');
  const [scale, setScale] = useState<VideoScale>(1.5);
  const [sharpen, setSharpen] = useState(40);
  const [denoise, setDenoise] = useState(30);
  const [outputCodec, setOutputCodec] = useState<VideoOutputCodec>('h264');
  const [frameInterpolation, setFrameInterpolation] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith('video/')) {
      showToast('error', '请选择视频文件');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setOriginalUrl(url);
    reset();

    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      const ratio = video.videoWidth / video.videoHeight;
      const dw = MAX_DIMENSION;
      const dh = dw / ratio;
      setDisplaySize({ w: Math.round(dw), h: Math.round(dh) });
    };
  }, [reset, showToast]);

  const handleProcess = async () => {
    if (!file) return;
    if (frameInterpolation) {
      const ok = await confirm({
        title: '帧率提升确认',
        message: '帧率提升（补帧到 60fps）性能开销极大，处理时间可能显著增加。是否继续？',
        danger: true,
      });
      if (!ok) return;
    }
    processVideo(file, buildVideoOptions(mode, scale, sharpen, denoise, outputCodec, frameInterpolation));
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    const ext = outputCodec === 'h264' ? 'mp4' : 'webm';
    a.download = `enhanced_${file?.name?.replace(/\.[^.]+$/, '') || 'result'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = async () => {
    if (!resultBlob || !currentSpaceId || !file) return;
    try {
      // 视频素材保存（与去水印 Lab 视频保存逻辑一致，使用通用 saveImageFromBlob 仅作占位，
      // 实际视频素材保存接口待 AssetLibraryService 扩展）
      await assetLibraryService.saveImageFromBlob({
        spaceId: currentSpaceId,
        name: `增强_${file.name}`,
        blob: resultBlob,
        prompt: `视频清晰度提升-${mode}`,
        model: 'enhance-local',
        aspectRatio: `${displaySize.w}:${displaySize.h}`,
        tags: ['清晰度提升', `模式-${mode}`, `放大-${scale}x`],
        sourceType: 'lab',
      });
      showToast('success', '已保存到素材库');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '保存失败');
    }
  };

  const previewUrl = showOriginal ? originalUrl : resultUrl;

  return (
    <div className="enhance-panel">
      {!file ? (
        <EnhanceUploadZone
          icon={<Film size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
          hint="拖拽视频到此处或点击上传"
          hint2="支持 MP4 / WebM / MOV · 最大 10 分钟 · 最大 200MB"
          accept="video/*"
          onFile={handleFileSelect}
        />
      ) : (
        <div className="enhance-editor-layout">
          <div className="enhance-canvas-area">
            {previewUrl ? (
              <>
                <video
                  src={previewUrl}
                  controls
                  style={{ width: displaySize.w, height: displaySize.h, borderRadius: 'var(--radius-md)' }}
                />
                {resultUrl && (
                  <div className="enhance-toolbar">
                    <button
                      className={`btn ${!showOriginal ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setShowOriginal(false)}
                    >
                      增强后
                    </button>
                    <button
                      className={`btn ${showOriginal ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setShowOriginal(true)}
                    >
                      原视频
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="enhance-params-panel">
            <div className="form-group">
              <label className="form-label">处理模式</label>
              <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value as EnhanceMode)} disabled={isProcessing}>
                <option value="sharpen">锐化</option>
                <option value="denoise">去噪</option>
                <option value="upscale">放大</option>
                <option value="all">综合增强（推荐）</option>
              </select>
            </div>

            {(mode === 'upscale' || mode === 'all') && (
              <div className="form-group">
                <label className="form-label">放大倍数</label>
                <select className="form-select" value={scale} onChange={(e) => setScale(Number(e.target.value) as VideoScale)} disabled={isProcessing}>
                  <option value={1}>1x（不放大）</option>
                  <option value={1.5}>1.5x（推荐）</option>
                  <option value={2}>2x</option>
                </select>
              </div>
            )}

            {(mode === 'sharpen' || mode === 'all') && (
              <EnhanceParamSlider
                label="锐化强度"
                value={sharpen}
                disabled={isProcessing}
                tooltip="FFmpeg unsharp 滤镜：增强画面边缘"
                onChange={setSharpen}
              />
            )}

            {(mode === 'denoise' || mode === 'all') && (
              <EnhanceParamSlider
                label="去噪强度"
                value={denoise}
                disabled={isProcessing}
                tooltip="FFmpeg hqdn3d 滤镜：去除压缩噪点"
                onChange={setDenoise}
              />
            )}

            <div className="form-group">
              <label className="form-label">输出编码</label>
              <select className="form-select" value={outputCodec} onChange={(e) => setOutputCodec(e.target.value as VideoOutputCodec)} disabled={isProcessing}>
                <option value="h264">H.264（兼容性好）</option>
                <option value="vp9">VP9（压缩率高）</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={frameInterpolation}
                  onChange={(e) => setFrameInterpolation(e.target.checked)}
                  disabled={isProcessing}
                  style={{ marginRight: '0.4rem' }}
                />
                帧率提升（补帧到 60fps，性能开销大）
              </label>
            </div>

            <EnhanceRetryHint retryCount={retryCount} isFallbackRetry={isFallbackRetry} isProcessing={isProcessing} />

            <EnhanceAsyncWrapper
              isProcessing={isProcessing}
              progress={progress}
              error={error}
              onRetry={retry}
              hasResult={!!resultUrl}
            >
              <EnhanceActionButtons
                isProcessing={isProcessing}
                hasResult={!!resultUrl}
                canProcess={!!file}
                onProcess={handleProcess}
                onCancel={cancel}
                onDownload={handleDownload}
                onSaveToLibrary={handleSaveToLibrary}
                onReset={() => { reset(); setShowOriginal(false); }}
              />
            </EnhanceAsyncWrapper>

            {isProcessing && <EnhanceProgressBar progress={progress} />}

            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}
              onClick={() => { setFile(null); setOriginalUrl(null); setShowOriginal(false); reset(); }}
            >
              更换视频
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
