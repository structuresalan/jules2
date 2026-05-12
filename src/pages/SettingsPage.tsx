import React from 'react';
import { Monitor, Palette, Sparkles, SlidersHorizontal } from 'lucide-react';
import { type WebsiteAccent, type WebsiteDensity, type WebsiteStyle, useWebsiteStyleSettings } from '../utils/websiteStyle';

const styleOptions: Array<{
  value: WebsiteStyle;
  title: string;
  description: string;
}> = [
  {
    value: 'classic',
    title: 'Classic',
    description: 'Clean light interface with the original SimplifyStruct feel.',
  },
  {
    value: 'desktop-dark',
    title: 'Desktop Dark',
    description: 'Dark app shell with solid desktop-style panels.',
  },
  {
    value: 'desktop-glass',
    title: 'Desktop Dark + Glass',
    description: 'Premium Fireflies-style dark glass, glow, and desktop-window panels.',
  },
];

const accentOptions: Array<{ value: WebsiteAccent; title: string }> = [
  { value: 'blue', title: 'Blue' },
  { value: 'purple', title: 'Purple' },
  { value: 'slate', title: 'Slate' },
];

const densityOptions: Array<{ value: WebsiteDensity; title: string }> = [
  { value: 'comfortable', title: 'Comfortable' },
  { value: 'compact', title: 'Compact' },
];

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, isDesktopStyle } = useWebsiteStyleSettings();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isDesktopStyle ? 'ss-glass text-white' : 'bg-blue-50 text-blue-600'}`}>
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <h1 className={`text-3xl font-bold tracking-tight ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-900'}`}>
              Settings
            </h1>
            <p className={`mt-2 ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>
              Customize the SimplifyStruct website style and workspace feel.
            </p>
          </div>
        </div>
      </div>

      <section className={`relative overflow-hidden rounded-3xl border p-6 ${isDesktopStyle ? 'ss-glass-strong' : 'border-gray-200 bg-white shadow-sm'}`}>
        {isDesktopStyle && (
          <>
            <span className="ss-orb -left-12 top-4 h-40 w-40 bg-blue-500/20" />
            <span className="ss-orb right-12 top-10 h-44 w-44 bg-purple-500/20" />
          </>
        )}

        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <Sparkles className={isDesktopStyle ? 'ss-accent' : 'text-blue-600'} size={22} />
            <div>
              <h2 className={`text-xl font-bold ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-900'}`}>Website Style</h2>
              <p className={`text-sm ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>
                Pick the overall interface style. The dark glass option is inspired by premium desktop apps.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {styleOptions.map((option) => {
              const active = settings.style === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => updateSettings({ style: option.value })}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? isDesktopStyle
                        ? 'border-blue-300/60 bg-white/15 shadow-2xl shadow-blue-950/20'
                        : 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                      : isDesktopStyle
                        ? 'border-white/10 bg-white/5 hover:bg-white/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-blue-600 text-white' : isDesktopStyle ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Monitor size={20} />
                    </div>
                    {active && <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Active</span>}
                  </div>
                  <h3 className={`font-bold ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-900'}`}>{option.title}</h3>
                  <p className={`mt-2 text-sm ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${isDesktopStyle ? 'ss-glass' : 'border-gray-200 bg-white shadow-sm'}`}>
        <div className="mb-5 flex items-center gap-3">
          <Palette className={isDesktopStyle ? 'ss-accent' : 'text-blue-600'} size={22} />
          <div>
            <h2 className={`text-xl font-bold ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-900'}`}>Accent & Density</h2>
            <p className={`text-sm ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>Fine tune the app feel.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className={`mb-3 text-sm font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-500'}`}>Accent Color</h3>
            <div className="flex flex-wrap gap-2">
              {accentOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateSettings({ accent: option.value })}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    settings.accent === option.value
                      ? 'border-blue-400 bg-blue-600 text-white'
                      : isDesktopStyle
                        ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className={`mb-3 text-sm font-bold uppercase tracking-wide ${isDesktopStyle ? 'ss-text-muted' : 'text-gray-500'}`}>Density</h3>
            <div className="flex flex-wrap gap-2">
              {densityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateSettings({ density: option.value })}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    settings.density === option.value
                      ? 'border-blue-400 bg-blue-600 text-white'
                      : isDesktopStyle
                        ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`overflow-hidden rounded-3xl border ${isDesktopStyle ? 'ss-glass-strong' : 'border-gray-200 bg-white shadow-sm'}`}>
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className={`text-xl font-bold ${isDesktopStyle ? 'ss-text-primary' : 'text-gray-900'}`}>Preview</h2>
          <p className={`mt-1 text-sm ${isDesktopStyle ? 'ss-text-secondary' : 'text-gray-500'}`}>
            The selected style is applied immediately across the app.
          </p>
        </div>
        <div className="relative p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-amber-500/10" />
          <div className={`relative mx-auto max-w-3xl rounded-[2rem] border p-5 ${isDesktopStyle ? 'border-white/15 bg-black/25 shadow-2xl' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-8 flex gap-2">
              <span className="ss-window-dot bg-red-400" />
              <span className="ss-window-dot bg-amber-300" />
              <span className="ss-window-dot bg-green-400" />
            </div>
            <div className="mx-auto flex w-fit gap-3 rounded-3xl border border-white/20 bg-white/10 p-3">
              {['Steel', 'Docs', 'Map', 'Review', 'Print'].map((label) => (
                <div key={label} className="rounded-2xl bg-black/40 px-4 py-3 text-sm font-bold text-white shadow">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
