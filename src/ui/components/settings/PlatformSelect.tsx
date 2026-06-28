import React from 'react';

interface PlatformSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export const PlatformSelect: React.FC<PlatformSelectProps> = ({
  label,
  value,
  onChange,
  options,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <label
        style={{
          width: '120px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <select
        className="form-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1 }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};