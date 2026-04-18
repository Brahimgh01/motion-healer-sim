import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Activity, Power, RotateCw, Zap, Cpu, ShieldCheck, Download } from "lucide-react";
import { RingCanvas } from "@/components/kinetic/RingCanvas";
import { StatPanel } from "@/components/kinetic/StatPanel";
import { FingerprintIndex } from "@/components/kinetic/FingerprintIndex";
import { AnchorVault } from "@/components/kinetic/AnchorVault";
import type { Fragment, SimPhase, TenantId } from "@/components/kinetic/types";

const NODES = 12;
const TARGET = 200;
const ANCHOR_COUNT = 10; // 5%
const BASE_SPEED = 0.0018; // rad/ms

const randHash = () => {
  const c = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * 16)];
  return s;
};

let nextId = 1;
const makeFragment = (tenant: TenantId, angle: number): Fragment => ({
  id: nextId++,
  tenant,
  angle,
  speed: BASE_SPEED * (0.92 + Math.random() * 0.16),
  alive: true,
  kind: "normal",
  hash: randHash(),
});

const Index = () => {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const fragmentsRef = useRef<Fragment[]>([]);
  fragmentsRef.current = fragments;

  const [phase, setPhase] = useState<SimPhase>("idle");
  const phaseRef = useRef<SimPhase>("idle");
  phaseRef.current = phase;

  const [lossRate, setLossRate] = useState(2); // % per loop
  const lossRef = useRef(lossRate);
  lossRef.current = lossRate;

  const [cumulativeLoss, setCumulativeLoss] = useState(0);
  const [healed, setHealed] = useState(0);
  const [ups, setUps] = useState(100);
  const [countdown, setCountdown] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [healerPulse, setHealerPulse] = useState(0);
  const healerPulseRef = useRef(0);
  const [reconstructProgress, setReconstructProgress] = useState(0);
  const reconstructProgressRef = useRef(0);
  const [reconstructCollected, setReconstructCollected] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const [fingerprints, setFingerprints] = useState<
    { hash: string; tenant: number; node: number; status: "OK" | "LOST" | "ANCHOR" | "HEAL" }[]
  >([]);

  const lastTimeRef = useRef<number>(performance.now());
  const lastNodeIdxRef = useRef<Map<number, number>>(new Map());
  const fpTickRef = useRef(0);

  const aliveCount = fragments.filter((f) => f.alive).length;
  const dataHealth = phase === "blackout" ? 0 : Math.min(100, Math.round((aliveCount / TARGET) * 100));

  const initialize = useCallback(() => {
    const newFrags: Fragment[] = [];
    for (let i = 0; i < TARGET; i++) {
      const tenant = (i % 3) as TenantId;
      const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2); // start near origin (top)
      newFrags.push(makeFragment(tenant, angle));
    }
    nextId = TARGET + 1;
    setFragments(newFrags);
    setCumulativeLoss(0);
    setHealed(0);
    setUps(100);
    setVaultCount(0);
    setFingerprints([]);
    lastNodeIdxRef.current = new Map();
    setPhase("running");
  }, []);

  const reset = useCallback(() => {
    setFragments([]);
    setPhase("idle");
    setCumulativeLoss(0);
    setHealed(0);
    setUps(100);
    setVaultCount(0);
    setFingerprints([]);
    setCountdown(0);
    reconstructProgressRef.current = 0;
    setReconstructProgress(0);
    setReconstructCollected(0);
    setDeliveries(0);
  }, []);

  // Failure trigger
  const triggerFailure = useCallback(() => {
    if (phaseRef.current !== "running") return;
    // Mark 10 alive fragments as anchors
    setFragments((prev) => {
      const alive = prev.filter((f) => f.alive);
      const chosen = new Set<number>();
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(ANCHOR_COUNT, shuffled.length); i++) {
        chosen.add(shuffled[i].id);
      }
      return prev.map((f) =>
        chosen.has(f.id) ? { ...f, kind: "anchor" as const, vaultProgress: 0 } : f,
      );
    });
    setPhase("failing");
    setCountdown(5);
    setUps(100);
  }, []);

  const restore = useCallback(() => {
    if (phaseRef.current !== "blackout") return;
    setPhase("restoring");
    setFragments((prev) =>
      prev
        .filter((f) => f.kind === "anchor")
        .map((f) => ({ ...f, alive: true, rebornProgress: 0, vaultProgress: undefined })),
    );
  }, []);

  // Client request: Healer collects k=148 fragments, reconstructs via FEC, delivers payload
  const requestData = useCallback(() => {
    if (phaseRef.current !== "running") return;
    if (reconstructProgressRef.current > 0) return;
    reconstructProgressRef.current = 0.001;
    setReconstructProgress(0.001);
    setReconstructCollected(0);
    healerPulseRef.current = 1;
  }, []);
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(50, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const ph = phaseRef.current;

      if (ph === "running" || ph === "failing" || ph === "restoring") {
        const speedMul = ph === "failing" ? 0.3 : 1;

        let lostThisTick = 0;
        let healedThisTick = 0;
        const newFingerprints: typeof fingerprints = [];

        setFragments((prev) => {
          const next = prev.map((f) => {
            // Vault travel during failure
            if (ph === "failing" && f.vaultProgress !== undefined && f.vaultProgress < 1) {
              const np = Math.min(1, f.vaultProgress + dt / 2500);
              return { ...f, vaultProgress: np };
            }
            // Reborn travel during restore
            if (ph === "restoring" && f.rebornProgress !== undefined && f.rebornProgress < 1) {
              const np = Math.min(1, f.rebornProgress + dt / 1800);
              return { ...f, rebornProgress: np };
            }

            if (!f.alive) return f;
            // Don't move anchors that are already in the vault
            if (ph === "failing" && f.kind === "anchor" && (f.vaultProgress ?? 0) >= 1) return f;

            // Advance angle
            let newAngle = f.angle + f.speed * dt * speedMul;
            if (newAngle > Math.PI) newAngle -= Math.PI * 2;

            // Detect node crossing
            const segment = (Math.PI * 2) / NODES;
            const idx = Math.floor(((newAngle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / segment);
            const prevIdx = lastNodeIdxRef.current.get(f.id);
            if (prevIdx !== undefined && prevIdx !== idx) {
              // crossed a node — apply loss
              if (ph === "running" && f.kind === "normal") {
                const p = lossRef.current / 100 / NODES; // distribute per hop
                if (Math.random() < p) {
                  lostThisTick++;
                  if (Math.random() < 0.4) {
                    newFingerprints.push({
                      hash: f.hash,
                      tenant: f.tenant,
                      node: idx + 1,
                      status: "LOST",
                    });
                  }
                  return { ...f, alive: false };
                }
              }
            }
            lastNodeIdxRef.current.set(f.id, idx);
            return { ...f, angle: newAngle };
          });

          // Vault arrivals
          if (ph === "failing") {
            const arrived = next.filter(
              (f) => f.kind === "anchor" && (f.vaultProgress ?? 0) >= 1,
            ).length;
            setVaultCount(arrived);
          }

          // Healing in running phase
          if (ph === "running") {
            const aliveNow = next.filter((f) => f.alive).length;
            const deficit = TARGET - aliveNow;
            // Heal up to a small batch per tick when fragments pass near healer
            if (deficit > 0) {
              // Heal probabilistically each tick, paced
              const healPerTick = Math.min(deficit, Math.ceil((deficit * dt) / 400));
              if (healPerTick > 0) {
                healedThisTick += healPerTick;
                healerPulseRef.current = 1;
                // revive dead ones from the back
                let revived = 0;
                for (let i = next.length - 1; i >= 0 && revived < healPerTick; i--) {
                  if (!next[i].alive && next[i].kind === "normal") {
                    next[i] = {
                      ...next[i],
                      alive: true,
                      angle: -Math.PI / 2 + (5 / NODES) * Math.PI * 2 + (Math.random() * 0.2 - 0.1),
                      hash: randHash(),
                    };
                    revived++;
                    if (Math.random() < 0.3) {
                      newFingerprints.push({
                        hash: next[i].hash,
                        tenant: next[i].tenant,
                        node: 6,
                        status: "HEAL",
                      });
                    }
                  }
                }
              }
            }
          }

          // Restore phase: when anchors return, regrow missing 190
          if (ph === "restoring") {
            const arrivedAnchors = next.filter(
              (f) => f.kind === "anchor" && (f.rebornProgress ?? 0) >= 1,
            );
            if (arrivedAnchors.length === ANCHOR_COUNT) {
              // Aggressively regrow fragments from healer
              const aliveNow = next.filter((f) => f.alive).length;
              const deficit = TARGET - aliveNow;
              if (deficit > 0) {
                healerPulseRef.current = 1;
                const grow = Math.min(deficit, Math.ceil((deficit * dt) / 80));
                for (let i = 0; i < grow; i++) {
                  const tenant = (next.length % 3) as TenantId;
                  const newF = makeFragment(
                    tenant,
                    -Math.PI / 2 + (5 / NODES) * Math.PI * 2 + (Math.random() * 0.3 - 0.15),
                  );
                  next.push(newF);
                  healedThisTick++;
                  if (Math.random() < 0.2) {
                    newFingerprints.push({
                      hash: newF.hash,
                      tenant: newF.tenant,
                      node: 6,
                      status: "HEAL",
                    });
                  }
                }
              } else {
                // done — clear reborn flags and resume running
                for (let i = 0; i < next.length; i++) {
                  if (next[i].rebornProgress !== undefined) {
                    next[i] = { ...next[i], rebornProgress: undefined, kind: "normal" };
                  }
                }
                setVaultCount(0);
                setPhase("running");
              }
            }
          }

          return next;
        });

        if (lostThisTick > 0) setCumulativeLoss((c) => c + lostThisTick);
        if (healedThisTick > 0) setHealed((h) => h + healedThisTick);

        // healer pulse decay
        healerPulseRef.current = Math.max(0, healerPulseRef.current - dt / 600);
        setHealerPulse(healerPulseRef.current);

        // Fingerprints (throttled)
        fpTickRef.current += dt;
        if (fpTickRef.current > 250) {
          fpTickRef.current = 0;
          if (newFingerprints.length === 0 && (ph === "running")) {
            // sample a random alive fragment as OK
            const alive = fragmentsRef.current.filter((f) => f.alive);
            if (alive.length > 0) {
              const f = alive[Math.floor(Math.random() * alive.length)];
              const segment = (Math.PI * 2) / NODES;
              const idx =
                Math.floor(((f.angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / segment) + 1;
              newFingerprints.push({ hash: f.hash, tenant: f.tenant, node: idx, status: "OK" });
            }
          }
          if (newFingerprints.length > 0) {
            setFingerprints((prev) => [...newFingerprints, ...prev].slice(0, 30));
          }
        }
      }

      // Countdown handling
      if (phaseRef.current === "failing") {
        setCountdown((c) => {
          const nc = Math.max(0, c - dt / 1000);
          setUps(Math.round((nc / 5) * 100));
          if (nc <= 0) {
            // transition to blackout — kill all non-anchors
            setFragments((prev) =>
              prev.map((f) =>
                f.kind === "anchor" ? f : { ...f, alive: false },
              ),
            );
            setPhase("blackout");
          }
          return nc;
        });
      }

      // UPS recharge while not draining (running / restoring / idle after restore)
      if (phaseRef.current === "running" || phaseRef.current === "restoring" || phaseRef.current === "idle") {
        setUps((u) => (u >= 100 ? 100 : Math.min(100, u + dt / 80)));
      }

      // Reconstruction progress — Healer collects k=148 then beams to client
      if (reconstructProgressRef.current > 0 && reconstructProgressRef.current < 1) {
        const np = Math.min(1, reconstructProgressRef.current + dt / 2200);
        reconstructProgressRef.current = np;
        setReconstructProgress(np);
        // Collected symbols climb during 0..0.5
        const collected = np < 0.5 ? Math.floor((np / 0.5) * 148) : 148;
        setReconstructCollected(collected);
        if (np >= 1) {
          reconstructProgressRef.current = 0;
          setReconstructProgress(0);
          setReconstructCollected(0);
          setDeliveries((d) => d + 1);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tenantCounts = useMemo(() => {
    const counts = [0, 0, 0];
    fragments.forEach((f) => {
      if (f.alive) counts[f.tenant]++;
    });
    return counts;
  }, [fragments]);

  return (
    <div className="min-h-screen bg-background text-foreground grid-bg relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(195 100% 30% / 0.12), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-border/40 panel">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded border border-[hsl(var(--neon-cyan)/0.5)] flex items-center justify-center bg-secondary">
            <Activity className="h-4 w-4 text-[hsl(var(--neon-cyan))] text-glow-cyan" />
          </div>
          <div>
            <h1 className="font-mono-display text-base tracking-widest text-[hsl(var(--neon-cyan))] text-glow-cyan">
              KINETIC&nbsp;BUFFER · L2.5
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Dynamic Data Circulation Layer · Live Simulation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono-display text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--neon-green))] animate-pulse" />
            <span className="text-muted-foreground">SyncE</span>
            <span className="text-[hsl(var(--neon-green))]">LOCKED</span>
          </div>
          <div className="text-muted-foreground">RaptorQ ρ=1.35</div>
          <div className="text-muted-foreground">12 NODES · 3 TENANTS</div>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-12 gap-3 p-3 lg:h-[calc(100vh-57px)]">
        {/* LEFT: Real-time stats */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0 order-2 lg:order-none">
          <StatPanel
            label="Data Health"
            value={dataHealth}
            unit="%"
            tone={dataHealth > 80 ? "green" : dataHealth > 30 ? "gold" : "red"}
            bar={dataHealth}
            hint={`${aliveCount} / ${TARGET} fragments live`}
          />
          <StatPanel
            label="Active Fragments"
            value={aliveCount}
            tone="cyan"
            hint={`T0 ${tenantCounts[0]} · T1 ${tenantCounts[1]} · T2 ${tenantCounts[2]}`}
          />
          <StatPanel
            label="UPS Battery"
            value={ups}
            unit="%"
            tone={ups > 50 ? "green" : ups > 20 ? "gold" : "red"}
            bar={ups}
            hint={phase === "failing" ? "DRAINING — anchoring seed" : "Standby"}
          />
          <StatPanel
            label="Cumulative Loss"
            value={cumulativeLoss}
            tone="red"
            hint={`${healed} fragments healed · ${lossRate}% link loss`}
          />

          <div className="panel rounded-md p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Tenant Distribution
            </div>
            <div className="space-y-1.5">
              {(["Tenant 0 · Blue", "Tenant 1 · Green", "Tenant 2 · Purple"] as const).map(
                (label, i) => {
                  const colors = ["tenant-blue", "tenant-green", "tenant-purple"];
                  const total = tenantCounts.reduce((a, b) => a + b, 0) || 1;
                  const pct = (tenantCounts[i] / total) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[10px] font-mono-display">
                        <span className={`text-[hsl(var(--${colors[i]}))]`}>{label}</span>
                        <span className="text-muted-foreground">{tenantCounts[i]}</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: `hsl(var(--${colors[i]}))`,
                            boxShadow: `0 0 6px hsl(var(--${colors[i]}))`,
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="panel rounded-md p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Link Loss Rate
            </div>
            <Slider
              value={[lossRate]}
              onValueChange={(v) => setLossRate(v[0])}
              min={0}
              max={20}
              step={0.5}
            />
            <div className="flex justify-between text-[11px] font-mono-display">
              <span className="text-muted-foreground">0%</span>
              <span className="text-[hsl(var(--neon-cyan))] text-glow-cyan">
                {lossRate.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">20%</span>
            </div>
          </div>
        </aside>

        {/* CENTER: Ring */}
        <main className="col-span-12 lg:col-span-6 panel rounded-md relative overflow-hidden scan-line min-h-[560px] lg:min-h-0 order-first lg:order-none">
          <div className="absolute top-3 left-4 z-10 font-mono-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            CIRCULATION RING · 12 NODES
          </div>
          <div className="absolute top-3 right-4 z-10 font-mono-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--neon-cyan))]" />
              PHASE: <span className="text-[hsl(var(--neon-cyan))]">{phase.toUpperCase()}</span>
            </span>
            <span className="text-muted-foreground">DELIVERED: <span className="text-[hsl(var(--neon-green))]">{deliveries}</span></span>
          </div>

          {/* Canvas area — explicit height so it never collapses below controls */}
          <div className="relative w-full h-[460px] lg:h-[calc(100%-72px)]">
            <RingCanvas
              fragments={fragments}
              phase={phase}
              healerPulse={healerPulse}
              countdown={countdown}
              vaultPos={{ x: 1.08, y: 0.5 }}
              nodes={NODES}
              reconstructProgress={reconstructProgress}
              reconstructCollected={reconstructCollected}
            />
          </div>

          {/* Bottom controls */}
          <div className="relative lg:absolute lg:bottom-0 left-0 right-0 p-3 flex flex-wrap items-center justify-center gap-2 border-t border-border/40 bg-background/60 backdrop-blur">
            <Button
              onClick={initialize}
              disabled={phase !== "idle"}
              className="font-mono-display tracking-wider bg-[hsl(var(--neon-cyan))] text-primary-foreground hover:bg-[hsl(var(--neon-cyan)/0.85)]"
              style={{ boxShadow: "var(--shadow-neon)" }}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              INITIALIZE
            </Button>
            <Button
              onClick={requestData}
              disabled={phase !== "running" || reconstructProgress > 0}
              className="font-mono-display tracking-wider bg-[hsl(var(--neon-green))] text-accent-foreground hover:bg-[hsl(var(--neon-green)/0.85)]"
              style={{ boxShadow: "var(--shadow-green)" }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              REQUEST DATA
            </Button>
            <Button
              onClick={triggerFailure}
              disabled={phase !== "running"}
              variant="destructive"
              className="font-mono-display tracking-wider"
              style={{ boxShadow: "0 0 18px hsl(var(--neon-red) / 0.5)" }}
            >
              <Power className="h-4 w-4 mr-1.5" />
              GRID POWER FAILURE
            </Button>
            <Button
              onClick={restore}
              disabled={phase !== "blackout"}
              className="font-mono-display tracking-wider bg-[hsl(var(--neon-green))] text-accent-foreground hover:bg-[hsl(var(--neon-green)/0.85)]"
              style={{ boxShadow: "var(--shadow-green)" }}
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              RESTORE & REGROW
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              className="font-mono-display tracking-wider border-border/60"
            >
              <RotateCw className="h-4 w-4 mr-1.5" />
              RESET
            </Button>
          </div>
        </main>

        {/* RIGHT: AI Manager */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0 order-3 lg:order-none">
          <div className="panel rounded-md p-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[hsl(var(--neon-cyan))]" />
              <div>
                <div className="font-mono-display text-sm text-glow-cyan text-[hsl(var(--neon-cyan))] tracking-wider">
                  AI MANAGEMENT CONSOLE
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Fragment Manager · v0.9
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono-display">
              <div className="border border-border/40 rounded p-2">
                <div className="text-muted-foreground">DEDUP</div>
                <div className="text-[hsl(var(--neon-green))]">ACTIVE</div>
              </div>
              <div className="border border-border/40 rounded p-2">
                <div className="text-muted-foreground">FEC k/n</div>
                <div className="text-[hsl(var(--neon-cyan))]">148/200</div>
              </div>
            </div>
          </div>

          <FingerprintIndex entries={fingerprints} />

          <AnchorVault
            count={vaultCount}
            capacity={ANCHOR_COUNT}
            active={phase === "failing" || phase === "blackout"}
          />
        </aside>
      </div>
    </div>
  );
};

export default Index;
