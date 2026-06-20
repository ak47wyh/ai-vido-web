import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Image as ImageIcon, BookOpen, Settings,
  FolderOpen, Download, Mic, MessageSquare, Sparkles, Film,
  ChevronLeft, ChevronRight, Plus, Zap, Palette, Music as MusicIcon, X, Menu
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAllSpaces } from '../hooks/useSpaceScopedQuery';
import { useSpace } from '../contexts/SpaceContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { storySpaceService } from '../../dependencies';
import { useToast } from '../contexts/ToastContext';
import './MainLayout.css';

interface NavGroup {
  key: string;
  label: string;
  items: { to: string; icon: React.ReactNode; label: string; badge?: string }[];
}

export const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const { currentSpaceId, setCurrentSpaceId } = useSpace();
  const spaces = useAllSpaces();
  const { showToast } = useToast();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSpaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentSpaceId(e.target.value || null);
  };

  const handleCreateSpace = async () => {
    try {
      await storySpaceService.createSpace(t('space.defaultName', '新空间'), '');
      showToast('success', t('space.createSuccess'));
    } catch {
      showToast('error', t('space.createFailed', '创建空间失败'));
    }
  };

  const navGroups: NavGroup[] = [
    {
      key: 'overview',
      label: t('nav.groupOverview', '总览'),
      items: [
        { to: '/', icon: <LayoutDashboard size={18} />, label: t('nav.dashboard') },
      ],
    },
    {
      key: 'creation',
      label: t('nav.groupCreation', '创作'),
      items: [
        { to: '/characters', icon: <Users size={18} />, label: t('nav.characters') },
        { to: '/backgrounds', icon: <Palette size={18} />, label: t('nav.backgrounds') },
        { to: '/workbench', icon: <BookOpen size={18} />, label: t('nav.workbench') },
        { to: '/export', icon: <Download size={18} />, label: t('nav.export', '导出中心') },
      ],
    },
    {
      key: 'ai',
      label: t('nav.groupAI', 'AI 实验室'),
      items: [
        { to: '/labs/image', icon: <ImageIcon size={18} />, label: t('nav.imageLab', '图片生成') },
        { to: '/labs/video', icon: <Film size={18} />, label: t('nav.videoLab', '视频生成') },
        { to: '/labs/voice', icon: <Mic size={18} />, label: t('nav.voiceLab', '音色与配音') },
        { to: '/labs/music', icon: <MusicIcon size={18} />, label: t('nav.musicLab', '音乐生成') },
        { to: '/labs/text', icon: <MessageSquare size={18} />, label: t('nav.textLab', '文本润色') },
      ],
    },
    {
      key: 'manage',
      label: t('nav.groupManage', '管理'),
      items: [
        { to: '/spaces', icon: <FolderOpen size={18} />, label: t('nav.spaces') },
        { to: '/settings', icon: <Settings size={18} />, label: t('nav.settings') },
      ],
    },
  ];

  // 判断当前路径属于哪个创作步骤（用于流程指示器）
  const creationSteps = ['/characters', '/backgrounds', '/workbench', '/export'];
  const currentStepIndex = creationSteps.indexOf(location.pathname);

  // Bottom nav items (mobile) — most important 5
  const bottomNavItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: t('nav.dashboard'), end: true },
    { to: '/workbench', icon: <BookOpen size={20} />, label: t('nav.workbench') },
    { to: '/labs/image', icon: <ImageIcon size={20} />, label: t('nav.imageLab', '图片') },
    { to: '/labs/voice', icon: <Mic size={20} />, label: t('nav.voiceLab', '配音') },
    { to: '/export', icon: <Download size={20} />, label: t('nav.export', '导出') },
  ];

  return (
    <div className={`layout-container ${isMobile ? 'layout-mobile' : ''}`}>
      {/* Mobile Top Bar */}
      {isMobile && (
        <header className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <div className="logo-icon" style={{ width: 28, height: 28 }}>
              <Zap size={16} />
            </div>
            <span className="mobile-topbar-title">AI Video Studio</span>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar — Desktop: always visible, Mobile: drawer */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'sidebar-mobile' : ''} ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Close button for mobile drawer */}
        {isMobile && (
          <button className="mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        )}

        {/* Collapse button — desktop only */}
        {!isMobile && (
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? t('nav.expand', '展开') : t('nav.collapse', '收起')}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        {/* Logo */}
        <div className="sidebar-header">
          <div className="logo-icon">
            <Zap size={20} />
          </div>
          {(!collapsed || isMobile) && <h2 className="logo-text">AI Video Studio</h2>}
        </div>

        {/* Space Switcher */}
        {(!collapsed || isMobile) && (
          <div className="space-switcher">
            <select
              className="form-select space-select"
              value={currentSpaceId ?? ''}
              onChange={handleSpaceChange}
            >
              {(spaces ?? []).map(space => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
            <button className="space-add-btn" onClick={handleCreateSpace} title={t('space.newBtn')}>
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Creation Flow — desktop only */}
        {!isMobile && !collapsed && currentStepIndex >= 0 && (
          <div className="creation-flow">
            <div className="flow-label">
              <Film size={12} />
              <span>{t('nav.creationFlow', '创作流程')}</span>
            </div>
            <div className="flow-steps">
              {[
                { icon: <Users size={10} />, label: t('nav.flowCharacters', '角色') },
                { icon: <Palette size={10} />, label: t('nav.flowBackgrounds', '场景') },
                { icon: <Sparkles size={10} />, label: t('nav.flowGenerate', '生成') },
                { icon: <Download size={10} />, label: t('nav.flowExport', '导出') },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className={`flow-connector ${i <= currentStepIndex ? 'completed' : ''}`} />}
                  <div className={`flow-step ${i < currentStepIndex ? 'done' : ''} ${i === currentStepIndex ? 'current' : ''} ${i > currentStepIndex ? 'pending' : ''}`}>
                    <div className="flow-dot">{step.icon}</div>
                    <span className="flow-step-label">{step.label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navGroups.map(group => (
            <div key={group.key} className="nav-group">
              {(!collapsed || isMobile) && <div className="nav-group-label">{group.label}</div>}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed && !isMobile ? 'nav-item-collapsed' : ''}`}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {(!collapsed || isMobile) && <span className="nav-label">{item.label}</span>}
                  {(!collapsed || isMobile) && item.badge && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {(!collapsed || isMobile) && (
          <div className="sidebar-footer">
            <LanguageSwitcher />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="glass-panel main-panel">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          {bottomNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'mobile-bottom-nav-active' : ''}`}
            >
              {item.icon}
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};