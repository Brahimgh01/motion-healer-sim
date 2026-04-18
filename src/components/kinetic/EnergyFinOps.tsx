import { Leaf, DollarSign, Layers } from "lucide-react";

interface EnergyFinOpsProps {
  aliveCount: number;
  passes: number;
  deliveries: number;
  tenants: number;
  overlap: number; // 0..1
}

// Rough simulation-grade estimates inspired by §4.3 & §5 of the report.
// Per-fragment per-pass OEO regen energy budget (joules) — simulation constant.
const J_PER_FRAG_PASS = 0.00045;
// Equivalent S3-Standard cost avoided per delivered reconstruction (USD).
const USD_PER_DELIVERY = 0.000023;

export function EnergyFinOps({
  aliveCount,
  passes,
  deliveries,
  tenants,
  overlap,
}: EnergyFinOpsProps) {
  const joules = aliveCount * passes * J_PER_FRAG_PASS;
  const kwh = joules / 3.6e6;
  const savedUsd = deliveries * USD_PER_DELIVERY;
  // Multi-tenant efficiency multiplier from §4.3:
  //   M(T, s) = T / (1 + (T - 1)(1 - s))
  // At T=100, s=0.4 → ~1.66×
  const multiplier = tenants / (1 + (tenants - 1) * (1 - overlap));

  return (
    <div className="panel rounded-md p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Leaf className="h-3.5 w-3.5 text-[hsl(var(--neon-green))]" />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Energy &amp; FinOps
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono-display">
        <div className="border border-border/40 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            kWh used
          </div>
          <div className="text-[hsl(var(--neon-green))] text-sm text-glow-green">
            {kwh < 0.001 ? kwh.toExponential(2) : kwh.toFixed(4)}
          </div>
        </div>
        <div className="border border-border/40 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5" /> Saved
          </div>
          <div className="text-[hsl(var(--neon-gold))] text-sm text-glow-gold">
            ${savedUsd.toFixed(6)}
          </div>
        </div>
      </div>

      <div className="border border-border/40 rounded p-2">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-2.5 w-2.5" /> Multi-Tenant Multiplier
          </span>
          <span>
            T={tenants} · s={(overlap * 100).toFixed(0)}%
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="font-mono-display text-xl text-[hsl(var(--neon-cyan))] text-glow-cyan">
            {multiplier.toFixed(2)}×
          </div>
          <div className="text-[9px] text-muted-foreground">
            vs static replication
          </div>
        </div>
        <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-[hsl(var(--neon-cyan))] transition-all"
            style={{
              width: `${Math.min(100, (multiplier / 2) * 100)}%`,
              boxShadow: "0 0 8px hsl(var(--neon-cyan))",
            }}
          />
        </div>
      </div>

      <div className="text-[9px] text-muted-foreground/70 leading-relaxed">
        Model: M(T,s) = T / (1 + (T−1)(1−s)) · §4.3
      </div>
    </div>
  );
}
