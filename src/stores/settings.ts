import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  userName: string;
  theme: ThemeMode;
  dailyGoalMin: number;
  animations: boolean;
  sounds: boolean;
  gamification: boolean;
  preferredDifficulty: 'auto' | 1 | 2 | 3;
  fontScale: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  cours0Mode: 'essentiel' | 'complet';
  examQuestions: number;
  examMinutes: number;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  theme: 'system',
  dailyGoalMin: 30,
  animations: true,
  sounds: false,
  gamification: true,
  preferredDifficulty: 'auto',
  fontScale: 'normal',
  highContrast: false,
  cours0Mode: 'essentiel',
  examQuestions: 20,
  examMinutes: 30,
  onboarded: false,
};

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

/** Préférences simples : localStorage (les données d'apprentissage sont dans IndexedDB). */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'ece-study-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _s, reset: _r, ...rest }) => rest,
    },
  ),
);

export function pickSettings(s: SettingsState): Settings {
  const { set: _s, reset: _r, ...rest } = s;
  return rest;
}

export function sanitizeSettings(raw: unknown): Partial<Settings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[key])
      (out as Record<string, unknown>)[key] = v;
    if (key === 'preferredDifficulty' && (v === 'auto' || v === 1 || v === 2 || v === 3))
      out.preferredDifficulty = v;
  }
  return out;
}
