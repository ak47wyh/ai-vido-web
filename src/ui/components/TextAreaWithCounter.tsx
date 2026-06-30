import React from 'react';

interface TextAreaWithCounterProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCounter?: boolean;
}

export const TextAreaWithCounter = React.forwardRef<HTMLTextAreaElement, TextAreaWithCounterProps>(
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

    const textareaStyle: React.CSSProperties = {
      ...style,
      paddingBottom: showCounter ? '2rem' : style?.paddingBottom,
    };

    const counterStyle: React.CSSProperties = {
      position: 'absolute',
      right: '0.5rem',
      bottom: '0.35rem',
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
        <textarea
          {...props}
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          style={textareaStyle}
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