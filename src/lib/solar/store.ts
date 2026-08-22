import { create } from "zustand";
import type { BodyId, ScaleMode } from "./bodies";

export interface SolarState {
  paused: boolean;
  speed: number;
  selectedId: BodyId | null;
  focusGen: number;
  showTrails: boolean;
  showLabels: boolean;
  showWorldList: boolean;
  hintVisible: boolean;
  scaleMode: ScaleMode;
  muted: boolean;
  galaxyView: boolean;
  sgrASelected: boolean;
  togglePause: () => void;
  setPaused: (value: boolean) => void;
  setSpeed: (value: number) => void;
  select: (id: BodyId | null) => void;
  setShowTrails: (value: boolean) => void;
  setShowLabels: (value: boolean) => void;
  setShowWorldList: (value: boolean) => void;
  setScaleMode: (value: ScaleMode) => void;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
  setGalaxyView: (value: boolean) => void;
  selectSgrA: (value: boolean) => void;
  dismissHint: () => void;
}

export const useSolar = create<SolarState>((set) => ({
  paused: false,
  speed: 1,
  selectedId: null,
  focusGen: 0,
  showTrails: true,
  showLabels: true,
  showWorldList: true,
  hintVisible: true,
  scaleMode: "visual",
  muted: true,
  galaxyView: false,
  sgrASelected: false,
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  select: (selectedId) =>
    set((s) => ({
      selectedId,
      galaxyView: false,
      sgrASelected: false,
      focusGen: s.focusGen + 1,
      hintVisible: false,
    })),
  setShowTrails: (showTrails) => set({ showTrails }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowWorldList: (showWorldList) => set({ showWorldList }),
  setScaleMode: (scaleMode) =>
    set((s) => ({
      scaleMode,
      galaxyView: false,
      sgrASelected: false,
      selectedId: null,
      focusGen: s.focusGen + 1,
    })),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setGalaxyView: (galaxyView) =>
    set((s) => ({
      galaxyView,
      sgrASelected: false,
      selectedId: galaxyView ? null : s.selectedId,
      focusGen: s.focusGen + 1,
      hintVisible: false,
    })),
  selectSgrA: (sgrASelected) =>
    set((s) => ({
      sgrASelected,
      selectedId: null,
      galaxyView: true,
      focusGen: s.focusGen + 1,
      hintVisible: false,
    })),
  dismissHint: () => set({ hintVisible: false }),
}));

export const simTimeRef = { current: 0 };
export const galaxyTimeRef = { current: 0 };
/** Simulated Myr per real second at 1× while in galaxy view. */
export const GALAXY_MYR_PER_SEC = 1;

export const bodyWorldPos = new Map<
  BodyId,
  { x: number; y: number; z: number }
>();