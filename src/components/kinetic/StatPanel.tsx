import { ReactNode } from "react";

interface StatPanelProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "cyan" | "green" | "gold" | "red";
  bar?: number; // 0-100
}

const toneMap: Record<NonNullable<StatPanelProps["tone"]>, string> = {
  cyan: "text-glow-cyan text-[hsl(var(--neon-cyan))]",
  green: "text-glow-green text-[hsl(var(--neon-green))]",
  gold: "text-glow-gold text-[hsl(var(--neon-gold))]",
  red: "text-glow-red text-[hsl(var(--neon-red))]",
};

const barMap: Record<NonNullable<StatPanelProps["tone"]>, string> = {
  cyan: "bg-[hsl(var(--neon-cyan))]",
  green: "bg-[hsl(var(--neon-green))]",
  gold: "bg-[hsl(var(--neon-gold))]",
  red: "bg-[hsl(var(--neon-red))]",
};

export function StatPanel({ label, value, unit, hint, tone = "cyan", bar }: StatPanelProps) {
  return (
    <div className="panel rounded-md p-3 relative overflow-hidden">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--neon-cyan))] animate-pulse" />
      </div>
      <div className={`mt-1 font-mono-display text-2xl font-semibold ${toneMap[tone]}`}>
        {value}
        {unit && <span className="text-xs ml-1 opacity-70">{unit}</span>}
      </div>
      {bar !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${barMap[tone]}`}
            style={{ width: `${Math.max(0, Math.min(100, bar))}%`, boxShadow: `0 0 10px hsl(var(--neon-${tone === 'cyan' ? 'cyan' : tone}))` }}
          />
        </div>
      )}
      {hint && <div className="mt-1 text-[10px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}
