import React, { useState, useRef, useCallback } from 'react';
import { Eraser, Image as ImageIcon, FileText, Film, Upload, Download, Trash2, Undo2, Redo2, Wand2, Loader2, X, Save } from 'lucide-react';
import { LabPageLayout } from '../components/LabPageLayout';
import { AsyncState } from '../components/AsyncState';
import { RegionSelector, type SelectionMode } from '../components/watermark/RegionSelector';
import { InpaintPreview } from '../components/watermark/InpaintPreview';
import { useWatermarkRemoval } from '../hooks/useWatermarkRemoval';
import { useToast } from '../contexts/ToastContext';
import { useSpace } from '../contexts/SpaceContext';
import { assetLibraryService } from '../../dependencies';
import type { InpaintRegion, InpaintAlgorithm } from '../../domain/ports/WatermarkRemovalPorts';
import './WatermarkLab.css';

type LabTab = 'image' | 'pdf' | 'video';

const TABS = [
  { key: 'image', label: '图片去水印', icon: <ImageIcon size={14} /> },
  { key: 'pdf', label: 'PDF去水印', icon: <FileText size={14} /> },
  { key: 'video', label: '视频去水印', icon: <Film size={14} /> },
];

const MAX_DIMENSION = 600;

export const WatermarkLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LabTab>('image');

  return (
    <LabPageLayout
      icon={<Eraser size={22} />}
      iconBg="rgba(236, 72, 153, 0.15)"
      iconColor="#ec4899"
      title="去水印实验室"
      subtitle="浏览器端本地处理 · 图片 / PDF / 视频去水印 · 隐私安全零上传"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as LabTab)}
    >
      {activeTab === 'image' && <ImageWatermarkPanel />}
      {activeTab === 'pdf' && <PdfWatermarkPanel />}
      {activeTab === 'video' && <VideoWatermarkPanel />}
    </LabPageLayout>
  );
};

// ==================== 图片去水印面板 ====================
const ImageWatermarkPanel: React.FC = () => {
  const { showToast } = useToast();
  const { currentSpaceId } = useSpace();
  const {
    progress, isProcessing, error, resultUrl, resultBlob,
    processImage, cancel, reset, retry, retryCount, currentAlgorithm, isFallbackRetry,
  } = useWatermarkRemoval();

  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 400, h: 300 });
  const [regions, setRegions] = useState<InpaintRegion[]>([]);
  const [mode, setMode] = useState<SelectionMode>('rect');
  const [brushSize, setBrushSize] = useState(30);
  const [algorithm, setAlgorithm] = useState<InpaintAlgorithm>('edge_interpolation');
  const [history, setHistory] = useState<InpaintRegion[][]>([]);
  const [redoStack, setRedoStack] = useState<InpaintRegion[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      showToast('error', '请选择图片文件');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    setRegions([]);
    setHistory([]);
    setRedoStack([]);
    reset();

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // 按比例缩放到显示区域
      const ratio = img.naturalWidth / img.naturalHeight;
      let dw = MAX_DIMENSION;
      let dh = MAX_DIMENSION / ratio;
      if (dh > MAX_DIMENSION) {
        dh = MAX_DIMENSION;
        dw = MAX_DIMENSION * ratio;
      }
      setDisplaySize({ w: Math.round(dw), h: Math.round(dh) });
    };
    img.src = url;
  }, [reset, showToast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleRegionsChange = (newRegions: InpaintRegion[]) => {
    setHistory(prev => [...prev, regions]);
    setRedoStack([]);
    setRegions(newRegions);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [...r, regions]);
    setRegions(prev);
    setHistory(h => h.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(h => [...h, regions]);
    setRegions(next);
    setRedoStack(r => r.slice(0, -1));
  };

  const handleProcess = () => {
    if (!file || regions.length === 0) return;
    processImage(file, regions, algorithm);
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inpaint_${file?.name || 'result'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = async () => {
    if (!resultBlob || !currentSpaceId || !file) return;
    try {
      await assetLibraryService.saveImageFromBlob({
        spaceId: currentSpaceId,
        name: `去水印_${file.name}`,
        blob: resultBlob,
        prompt: '去水印处理',
        model: 'inpaint-local',
        aspectRatio: `${naturalSize.w}:${naturalSize.h}`,
        tags: ['去水印'],
        sourceType: 'lab',
      });
      showToast('success', '已保存到素材库');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <div className="watermark-panel">
      {/* 上传区 */}
      {!file && (
        <div
          className="watermark-upload-zone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            拖拽图片到此处或点击上传
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>
            支持 JPG / PNG / WEBP / BMP · 最大 4096×4096 · 最大 20MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>
      )}

      {/* 编辑区 */}
      {file && (
        <div className="watermark-editor-layout">
          {/* 左侧：预览/选区编辑 */}
          <div className="watermark-canvas-area">
            {resultUrl ? (
              <InpaintPreview
                originalUrl={imageUrl!}
                resultUrl={resultUrl}
                displayWidth={displaySize.w}
                displayHeight={displaySize.h}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {imageUrl && (
                  <RegionSelector
                    displayWidth={displaySize.w}
                    displayHeight={displaySize.h}
                    naturalWidth={naturalSize.w}
                    naturalHeight={naturalSize.h}
                    regions={regions}
                    onRegionsChange={handleRegionsChange}
                    mode={mode}
                    brushSize={brushSize}
                    imageSrc={imageUrl}
                    disabled={isProcessing}
                  />
                )}
              </div>
            )}

            {/* 工具栏 */}
            {!resultUrl && (
              <div className="watermark-toolbar">
                <button
                  className={`btn ${mode === 'rect' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setMode('rect')}
                >
                  矩形框选
                </button>
                <button
                  className={`btn ${mode === 'brush' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setMode('brush')}
                >
                  涂抹
                </button>
                {mode === 'brush' && (
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                )}
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={handleUndo} disabled={history.length === 0}>
                  <Undo2 size={14} />
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={handleRedo} disabled={redoStack.length === 0}>
                  <Redo2 size={14} />
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#ef4444' }}
                  onClick={() => { setRegions([]); setHistory([]); setRedoStack([]); }}
                >
                  <Trash2 size={14} /> 清除选区
                </button>
              </div>
            )}
          </div>

          {/* 右侧：参数面板 */}
          <div className="watermark-params-panel">
            <div className="form-group">
              <label className="form-label">去水印算法</label>
              <select
                className="form-select"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as InpaintAlgorithm)}
                disabled={isProcessing}
              >
                <option value="fast_fill">快速填充（纯色背景）</option>
                <option value="edge_interpolation">边缘插值（推荐）</option>
                <option value="texture_synthesis">纹理合成（复杂背景）</option>
                <option value="telea">Telea 快速行进法（保留纹理走向）</option>
                <option value="navier_stokes">Navier-Stokes 流体扩散（边缘平滑）</option>
                <option value="content_aware">内容感知填充（Patch-Match，质量最高）</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">已选区域</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {regions.length} 个区域
              </div>
            </div>

            {/* 重试状态提示 */}
            {(retryCount > 0 || isFallbackRetry) && isProcessing && (
              <div className="watermark-retry-hint">
                {isFallbackRetry && currentAlgorithm ? (
                  <>主算法失败，正在尝试备选算法：<strong>{currentAlgorithm}</strong></>
                ) : (
                  <>正在重试 · 第 {retryCount + 1} 次尝试</>
                )}
              </div>
            )}

            <AsyncState
              loading={isProcessing}
              loadingText={`处理中... ${Math.round(progress * 100)}%`}
              error={error}
              onRetry={retry}
              minHeight={80}
            >
              {!resultUrl ? (
                <>
                  <button
                    className="btn btn-primary btn-generate"
                    disabled={regions.length === 0 || isProcessing}
                    onClick={handleProcess}
                  >
                    {isProcessing ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
                    {isProcessing ? '处理中...' : '开始去水印'}
                  </button>
                  {isProcessing && (
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={cancel}
                    >
                      <X size={14} /> 取消
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-generate" onClick={handleDownload}>
                    <Download size={18} /> 下载图片
                  </button>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleSaveToLibrary}>
                    <Save size={16} /> 保存到素材库
                  </button>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => { reset(); setRegions([]); }}>
                    <Trash2 size={16} /> 重新处理
                  </button>
                </>
              )}
            </AsyncState>

            {isProcessing && (
              <div className="watermark-progress">
                <div className="watermark-progress-bar" style={{ width: `${progress * 100}%` }} />
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}
              onClick={() => {
                setFile(null);
                setImageUrl(null);
                setRegions([]);
                reset();
              }}
            >
              更换图片
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PDF 去水印面板 ====================
const PdfWatermarkPanel: React.FC = () => {
  const { showToast } = useToast();
  const {
    progress, isProcessing, error, resultUrl, resultBlob,
    processPdf, cancel, reset, retry, retryCount, isFallbackRetry,
  } = useWatermarkRemoval();
  const [file, setFile] = useState<File | null>(null);
  const [firstPageUrl, setFirstPageUrl] = useState<string | null>(null);
  const [regions, setRegions] = useState<InpaintRegion[]>([]);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 400, h: 560 });
  const [mode, setMode] = useState<SelectionMode>('rect');
  const [dpi, setDpi] = useState(150);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (f: File) => {
    if (f.type !== 'application/pdf') {
      showToast('error', '请选择 PDF 文件');
      return;
    }
    setFile(f);
    setRegions([]);
    reset();
    // 渲染第一页作为预览
    try {
      // @ts-expect-error - CDN 动态导入，无类型声明
      const pdfjs = await import(/* @vite-ignore */ 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      setNaturalSize({ w: viewport.width, h: viewport.height });
      const ratio = viewport.width / viewport.height;
      const dh = MAX_DIMENSION;
      const dw = dh * ratio;
      setDisplaySize({ w: Math.round(dw), h: Math.round(dh) });

      // 渲染为图片 URL
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      setFirstPageUrl(canvas.toDataURL('image/png'));
    } catch (_e) {
      showToast('error', 'PDF 预览失败');
    }
  };

  const handleProcess = () => {
    if (!file || regions.length === 0) return;
    processPdf(file, regions, dpi);
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermark_removed_${file?.name || 'result.pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="watermark-panel">
      {!file ? (
        <div
          className="watermark-upload-zone"
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>拖拽 PDF 到此处或点击上传</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>
            支持标准 PDF · 最大 50 页 · 最大 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="watermark-editor-layout">
          <div className="watermark-canvas-area">
            {resultUrl ? (
              <iframe src={resultUrl} style={{ width: displaySize.w, height: displaySize.h, border: 'none' }} title="PDF Result" />
            ) : firstPageUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <RegionSelector
                  displayWidth={displaySize.w}
                  displayHeight={displaySize.h}
                  naturalWidth={naturalSize.w}
                  naturalHeight={naturalSize.h}
                  regions={regions}
                  onRegionsChange={setRegions}
                  mode={mode}
                  brushSize={30}
                  imageSrc={firstPageUrl}
                />
                <div className="watermark-toolbar">
                  <button className={`btn ${mode === 'rect' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setMode('rect')}>矩形框选</button>
                  <button className={`btn ${mode === 'brush' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setMode('brush')}>涂抹</button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#ef4444' }} onClick={() => setRegions([])}>
                    <Trash2 size={14} /> 清除
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  提示：框选的水印区域将应用到所有页（全页统一模式）
                </p>
              </div>
            ) : (
              <AsyncState loading emptyText="加载预览..." minHeight={300} />
            )}
          </div>

          <div className="watermark-params-panel">
            <div className="form-group">
              <label className="form-label">渲染分辨率 (DPI)</label>
              <select className="form-select" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} disabled={isProcessing}>
                <option value={96}>96 (快速)</option>
                <option value={150}>150 (推荐)</option>
                <option value={300}>300 (高清)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">已选区域</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{regions.length} 个区域</div>
            </div>
            {/* 重试状态提示 */}
            {retryCount > 0 && isProcessing && (
              <div className="watermark-retry-hint">
                {isFallbackRetry
                  ? '主算法失败，正在尝试备选算法'
                  : `正在重试 · 第 ${retryCount + 1} 次尝试`}
              </div>
            )}
            <AsyncState loading={isProcessing} loadingText={`处理中... ${Math.round(progress * 100)}%`} error={error} onRetry={retry} minHeight={80}>
              {!resultUrl ? (
                <>
                  <button className="btn btn-primary btn-generate" disabled={regions.length === 0 || isProcessing} onClick={handleProcess}>
                    {isProcessing ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
                    {isProcessing ? '处理中...' : '开始去水印'}
                  </button>
                  {isProcessing && <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={cancel}><X size={14} /> 取消</button>}
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-generate" onClick={handleDownload}><Download size={18} /> 下载 PDF</button>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => { reset(); setRegions([]); }}><Trash2 size={16} /> 重新处理</button>
                </>
              )}
            </AsyncState>
            {isProcessing && (
              <div className="watermark-progress"><div className="watermark-progress-bar" style={{ width: `${progress * 100}%` }} /></div>
            )}
            <button className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }} onClick={() => { setFile(null); setFirstPageUrl(null); setRegions([]); reset(); }}>
              更换 PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 视频去水印面板 ====================
const VideoWatermarkPanel: React.FC = () => {
  const { showToast } = useToast();
  const {
    progress, isProcessing, error, resultUrl, resultBlob,
    processVideo, cancel, reset, retry, retryCount, isFallbackRetry,
  } = useWatermarkRemoval();
  const [file, setFile] = useState<File | null>(null);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 480, h: 270 });
  const [regions, setRegions] = useState<InpaintRegion[]>([]);
  const [mode, setMode] = useState<SelectionMode>('rect');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (f: File) => {
    if (!f.type.startsWith('video/')) {
      showToast('error', '请选择视频文件');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setRegions([]);
    reset();

    // 抽取首帧作为预览
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setNaturalSize({ w: video.videoWidth, h: video.videoHeight });
      const ratio = video.videoWidth / video.videoHeight;
      const dw = MAX_DIMENSION;
      const dh = dw / ratio;
      setDisplaySize({ w: Math.round(dw), h: Math.round(dh) });
    };
    video.onloadeddata = () => {
      video.currentTime = 0;
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      setFirstFrameUrl(canvas.toDataURL('image/png'));
    };
  };

  const handleProcess = () => {
    if (!file || regions.length === 0) return;
    processVideo(file, regions);
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermark_removed_${file?.name || 'result.mp4'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="watermark-panel">
      {!file ? (
        <div
          className="watermark-upload-zone"
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>拖拽视频到此处或点击上传</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>
            支持 MP4 / WebM / MOV · 最大 10 分钟 · 最大 200MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="watermark-editor-layout">
          <div className="watermark-canvas-area">
            {resultUrl ? (
              <video src={resultUrl} controls style={{ width: displaySize.w, height: displaySize.h, borderRadius: 'var(--radius-md)' }} />
            ) : firstFrameUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <RegionSelector
                  displayWidth={displaySize.w}
                  displayHeight={displaySize.h}
                  naturalWidth={naturalSize.w}
                  naturalHeight={naturalSize.h}
                  regions={regions}
                  onRegionsChange={setRegions}
                  mode={mode}
                  brushSize={30}
                  imageSrc={firstFrameUrl}
                />
                <div className="watermark-toolbar">
                  <button className={`btn ${mode === 'rect' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setMode('rect')}>矩形框选</button>
                  <button className={`btn ${mode === 'brush' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setMode('brush')}>涂抹</button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#ef4444' }} onClick={() => setRegions([])}>
                    <Trash2 size={14} /> 清除
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  提示：框选水印位置，将应用到视频所有帧（静态水印模式）
                </p>
              </div>
            ) : (
              <AsyncState loading emptyText="加载视频预览..." minHeight={300} />
            )}
          </div>

          <div className="watermark-params-panel">
            <div className="form-group">
              <label className="form-label">已选区域</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{regions.length} 个区域</div>
            </div>
            <div className="form-group">
              <label className="form-label">处理模式</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>静态水印 · 关键帧抽帧</div>
            </div>
            {/* 重试状态提示 */}
            {retryCount > 0 && isProcessing && (
              <div className="watermark-retry-hint">
                {isFallbackRetry
                  ? '主算法失败，正在尝试备选算法'
                  : `正在重试 · 第 ${retryCount + 1} 次尝试`}
              </div>
            )}
            <AsyncState loading={isProcessing} loadingText={`处理中... ${Math.round(progress * 100)}%`} error={error} onRetry={retry} minHeight={80}>
              {!resultUrl ? (
                <>
                  <button className="btn btn-primary btn-generate" disabled={regions.length === 0 || isProcessing} onClick={handleProcess}>
                    {isProcessing ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
                    {isProcessing ? '处理中...' : '开始去水印'}
                  </button>
                  {isProcessing && <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={cancel}><X size={14} /> 取消</button>}
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-generate" onClick={handleDownload}><Download size={18} /> 下载视频</button>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => { reset(); setRegions([]); }}><Trash2 size={16} /> 重新处理</button>
                </>
              )}
            </AsyncState>
            {isProcessing && (
              <div className="watermark-progress"><div className="watermark-progress-bar" style={{ width: `${progress * 100}%` }} /></div>
            )}
            <button className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }} onClick={() => { setFile(null); setFirstFrameUrl(null); setRegions([]); reset(); }}>
              更换视频
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
