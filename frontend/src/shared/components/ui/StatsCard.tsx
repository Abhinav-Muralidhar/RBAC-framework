import React from 'react';
import { cn } from '@shared/lib/utils';

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  trend?: 'up' | 'down';
  trendValue?: string | number;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';
  onClick?: () => void;
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'indigo',
  onClick
}: StatsCardProps) {
  const colors = {
    indigo: {
      glow: 'bg-sky-400/25',
      icon: 'bg-sky-100 text-sky-700',
      text: 'text-sky-700',
      ring: 'ring-sky-100'
    },
    emerald: {
      glow: 'bg-emerald-400/25',
      icon: 'bg-emerald-100 text-emerald-700',
      text: 'text-emerald-700',
      ring: 'ring-emerald-100'
    },
    amber: {
      glow: 'bg-amber-400/30',
      icon: 'bg-amber-100 text-amber-700',
      text: 'text-amber-700',
      ring: 'ring-amber-100'
    },
    rose: {
      glow: 'bg-rose-400/30',
      icon: 'bg-rose-100 text-rose-700',
      text: 'text-rose-700',
      ring: 'ring-rose-100'
    },
    violet: {
      glow: 'bg-cyan-400/25',
      icon: 'bg-cyan-100 text-cyan-700',
      text: 'text-cyan-700',
      ring: 'ring-cyan-100'
    }
  };

  const colorSet = colors[color] || colors.indigo;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-[0_32px_60px_-30px_rgba(15,23,42,0.35)]',
        onClick && 'cursor-pointer'
      )}
    >
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl', colorSet.glow)} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className={cn('text-3xl font-extrabold tracking-[-0.03em]', colorSet.text)}>{value}</p>
          {trend && (
            <p className={cn(
              'text-xs font-semibold',
              trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl ring-8',
            colorSet.ring,
            colorSet.icon
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
