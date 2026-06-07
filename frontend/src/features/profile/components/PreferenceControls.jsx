import React from 'react';
import { Check } from 'lucide-react';

/**
 * Small, presentational building blocks for the Settings page. Kept dependency-free (just lucide +
 * Tailwind) so they match the existing "Hospital OS" look without introducing a UI library.
 */

// A labeled row that hosts any control on the right. The whole row is the visual unit.
export function SettingRow({ icon: Icon, title, description, children, htmlFor }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <label htmlFor={htmlFor} className="flex items-start gap-3 min-w-0 cursor-default">
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">{title}</span>
          {description && <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{description}</span>}
        </span>
      </label>
      <div className="shrink-0 sm:pl-4">{children}</div>
    </div>
  );
}

// iOS-style toggle. `accent` is a hex used for the "on" state so it can track the user's accent.
export function Toggle({ id, checked, onChange, accent = '#4f46e5' }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 ${
        checked ? '' : 'bg-slate-200'
      }`}
      style={checked ? { backgroundColor: accent } : undefined}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Segmented control for small enumerations (e.g. 24h / 12h, density).
export function Segmented({ value, onChange, options, accent = '#4f46e5' }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition-all duration-200 ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            style={active ? { color: accent } : undefined}
          >
            {opt.icon && <opt.icon className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Accent color swatches with a check on the active one.
export function AccentPicker({ value, onChange, accents }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {Object.entries(accents).map(([key, { label, hex }]) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 ${
              active ? 'ring-2 ring-offset-2 ring-slate-300' : ''
            }`}
            style={{ backgroundColor: hex }}
          >
            {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

// A section card with an icon header — mirrors the existing Card look on ProfilePage.
export function SettingsCard({ icon: Icon, title, description, accent = '#4f46e5', children }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

// Radio-style picker for clock face selection
export function RadioPicker({ value, onChange, options, accent = '#4f46e5' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-bold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              active
                ? 'border-transparent text-white shadow-sm'
                : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
            style={active ? { backgroundColor: accent, borderColor: accent } : undefined}
          >
            {opt.icon && <opt.icon className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
