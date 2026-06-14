import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Image as ImageIcon, BookOpen, Settings, FolderOpen, Download, Mic, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { useSpace } from '../contexts/SpaceContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const spaces = useLiveQuery(() => db.storySpaces.toArray());
  const { currentSpaceId, setCurrentSpaceId } = useSpace();

  const handleSpaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentSpaceId(e.target.value || null);
  };

  return (
    <div className="layout-container">
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <div className="logo-glow"></div>
          <h2>AI Video Studio</h2>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <select
            className="form-select"
            value={currentSpaceId ?? ''}
            onChange={handleSpaceChange}
            style={{ width: '100%' }}
          >
            {spaces?.map(space => (
              <option key={space.id} value={space.id}>{space.name}</option>
            ))}
          </select>
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
          <NavLink to="/spaces" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FolderOpen size={20} />
            <span>{t('nav.spaces')}</span>
          </NavLink>
          <NavLink to="/export" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Download size={20} />
            <span>{t('nav.export', '导出中心')}</span>
          </NavLink>
        </nav>
        
        <div style={{ padding: '0 1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>AI 实验室</span>
        </div>
        <nav className="sidebar-nav" style={{ flex: 1, paddingTop: 0 }}>
          <NavLink to="/labs/image" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ImageIcon size={20} />
            <span>{t('nav.imageLab', '图片生成')}</span>
          </NavLink>
          <NavLink to="/labs/voice" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Mic size={20} />
            <span>{t('nav.voiceLab', '音色与配音')}</span>
          </NavLink>
          <NavLink to="/labs/text" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquare size={20} />
            <span>{t('nav.textLab', '文本问答润色')}</span>
          </NavLink>
        </nav>

        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>{t('nav.settings')}</span>
          </NavLink>
          <div style={{ marginTop: '0.5rem' }}>
            <LanguageSwitcher />
          </div>
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
