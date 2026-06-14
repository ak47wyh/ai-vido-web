import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { Users, Image as ImageIcon, BookOpen, Settings, ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpace } from '../contexts/SpaceContext';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSpaceId } = useSpace();

  // Space-aware counts
  const characterCount = useLiveQuery(
    () => currentSpaceId ? db.characters.where('spaceId').equals(currentSpaceId).count() : 0,
    [currentSpaceId]
  ) ?? 0;
  const backgroundCount = useLiveQuery(
    () => currentSpaceId ? db.backgrounds.where('spaceId').equals(currentSpaceId).count() : 0,
    [currentSpaceId]
  ) ?? 0;
  const storyCount = useLiveQuery(
    () => currentSpaceId ? db.stories.where('spaceId').equals(currentSpaceId).count() : 0,
    [currentSpaceId]
  ) ?? 0;

  // Space-aware video task stats: only count tasks for stories in current space
  const spaceVideoTaskStats = useLiveQuery(async () => {
    if (!currentSpaceId) return { success: 0, failed: 0, processing: 0, total: 0 };
    const spaceStories = await db.stories.where('spaceId').equals(currentSpaceId).toArray();
    const storyIds = new Set(spaceStories.map(s => s.id));
    const allSegments = await db.segments.toArray();
    const spaceSegmentIds = new Set(allSegments.filter(seg => storyIds.has(seg.storyId)).map(seg => seg.id));
    const allTasks = await db.videoTasks.toArray();
    const spaceTasks = allTasks.filter(t => spaceSegmentIds.has(t.segmentId));
    return {
      success: spaceTasks.filter(t => t.status === 'SUCCESS').length,
      failed: spaceTasks.filter(t => t.status === 'FAILED').length,
      processing: spaceTasks.filter(t => t.status === 'PROCESSING' || t.status === 'PENDING').length,
      total: spaceTasks.length
    };
  }, [currentSpaceId]);

  const taskStats = spaceVideoTaskStats ?? { success: 0, failed: 0, processing: 0, total: 0 };

  // Recent stories in current space
  const recentStories = useLiveQuery(
    () => currentSpaceId
      ? db.stories.where('spaceId').equals(currentSpaceId).reverse().sortBy('createdAt').then(arr => arr.slice(0, 3))
      : [],
    [currentSpaceId]
  );

  const steps = [
    {
      icon: <Users size={24} />,
      title: t('dashboard.step1Title'),
      desc: t('dashboard.step1Desc'),
      count: characterCount,
      countLabel: t('dashboard.charactersCount'),
      path: '/characters',
      color: '#6366f1'
    },
    {
      icon: <ImageIcon size={24} />,
      title: t('dashboard.step2Title'),
      desc: t('dashboard.step2Desc'),
      count: backgroundCount,
      countLabel: t('dashboard.backgroundsCount'),
      path: '/backgrounds',
      color: '#ec4899'
    },
    {
      icon: <BookOpen size={24} />,
      title: t('dashboard.step3Title'),
      desc: t('dashboard.step3Desc'),
      count: storyCount,
      countLabel: t('dashboard.storiesCount'),
      path: '/workbench',
      color: '#f59e0b'
    },
    {
      icon: <Settings size={24} />,
      title: t('dashboard.step4Title'),
      desc: t('dashboard.step4Desc'),
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
    <div>
      <div className="page-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.welcome')}</p>
      </div>

      {/* Workflow guide cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
        {steps.map((step) => (
          <div
            key={step.path}
            className="glass-panel interactive"
            style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => navigate(step.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                background: `${step.color}20`, color: step.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {step.icon}
              </div>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>{step.title}</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              {step.desc}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {step.count !== null && (
                <span style={{ fontSize: '0.8rem', color: step.color, fontWeight: 600 }}>
                  {step.count} {step.countLabel}
                </span>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                {t('dashboard.go')} <ArrowRight size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Stats row: Video task stats + Recent stories */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        {/* Video task stats */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('dashboard.videoStats')}</h3>
          {taskStats.total === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>{t('dashboard.noVideoStats')}</p>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.1)' }}>
              <CheckCircle size={24} color="#34d399" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{taskStats.success}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.statusSuccess')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(248,113,113,0.1)' }}>
              <XCircle size={24} color="#f87171" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{taskStats.failed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.statusFailed')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(251,191,36,0.1)' }}>
              <Clock size={24} color="#fbbf24" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{taskStats.processing}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.statusProcessing')}</div>
            </div>
          </div>
          )}
        </div>

        {/* Recent stories */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('dashboard.recentStories')}</h3>
          {(!recentStories || recentStories.length === 0) ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('dashboard.noStories')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentStories.map(s => (
                <div
                  key={s.id}
                  className="glass-panel interactive"
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-panel)', cursor: 'pointer',
                    border: '1px solid var(--border-color)'
                  }}
                  onClick={() => handleStoryClick(s.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: '999px',
                    fontSize: '0.7rem', fontWeight: 600,
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
  );
};
