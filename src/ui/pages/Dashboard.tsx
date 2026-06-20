import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Image as ImageIcon, BookOpen, Settings, ArrowRight, CheckCircle, XCircle, Clock, Film, Mic, MessageSquare, Sparkles, Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpaceScopedCharacters, useSpaceScopedBackgrounds, useSpaceScopedStories, useSpaceVideoTaskStats, useRecentStories } from '../hooks/useSpaceScopedQuery';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Space-aware counts
  const characters = useSpaceScopedCharacters();
  const characterCount = characters.length;
  const backgrounds = useSpaceScopedBackgrounds();
  const backgroundCount = backgrounds.length;
  const stories = useSpaceScopedStories();
  const storyCount = stories.length;

  // Space-aware video task stats
  const taskStats = useSpaceVideoTaskStats();

  // Recent stories in current space
  const recentStories = useRecentStories(3);

  const steps = [
    {
      icon: <Users size={18} />,
      title: t('dashboard.step1Title'),
      desc: t('dashboard.step1Desc'),
      count: characterCount,
      countLabel: t('dashboard.charactersCount'),
      path: '/characters',
      color: '#6366f1'
    },
    {
      icon: <ImageIcon size={18} />,
      title: t('dashboard.step2Title'),
      desc: t('dashboard.step2Desc'),
      count: backgroundCount,
      countLabel: t('dashboard.backgroundsCount'),
      path: '/backgrounds',
      color: '#ec4899'
    },
    {
      icon: <BookOpen size={18} />,
      title: t('dashboard.step3Title'),
      desc: t('dashboard.step3Desc'),
      count: storyCount,
      countLabel: t('dashboard.storiesCount'),
      path: '/workbench',
      color: '#f59e0b'
    },
    {
      icon: <Film size={18} />,
      title: t('dashboard.step4Title', '导出中心'),
      desc: t('dashboard.step4Desc', '合成最终视频并下载导出'),
      count: null,
      countLabel: '',
      path: '/export',
      color: '#8b5cf6'
    },
    {
      icon: <Settings size={18} />,
      title: t('dashboard.step5Title', '系统设置'),
      desc: t('dashboard.step5Desc', '配置您的系统偏好'),
      count: null,
      countLabel: '',
      path: '/settings',
      color: '#10b981'
    }
  ];

  const handleStoryClick = (storyId: string) => {
    navigate(`/workbench?story=${storyId}`);
  };

  return (
    <div className="dashboard fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{t('dashboard.title')}</h1>
          <p className="dashboard-subtitle">{t('dashboard.welcome')}</p>
        </div>
      </div>

      {/* Workflow guide cards */}
      <div className="dashboard-section">
        <div className="dashboard-grid">
          {steps.map((step, index) => (
            <div
              key={step.path}
              className="dashboard-card"
              onClick={() => navigate(step.path)}
            >
              <div className="dashboard-card-header">
                <div className="dashboard-card-icon" style={{ background: `${step.color}20`, color: step.color, position: 'relative' }}>
                  {step.icon}
                  <span className="dashboard-step-badge" style={{ background: step.color }}>{index + 1}</span>
                </div>
                <h3 className="dashboard-card-title">{step.title}</h3>
              </div>
              <p className="dashboard-card-desc">{step.desc}</p>
              <div className="dashboard-card-footer">
                {step.count !== null && (
                  <span className="dashboard-card-count" style={{ color: step.color }}>
                    {step.count} {step.countLabel}
                  </span>
                )}
                <span className="dashboard-card-go">
                  {t('dashboard.go')} <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI 实验室快捷入口 */}
      <div className="dashboard-section">
        <div className="dashboard-section-title">
          <Sparkles size={16} style={{ color: 'var(--primary-color)' }} />
          {t('dashboard.aiLab', 'AI 实验室')}
        </div>
        <div className="dashboard-grid">
          {[
            { icon: <ImageIcon size={16} />, label: t('nav.imageLab', '图片生成'), path: '/labs/image', color: '#ec4899', desc: t('dashboard.aiImageDesc', 'AI 图片生成与编辑') },
            { icon: <Film size={16} />, label: t('nav.videoLab', '视频生成'), path: '/labs/video', color: '#3b82f6', desc: t('dashboard.aiVideoDesc', '文生视频、图生视频、首尾帧、主体参考') },
            { icon: <Mic size={16} />, label: t('nav.voiceLab', '音色与配音'), path: '/labs/voice', color: '#10b981', desc: t('dashboard.aiVoiceDesc', '音色克隆、文本配音、音色设计') },
            { icon: <Music size={16} />, label: t('nav.musicLab', '音乐生成'), path: '/labs/music', color: '#8b5cf6', desc: t('dashboard.aiMusicDesc', 'AI 音乐创作与 BGM 生成') },
            { icon: <MessageSquare size={16} />, label: t('nav.textLab', '文本润色'), path: '/labs/text', color: '#f59e0b', desc: t('dashboard.aiTextDesc', 'AI 文本优化与改写') },
          ].map(item => (
            <div
              key={item.path}
              className="dashboard-card"
              onClick={() => navigate(item.path)}
            >
              <div className="dashboard-card-header">
                <div className="dashboard-card-icon" style={{ background: `${item.color}20`, color: item.color }}>
                  {item.icon}
                </div>
                <span className="dashboard-card-title">{item.label}</span>
              </div>
              <p className="dashboard-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row: Video task stats + Recent stories */}
      <div className="dashboard-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {/* Video task stats — inline compact, no nested cards */}
          <div className="dashboard-card" style={{ cursor: 'default' }}>
            <h3 className="dashboard-section-title" style={{ marginBottom: '0.5rem' }}>{t('dashboard.videoStats')}</h3>
            {taskStats.total === 0 ? (
              <p className="dashboard-card-desc" style={{ textAlign: 'center', padding: '0.75rem 0' }}>{t('dashboard.noVideoStats')}</p>
            ) : (
            <div className="dashboard-stats-row">
              <div className="dashboard-stat-item" style={{ background: 'rgba(52,211,153,0.08)' }}>
                <div className="dashboard-stat-icon" style={{ background: 'rgba(52,211,153,0.2)' }}>
                  <CheckCircle size={16} color="#34d399" />
                </div>
                <div>
                  <div className="dashboard-stat-value" style={{ color: '#34d399' }}>{taskStats.success}</div>
                  <div className="dashboard-stat-label">{t('dashboard.statusSuccess')}</div>
                </div>
              </div>
              <div className="dashboard-stat-item" style={{ background: 'rgba(248,113,113,0.08)' }}>
                <div className="dashboard-stat-icon" style={{ background: 'rgba(248,113,113,0.2)' }}>
                  <XCircle size={16} color="#f87171" />
                </div>
                <div>
                  <div className="dashboard-stat-value" style={{ color: '#f87171' }}>{taskStats.failed}</div>
                  <div className="dashboard-stat-label">{t('dashboard.statusFailed')}</div>
                </div>
              </div>
              <div className="dashboard-stat-item" style={{ background: 'rgba(251,191,36,0.08)' }}>
                <div className="dashboard-stat-icon" style={{ background: 'rgba(251,191,36,0.2)' }}>
                  <Clock size={16} color="#fbbf24" />
                </div>
                <div>
                  <div className="dashboard-stat-value" style={{ color: '#fbbf24' }}>{taskStats.processing}</div>
                  <div className="dashboard-stat-label">{t('dashboard.statusProcessing')}</div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Recent stories — compact list, no nested cards */}
          <div className="dashboard-card" style={{ cursor: 'default' }}>
            <h3 className="dashboard-section-title" style={{ marginBottom: '0.5rem' }}>{t('dashboard.recentStories')}</h3>
            {(!recentStories || recentStories.length === 0) ? (
              <p className="dashboard-card-desc">{t('dashboard.noStories')}</p>
            ) : (
              <div className="dashboard-story-list">
                {recentStories.map(s => (
                  <div
                    key={s.id}
                    className="dashboard-story-item"
                    onClick={() => handleStoryClick(s.id)}
                  >
                    <div>
                      <div className="dashboard-story-title">{s.title}</div>
                      <div className="dashboard-story-date">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="dashboard-story-badge" style={{
                      background: s.status === 'SPLIT' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                      color: s.status === 'SPLIT' ? '#34d399' : '#fbbf24',
                    }}>
                      {s.status === 'SPLIT' ? t('dashboard.statusSplit') : t('dashboard.statusDraft')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
