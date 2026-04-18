interface Entry {
  hash: string;
  tenant: number;
  node: number;
  status: "OK" | "LOST" | "ANCHOR" | "HEAL";
}

const tenantColor = (t: number) =>
  t === 0 ? "text-[hsl(var(--tenant-blue))]" : t === 1 ? "text-[hsl(var(--tenant-green))]" : "text-[hsl(var(--tenant-purple))]";

const statusColor = (s: Entry["status"]) => {
  switch (s) {
    case "OK": return "text-[hsl(var(--neon-cyan))]";
    case "LOST": return "text-[hsl(var(--neon-red))]";
    case "ANCHOR": return "text-[hsl(var(--neon-gold))]";
    case "HEAL": return "text-[hsl(var(--neon-green))]";
  }
};

export function FingerprintIndex({ entries }: { entries: Entry[] }) {
  return (
    <div className="panel rounded-md p-3 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
        <span>Fingerprint Index</span>
        <span className="font-mono-display text-[hsl(var(--neon-cyan))]">{entries.length} REC</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden font-mono-display text-[10.5px] space-y-0.5">
        {entries.slice(0, 14).map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-2 border-b border-border/30 py-0.5">
            <span className="text-muted-foreground/80 truncate">{e.hash}</span>
            <span className={tenantColor(e.tenant)}>T{e.tenant}</span>
            <span className="text-muted-foreground">N{String(e.node).padStart(2, "0")}</span>
            <span className={`${statusColor(e.status)} text-[9px] font-bold w-12 text-right`}>{e.status}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-muted-foreground/50 text-center py-6">— no fragments registered —</div>
        )}
      </div>
    </div>
  );
}
