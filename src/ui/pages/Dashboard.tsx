import React from 'react';
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="page-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.welcome')}</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>{t('dashboard.getStarted')}</h3>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            {t('dashboard.description')}
          </p>
        </div>
      </div>
    </div>
  );
};
