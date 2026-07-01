import React from 'react';
import { Key } from 'lucide-react';

export interface FormFieldOption {
  value: string;
  label: string;
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'select';
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  showKeyIcon?: boolean;
  disabled?: boolean;
  options?: FormFieldOption[];
  /** 输入字符上限，设置后显示计数器（仅对 text/password 生效） */
  maxLength?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  hint,
  showKeyIcon = false,
  disabled = false,
  options,
  maxLength,
}) => {
  const showCounter = maxLength !== undefined && type !== 'select';
  const currentLength = typeof value === 'string' ? value.length : 0;
  // 同时显示 key 图标和计数器时，预留更宽右侧空间
  const paddingRight = showKeyIcon && showCounter
    ? '5rem'
    : showKeyIcon
      ? '2.5rem'
      : showCounter
        ? '3.5rem'
        : '0.75rem';

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        {type === 'select' ? (
          <select
            className="form-input"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ paddingRight: '0.75rem', appearance: 'auto' }}
          >
            {(options ?? []).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            className="form-input"
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            maxLength={maxLength}
            style={{ paddingRight }}
          />
        )}
        {showKeyIcon && type !== 'select' && (
          <Key
            size={15}
            style={{
              position: 'absolute',
              right: showCounter ? '3rem' : '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        )}
        {showCounter && (
          <div
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.75rem',
              color: maxLength && currentLength > maxLength
                ? 'var(--color-danger)'
                : 'var(--text-muted)',
              pointerEvents: 'none',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '0.1rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {currentLength}/{maxLength}
          </div>
        )}
      </div>
      {hint && (
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {hint}
        </p>
      )}
    </div>
  );
};