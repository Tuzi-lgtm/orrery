/**
 * Procedural Milky Way: ~460k points across the disc, arms, bar and core.
 *
 * Pure maths -- no `three`, no DOM -- so the galaxy worker can pull it in
 * without the renderer and hand back plain typed arrays. `galaxy.tsx` turns
 * those into BufferGeometry.
 */

/** Plain RGB accumulator, standing in for three's Color. */
class Rgb {
  r = 0;
  g = 0;
  b = 0;
  setRGB(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }
}

export type CloudKind = "star" | "dust" | "cluster";

/** One cloud's attributes, each transferable straight back to the main thread. */
export interface CloudBuffers {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
}

export const GALAXY_CENTER = { x: -460, y: 0, z: -90 };
export const GALAXY_RADIUS = 900;
export const GALAXY_PITCH = 0.38;
export const GALAXY_SUN_R = Math.hypot(GALAXY_CENTER.x, GALAXY_CENTER.z);
export const GALAXY_SUN_ANGLE = Math.atan2(-GALAXY_CENTER.z, -GALAXY_CENTER.x);
export const GALAXY_BAR_ANGLE = GALAXY_SUN_ANGLE + 0.48;
export const GALAXY_ARM_ROT = GALAXY_BAR_ANGLE;
export const GALAXY_BAR_LEN = GALAXY_RADIUS * 0.2;
/**
 * Myr per revolution of the spiral pattern. Arms and the bar are baked into
 * the point positions, so they are structures, not free-floating stars: every
 * cloud has to turn at this one rigid rate or they shear apart. They used to
 * turn differentially (`28 + r * 0.12`), which wound the arms up and smeared
 * the bar into a ring within ~24 Myr of viewing — about 24s at 1x, 1.5s at 16x
 * — while the painted arms in the volume shader stayed put at this period.
 */
export const GALAXY_PATTERN_PERIOD = 28 + GALAXY_RADIUS * 0.45 * 0.12;
function hash(i: number, salt: number) {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash(a * 19 + b * 47, 17);
  return (
    h(ix, iy) * (1 - ux) * (1 - uy) +
    h(ix + 1, iy) * ux * (1 - uy) +
    h(ix, iy + 1) * (1 - ux) * uy +
    h(ix + 1, iy + 1) * ux * uy
  );
}

function placeArm(i: number, seed: number, u: number, v: number, pitch: number) {
  const pick = hash(i, seed + 31);
  let arm = 0;
  let major = true;
  let spur = false;
  let pitchMul = 1;
  let width = 1;
  let nOff = 0;
  if (pick < 0.44) {
    arm = 0;
    pitchMul = 1.04;
    width = 1.25;
    nOff = 2.4;
  } else if (pick < 0.84) {
    arm = Math.PI;
    pitchMul = 0.9;
    width = 1.4;
    nOff = 9.1;
  } else if (pick < 0.93) {
    arm = Math.PI * 0.5 + 0.18;
    major = false;
    pitchMul = 1.12;
    width = 0.78;
    nOff = 14.6;
  } else if (pick < 0.975) {
    arm = Math.PI * 1.5 + 0.12;
    major = false;
    pitchMul = 0.8;
    width = 0.7;
    nOff = 21.3;
  } else {
    arm = GALAXY_SUN_ANGLE - GALAXY_ARM_ROT;
    spur = true;
    major = false;
    pitchMul = 1.4;
    width = 0.55;
    nOff = 27.0;
  }

  let r =
    GALAXY_BAR_LEN +
    Math.pow(u, spur ? 0.75 : 0.5) *
      (GALAXY_RADIUS - GALAXY_BAR_LEN) *
      (spur ? 0.22 : major ? 1 : 0.82);
  if (spur) {
    r = GALAXY_SUN_R * (0.82 + u * 0.32);
  }
  const nv = vnoise(r * 0.015 + nOff, arm * 5.3);
  const wiggle = (nv - 0.5) * 0.07 + (hash(i, seed + 41) - 0.5) * 0.03;
  let theta =
    GALAXY_ARM_ROT + arm + Math.log(Math.max(r, 10) / GALAXY_BAR_LEN) / (pitch * pitchMul) + wiggle;

  const d1 = vnoise(r * 0.008 + nOff, theta * 1.4 + nOff);
  const d2 = vnoise(r * 0.022 + nOff * 2.0, theta * 3.2);
  const d3 = vnoise(r * 0.055 + nOff * 0.5, theta * 7.0);
  const dens = Math.pow(d1 * 0.5 + d2 * 0.35 + d3 * 0.15, 1.15);
  const lane = Math.pow(vnoise(r * 0.0038 + nOff * 0.25, arm * 1.7 + r * 0.0015), 1.85);

  const innerFat = Math.exp(-((r / (GALAXY_RADIUS * 0.4)) ** 2));
  const edge = Math.sign(v - 0.5) * Math.pow(Math.abs(v - 0.5), 0.62);
  let spread = edge * width * (16 + innerFat * 48 + r * 0.022 + (1 - dens) * 16);
  let knot = dens > 0.74 && hash(i, seed + 53) > 0.78;
  let dim = (0.2 + dens * 0.75) * (0.22 + lane * 1.7);

  if (lane < 0.28) {
    dim *= 0.15 + lane;
  }

  if (hash(i, seed + 70) > 0.94) {
    const cid = Math.floor(hash(i, seed + 71) * 180);
    const cu = hash(cid, seed + 210 + Math.floor(nOff));
    const cR = GALAXY_BAR_LEN + cu * (GALAXY_RADIUS - GALAXY_BAR_LEN) * (spur ? 0.55 : 1);
    const cTh =
      GALAXY_ARM_ROT + arm + Math.log(Math.max(cR, 10) / GALAXY_BAR_LEN) / (pitch * pitchMul);
    const rad = 8 + hash(cid, seed + 212) * 16;
    r = cR + (hash(i, seed + 72) - 0.5) * 2 * rad;
    theta = cTh + (hash(i, seed + 73) - 0.5) * (rad / Math.max(cR, 50));
    spread = (hash(i, seed + 74) - 0.5) * rad * 0.9;
    knot = true;
    dim = 0.5 + hash(i, seed + 75) * 0.32;
  }

  if (hash(i, seed + 63) > 0.9) {
    theta += (hash(i, seed + 64) - 0.5) * 0.35;
    spread *= 1.35;
    knot = false;
    dim *= 0.6;
  }

  if (dens < 0.2 && hash(i, seed + 67) > 0.55) {
    spread *= 1.6;
    dim *= 0.28;
    knot = false;
  }

  return { r, theta, spread, major, spur, knot, dim, arm };
}

export function makeCloud(count: number, kind: CloudKind, seed: number): CloudBuffers {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new Rgb();
  const cx = GALAXY_CENTER.x;
  const cz = GALAXY_CENTER.z;
  const pitch = GALAXY_PITCH;

  for (let i = 0; i < count; i++) {
    const u = hash(i, seed);
    const v = hash(i, seed + 3);
    const w = hash(i, seed + 7);
    const n = hash(i, seed + 13);
    const q = hash(i, seed + 19);

    let r: number;
    let theta: number;
    let spread: number;
    let size = 0.4;
    let bright = 0.4;

    if (kind === "dust") {
      const a = placeArm(i, seed, u, v, pitch);
      r = a.r;
      theta = a.theta;
      spread = a.spread * 0.45 - 16;
      color.setRGB(0.28 + w * 0.1, 0.14 + w * 0.06, 0.08);
      size = 2.0 + q * 3.2;
      bright = (0.14 + w * 0.2) * a.dim;
    } else if (kind === "cluster") {
      const nAssoc = 52;
      const aid = Math.floor(hash(i, seed + 3) * nAssoc);
      const aPick = hash(aid, 301);
      const armAng = aPick < 0.47 ? 0 : aPick < 0.88 ? Math.PI : Math.PI * 0.5 + 0.2;
      const along0 = 0.22 + Math.pow(hash(aid, 302), 0.9) * 0.68;
      const aR = GALAXY_BAR_LEN + along0 * (GALAXY_RADIUS - GALAXY_BAR_LEN);
      const aTh = GALAXY_ARM_ROT + armAng + Math.log(Math.max(aR, 10) / GALAXY_BAR_LEN) / pitch;
      const aRad = 4 + Math.pow(hash(aid, 303), 2.4) * 26;
      // was *5.5, which smeared associations into ~35deg arcs across the disc
      const stretch = 1.1 + Math.pow(hash(aid, 305), 1.5) * 0.85;
      const u1 = Math.max(hash(i, seed + 55), 1e-4);
      const u2 = hash(i, seed + 56) * Math.PI * 2;
      const mag = Math.sqrt(-2 * Math.log(u1));
      const gx = mag * Math.cos(u2);
      const gy = mag * Math.sin(u2);
      r = aR + gy * aRad * 0.55;
      theta = aTh + (gx * aRad * stretch) / Math.max(aR, 40);
      spread = gy * aRad * 0.4;
      const fall = Math.exp(-(gx * gx * 0.22 + gy * gy * 0.55));
      const spec = hash(i, seed + 99);
      if (spec < 0.2) color.setRGB(1, 0.42 + w * 0.2, 0.62 + w * 0.12);
      else if (spec < 0.55) color.setRGB(0.62 + w * 0.12, 0.78, 1);
      else color.setRGB(1, 0.94, 0.9);
      size = 0.1 + Math.pow(q, 2.9) * 1.35;
      bright = (0.3 + Math.pow(hash(i, seed + 58), 2.2) * 1.15) * fall;
    } else if (n < 0.1) {
      r = Math.pow(u, 0.52) * GALAXY_RADIUS * 0.2;
      theta = v * Math.PI * 2;
      const g = vnoise(Math.cos(theta) * 1.4, Math.sin(theta) * 1.4);
      r *= 0.75 + g * 0.65;
      theta += (g - 0.5) * 0.45;
      spread = (w - 0.5) * (6 + r * 0.28);
      color.setRGB(1, 0.82 + w * 0.12, 0.48 + w * 0.1);
      size = 0.35 + q * 0.85 + (1 - r / (GALAXY_RADIUS * 0.2)) * 0.5;
      bright = (0.55 + w * 0.4) * (0.35 + g * 1.05);
    } else if (n < 0.2) {
      r = Math.pow(u, 0.5) * GALAXY_RADIUS;
      theta = v * Math.PI * 2;
      spread = (w - 0.5) * (48 + r * 0.12);
      color.setRGB(0.62 + w * 0.12, 0.7 + w * 0.1, 0.92);
      size = 0.12 + Math.pow(q, 2.4) * 0.55;
      bright = 0.06 + w * 0.1;
    } else {
      const a = placeArm(i, seed, u, v, pitch);
      r = a.r;
      theta = a.theta;
      spread = a.spread;
      const spec = hash(i, seed + 99);
      const flux = 0.28 + Math.pow(hash(i, seed + 101), 2.3) * 2.2;
      const inner = 1.0 - Math.min(r / GALAXY_RADIUS, 1);
      if ((a.knot && spec < 0.35) || spec < 0.06) {
        color.setRGB(1, 0.3 + w * 0.16, 0.48 + w * 0.12);
        size = 0.45 + Math.pow(q, 2.0) * 1.5;
      } else if (inner > 0.55) {
        color.setRGB(1, 0.86 + w * 0.08, 0.55 + w * 0.12);
        size = 0.12 + Math.pow(q, 2.6) * 1.15;
      } else if (spec < 0.55) {
        color.setRGB(0.62 + w * 0.12, 0.78 + w * 0.12, 1);
        size = 0.14 + Math.pow(q, 2.5) * 1.35;
      } else {
        color.setRGB(0.95, 0.96, 1);
        size = 0.1 + Math.pow(q, 2.8) * 1.05;
      }
      bright = flux * a.dim * (a.major ? 1.25 : 0.8) * (0.7 + inner * 0.5);
      if (a.knot) bright *= 1.25;
    }

    const bulge = Math.exp(-((r / (GALAXY_RADIUS * 0.2)) ** 2));
    const x = cx + Math.cos(theta) * r + Math.cos(theta + 1.57) * spread;
    const z = cz + Math.sin(theta) * r + Math.sin(theta + 1.57) * spread;
    const thick = 5 + bulge * bulge * 38 + (1 - r / GALAXY_RADIUS) * 4;
    let y = (hash(i, seed + 11) - 0.5) * thick;
    let dx = x - cx;
    let dz = z - cz;
    const near = Math.hypot(dx, y, dz);
    if (near < 12) {
      const s = 12 / Math.max(near, 0.05);
      dx *= s;
      y *= s;
      dz *= s;
    }
    positions[i * 3] = cx + dx;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = cz + dz;
    colors[i * 3] = color.r * bright;
    colors[i * 3 + 1] = color.g * bright;
    colors[i * 3 + 2] = color.b * bright;
    sizes[i] = size;
  }

  return { positions, colors, sizes };
}

export function makeBar(count: number): CloudBuffers {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new Rgb();
  const ca = Math.cos(GALAXY_BAR_ANGLE);
  const sa = Math.sin(GALAXY_BAR_ANGLE);
  const cx = GALAXY_CENTER.x;
  const cz = GALAXY_CENTER.z;
  for (let i = 0; i < count; i++) {
    const u = hash(i, 71);
    const v = hash(i, 73);
    const w = hash(i, 79);
    const q = hash(i, 83);
    const along = (u - 0.5) * 1.55 * GALAXY_BAR_LEN;
    const endFade = Math.exp(-((along / (GALAXY_BAR_LEN * 0.42)) ** 2));
    let side = (v - 0.5) * (14 + endFade ** 1.15 * 64);
    let y = (w - 0.5) * (8 + endFade ** 1.1 * 26);
    let ax = along;
    const r0 = Math.hypot(ax, side, y);
    if (r0 < 12) {
      const s = 12 / Math.max(r0, 0.05);
      ax *= s;
      side *= s;
      y *= s;
    }
    positions[i * 3] = cx + ax * ca - side * sa;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = cz + ax * sa + side * ca;
    color.setRGB(1, 0.78 + q * 0.14, 0.4 + w * 0.1);
    const bright = 0.04 + endFade ** 1.65 * 0.92;
    colors[i * 3] = color.r * bright;
    colors[i * 3 + 1] = color.g * bright;
    colors[i * 3 + 2] = color.b * bright;
    sizes[i] = 0.1 + endFade * 0.58;
  }
  return { positions, colors, sizes };
}

export function makeCore(count: number): CloudBuffers {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const cx = GALAXY_CENTER.x;
  const cz = GALAXY_CENTER.z;
  for (let i = 0; i < count; i++) {
    const u = Math.max(hash(i, 41), 1e-4);
    const v = hash(i, 43);
    const w = hash(i, 47);
    let rho = Math.sqrt(-Math.log(u)) * 38;
    let theta = v * Math.PI * 2;
    const px = Math.cos(theta);
    const pz = Math.sin(theta);
    const n1 = vnoise(px * 1.35 + rho * 0.008, pz * 1.35);
    const n2 = vnoise(px * 2.1 + 4.5, pz * 2.1 + rho * 0.012);
    const gas = Math.pow(n1 * 0.62 + n2 * 0.38, 1.25);
    theta += (n1 - 0.5) * 0.55;
    rho *= 0.72 + gas * 0.7;
    if (gas < 0.38) {
      rho *= 1.1 + hash(i, 51) * 0.7;
    }
    const h = 5 + 32 * Math.exp(-((rho / 28) ** 2));
    let y = (w - 0.5) * h * (0.65 + gas * 0.55);
    const near = Math.hypot(rho, y);
    if (near < 12) {
      const s = 12 / Math.max(near, 0.05);
      rho *= s;
      y *= s;
    }
    positions[i * 3] = cx + Math.cos(theta) * rho;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = cz + Math.sin(theta) * rho;
    const fade = Math.exp(-((rho / 44) ** 2));
    const hot = (0.16 + fade * 0.9) * (0.28 + gas * 1.15);
    colors[i * 3] = 1 * hot;
    colors[i * 3 + 1] = 0.78 * hot;
    colors[i * 3 + 2] = 0.42 * hot;
    sizes[i] = 0.14 + hash(i, 53) * 0.42 + fade * gas * 0.4;
  }
  return { positions, colors, sizes };
}
