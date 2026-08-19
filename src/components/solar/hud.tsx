import {
  Eye,
  EyeOff,
  Locate,
  Orbit,
  Pause,
  Play,
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
import { simTimeRef, useSolar } from "@/lib/solar/store";
import { cn } from "@/lib/utils";
import { AuthChip } from "./auth-chip";

export function Hud() {
  const paused = useSolar((s) => s.paused);
  const speed = useSolar((s) => s.speed);
  const selectedId = useSolar((s) => s.selectedId);
  const showTrails = useSolar((s) => s.showTrails);
  const showLabels = useSolar((s) => s.showLabels);
  const hintVisible = useSolar((s) => s.hintVisible);
  const scaleMode = useSolar((s) => s.scaleMode);
  const muted = useSolar((s) => s.muted);
  const focusGen = useSolar((s) => s.focusGen);
  const togglePause = useSolar((s) => s.togglePause);
  const setSpeed = useSolar((s) => s.setSpeed);
  const select = useSolar((s) => s.select);
  const setShowTrails = useSolar((s) => s.setShowTrails);
  const setShowLabels = useSolar((s) => s.setShowLabels);
  const setScaleMode = useSolar((s) => s.setScaleMode);
  const toggleMuted = useSolar((s) => s.toggleMuted);

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
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.code === "Escape") {
        select(null);
      } else if (e.key === "[") {
        setSpeed(Math.max(0.25, speed / 2));
      } else if (e.key === "]") {
        setSpeed(Math.min(32, speed * 2));
      } else if (e.key === "m" || e.key === "M") {
        toggleMuted();
      } else if (e.key === "0") {
        select("sun");
      } else if (e.key >= "1" && e.key <= "8") {
        const planet = BODIES[Number(e.key)];
        if (planet) select(planet.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, setSpeed, speed, toggleMuted, togglePause]);

  const selected = selectedId ? BODIES.find((b) => b.id === selectedId) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <header className="pointer-events-auto flex items-start justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div>
          <h1 className="font-display text-3xl leading-none tracking-tight sm:text-4xl">
            Orrery
          </h1>
          <div className="mt-2 inline-flex rounded-full bg-surface p-0.5 shadow-[var(--shadow-border)]">
            <button
              type="button"
              onClick={() => setScaleMode("visual")}
              className={cn(
                "h-7 rounded-full px-2.5 text-[0.65rem] font-medium tracking-[0.12em] uppercase transition-colors duration-150",
                scaleMode === "visual"
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
                scaleMode === "true"
                  ? "bg-fg text-accent-fg"
                  : "text-muted hover:text-fg",
              )}
            >
              True size
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {scaleMode === "true"
              ? "Sizes to scale · orbits compressed to fit"
              : "Visual scale · drag to orbit"}
          </p>
        </div>
        <AuthChip />
      </header>

      <nav
        aria-label="Worlds"
        className="pointer-events-auto absolute top-24 bottom-36 left-0 hidden w-44 flex-col justify-center gap-0.5 px-4 lg:flex"
      >
        {BODIES.map((body) => (
          <button
            key={body.id}
            type="button"
            onClick={() => select(body.id === selectedId ? null : body.id)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-150",
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

      <div className="pointer-events-auto absolute top-20 right-0 left-0 overflow-x-auto px-4 lg:hidden">
        <div className="flex w-max gap-1.5">
          {BODIES.map((body) => (
            <button
              key={body.id}
              type="button"
              onClick={() => select(body.id === selectedId ? null : body.id)}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-medium tracking-wide uppercase",
                selectedId === body.id
                  ? "bg-fg text-accent-fg"
                  : "bg-surface text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {body.name}
            </button>
          ))}
        </div>
      </div>

      {selected ? <InfoPanel bodyId={selected.id} /> : null}

      {hintVisible && !selectedId ? (
        <p className="pointer-events-none absolute bottom-36 left-1/2 hidden -translate-x-1/2 text-center text-xs text-muted sm:block">
          Click a world to approach
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
              min={0.25}
              max={16}
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
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) {
        const years = simTimeRef.current / EARTH.period;
        ref.current.textContent = `${years.toFixed(2)} yr`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span
      ref={ref}
      className="min-w-16 text-xs text-muted tabular-nums"
      aria-label="Elapsed Earth years"
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
