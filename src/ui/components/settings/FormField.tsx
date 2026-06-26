import React from 'react';
import { Key } from 'lucide-react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  showKeyIcon?: boolean;
  disabled?: boolean;
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
}) => {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          style={{
            paddingRight: showKeyIcon ? '2.5rem' : '0.75rem',
          }}
        />
        {showKeyIcon && (
          <Key
            size={15}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
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