/**
 * FileManager —— 文件管理页
 *
 * 统一聚合所有保存+上传的图片素材，跨空间可见。
 * 支持：多选、批量压缩、删除、下载、关键词搜索。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { assetLibraryService } from '../../dependencies';
import { useToast } from '../contexts/ToastContext';
import { BatchCompressDialog } from '../components/BatchCompressDialog';
import { FileText, Trash2, Download, Zap, Search } from 'lucide-react';

export const FileManager: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // 跨空间查询所有图片（useLiveQuery 自动响应 DB 变化）
  const allImages = useLiveQuery(() => db.savedImages.toArray(), [], []);
  const allSpaces = useLiveQuery(() => db.storySpaces.toArray(), [], []);

  const [keyword, setKeyword] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompressDialog, setShowCompressDialog] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  // 筛选
  const filteredImages = (allImages ?? []).filter(img => {
    if (spaceFilter !== 'all' && img.spaceId !== spaceFilter) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      return img.name.toLowerCase().includes(kw)
        || img.tags.some(tg => tg.toLowerCase().includes(kw))
        || (img.prompt || '').toLowerCase().includes(kw);
    }
    return true;
  });

  // 加载缩略图 URL
  useEffect(() => {
    let cancelled = false;
    const localUrls: Record<string, string> = {};
    (async () => {
      for (const img of filteredImages) {
        try {
          localUrls[img.id] = await assetLibraryService.getImageBlobUrl(img);
        } catch {
          localUrls[img.id] = '';
        }
      }
      if (!cancelled) setUrls(localUrls);
    })();
    return () => {
      cancelled = true;
      Object.values(localUrls).forEach(u => { if (u) URL.revokeObjectURL(u); });
    };
  }, [filteredImages]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await assetLibraryService.deleteImage(id);
      showToast('success', t('fileManager.deleteSuccess', '已删除'));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      showToast('error', t('fileManager.deleteFailed', '删除失败：{{msg}}', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  const handleDownload = async (id: string) => {
    const img = filteredImages.find(i => i.id === id);
    if (!img) return;
    const url = urls[id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${img.name}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await handleDelete(id);
    }
  };

  const spaceName = (spaceId: string): string => {
    return allSpaces?.find(s => s.id === spaceId)?.name || spaceId.slice(0, 8);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={24} />
          {t('fileManager.title', '文件管理')}
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
          {t('fileManager.subtitle', '统一管理所有保存的图片素材，支持批量压缩、删除、下载')}
        </p>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t('fileManager.searchPlaceholder', '搜索名称/标签/提示词...')}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.4rem 0.4rem 2rem', boxSizing: 'border-box' }}
            maxLength={100}
          />
        </div>
        <select
          value={spaceFilter}
          onChange={e => setSpaceFilter(e.target.value)}
          style={{ padding: '0.4rem' }}
        >
          <option value="all">{t('fileManager.allSpaces', '所有空间')}</option>
          {(allSpaces ?? []).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 工具栏（多选时显示） */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.6rem 0.8rem',
          background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
          borderRadius: '0.4rem',
          marginBottom: '1rem',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.85rem' }}>
            {t('fileManager.selected', '已选 {{count}} 项', { count: selectedIds.size })}
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary btn-xs"
            onClick={() => setShowCompressDialog(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Zap size={14} />
            {t('fileManager.batchCompress', '批量压缩')}
          </button>
          <button
            className="btn btn-secondary btn-xs"
            onClick={handleBatchDelete}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Trash2 size={14} />
            {t('fileManager.batchDelete', '批量删除')}
          </button>
          <button
            className="btn btn-secondary btn-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            {t('fileManager.clearSelection', '取消选择')}
          </button>
        </div>
      )}

      {/* 图片网格 */}
      {filteredImages.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--text-muted)',
        }}>
          {t('fileManager.empty', '暂无素材。去实验室生成并保存图片吧。')}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.8rem',
        }}>
          {filteredImages.map(img => (
            <div
              key={img.id}
              style={{
                border: selectedIds.has(img.id) ? '2px solid var(--primary-color, #3b82f6)' : '1px solid var(--border-color, #333)',
                borderRadius: '0.4rem',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => toggleSelect(img.id)}
            >
              {urls[img.id] ? (
                <img
                  src={urls[img.id]}
                  alt={img.name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={24} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div style={{ padding: '0.4rem' }}>
                <div style={{
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {img.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {spaceName(img.spaceId)}
                </div>
              </div>
              {/* 悬浮操作按钮 */}
              <div style={{
                position: 'absolute',
                top: '0.3rem',
                right: '0.3rem',
                display: 'flex',
                gap: '0.2rem',
                opacity: 0.8,
              }}>
                <button
                  onClick={e => { e.stopPropagation(); handleDownload(img.id); }}
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    borderRadius: '0.2rem',
                    cursor: 'pointer',
                    color: '#fff',
                    padding: '0.2rem',
                  }}
                  title={t('common.download', '下载')}
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(img.id); }}
                  style={{
                    background: 'rgba(220, 38, 38, 0.7)',
                    border: 'none',
                    borderRadius: '0.2rem',
                    cursor: 'pointer',
                    color: '#fff',
                    padding: '0.2rem',
                  }}
                  title={t('common.delete', '删除')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 批量压缩对话框 */}
      {showCompressDialog && (
        <BatchCompressDialog
          imageIds={Array.from(selectedIds)}
          onClose={() => setShowCompressDialog(false)}
          onComplete={() => {
            setSelectedIds(new Set());
            showToast('success', t('fileManager.compressComplete', '压缩完成，素材已更新'));
          }}
        />
      )}
    </div>
  );
};
