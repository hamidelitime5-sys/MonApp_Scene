import React, { createContext, useContext, useState, useEffect } from 'react';
import { StageCircumstanceTheme, ThemeConfig, STAGE_THEMES } from '../theme/theme';

export type { StageCircumstanceTheme };

interface ThemeContextType {
  theme: StageCircumstanceTheme;
  themeConfig: ThemeConfig;
  setTheme: (theme: StageCircumstanceTheme) => void;
  cycleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'stage_dark',
  themeConfig: STAGE_THEMES.stage_dark,
  setTheme: () => {},
  cycleTheme: () => {},
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<StageCircumstanceTheme>(() => {
    try {
      const saved = localStorage.getItem('hamide_stage_theme') || localStorage.getItem('app_theme_mode');
      if (saved === 'stage_light' || saved === 'light') return 'stage_light';
      if (saved === 'studio_slate') return 'studio_slate';
      return 'stage_dark';
    } catch {
      return 'stage_dark';
    }
  });

  const themeConfig = STAGE_THEMES[theme] || STAGE_THEMES.stage_dark;

  const setTheme = (newTheme: StageCircumstanceTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('hamide_stage_theme', newTheme);
      // Keep legacy key synced for compatibility
      localStorage.setItem('app_theme_mode', newTheme === 'stage_light' ? 'light' : 'dark');
    } catch (e) {
      console.warn('Could not persist theme to localStorage', e);
    }
  };

  const cycleTheme = () => {
    if (theme === 'stage_dark') {
      setTheme('stage_light');
    } else if (theme === 'stage_light') {
      setTheme('studio_slate');
    } else {
      setTheme('stage_dark');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const isDark = themeConfig.isDark;

    // Clean previous theme classes
    root.classList.remove('theme-stage-dark', 'theme-stage-light', 'theme-studio-slate', 'light-theme', 'dark-theme');

    // Add active theme class
    root.classList.add(`theme-${theme.replace('_', '-')}`);

    if (isDark) {
      root.classList.add('dark');
      root.classList.add('dark-theme');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light-theme');
      root.style.colorScheme = 'light';
    }

    // Apply global CSS custom properties for instant styling
    root.style.setProperty('--color-bg-app', themeConfig.colors.bgApp);
    root.style.setProperty('--color-bg-panel', themeConfig.colors.bgPanel);
    root.style.setProperty('--color-bg-header', themeConfig.colors.bgHeader);
    root.style.setProperty('--color-bg-card', themeConfig.colors.bgCard);
    root.style.setProperty('--color-text-primary', themeConfig.colors.textPrimary);
    root.style.setProperty('--color-text-secondary', themeConfig.colors.textSecondary);
    root.style.setProperty('--color-text-muted', themeConfig.colors.textMuted);
    root.style.setProperty('--color-accent', themeConfig.colors.accent);
    root.style.setProperty('--color-border', themeConfig.colors.border);
    root.style.setProperty('--color-stage-bg', themeConfig.colors.stageBg);
    root.style.setProperty('--color-stage-text', themeConfig.colors.stageText);
    root.style.setProperty('--color-stage-text-active', themeConfig.colors.stageTextActive);
  }, [theme, themeConfig]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig,
        setTheme,
        cycleTheme,
        isDark: themeConfig.isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
