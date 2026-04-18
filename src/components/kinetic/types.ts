export type TenantId = 0 | 1 | 2;
export type FragmentKind = "normal" | "anchor";

export interface Fragment {
  id: number;
  tenant: TenantId;
  angle: number; // radians around the ring
  speed: number; // radians per ms
  alive: boolean;
  kind: FragmentKind;
  // For vault travel during failure
  vaultProgress?: number; // 0..1 path from ring to vault
  rebornProgress?: number; // 0..1 path from vault back to ring
  hash: string;
}

export type SimPhase =
  | "idle"
  | "running"
  | "failing" // UPS countdown, anchors move to vault
  | "blackout" // ring dark, only vault stores anchors
  | "restoring"; // anchors return + healer regrows
