import type { LucideIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export type ViewSwitcherOption = {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type ViewSwitcherProps = {
  value: string;
  onChange: (value: string) => void;
  options: ViewSwitcherOption[];
  className?: string;
};

export function ViewSwitcher({ value, onChange, options, className }: ViewSwitcherProps) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'group rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200',
              active
                ? 'border-sky-200 bg-sky-50 shadow-[0_18px_30px_-24px_rgba(14,165,233,0.45)]'
                : 'border-slate-200/80 bg-white/85 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white'
            )}
          >
            <div className="flex items-start gap-3">
              {Icon ? (
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
                    active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className={cn('text-sm font-semibold', active ? 'text-sky-800' : 'text-slate-900')}>
                  {option.label}
                </div>
                {option.description ? (
                  <p className={cn('mt-1 text-xs leading-5', active ? 'text-sky-700/90' : 'text-slate-500')}>
                    {option.description}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
