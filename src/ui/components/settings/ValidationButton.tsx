import React, { useState } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

interface ValidationButtonProps {
  onValidate: () => Promise<void>;
  label: string;
  disabled?: boolean;
}

export const ValidationButton: React.FC<ValidationButtonProps> = ({
  onValidate,
  label,
  disabled = false,
}) => {
  const [isValidating, setIsValidating] = useState(false);

  const handleClick = async () => {
    if (isValidating || disabled) return;
    setIsValidating(true);
    try {
      await onValidate();
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.85rem',
        padding: '0.5rem 1rem',
      }}
      disabled={disabled || isValidating}
      onClick={handleClick}
    >
      {isValidating ? (
        <RefreshCw size={14} className="spin" />
      ) : (
        <CheckCircle size={14} />
      )}
      {isValidating ? '验证中...' : label}
    </button>
  );
};