import React from 'react';

interface InputWithCounterProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maxLength?: number;
  showCounter?: boolean;
}

/**
 * 带字数计数器的单行输入框。
 *
 * 软限制模式：不将 maxLength 透传给原生 input（不阻止输入），
 * 超限时计数器变红并显示提示文本，由提交逻辑调用 validateTextLimit 拦截。
 */
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
    const isOverLimit = !!(maxLength && currentLength > maxLength);

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const inputStyle: React.CSSProperties = {
      ...style,
      paddingRight: showCounter ? '4rem' : style?.paddingRight,
      borderColor: isOverLimit ? 'var(--color-danger)' : style?.borderColor,
    };

    const counterStyle: React.CSSProperties = {
      position: 'absolute',
      right: '0.5rem',
      top: '50%',
      transform: 'translateY(-50%)',
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
        <input
          {...props}
          ref={ref}
          value={value}
          onChange={onChange}
          style={inputStyle}
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
