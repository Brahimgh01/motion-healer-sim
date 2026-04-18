interface AnchorVaultProps {
  count: number;
  capacity: number;
  active: boolean;
}

export function AnchorVault({ count, capacity, active }: AnchorVaultProps) {
  const fill = (count / capacity) * 100;
  return (
    <div className="panel rounded-md p-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
        <span>Anchor Persistence Vault</span>
        <span className="font-mono-display text-[hsl(var(--neon-gold))]">SSD-NVME</span>
      </div>
      <div
        className="relative rounded-md border border-[hsl(var(--neon-gold)/0.4)] p-3 h-28 overflow-hidden"
        style={{
          background: "var(--gradient-vault)",
          animation: active ? "vault-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      >
        {/* SSD chip grid */}
        <div className="absolute inset-2 grid grid-cols-5 gap-1.5 opacity-80">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm border border-[hsl(var(--neon-gold)/0.3)]"
              style={{
                background:
                  i < count
                    ? "linear-gradient(180deg, hsl(var(--neon-gold) / 0.6), hsl(var(--neon-gold) / 0.2))"
                    : "hsl(var(--background) / 0.6)",
                boxShadow: i < count ? "0 0 8px hsl(var(--neon-gold) / 0.7)" : undefined,
                transition: "all 0.4s ease",
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-mono-display">
        <span className="text-muted-foreground">SEED 5%</span>
        <span className="text-[hsl(var(--neon-gold))] text-glow-gold">
          {count} / {capacity}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-[hsl(var(--neon-gold))] transition-all duration-300"
          style={{ width: `${fill}%`, boxShadow: "0 0 8px hsl(var(--neon-gold))" }}
        />
      </div>
    </div>
  );
}
