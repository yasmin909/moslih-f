interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  colorVar?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 7,
  colorVar = '--accent',
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = `var(${colorVar})`;
  const gradId = `ring-${colorVar.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-soft)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight" style={{ color }}>{percentage}%</span>
        {label && <span className="text-[11px] text-dim mt-0.5 font-medium">{label}</span>}
        {sublabel && <span className="text-[10px] text-dim">{sublabel}</span>}
      </div>
    </div>
  );
}
