import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  colorVar?: string;
  trend?: string;
}

export function StatCard({ icon, label, value, sublabel, colorVar = '--accent', trend }: StatCardProps) {
  const color = `var(${colorVar})`;
  const bg = `var(${colorVar}-bg)`;
  const bd = `var(${colorVar}-bd)`;

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 hover-lift" style={{ borderColor: bd }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform duration-300 hover:scale-110" style={{ background: bg, color }}>{icon}</div>
        {trend && <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color, background: bg }}>{trend}</span>}
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-app mb-1 tracking-tight">{value}</div>
      <div className="text-sm text-sub font-medium">{label}</div>
      {sublabel && <div className="text-xs text-dim mt-1">{sublabel}</div>}
    </div>
  );
}
