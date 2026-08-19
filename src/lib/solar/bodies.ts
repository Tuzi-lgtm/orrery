export type BodyKind = "star" | "terrestrial" | "gas-giant" | "ice-giant";

export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type ScaleMode = "visual" | "true";

export interface SatelliteDef {
  name: string;
  orbit: number;
  radius: number;
  period: number;
  color: string;
  phase: number;
}

export interface BodyDef {
  id: BodyId;
  name: string;
  kind: BodyKind;
  orbitRadius: number;
  radius: number;
  period: number;
  phase: number;
  eccentricity: number;
  inclination: number;
  tilt: number;
  spin: number;
  color: string;
  emissive?: string;
  realDistanceAu: number;
  realPeriodDays: number;
  realDiameterKm: number;
  moons: number;
  fact: string;
  rings?: { inner: number; outer: number };
  satellites?: SatelliteDef[];
  textureSeed: number;
}

function visPeriod(days: number) {
  return Math.sqrt(days) * 0.46;
}

export const BODIES: BodyDef[] = [
  {
    id: "sun",
    name: "Sun",
    kind: "star",
    orbitRadius: 0,
    radius: 3.15,
    period: 1,
    phase: 0,
    eccentricity: 0,
    inclination: 0,
    tilt: 0.12,
    spin: 0.08,
    color: "#f0d9a0",
    emissive: "#fff4d0",
    realDistanceAu: 0,
    realPeriodDays: 0,
    realDiameterKm: 1_392_700,
    moons: 0,
    fact: "A G-type main-sequence star holding the system in place. More than 99% of the mass lives here.",
    textureSeed: 1,
  },
  {
    id: "mercury",
    name: "Mercury",
    kind: "terrestrial",
    orbitRadius: 8.2,
    radius: 0.28,
    period: visPeriod(88),
    phase: 0.4,
    eccentricity: 0.206,
    inclination: 0.12,
    tilt: 0.01,
    spin: 0.22,
    color: "#9a9086",
    realDistanceAu: 0.39,
    realPeriodDays: 88,
    realDiameterKm: 4_879,
    moons: 0,
    fact: "The innermost world. Days last longer than years, and the sky never holds a moon.",
    textureSeed: 11,
  },
  {
    id: "venus",
    name: "Venus",
    kind: "terrestrial",
    orbitRadius: 11.2,
    radius: 0.52,
    period: visPeriod(225),
    phase: 1.1,
    eccentricity: 0.007,
    inclination: 0.06,
    tilt: 3.1,
    spin: -0.05,
    color: "#d9c089",
    realDistanceAu: 0.72,
    realPeriodDays: 225,
    realDiameterKm: 12_104,
    moons: 0,
    fact: "A runaway greenhouse wrapped in sulfuric clouds. It spins backwards, and slower than it orbits.",
    textureSeed: 23,
  },
  {
    id: "earth",
    name: "Earth",
    kind: "terrestrial",
    orbitRadius: 15.1,
    radius: 0.55,
    period: visPeriod(365.25),
    phase: 0.2,
    eccentricity: 0.017,
    inclination: 0,
    tilt: 0.41,
    spin: 0.7,
    color: "#6ea0d0",
    realDistanceAu: 1,
    realPeriodDays: 365.25,
    realDiameterKm: 12_742,
    moons: 1,
    fact: "The only world known to carry liquid oceans and a living atmosphere. One large moon keeps the tilt steady.",
    textureSeed: 42,
    satellites: [
      {
        name: "Moon",
        orbit: 1.35,
        radius: 0.15,
        period: visPeriod(27.3),
        color: "#c5c1b6",
        phase: 0.6,
      },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    kind: "terrestrial",
    orbitRadius: 19.6,
    radius: 0.36,
    period: visPeriod(687),
    phase: 2.4,
    eccentricity: 0.093,
    inclination: 0.04,
    tilt: 0.44,
    spin: 0.68,
    color: "#c0724a",
    realDistanceAu: 1.52,
    realPeriodDays: 687,
    realDiameterKm: 6_779,
    moons: 2,
    fact: "A cold desert of iron dust and ancient riverbeds. Polar ice caps grow and shrink with the long seasons.",
    textureSeed: 57,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "gas-giant",
    orbitRadius: 31.4,
    radius: 1.85,
    period: visPeriod(4_333),
    phase: 0.8,
    eccentricity: 0.049,
    inclination: 0.03,
    tilt: 0.05,
    spin: 1.4,
    color: "#c4a078",
    realDistanceAu: 5.2,
    realPeriodDays: 4_333,
    realDiameterKm: 139_820,
    moons: 95,
    fact: "A failed star of hydrogen and helium. The Great Red Spot is a storm older than recorded history.",
    textureSeed: 71,
    satellites: [
      { name: "Io", orbit: 2.55, radius: 0.08, period: 2.1, color: "#e0c46a", phase: 0.2 },
      { name: "Europa", orbit: 3.15, radius: 0.07, period: 3.5, color: "#d5d8dc", phase: 1.4 },
      { name: "Ganymede", orbit: 3.9, radius: 0.1, period: 5.4, color: "#9a8b76", phase: 2.1 },
      { name: "Callisto", orbit: 4.75, radius: 0.09, period: 7.6, color: "#6d675e", phase: 3.0 },
    ],
  },
  {
    id: "saturn",
    name: "Saturn",
    kind: "gas-giant",
    orbitRadius: 42.2,
    radius: 1.55,
    period: visPeriod(10_759),
    phase: 1.7,
    eccentricity: 0.057,
    inclination: 0.045,
    tilt: 0.47,
    spin: 1.25,
    color: "#e0c98a",
    realDistanceAu: 9.58,
    realPeriodDays: 10_759,
    realDiameterKm: 116_460,
    moons: 146,
    fact: "The ringed giant. Ice and dust orbit in a sheet thin enough to vanish when seen edge-on.",
    textureSeed: 88,
    rings: { inner: 1.45, outer: 2.45 },
    satellites: [
      { name: "Titan", orbit: 3.6, radius: 0.11, period: 6.2, color: "#c9a46a", phase: 0.9 },
    ],
  },
  {
    id: "uranus",
    name: "Uranus",
    kind: "ice-giant",
    orbitRadius: 52.4,
    radius: 0.88,
    period: visPeriod(30_687),
    phase: 2.9,
    eccentricity: 0.046,
    inclination: 0.02,
    tilt: 1.71,
    spin: 0.9,
    color: "#8fd0d4",
    realDistanceAu: 19.2,
    realPeriodDays: 30_687,
    realDiameterKm: 50_724,
    moons: 28,
    fact: "An ice giant rolled onto its side. Seasons last decades, and the rings stand almost vertical.",
    textureSeed: 101,
    rings: { inner: 1.35, outer: 1.7 },
  },
  {
    id: "neptune",
    name: "Neptune",
    kind: "ice-giant",
    orbitRadius: 62.2,
    radius: 0.84,
    period: visPeriod(60_190),
    phase: 0.5,
    eccentricity: 0.009,
    inclination: 0.03,
    tilt: 0.49,
    spin: 0.95,
    color: "#3d6fce",
    realDistanceAu: 30.05,
    realPeriodDays: 60_190,
    realDiameterKm: 49_244,
    moons: 16,
    fact: "The farthest planet, still stormy. Winds here are the fastest measured in the solar system.",
    textureSeed: 119,
    satellites: [
      { name: "Triton", orbit: 1.85, radius: 0.08, period: 4.4, color: "#c8c2b4", phase: 1.2 },
    ],
  },
];

export const PLANETS = BODIES.filter((b) => b.id !== "sun");
export const SUN = BODIES[0]!;
export const EARTH = BODIES.find((b) => b.id === "earth")!;

const EARTH_DIAM_KM = 12_742;
const TRUE_EARTH_R = 0.18;
const TRUE_AU = 11;
const TRUE_SUN_CLEAR = 1.38;

export function bodyRadius(body: BodyDef, mode: ScaleMode) {
  if (mode === "visual") return body.radius;
  return (body.realDiameterKm / EARTH_DIAM_KM) * TRUE_EARTH_R;
}

export function bodyOrbit(body: BodyDef, mode: ScaleMode) {
  if (mode === "visual") return body.orbitRadius;
  if (body.realDistanceAu === 0) return 0;
  const sunR = bodyRadius(SUN, "true");
  return sunR * TRUE_SUN_CLEAR + body.realDistanceAu * TRUE_AU;
}

export function satRadius(
  parent: BodyDef,
  sat: SatelliteDef,
  mode: ScaleMode,
) {
  if (mode === "visual") return sat.radius;
  return sat.radius * (bodyRadius(parent, mode) / parent.radius);
}

export function satOrbit(
  parent: BodyDef,
  sat: SatelliteDef,
  mode: ScaleMode,
) {
  if (mode === "visual") return sat.orbit;
  return sat.orbit * (bodyRadius(parent, mode) / parent.radius) * 2.4;
}

export const KIND_LABEL: Record<BodyKind, string> = {
  star: "G-type star",
  terrestrial: "Terrestrial planet",
  "gas-giant": "Gas giant",
  "ice-giant": "Ice giant",
};

export function getBody(id: BodyId) {
  return BODIES.find((b) => b.id === id)!;
}

export function orbitPoint(
  body: BodyDef,
  time: number,
  out: { x: number; y: number; z: number },
  mode: ScaleMode = "visual",
) {
  const a = bodyOrbit(body, mode);
  if (a === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const angle = (time / body.period) * Math.PI * 2 + body.phase;
  const e = body.eccentricity;
  const b = a * Math.sqrt(1 - e * e);
  const x = Math.cos(angle) * a - a * e;
  const z = Math.sin(angle) * b;
  const y = Math.sin(angle) * body.inclination * a * 0.08;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}
