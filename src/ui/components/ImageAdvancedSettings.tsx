import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ImageModel } from '../../domain/ports/OutboundPorts';

export interface ImageAdvancedSettingsValue {
  n: number;
  seed: string;
  watermark: boolean;
  customSizeEnabled: boolean;
  customWidth: number;
  customHeight: number;
  style: string;
}

interface ImageAdvancedSettingsProps {
  value: ImageAdvancedSettingsValue;
  onChange: (value: ImageAdvancedSettingsValue) => void;
  model: ImageModel;
}

const IMAGE_STYLES = [
  { key: '', label: '默认' },
  { key: 'anime', label: '动漫' },
  { key: 'photorealistic', label: '写实' },
  { key: 'oil_painting', label: '油画' },
  { key: 'watercolor', label: '水彩' },
  { key: 'sketch', label: '素描' },
  { key: '3d_render', label: '3D 渲染' },
];

/** 高级设置折叠面板：生成数量、种子、水印、自定义尺寸、画风 */
export const ImageAdvancedSettings: React.FC<ImageAdvancedSettingsProps> = ({
  value, onChange, model,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isLiveModel = model === 'image-01-live';

  const update = (patch: Partial<ImageAdvancedSettingsValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div>
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.8rem' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 高级设置
      </button>
      {expanded && (
        <div style={{
          marginTop: '0.75rem', padding: '1rem',
          background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)',
          display: 'flex', flexWrap: 'wrap', gap: '1.5rem',
        }}>
          {/* 生成数量 */}
          <div>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>生成数量</label>
            <select
              className="form-select"
              style={{ width: '80px' }}
              value={value.n}
              onChange={e => update({ n: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* 随机种子 */}
          <div>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>随机种子 (可复现)</label>
            <input
              className="form-input"
              type="number"
              placeholder="留空则随机"
              value={value.seed}
              onChange={e => update({ seed: e.target.value })}
              style={{ width: '140px', fontSize: '0.85rem' }}
            />
          </div>

          {/* 水印 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', paddingTop: '1.5rem' }}>
            <input
              type="checkbox"
              checked={value.watermark}
              onChange={e => update({ watermark: e.target.checked })}
              style={{ accentColor: 'var(--primary-color)' }}
            /> 添加水印
          </label>

          {/* 自定义尺寸 (仅 image-01) */}
          {!isLiveModel && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', paddingBottom: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={value.customSizeEnabled}
                  onChange={e => update({ customSizeEnabled: e.target.checked })}
                  style={{ accentColor: 'var(--primary-color)' }}
                /> 自定义尺寸
              </label>
              {value.customSizeEnabled && (
                <>
                  <input
                    className="form-input"
                    type="number"
                    min={512}
                    max={2048}
                    step={8}
                    placeholder="宽"
                    value={value.customWidth}
                    onChange={e => update({ customWidth: Number(e.target.value) })}
                    style={{ width: '70px', fontSize: '0.85rem' }}
                  />
                  <span style={{ paddingBottom: '0.4rem' }}>×</span>
                  <input
                    className="form-input"
                    type="number"
                    min={512}
                    max={2048}
                    step={8}
                    placeholder="高"
                    value={value.customHeight}
                    onChange={e => update({ customHeight: Number(e.target.value) })}
                    style={{ width: '70px', fontSize: '0.85rem' }}
                  />
                </>
              )}
            </div>
          )}

          {/* 画风 (仅 image-01-live) */}
          {isLiveModel && (
            <div>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>画风</label>
              <select
                className="form-select"
                style={{ width: '120px' }}
                value={value.style}
                onChange={e => update({ style: e.target.value })}
              >
                {IMAGE_STYLES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
