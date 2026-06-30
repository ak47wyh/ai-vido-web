import React from 'react';

interface InputWithCounterProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maxLength?: number;
  showCounter?: boolean;
}

export const InputWithCounter = React.forwardRef<HTMLInputElement, InputWithCounterProps>(
  ({
    maxLength,
    showCounter = true,
    value = '',
    onChange,
    style,
    ...props
  }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0;

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const inputStyle: React.CSSProperties = {
      ...style,
      paddingRight: showCounter ? '4rem' : style?.paddingRight,
    };

    const counterStyle: React.CSSProperties = {
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
    };

    return (
      <div style={containerStyle}>
        <input
          {...props}
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          style={inputStyle}
          className={`${props.className || ''} form-input`}
        />
        {showCounter && (
          <div style={counterStyle}>
            {maxLength ? `${currentLength}/${maxLength}` : currentLength}
          </div>
        )}
      </div>
    );
  }
);