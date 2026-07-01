/**
 * BatchCompressDialog —— 批量图片压缩设置对话框
 *
 * 功能：
 *   - 选择压缩参数（质量/最长边/格式/结果处理方式）
 *   - 进度条逐张处理
 *   - 完成后展示前/后体积对比 + 总节省
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { assetLibraryService } from '../../dependencies';
import { compressImage } from '../utils/imageCompress';
import { useToast } from '../contexts/ToastContext';

interface BatchCompressDialogProps {
  imageIds: string[];
  onClose: () => void;
  onComplete: () => void;
}

interface CompressResultItem {
  imageId: string;
  success: boolean;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  error?: string;
}

export const BatchCompressDialog: React.FC<BatchCompressDialogProps> = ({ imageIds, onClose, onComplete }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [quality, setQuality] = useState(85);
  const [maxDimensionEnabled, setMaxDimensionEnabled] = useState(false);
  const [maxDimension, setMaxDimension] = useState(2048);
  const [outputFormat, setOutputFormat] = useState<'original' | 'jpeg' | 'webp'>('original');
  const [resultMode, setResultMode] = useState<'replace' | 'saveAsNew'>('replace');

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<CompressResultItem[] | null>(null);

  const handleStart = async () => {
    setProcessing(true);
    setProgress({ done: 0, total: imageIds.length });
    setResults(null);

    try {
      const res = await assetLibraryService.compressImages({
        imageIds,
        quality,
        maxDimension: maxDimensionEnabled ? maxDimension : undefined,
        outputFormat,
        resultMode,
        compressFn: compressImage,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      setResults(res);
      const successCount = res.filter(r => r.success).length;
      const totalOriginal = res.reduce((s, r) => s + r.originalSize, 0);
      const totalCompressed = res.reduce((s, r) => s + r.compressedSize, 0);
      const saved = totalOriginal - totalCompressed;

      if (successCount > 0) {
        showToast(
          'success',
          t(
            'compress.completeSummary',
            '压缩完成：{{ok}}/{{total}} 张成功，节省 {{saved}}',
            {
              ok: successCount,
              total: imageIds.length,
              saved: formatBytes(saved),
            }
          )
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('error', t('compress.failed', '压缩失败：{{msg}}', { msg }));
    } finally {
      setProcessing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  };

  const formatRatio = (ratio: number): string => {
    const pct = Math.round((1 - ratio) * 100);
    return pct > 0 ? `↓${pct}%` : `+${-pct}%`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary, #1a1a1a)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          maxWidth: '520px',
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color, #333)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            {t('compress.title', '批量压缩图片')}
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              ({imageIds.length} 张)
            </span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {!results && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  {t('compress.quality', '质量')}：{quality}
                </label>
                <input
                  type="range"
                  min={60}
                  max={95}
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('compress.qualityHint', '85=近无损（推荐），60=高压缩，95=最高质量')}
                </span>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={maxDimensionEnabled}
                    onChange={e => setMaxDimensionEnabled(e.target.checked)}
                  />
                  {t('compress.limitDimension', '限制最长边')}
                </label>
                {maxDimensionEnabled && (
                  <input
                    type="number"
                    value={maxDimension}
                    onChange={e => setMaxDimension(Number(e.target.value))}
                    min={256}
                    max={4096}
                    style={{ width: '100%', marginTop: '0.4rem', padding: '0.3rem' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  {t('compress.format', '输出格式')}
                </label>
                <select
                  value={outputFormat}
                  onChange={e => setOutputFormat(e.target.value as 'original' | 'jpeg' | 'webp')}
                  style={{ width: '100%', padding: '0.3rem' }}
                >
                  <option value="original">{t('compress.formatOriginal', '跟随原图（PNG 透明图保留）')}</option>
                  <option value="jpeg">JPEG（更省体积，不支持透明）</option>
                  <option value="webp">WebP（现代格式，体积更小）</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  {t('compress.resultMode', '结果处理')}
                </label>
                <select
                  value={resultMode}
                  onChange={e => setResultMode(e.target.value as 'replace' | 'saveAsNew')}
                  style={{ width: '100%', padding: '0.3rem' }}
                >
                  <option value="replace">{t('compress.modeReplace', '原地替换（瘦身素材库）')}</option>
                  <option value="saveAsNew">{t('compress.modeSaveAsNew', '另存为新素材（保留原图）')}</option>
                </select>
              </div>
            </div>

            {processing && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  {t('compress.processing', '压缩中...')} {progress.done}/{progress.total}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', height: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                      height: '100%',
                      background: 'var(--primary-color, #3b82f6)',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleStart}
                disabled={processing}
                style={{ flex: 1, padding: '0.5rem' }}
              >
                {processing ? (
                  <><Loader2 size={16} className="animate-spin" /> {t('compress.processing', '压缩中...')}</>
                ) : (
                  t('compress.start', '开始压缩')
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={processing}
                style={{ padding: '0.5rem 1rem' }}
              >
                {t('common.cancel', '取消')}
              </button>
            </div>
          </>
        )}

        {results && (
          <>
            <div style={{ marginTop: '0.5rem' }}>
              {(() => {
                const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
                const totalCompressed = results.reduce((s, r) => s + r.compressedSize, 0);
                const saved = totalOriginal - totalCompressed;
                const okCount = results.filter(r => r.success).length;
                return (
                  <div style={{
                    padding: '0.8rem',
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '0.4rem',
                    marginBottom: '0.8rem',
                    fontSize: '0.85rem',
                  }}>
                    <div>{t('compress.resultSummary', '压缩结果')}：{okCount}/{results.length} {t('compress.success', '成功')}</div>
                    <div style={{ marginTop: '0.3rem' }}>
                      {t('compress.totalOriginal', '原体积')}：{formatBytes(totalOriginal)}
                    </div>
                    <div>
                      {t('compress.totalCompressed', '压缩后')}：{formatBytes(totalCompressed)}
                    </div>
                    <div style={{ fontWeight: 600, color: '#22c55e' }}>
                      {t('compress.totalSaved', '节省')}：{formatBytes(saved)}
                    </div>
                  </div>
                );
              })()}
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {results.map((r, i) => (
                  <div
                    key={r.imageId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.3rem 0',
                      fontSize: '0.8rem',
                      borderBottom: '1px solid var(--border-color, #222)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>#{i + 1} {r.imageId.slice(0, 12)}</span>
                    {r.success ? (
                      <span>
                        {formatBytes(r.originalSize)} → {formatBytes(r.compressedSize)}
                        <span style={{ color: '#22c55e', marginLeft: '0.5rem' }}>{formatRatio(r.ratio)}</span>
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>{r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { onComplete(); onClose(); }}
              style={{ width: '100%', marginTop: '1rem', padding: '0.5rem' }}
            >
              {t('common.confirm', '确定')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
