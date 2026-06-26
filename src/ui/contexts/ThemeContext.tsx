import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

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

interface ThemeContextValue {
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeConfig[];
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const config = ApiConfigStore.load();
    return (config.theme as ThemeId) || 'dark';
  });
  const [isLoading, setIsLoading] = useState(false);

  // 应用主题到 document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback((theme: ThemeId) => {
    setIsLoading(true);
    try {
      const config = ApiConfigStore.load();
      ApiConfigStore.save({ ...config, theme });
      setCurrentTheme(theme);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: THEMES, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}