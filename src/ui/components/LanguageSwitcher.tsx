import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <button 
      onClick={toggleLanguage} 
      className="btn btn-secondary" 
      style={{ padding: '0.4rem 0.8rem', border: 'none', gap: '0.5rem', opacity: 0.8 }}
    >
      <Globe size={18} />
      <span>{i18n.language.startsWith('zh') ? 'EN' : '中文'}</span>
    </button>
  );
};
