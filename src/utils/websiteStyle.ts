import { useEffect, useState } from 'react';

export type WebsiteStyle = 'classic' | 'desktop-dark' | 'desktop-glass';
export type WebsiteAccent = 'blue' | 'purple' | 'slate';
export type WebsiteDensity = 'comfortable' | 'compact';

export interface WebsiteStyleSettings {
  style: WebsiteStyle;
  accent: WebsiteAccent;
  density: WebsiteDensity;
}

const WEBSITE_STYLE_STORAGE_KEY = 'simplifystruct.websiteStyle.v1';

const DEFAULT_SETTINGS: WebsiteStyleSettings = {
  style: 'desktop-glass',
  accent: 'blue',
  density: 'comfortable',
};

const isWebsiteStyle = (value: unknown): value is WebsiteStyle =>
  value === 'classic' || value === 'desktop-dark' || value === 'desktop-glass';

const isWebsiteAccent = (value: unknown): value is WebsiteAccent =>
  value === 'blue' || value === 'purple' || value === 'slate';

const isWebsiteDensity = (value: unknown): value is WebsiteDensity =>
  value === 'comfortable' || value === 'compact';

export const getWebsiteStyleSettings = (): WebsiteStyleSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(WEBSITE_STYLE_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<WebsiteStyleSettings>;

    return {
      style: isWebsiteStyle(parsed.style) ? parsed.style : DEFAULT_SETTINGS.style,
      accent: isWebsiteAccent(parsed.accent) ? parsed.accent : DEFAULT_SETTINGS.accent,
      density: isWebsiteDensity(parsed.density) ? parsed.density : DEFAULT_SETTINGS.density,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const applyWebsiteStyleSettings = (settings: WebsiteStyleSettings) => {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.websiteStyle = settings.style;
  document.documentElement.dataset.websiteAccent = settings.accent;
  document.documentElement.dataset.websiteDensity = settings.density;
  document.body.dataset.websiteStyle = settings.style;
  document.body.dataset.websiteAccent = settings.accent;
  document.body.dataset.websiteDensity = settings.density;
};

export const saveWebsiteStyleSettings = (settings: WebsiteStyleSettings) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(WEBSITE_STYLE_STORAGE_KEY, JSON.stringify(settings));
  applyWebsiteStyleSettings(settings);
  window.dispatchEvent(new CustomEvent<WebsiteStyleSettings>('simplifystruct:website-style-change', { detail: settings }));
};

export const useWebsiteStyleSettings = () => {
  const [settings, setSettings] = useState<WebsiteStyleSettings>(() => getWebsiteStyleSettings());

  useEffect(() => {
    applyWebsiteStyleSettings(settings);

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<WebsiteStyleSettings>;
      setSettings(customEvent.detail || getWebsiteStyleSettings());
    };

    window.addEventListener('simplifystruct:website-style-change', handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
      window.removeEventListener('simplifystruct:website-style-change', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  const updateSettings = (patch: Partial<WebsiteStyleSettings>) => {
    const nextSettings = {
      ...settings,
      ...patch,
    };
    setSettings(nextSettings);
    saveWebsiteStyleSettings(nextSettings);
  };

  return {
    settings,
    updateSettings,
    isClassic: settings.style === 'classic',
    isDesktopDark: settings.style === 'desktop-dark',
    isDesktopGlass: settings.style === 'desktop-glass',
    isDesktopStyle: settings.style === 'desktop-dark' || settings.style === 'desktop-glass',
  };
};
