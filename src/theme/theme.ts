export type StageCircumstanceTheme = 'stage_dark' | 'stage_light' | 'studio_slate';

export interface ThemeConfig {
  id: StageCircumstanceTheme;
  name: string;
  shortName: string;
  emoji: string;
  subtitle: string;
  description: string;
  isDark: boolean;
  colors: {
    bgApp: string;
    bgPanel: string;
    bgHeader: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentMuted: string;
    border: string;
    stageBg: string;
    stageText: string;
    stageTextActive: string;
    stageChordBg: string;
    stageChordText: string;
    stageChordBorder: string;
  };
}

export const STAGE_THEMES: Record<StageCircumstanceTheme, ThemeConfig> = {
  stage_dark: {
    id: 'stage_dark',
    name: 'Scène Sombre (Dark Stage)',
    shortName: 'Scène Sombre',
    emoji: '🕶️',
    subtitle: 'Anti-éblouissement live',
    description: 'Fond anthracite profond (#121214) avec textes blanc pur et accents jaune ambré (#FFB300). Idéal en club ou salle sombre.',
    isDark: true,
    colors: {
      bgApp: '#121214',
      bgPanel: '#18181c',
      bgHeader: '#141418',
      bgCard: '#1d1d23',
      textPrimary: '#ffffff',
      textSecondary: '#d1d5db',
      textMuted: '#9ca3af',
      accent: '#FFB300',
      accentMuted: '#b45309',
      border: '#2a2a34',
      stageBg: '#121214',
      stageText: '#ffffff',
      stageTextActive: '#FFB300',
      stageChordBg: '#1c1917',
      stageChordText: '#fbbf24',
      stageChordBorder: '#78350f',
    },
  },
  stage_light: {
    id: 'stage_light',
    name: 'Scène Extérieure (Plein Soleil)',
    shortName: 'Plein Soleil',
    emoji: '☀️',
    subtitle: 'Contraste maximal anti-reflets',
    description: 'Fond blanc pur avec écritures noires ultra épaisses pour contrer les reflets du soleil en festival extérieur.',
    isDark: false,
    colors: {
      bgApp: '#f8fafc',
      bgPanel: '#ffffff',
      bgHeader: '#f1f5f9',
      bgCard: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#1e293b',
      textMuted: '#475569',
      accent: '#d97706',
      accentMuted: '#f59e0b',
      border: '#cbd5e1',
      stageBg: '#ffffff',
      stageText: '#000000',
      stageTextActive: '#000000',
      stageChordBg: '#fef3c7',
      stageChordText: '#000000',
      stageChordBorder: '#000000',
    },
  },
  studio_slate: {
    id: 'studio_slate',
    name: 'Répétition / Studio (Slate Gray)',
    shortName: 'Studio Ardoise',
    emoji: '🎭',
    subtitle: 'Reposant & élégant',
    description: 'Bleu nuit et gris ardoise reposant (#0f172a / #1e293b) pour les longues sessions de répétition et de studio.',
    isDark: true,
    colors: {
      bgApp: '#0f172a',
      bgPanel: '#1e293b',
      bgHeader: '#111e36',
      bgCard: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentMuted: '#0284c7',
      border: '#334155',
      stageBg: '#0f172a',
      stageText: '#f8fafc',
      stageTextActive: '#38bdf8',
      stageChordBg: '#1e293b',
      stageChordText: '#38bdf8',
      stageChordBorder: '#0ea5e9',
    },
  },
};
