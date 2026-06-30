export type ThemeId = 'dark' | 'light' | 'blue';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  icon: string;
  previewColors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'dark',
    name: '深邃暗夜',
    icon: '🌙',
    previewColors: {
      primary: '#6366f1',
      secondary: '#ec4899',
      background: '#0a0a0f',
      surface: 'rgba(255,255,255,0.05)',
    },
  },
  {
    id: 'light',
    name: '简约日光',
    icon: '☀️',
    previewColors: {
      primary: '#6366f1',
      secondary: '#ec4899',
      background: '#f8fafc',
      surface: 'rgba(255,255,255,0.85)',
    },
  },
  {
    id: 'blue',
    name: '静谧蓝海',
    icon: '🌊',
    previewColors: {
      primary: '#3b82f6',
      secondary: '#06b6d4',
      background: '#0c1929',
      surface: 'rgba(30,58,95,0.6)',
    },
  },
];
