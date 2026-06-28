import React, { useState, useCallback } from 'react';
import { Download, BookmarkPlus, ImagePlus, X, Maximize2, ImageOff } from 'lucide-react';

export interface GalleryImage {
  url: string;
  prompt: string;
  model?: string;
  aspectRatio?: string;
  seed?: number;
  createdAt: number;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  onDownload: (image: GalleryImage) => void;
  onSave: (image: GalleryImage) => void;
  onUseAsReference?: (image: GalleryImage) => void;
}

/** 图片加载失败的降级占位 */
const BrokenPlaceholder: React.FC<{ prompt: string }> = ({ prompt }) => (
  <div style={{
    width: '100%', minHeight: '150px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    background: 'var(--bg-tertiary, #2a2a3e)', color: 'var(--text-muted, #888)',
    borderRadius: 'var(--radius-sm)', padding: '1rem',
  }}>
    <ImageOff size={28} />
    <span style={{ fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.4 }}>
      图片加载失败
    </span>
    <span style={{ fontSize: '0.65rem', opacity: 0.6, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {prompt}
    </span>
  </div>
);

const MAX_RETRY = 2;

/** 多图画廊组件：网格展示 + 大图模态框 */
export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images, onDownload, onSave, onUseAsReference,
}) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [retryMap, setRetryMap] = useState<Map<string, number>>(new Map());

  const handleImageError = useCallback((url: string) => {
    // 代理 URL 和 data URI 由服务端处理重试，前端不追加重试后缀
    const isProxied = url.includes('/__oss-proxy?');
    const isDataUri = url.startsWith('data:');
    if (isProxied || isDataUri) {
      setFailedUrls(prev => {
        if (prev.has(url)) return prev;
        const next = new Set(prev);
        next.add(url);
        return next;
      });
      return;
    }
    setRetryMap(prev => {
      const next = new Map(prev);
      const count = (next.get(url) ?? 0) + 1;
      next.set(url, count);
      return next;
    });
  }, []);

  // 当 retryMap 变化时，检查是否需要标记失败
  React.useEffect(() => {
    for (const [url, count] of retryMap) {
      if (count >= MAX_RETRY && !failedUrls.has(url)) {
        setFailedUrls(prev => new Set(prev).add(url));
      }
    }
  }, [retryMap, failedUrls]);

  /** 获取带重试后缀的 URL，或 null（已失败） */
  const getSrc = useCallback((url: string): string | null => {
    if (failedUrls.has(url)) return null;
    // 代理 URL 和 data URI 不追加重试后缀，避免破坏 URL 签名
    const isProxied = url.includes('/__oss-proxy?');
    const isDataUri = url.startsWith('data:');
    if (isProxied || isDataUri) return url;
    const retry = retryMap.get(url) ?? 0;
    if (retry === 0) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_retry=${retry}`;
  }, [failedUrls, retryMap]);

  if (images.length === 0) return null;

  return (
    <>
      {/* 缩略图网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${images.length === 1 ? '400px' : '200px'}, 1fr))`,
        gap: '1rem',
      }}>
        {images.map((img, idx) => (
          <div
            key={`${img.url}-${idx}`}
            className="glass-panel"
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', position: 'relative' }}
          >
            <div
              style={{ cursor: failedUrls.has(img.url) ? 'default' : 'pointer', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}
              onClick={() => { if (!failedUrls.has(img.url)) setPreviewIndex(idx); }}
            >
              {(() => {
                const src = getSrc(img.url);
                return src ? (
                  <img
                    key={`${img.url}-r${retryMap.get(img.url) ?? 0}`}
                    src={src}
                    alt={img.prompt.substring(0, 50)}
                    style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', display: 'block' }}
                    onError={() => handleImageError(img.url)}
                  />
                ) : (
                  <BrokenPlaceholder prompt={img.prompt} />
                );
              })()}
              {!failedUrls.has(img.url) && (
                <div style={{
                  position: 'absolute', top: '0.25rem', right: '0.25rem',
                  background: 'rgba(0,0,0,0.5)', borderRadius: 'var(--radius-sm)',
                  padding: '0.15rem', opacity: 0.7,
                }}>
                  <Maximize2 size={12} color="#fff" />
                </div>
              )}
            </div>
            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                onClick={() => onDownload(img)}
                title="下载"
              ><Download size={12} /> 下载</button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                onClick={() => onSave(img)}
                title="保存到素材库"
              ><BookmarkPlus size={12} /> 保存</button>
              {onUseAsReference && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                  onClick={() => onUseAsReference(img)}
                  title="用作图生图参考"
                ><ImagePlus size={12} /> 用作参考</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 大图模态框 */}
      {previewIndex !== null && images[previewIndex] && (
        <div
          onClick={() => setPreviewIndex(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem', cursor: 'pointer',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', cursor: 'default' }}
          >
            {(() => {
              const img = images[previewIndex!];
              const src = getSrc(img.url);
              return src ? (
                <img
                  key={`${img.url}-preview-r${retryMap.get(img.url) ?? 0}`}
                  src={src}
                  alt={img.prompt.substring(0, 50)}
                  style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 'var(--radius-md)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
                  onError={() => handleImageError(img.url)}
                />
              ) : (
                <div style={{ maxWidth: '100%', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BrokenPlaceholder prompt={img.prompt} />
                </div>
              );
            })()}
            {/* 图片信息 */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              padding: '2rem 1rem 1rem', borderRadius: '0 0 var(--radius-md) var(--radius-md)',
              color: '#fff',
            }}>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
                {images[previewIndex].prompt.substring(0, 200)}
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                {images[previewIndex].model && <span>模型: {images[previewIndex].model}</span>}
                {images[previewIndex].aspectRatio && <span>比例: {images[previewIndex].aspectRatio}</span>}
                {images[previewIndex].seed !== undefined && <span>种子: {images[previewIndex].seed}</span>}
              </div>
            </div>
            {/* 关闭按钮 */}
            <button
              onClick={() => setPreviewIndex(null)}
              style={{
                position: 'absolute', top: '-1rem', right: '-1rem',
                background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            ><X size={18} /></button>
            {/* 切换按钮 */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setPreviewIndex(prev => ((prev ?? 0) - 1 + images.length) % images.length)}
                  style={{
                    position: 'absolute', left: '-3rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                    width: '40px', height: '40px', cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >‹</button>
                <button
                  onClick={() => setPreviewIndex(prev => ((prev ?? 0) + 1) % images.length)}
                  style={{
                    position: 'absolute', right: '-3rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                    width: '40px', height: '40px', cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >›</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
