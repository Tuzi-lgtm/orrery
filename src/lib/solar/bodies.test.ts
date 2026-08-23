import assert from "node:assert/strict";
import test from "node:test";
import { BODIES, PLANETS, bodyOrbit, getBody, orbitPoint } from "./bodies.ts";

const at = (body: (typeof BODIES)[number], t: number) =>
  orbitPoint(body, t, { x: 0, y: 0, z: 0 });

/** Area of the triangle swept from the focus between two positions. */
function sweptArea(
  body: (typeof BODIES)[number],
  from: number,
  dt: number,
) {
  const a = at(body, from);
  const p = { x: a.x, z: a.z };
  const b = at(body, from + dt);
  return Math.abs(p.x * b.z - b.x * p.z) / 2;
}

test("sweeps equal areas in equal times (Kepler's second law)", () => {
  for (const body of PLANETS) {
    const dt = body.period / 4000;
    const areas = Array.from({ length: 24 }, (_, i) =>
      sweptArea(body, (i / 24) * body.period, dt),
    );
    const mean = areas.reduce((s, v) => s + v, 0) / areas.length;
    const spread = (Math.max(...areas) - Math.min(...areas)) / mean;
    // Stepping the eccentric anomaly uniformly instead of the mean anomaly
    // puts Mercury's spread near 50%.
    assert.ok(
      spread < 1e-3,
      `${body.name}: swept-area spread ${(spread * 100).toFixed(2)}% exceeds 0.1%`,
    );
  }
});

test("perihelion and aphelion sit at a(1-e) and a(1+e)", () => {
  for (const body of PLANETS) {
    const a = bodyOrbit(body, "visual");
    const e = body.eccentricity;
    // t chosen so the mean anomaly is exactly 0 / pi, cancelling the phase.
    const tPeri = (-body.phase / (Math.PI * 2)) * body.period;
    const tApo = tPeri + body.period / 2;
    const rPeri = Math.hypot(at(body, tPeri).x, at(body, tPeri).z);
    const rApo = Math.hypot(at(body, tApo).x, at(body, tApo).z);
    assert.ok(
      Math.abs(rPeri - a * (1 - e)) < 1e-9,
      `${body.name}: perihelion ${rPeri} != ${a * (1 - e)}`,
    );
    assert.ok(
      Math.abs(rApo - a * (1 + e)) < 1e-9,
      `${body.name}: aphelion ${rApo} != ${a * (1 + e)}`,
    );
  }
});

test("orbits close after exactly one period", () => {
  for (const body of PLANETS) {
    const start = at(body, 0);
    const round = at(body, body.period);
    assert.ok(Math.hypot(round.x - start.x, round.z - start.z) < 1e-9, body.name);
  }
});

test("a near-circular orbit keeps a near-constant radius", () => {
  const venus = getBody("venus"); // e = 0.007
  const radii = Array.from({ length: 32 }, (_, i) => {
    const p = at(venus, (i / 32) * venus.period);
    return Math.hypot(p.x, p.z);
  });
  const spread = (Math.max(...radii) - Math.min(...radii)) / Math.min(...radii);
  assert.ok(spread < 0.02, `radius spread ${spread}`);
});

test("the Sun stays at the origin in both scale modes", () => {
  for (const mode of ["visual", "true"] as const) {
    const p = orbitPoint(getBody("sun"), 12.5, { x: 0, y: 0, z: 0 }, mode);
    assert.deepEqual(p, { x: 0, y: 0, z: 0 });
  }
});
