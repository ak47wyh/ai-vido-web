import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Image as ImageIcon, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="layout-container">
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <div className="logo-glow"></div>
          <h2>AI Video Studio</h2>
        </div>
        <nav className="sidebar-nav" style={{ flex: 1 }}>
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={20} />
            <span>{t('nav.dashboard')}</span>
          </NavLink>
          <NavLink to="/characters" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>{t('nav.characters')}</span>
          </NavLink>
          <NavLink to="/backgrounds" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ImageIcon size={20} />
            <span>{t('nav.backgrounds')}</span>
          </NavLink>
          <NavLink to="/workbench" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={20} />
            <span>{t('nav.workbench')}</span>
          </NavLink>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <LanguageSwitcher />
        </div>
      </aside>
      <main className="main-content">
        <div className="glass-panel main-panel">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
