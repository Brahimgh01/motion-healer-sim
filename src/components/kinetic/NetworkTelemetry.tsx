import { Radio, Gauge } from "lucide-react";

interface NetworkTelemetryProps {
  passes: number;
  aliveCount: number;
  target: number;
  lossRate: number; // % per loop
  nodes: number;
}

// k=148, n=200 → loss tolerance = 1 - 148/200 = 26%
const K = 148;
const N_SYM = 200;
const LOSS_TOLERANCE = 1 - K / N_SYM;

export function NetworkTelemetry({
  passes,
  aliveCount,
  target,
  lossRate,
  nodes,
}: NetworkTelemetryProps) {
  // Predicted survivors via (1 - p)^(N·c), p as per-hop probability.
  const p = lossRate / 100 / nodes; // approximate per-hop
  const predicted = Math.round(target * Math.pow(1 - p, nodes * passes));

  const observedLossPct = ((target - aliveCount) / target) * 100;
  const tolerancePct = LOSS_TOLERANCE * 100;
  const headroom = Math.max(0, tolerancePct - observedLossPct);
  const breached = observedLossPct > tolerancePct;

  return (
    <div className="panel rounded-md p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-[hsl(var(--neon-cyan))]" />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Network Telemetry
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono-display text-[10px]">
        <div className="border border-border/40 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Circulation Passes
          </div>
          <div className="text-[hsl(var(--neon-cyan))] text-sm text-glow-cyan">
            {passes}
          </div>
        </div>
        <div className="border border-border/40 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Predicted Alive
          </div>
          <div className="text-[hsl(var(--neon-green))] text-sm">
            {predicted}
            <span className="text-[9px] text-muted-foreground ml-1">
              / obs {aliveCount}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-border/40 rounded p-2">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="h-2.5 w-2.5" /> FEC Loss Tolerance
          </span>
          <span>
            k={K}/n={N_SYM}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between font-mono-display">
          <span
            className={
              breached
                ? "text-[hsl(var(--neon-red))] text-glow-red text-sm"
                : "text-[hsl(var(--neon-green))] text-glow-green text-sm"
            }
          >
            {observedLossPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            limit {tolerancePct.toFixed(0)}%
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden relative">
          <div
            className={`h-full transition-all ${
              breached
                ? "bg-[hsl(var(--neon-red))]"
                : "bg-[hsl(var(--neon-green))]"
            }`}
            style={{
              width: `${Math.min(100, observedLossPct)}%`,
              boxShadow: breached
                ? "0 0 8px hsl(var(--neon-red))"
                : "0 0 8px hsl(var(--neon-green))",
            }}
          />
          <div
            className="absolute top-0 h-full w-px bg-[hsl(var(--neon-gold))]"
            style={{
              left: `${tolerancePct}%`,
              boxShadow: "0 0 6px hsl(var(--neon-gold))",
            }}
          />
        </div>
        <div className="mt-1 text-[9px] text-muted-foreground/70">
          Headroom: {headroom.toFixed(1)}% · Reconstruct iff R ≥ k
        </div>
      </div>

      <div className="text-[9px] text-muted-foreground/70 leading-relaxed">
        E[alive] = F·(1−p)^(N·c) · §4.1
      </div>
    </div>
  );
}
