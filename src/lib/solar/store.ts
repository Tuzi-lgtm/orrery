import { create } from "zustand";
import type { BodyId, ScaleMode } from "./bodies";

export interface SolarState {
  paused: boolean;
  speed: number;
  selectedId: BodyId | null;
  focusGen: number;
  showTrails: boolean;
  showLabels: boolean;
  hintVisible: boolean;
  scaleMode: ScaleMode;
  muted: boolean;
  togglePause: () => void;
  setPaused: (value: boolean) => void;
  setSpeed: (value: number) => void;
  select: (id: BodyId | null) => void;
  setShowTrails: (value: boolean) => void;
  setShowLabels: (value: boolean) => void;
  setScaleMode: (value: ScaleMode) => void;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
  dismissHint: () => void;
}

export const useSolar = create<SolarState>((set) => ({
  paused: false,
  speed: 1,
  selectedId: null,
  focusGen: 0,
  showTrails: true,
  showLabels: true,
  hintVisible: true,
  scaleMode: "visual",
  muted: true,
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  select: (selectedId) =>
    set((s) => ({
      selectedId,
      focusGen: s.focusGen + 1,
      hintVisible: false,
    })),
  setShowTrails: (showTrails) => set({ showTrails }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setScaleMode: (scaleMode) =>
    set((s) => ({
      scaleMode,
      selectedId: null,
      focusGen: s.focusGen + 1,
    })),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  dismissHint: () => set({ hintVisible: false }),
}));

export const simTimeRef = { current: 0 };

export const bodyWorldPos = new Map<
  BodyId,
  { x: number; y: number; z: number }
>();