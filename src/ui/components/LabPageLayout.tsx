import React from 'react';

interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
}

interface LabPageLayoutProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

/**
 * 实验室页面统一布局组件
 * - 统一的 Header（图标 + 标题 + 描述）
 * - 统一的 Tab Bar（带颜色高亮）
 * - 统一的内容区（glass-panel + 动画）
 */
export const LabPageLayout: React.FC<LabPageLayoutProps> = ({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  return (
    <div className="lab-page fade-in">
      {/* Header */}
      <div className="lab-header">
        <div className="lab-header-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div>
          <h1 className="lab-title">{title}</h1>
          <p className="lab-subtitle">{subtitle}</p>
        </div>
      </div>

      {/* Tab Bar */}
      {tabs.length > 1 && (
        <div className="lab-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`lab-tab ${activeTab === tab.key ? 'lab-tab-active' : ''}`}
              style={activeTab === tab.key && tab.color ? { background: tab.color } : undefined}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="lab-content">
        {children}
      </div>
    </div>
  );
};
