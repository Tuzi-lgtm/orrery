import {
  Eye,
  EyeOff,
  List,
  Locate,
  Orbit,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { BODIES, EARTH, KIND_LABEL, type BodyId } from "@/lib/solar/bodies";
import {
  playFocusWhoosh,
  setSoundEnabled,
  setSoundFocus,
  setSoundSpeed,
} from "@/lib/solar/audio";
import { galaxyTimeRef, simTimeRef, useSolar } from "@/lib/solar/store";
import { cn } from "@/lib/utils";
import { AuthChip } from "./auth-chip";

/** Shared by the slider and the [ ] keys so the two cannot drift apart. */
const MIN_SPEED = 0.25;
const MAX_SPEED = 16;

export function Hud() {
  const paused = useSolar((s) => s.paused);
  const speed = useSolar((s) => s.speed);
  const selectedId = useSolar((s) => s.selectedId);
  const showTrails = useSolar((s) => s.showTrails);
  const showLabels = useSolar((s) => s.showLabels);
  const showWorldList = useSolar((s) => s.showWorldList);
  const hintVisible = useSolar((s) => s.hintVisible);
  const scaleMode = useSolar((s) => s.scaleMode);
  const muted = useSolar((s) => s.muted);
  const galaxyView = useSolar((s) => s.galaxyView);
  const sgrASelected = useSolar((s) => s.sgrASelected);
  const focusGen = useSolar((s) => s.focusGen);
  const togglePause = useSolar((s) => s.togglePause);
  const setSpeed = useSolar((s) => s.setSpeed);
  const select = useSolar((s) => s.select);
  const setShowTrails = useSolar((s) => s.setShowTrails);
  const setShowLabels = useSolar((s) => s.setShowLabels);
  const setShowWorldList = useSolar((s) => s.setShowWorldList);
  const setScaleMode = useSolar((s) => s.setScaleMode);
  const toggleMuted = useSolar((s) => s.toggleMuted);
  const setGalaxyView = useSolar((s) => s.setGalaxyView);
  const selectSgrA = useSolar((s) => s.selectSgrA);

  useEffect(() => {
    void setSoundEnabled(!muted);
  }, [muted]);

  useEffect(() => {
    if (muted) return;
    setSoundFocus(selectedId);
    setSoundSpeed(speed);
  }, [muted, selectedId, speed]);

  useEffect(() => {
    if (!muted && focusGen > 0) playFocusWhoosh();
  }, [focusGen, muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Ctrl+L, Cmd+M and friends belong to the browser, not to us.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "Escape") {
        if (sgrASelected) selectSgrA(false);
        else if (galaxyView) setGalaxyView(false);
        else select(null);
      } else if (e.key === "[") {
        setSpeed(Math.max(MIN_SPEED, speed / 2));
      } else if (e.key === "]") {
        setSpeed(Math.min(MAX_SPEED, speed * 2));
      } else if (e.key === "m" || e.key === "M") {
        toggleMuted();
      } else if (e.key === "l" || e.key === "L") {
        setShowWorldList(!showWorldList);
      } else if (e.key === "g" || e.key === "G") {
        setGalaxyView(!galaxyView);
      } else if (e.key === "0") {
        select("sun");
      } else if (e.key >= "1" && e.key <= "8") {
        const planet = BODIES[Number(e.key)];
        if (planet) select(planet.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galaxyView, select, selectSgrA, setGalaxyView, setShowWorldList, setSpeed, sgrASelected, showWorldList, speed, toggleMuted, togglePause]);

  const selected = selectedId ? BODIES.find((b) => b.id === selectedId) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <header className="pointer-events-auto flex items-start justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div>
          <h1 className="font-display text-3xl leading-none tracking-tight sm:text-4xl">
            Orrery
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-surface p-0.5 shadow-[var(--shadow-border)]">
              <button
                type="button"
                onClick={() => setScaleMode("visual")}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[0.65rem] font-medium tracking-[0.12em] uppercase transition-colors duration-150",
                  scaleMode === "visual" && !galaxyView
                    ? "bg-fg text-accent-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                Orrery
              </button>
              <button
                type="button"
                onClick={() => setScaleMode("true")}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[0.65rem] font-medium tracking-[0.12em] uppercase transition-colors duration-150",
                  scaleMode === "true" && !galaxyView
                    ? "bg-fg text-accent-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                True size
              </button>
            </div>
            <button
              type="button"
              onClick={() => setGalaxyView(!galaxyView)}
              aria-pressed={galaxyView}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[0.65rem] font-medium tracking-[0.12em] uppercase shadow-[var(--shadow-border)] transition-colors duration-150",
                galaxyView
                  ? "bg-fg text-accent-fg"
                  : "bg-surface text-muted hover:text-fg",
              )}
            >
              <Sparkles className="size-3" />
              Milky Way
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {galaxyView
              ? "The Sun sits in the Orion Arm, ~26,000 ly from the center"
              : scaleMode === "true"
                ? "Sizes to scale · orbits compressed to fit"
                : "Visual scale · drag to orbit"}
          </p>
        </div>
        <AuthChip />
      </header>

      {showWorldList ? (
        <nav
          aria-label="Worlds"
          className="pointer-events-auto absolute top-28 bottom-36 left-0 flex w-32 flex-col justify-center gap-0.5 pl-[max(0.75rem,env(safe-area-inset-left))] pr-1 sm:top-24 sm:w-44 sm:px-4"
        >
          {BODIES.map((body) => (
            <button
              key={body.id}
              type="button"
              onClick={() => select(body.id === selectedId ? null : body.id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors duration-150 sm:h-9 sm:text-sm",
                selectedId === body.id
                  ? "bg-fg text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: body.color }}
                aria-hidden
              />
              {body.name}
            </button>
          ))}
        </nav>
      ) : null}

      {sgrASelected ? <SgrAPanel /> : selected ? <InfoPanel bodyId={selected.id} /> : null}

      {hintVisible && !selectedId && !galaxyView ? (
        <p className="pointer-events-none absolute bottom-36 left-1/2 hidden -translate-x-1/2 text-center text-xs text-muted sm:block">
          Click a world to approach
        </p>
      ) : null}
      {galaxyView && !sgrASelected ? (
        <p className="pointer-events-none absolute bottom-36 left-1/2 hidden -translate-x-1/2 text-center text-xs text-muted sm:block">
          Click Sagittarius A* for details
        </p>
      ) : null}

      <footer className="pointer-events-auto absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl bg-surface/90 p-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:gap-4 sm:rounded-3xl sm:p-3 sm:pl-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="subtle"
              size="icon"
              aria-label={paused ? "Resume" : "Pause"}
              onClick={togglePause}
            >
              {paused ? (
                <Play className="ml-0.5" />
              ) : (
                <Pause />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="System view"
              onClick={() => select(null)}
            >
              <Locate />
            </Button>
            <YearReadout />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="w-10 shrink-0 text-xs text-muted tabular-nums">
              {formatSpeed(speed)}
            </span>
            <Slider
              min={MIN_SPEED}
              max={MAX_SPEED}
              step={0.25}
              value={[speed]}
              onValueChange={(v) => setSpeed(v[0] ?? 1)}
              aria-label="Simulation speed"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={muted ? "ghost" : "subtle"}
              size="icon-sm"
              aria-pressed={!muted}
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={toggleMuted}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button
              type="button"
              variant={showWorldList ? "subtle" : "ghost"}
              size="icon-sm"
              aria-pressed={showWorldList}
              aria-label={showWorldList ? "Hide world list" : "Show world list"}
              onClick={() => setShowWorldList(!showWorldList)}
            >
              <List />
            </Button>
            <Button
              type="button"
              variant={showTrails ? "subtle" : "ghost"}
              size="icon-sm"
              aria-pressed={showTrails}
              aria-label={showTrails ? "Hide orbits" : "Show orbits"}
              onClick={() => setShowTrails(!showTrails)}
            >
              <Orbit />
            </Button>
            <Button
              type="button"
              variant={showLabels ? "subtle" : "ghost"}
              size="icon-sm"
              aria-pressed={showLabels}
              aria-label={showLabels ? "Hide labels" : "Show labels"}
              onClick={() => setShowLabels(!showLabels)}
            >
              {showLabels ? <Eye /> : <EyeOff />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function YearReadout() {
  const ref = useRef<HTMLSpanElement>(null);

  // Drives one text node from the animation frame rather than calling
  // setState 20x/second, which re-rendered this component on a timer whether
  // or not the value had changed.
  useEffect(() => {
    let frame = 0;
    let shown = "";
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const myr = galaxyTimeRef.current;
      const label = useSolar.getState().galaxyView
        ? myr >= 1000
          ? `${(myr / 1000).toFixed(2)} Gyr`
          : `${myr.toFixed(2)} Myr`
        : `${(simTimeRef.current / EARTH.period).toFixed(2)} yr`;
      if (label !== shown) {
        el.textContent = label;
        shown = label;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      ref={ref}
      className="min-w-24 text-xs text-muted tabular-nums"
      aria-label="Elapsed time"
    >
      0.00 yr
    </span>
  );
}

function formatSpeed(speed: number) {
  if (speed < 1) return `${speed.toFixed(2)}×`;
  if (Number.isInteger(speed)) return `${speed}×`;
  return `${speed.toFixed(1)}×`;
}

function InfoPanel({ bodyId }: { bodyId: BodyId }) {
  const body = BODIES.find((b) => b.id === bodyId);
  const select = useSolar((s) => s.select);
  if (!body) return null;

  return (
    <aside className="pointer-events-auto absolute right-3 bottom-36 left-3 max-h-[42vh] overflow-y-auto rounded-2xl bg-surface/92 p-4 shadow-[var(--shadow-border)] sm:right-6 sm:bottom-auto sm:left-auto sm:top-24 sm:w-80 sm:max-h-[calc(100dvh-12rem)] sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase">
            {KIND_LABEL[body.kind]}
          </p>
          <h2 className="font-display text-3xl leading-tight tracking-tight">
            {body.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => select(null)}
          className="size-9 rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body.fact}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat
          label="Distance"
          value={body.realDistanceAu === 0 ? "—" : `${body.realDistanceAu} AU`}
        />
        <Stat
          label="Period"
          value={
            body.realPeriodDays === 0
              ? "—"
              : body.realPeriodDays > 400
                ? `${(body.realPeriodDays / 365.25).toFixed(1)} yr`
                : `${Math.round(body.realPeriodDays)} d`
          }
        />
        <Stat label="Diameter" value={formatKm(body.realDiameterKm)} />
        <Stat label="Moons" value={body.moons === 0 ? "None" : String(body.moons)} />
      </dl>
    </aside>
  );
}

function SgrAPanel() {
  const selectSgrA = useSolar((s) => s.selectSgrA);

  return (
    <aside className="pointer-events-auto absolute right-3 bottom-36 left-3 max-h-[42vh] overflow-y-auto rounded-2xl bg-surface/92 p-4 shadow-[var(--shadow-border)] sm:right-6 sm:bottom-auto sm:left-auto sm:top-24 sm:w-80 sm:max-h-[calc(100dvh-12rem)] sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase">
            Supermassive black hole
          </p>
          <h2 className="font-display text-3xl leading-tight tracking-tight">
            Sagittarius A*
          </h2>
        </div>
        <button
          type="button"
          onClick={() => selectSgrA(false)}
          className="size-9 rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The true center of the Milky Way. A black hole about four million times
        the Sun’s mass, wrapped in a dense nuclear star cluster. You would not
        see a yellow star — only the glow of stars and hot gas around an event
        horizon.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Distance" value="26,000 ly" />
        <Stat label="Mass" value="4.3 M☉ × 10⁶" />
        <Stat label="Event horizon" value="~25 M km" />
        <Stat label="From Earth" value="8.2 kpc" />
      </dl>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg/50 px-3 py-2">
      <dt className="text-[0.65rem] tracking-[0.12em] text-subtle uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}

function formatKm(km: number) {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)} M km`;
  if (km >= 1000) return `${Math.round(km / 1000)} k km`;
  return `${km} km`;
}
