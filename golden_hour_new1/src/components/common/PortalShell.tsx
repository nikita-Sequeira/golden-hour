import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type PortalAccent = 'teal' | 'blue' | 'violet' | 'red' | 'gold';

const ACCENT: Record<PortalAccent, { hero: string; chip: string; bar: string }> = {
  teal: { hero: 'gh-accent-teal', chip: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30', bar: 'bg-emerald-400' },
  blue: { hero: 'gh-accent-blue', chip: 'bg-blue-400/20 text-blue-200 border-blue-300/30', bar: 'bg-blue-400' },
  violet: { hero: 'gh-accent-violet', chip: 'bg-violet-400/20 text-violet-200 border-violet-300/30', bar: 'bg-violet-400' },
  red: { hero: 'gh-accent-red', chip: 'bg-rose-400/20 text-rose-200 border-rose-300/30', bar: 'bg-rose-400' },
  gold: { hero: 'gh-accent-gold', chip: 'bg-amber-400/20 text-amber-200 border-amber-300/30', bar: 'bg-amber-400' },
};

export interface PortalNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  alert?: boolean;
}

interface PortalShellProps {
  accent: PortalAccent;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  nav?: PortalNavItem[];
  activeNav?: string;
  onNav?: (id: string) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared app frame for the staff portals: a control rail on the left, work area on the right. */
export const PortalShell: React.FC<PortalShellProps> = ({
  accent,
  icon: Icon,
  title,
  subtitle,
  status,
  nav,
  activeNav,
  onNav,
  actions,
  children,
}) => {
  const a = ACCENT[accent];
  return (
    <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] gap-5 lg:gap-7 items-start">
      <aside className={`gh-hero ${a.hero} p-5 lg:sticky lg:top-24 flex flex-col gap-5`}>
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${a.chip}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold leading-tight break-words">{title}</h2>
            {subtitle && <p className="text-sm text-slate-300 mt-1 leading-snug">{subtitle}</p>}
          </div>
        </div>

        {status && <div className="text-sm">{status}</div>}

        {nav && nav.length > 0 && (
          <nav aria-label={`${title} sections`} className="flex lg:flex-col gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 lg:pb-0">
            {nav.map((item) => {
              const active = item.id === activeNav;
              const NavIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNav?.(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative shrink-0 flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl text-sm font-semibold text-left transition-colors cursor-pointer min-h-[48px] ${
                    active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {active && <span className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full ${a.bar}`} />}
                  <NavIcon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {item.alert && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
                  {item.badge !== undefined && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/15 tabular-nums">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {actions && <div className="flex flex-wrap lg:flex-col gap-2 lg:mt-auto lg:pt-2">{actions}</div>}
      </aside>

      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
};

export const ShellButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'ghost' | 'primary' | 'danger' }
> = ({ tone = 'ghost', className = '', children, ...rest }) => {
  const cls =
    tone === 'primary'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : tone === 'danger'
      ? 'bg-rose-600 text-white animate-pulse'
      : 'bg-white/10 hover:bg-white/15 border border-white/15 text-white';
  return (
    <button
      type="button"
      {...rest}
      className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px] flex-1 lg:flex-none ${cls} ${className}`}
    >
      {children}
    </button>
  );
};
