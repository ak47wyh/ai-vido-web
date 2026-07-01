import React from 'react';

interface TextAreaWithCounterProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCounter?: boolean;
}

/**
 * 带字数计数器的文本域。
 *
 * 软限制模式：不将 maxLength 透传给原生 textarea（不阻止输入），
 * 超限时计数器变红并显示提示文本，由提交逻辑调用 validateTextLimit 拦截。
 */
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
    const isOverLimit = !!(maxLength && currentLength > maxLength);

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const textareaStyle: React.CSSProperties = {
      ...style,
      paddingBottom: showCounter ? '2rem' : style?.paddingBottom,
      borderColor: isOverLimit ? 'var(--color-danger)' : style?.borderColor,
    };

    const counterStyle: React.CSSProperties = {
      position: 'absolute',
      right: '0.5rem',
      bottom: '0.35rem',
      fontSize: '0.75rem',
      color: isOverLimit ? 'var(--color-danger)' : 'var(--text-muted)',
      pointerEvents: 'none',
      background: 'rgba(0, 0, 0, 0.3)',
      padding: '0.1rem 0.4rem',
      borderRadius: 'var(--radius-sm)',
    };

    const hintStyle: React.CSSProperties = {
      color: 'var(--color-danger)',
      fontSize: '0.75rem',
      marginTop: '0.25rem',
    };

    return (
      <div style={containerStyle}>
        <textarea
          {...props}
          ref={ref}
          value={value}
          onChange={onChange}
          style={textareaStyle}
          className={`${props.className || ''} form-input`}
        />
        {showCounter && (
          <div style={counterStyle}>
            {maxLength ? `${currentLength}/${maxLength}` : currentLength}
          </div>
        )}
        {isOverLimit && (
          <div style={hintStyle}>
            文本超限，请调整至 {maxLength} 字以内
          </div>
        )}
      </div>
    );
  }
);
