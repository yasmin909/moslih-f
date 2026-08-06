interface ProgressBarProps {
  percentage: number;
  colorVar?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ percentage, colorVar, height = 6, showLabel = false }: ProgressBarProps) {
  const resolveColor = () => {
    if (colorVar) return `var(${colorVar})`;
    if (percentage >= 75) return 'var(--st-done)';
    if (percentage >= 50) return 'var(--st-prog)';
    if (percentage >= 25) return 'var(--c-amber)';
    return 'var(--st-late)';
  };
  const c = resolveColor();

  return (
    <div className="w-full">
      <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--border-soft)' }}>
        <div className="h-full rounded-full transition-all duration-1000 ease-out progress-anim" style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${c}, ${c}99)` }} />
      </div>
      {showLabel && <div className="text-xs text-dim mt-1 text-left">{percentage}%</div>}
    </div>
  );
}
