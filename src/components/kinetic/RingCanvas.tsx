import { useEffect, useRef } from "react";
import type { Fragment, SimPhase } from "./types";

interface RingCanvasProps {
  fragments: Fragment[];
  phase: SimPhase;
  healerPulse: number; // 0..1
  countdown: number; // seconds remaining during failure
  vaultPos: { x: number; y: number }; // normalized -0.5..1.5
  nodes: number;
}

const TENANT_COLORS = [
  "hsl(210, 100%, 60%)", // blue
  "hsl(142, 90%, 55%)", // green
  "hsl(280, 95%, 70%)", // purple
];
const GOLD = "hsl(45, 100%, 60%)";

export function RingCanvas({ fragments, phase, healerPulse, countdown, vaultPos, nodes }: RingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep latest props in refs so the rAF loop reads fresh values without re-running the effect.
  const fragmentsRef = useRef(fragments);
  const phaseRef = useRef(phase);
  const healerPulseRef = useRef(healerPulse);
  const countdownRef = useRef(countdown);
  const vaultPosRef = useRef(vaultPos);
  const nodesRef = useRef(nodes);
  fragmentsRef.current = fragments;
  phaseRef.current = phase;
  healerPulseRef.current = healerPulse;
  countdownRef.current = countdown;
  vaultPosRef.current = vaultPos;
  nodesRef.current = nodes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const fragments = fragmentsRef.current;
      const phase = phaseRef.current;
      const healerPulse = healerPulseRef.current;
      const countdown = countdownRef.current;
      const vaultPos = vaultPosRef.current;
      const nodes = nodesRef.current;

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.36;

      const dimmed = phase === "blackout";
      const ringAlpha = dimmed ? 0.08 : phase === "failing" ? 0.4 : 0.7;

      // outer faint ring
      ctx.strokeStyle = `hsla(180, 100%, 50%, ${ringAlpha * 0.25})`;
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // main glowing ring
      const grad = ctx.createRadialGradient(cx, cy, radius - 10, cx, cy, radius + 10);
      grad.addColorStop(0, `hsla(180, 100%, 60%, ${ringAlpha * 0.05})`);
      grad.addColorStop(0.5, `hsla(180, 100%, 60%, ${ringAlpha})`);
      grad.addColorStop(1, `hsla(180, 100%, 60%, ${ringAlpha * 0.05})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // tick marks between nodes
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(a) * (radius - 4);
        const y1 = cy + Math.sin(a) * (radius - 4);
        const x2 = cx + Math.cos(a) * (radius + 4);
        const y2 = cy + Math.sin(a) * (radius + 4);
        ctx.strokeStyle = `hsla(180, 100%, 60%, ${ringAlpha * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Nodes
      for (let i = 0; i < nodes; i++) {
        const a = (i / nodes) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + Math.cos(a) * radius;
        const ny = cy + Math.sin(a) * radius;
        const isOrigin = i === 0;
        const isHealer = i === 5; // 0-indexed Node 6

        let color = "hsl(180, 100%, 65%)";
        let glow = 14;
        if (isOrigin) {
          color = "hsl(210, 100%, 65%)";
          glow = 22;
        } else if (isHealer) {
          color = "hsl(142, 90%, 60%)";
          glow = 18 + healerPulse * 30;
        }
        if (dimmed && !isHealer && !isOrigin) {
          color = "hsl(195, 30%, 25%)";
          glow = 0;
        }

        ctx.shadowBlur = glow;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(nx, ny, isOrigin || isHealer ? 11 : 7, 0, Math.PI * 2);
        ctx.fill();

        // inner core
        ctx.shadowBlur = 0;
        ctx.fillStyle = "hsla(0,0%,100%,0.85)";
        ctx.beginPath();
        ctx.arc(nx, ny, isOrigin || isHealer ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        // labels
        ctx.shadowBlur = 0;
        ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center";
        const lx = cx + Math.cos(a) * (radius + 26);
        const ly = cy + Math.sin(a) * (radius + 26);
        ctx.fillStyle = "hsla(180, 60%, 80%, 0.65)";
        ctx.fillText(`N${String(i + 1).padStart(2, "0")}`, lx, ly);

        if (isOrigin) {
          ctx.fillStyle = "hsl(210, 100%, 75%)";
          ctx.font = "bold 10px ui-monospace, monospace";
          ctx.fillText("ORIGIN SERVER", lx, ly + 12);
        }
        if (isHealer) {
          ctx.fillStyle = "hsl(142, 90%, 70%)";
          ctx.font = "bold 10px ui-monospace, monospace";
          ctx.fillText("HEALER", lx, ly + 12);
        }
      }

      // Healer pulse ring
      if (healerPulse > 0) {
        const ha = (5 / nodes) * Math.PI * 2 - Math.PI / 2;
        const hx = cx + Math.cos(ha) * radius;
        const hy = cy + Math.sin(ha) * radius;
        ctx.strokeStyle = `hsla(142, 90%, 60%, ${healerPulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, 14 + healerPulse * 30, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Vault target position (in pixel coords)
      const vx = vaultPos.x * w;
      const vy = vaultPos.y * h;

      // Fragments
      for (const f of fragments) {
        if (!f.alive && f.vaultProgress === undefined && f.rebornProgress === undefined) continue;

        let px: number, py: number;
        const baseColor = f.kind === "anchor" ? GOLD : TENANT_COLORS[f.tenant];

        if (f.vaultProgress !== undefined) {
          // moving from ring to vault
          const a = f.angle;
          const rx = cx + Math.cos(a) * radius;
          const ry = cy + Math.sin(a) * radius;
          const t = f.vaultProgress;
          // bezier-ish
          px = rx + (vx - rx) * t;
          py = ry + (vy - ry) * t - Math.sin(t * Math.PI) * 40;
        } else if (f.rebornProgress !== undefined) {
          const a = f.angle;
          const rx = cx + Math.cos(a) * radius;
          const ry = cy + Math.sin(a) * radius;
          const t = f.rebornProgress;
          px = vx + (rx - vx) * t;
          py = vy + (ry - vy) * t - Math.sin(t * Math.PI) * 40;
        } else {
          px = cx + Math.cos(f.angle) * radius;
          py = cy + Math.sin(f.angle) * radius;
        }

        const size = f.kind === "anchor" ? 3.2 : 2.2;
        const blur = f.kind === "anchor" ? 12 : 6;
        ctx.shadowBlur = blur;
        ctx.shadowColor = baseColor;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Countdown overlay
      if (phase === "failing" || phase === "blackout") {
        ctx.font = "bold 64px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = phase === "blackout" ? "hsla(0, 95%, 60%, 0.9)" : "hsla(45, 100%, 60%, 0.9)";
        ctx.shadowBlur = 30;
        ctx.shadowColor = phase === "blackout" ? "hsl(0, 95%, 60%)" : "hsl(45, 100%, 60%)";
        const txt = phase === "blackout" ? "BLACKOUT" : countdown.toFixed(1);
        ctx.fillText(txt, cx, cy - 8);
        ctx.font = "11px ui-monospace, monospace";
        ctx.shadowBlur = 0;
        ctx.fillStyle = "hsla(180, 60%, 80%, 0.7)";
        ctx.fillText(phase === "failing" ? "UPS COUNTDOWN — ANCHORING SEED" : "AWAITING RESTORE", cx, cy + 36);
      } else {
        ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "hsla(180, 60%, 70%, 0.5)";
        ctx.fillText("KINETIC BUFFER · L2.5", cx, cy - 6);
        ctx.fillText("DATA IN MOTION", cx, cy + 8);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
