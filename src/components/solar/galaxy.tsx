import { Html, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  MathUtils,
} from "three";
import { GALAXY_MYR_PER_SEC, galaxyTimeRef, useSolar } from "@/lib/solar/store";
import { usePick } from "./use-pick";

export const GALAXY_CENTER = { x: -460, y: 0, z: -90 };
export const GALAXY_RADIUS = 900;
export const GALAXY_CENTER_VEC = new Vector3(GALAXY_CENTER.x, 0, GALAXY_CENTER.z);
const CAM_POS = new Vector3();
const GALAXY_PITCH = 0.38;
const GALAXY_SUN_R = Math.hypot(GALAXY_CENTER.x, GALAXY_CENTER.z);
const GALAXY_SUN_ANGLE = Math.atan2(-GALAXY_CENTER.z, -GALAXY_CENTER.x);
const GALAXY_BAR_ANGLE = GALAXY_SUN_ANGLE + 0.48;
const GALAXY_ARM_ROT = GALAXY_BAR_ANGLE;
const GALAXY_BAR_LEN = GALAXY_RADIUS * 0.2;
/**
 * Myr per revolution of the spiral pattern. Arms and the bar are baked into
 * the point positions, so they are structures, not free-floating stars: every
 * cloud has to turn at this one rigid rate or they shear apart. They used to
 * turn differentially (`28 + r * 0.12`), which wound the arms up and smeared
 * the bar into a ring within ~24 Myr of viewing — about 24s at 1x, 1.5s at 16x
 * — while the painted arms in the volume shader stayed put at this period.
 */
const GALAXY_PATTERN_PERIOD = 28 + GALAXY_RADIUS * 0.45 * 0.12;

const STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float aSize;
uniform float uTime;
uniform vec3 uCenter;
uniform float uSize;
uniform float uPattern;
varying vec3 vColor;
varying vec3 vWorld;
void main() {
  vColor = color;
  vec3 p = position - uCenter;
  float ang = -uTime * 6.2831853 / uPattern;
  float c = cos(ang);
  float s = sin(ang);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + uCenter;
  vWorld = q;
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uSize * (260.0 / max(-mv.z, 1.0)), 0.35);
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uCenter;
varying vec3 vColor;
varying vec3 vWorld;
void main() {
  float dist = length(vWorld - uCenter);
  if (dist < 4.0) discard;
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = dot(uv, uv);
  float a = uOpacity * smoothstep(1.0, 0.15, d);
  a *= smoothstep(4.0, 6.4, dist);
  if (a < 0.02) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

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

function placeArm(
  i: number,
  seed: number,
  u: number,
  v: number,
  pitch: number,
) {
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
    GALAXY_ARM_ROT +
    arm +
    Math.log(Math.max(r, 10) / GALAXY_BAR_LEN) / (pitch * pitchMul) +
    wiggle;

  const d1 = vnoise(r * 0.008 + nOff, theta * 1.4 + nOff);
  const d2 = vnoise(r * 0.022 + nOff * 2.0, theta * 3.2);
  const d3 = vnoise(r * 0.055 + nOff * 0.5, theta * 7.0);
  const dens = Math.pow(d1 * 0.5 + d2 * 0.35 + d3 * 0.15, 1.15);
  const lane = Math.pow(vnoise(r * 0.0038 + nOff * 0.25, arm * 1.7 + r * 0.0015), 1.85);

  const innerFat = Math.exp(-((r / (GALAXY_RADIUS * 0.4)) ** 2));
  const edge = Math.sign(v - 0.5) * Math.pow(Math.abs(v - 0.5), 0.62);
  let spread =
    edge * width * (16 + innerFat * 48 + r * 0.022 + (1 - dens) * 16);
  let knot = dens > 0.74 && hash(i, seed + 53) > 0.78;
  let dim = (0.2 + dens * 0.75) * (0.22 + lane * 1.7);

  if (lane < 0.28) {
    dim *= 0.15 + lane;
  }

  if (hash(i, seed + 70) > 0.88) {
    const cid = Math.floor(hash(i, seed + 71) * 180);
    const cu = hash(cid, seed + 210 + Math.floor(nOff));
    const cR =
      GALAXY_BAR_LEN +
      cu * (GALAXY_RADIUS - GALAXY_BAR_LEN) * (spur ? 0.55 : 1);
    const cTh =
      GALAXY_ARM_ROT +
      arm +
      Math.log(Math.max(cR, 10) / GALAXY_BAR_LEN) / (pitch * pitchMul);
    const rad = 22 + hash(cid, seed + 212) * 40;
    r = cR + (hash(i, seed + 72) - 0.5) * 2 * rad;
    theta = cTh + (hash(i, seed + 73) - 0.5) * (rad / Math.max(cR, 50));
    spread = (hash(i, seed + 74) - 0.5) * rad * 0.9;
    knot = true;
    dim = 0.7 + hash(i, seed + 75) * 0.5;
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

function makeCloud(
  count: number,
  kind: "star" | "dust" | "cluster",
  seed: number,
) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new Color();
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
      const armAng =
        aPick < 0.47 ? 0 : aPick < 0.88 ? Math.PI : Math.PI * 0.5 + 0.2;
      const along0 = 0.22 + Math.pow(hash(aid, 302), 0.9) * 0.68;
      const aR = GALAXY_BAR_LEN + along0 * (GALAXY_RADIUS - GALAXY_BAR_LEN);
      const aTh =
        GALAXY_ARM_ROT +
        armAng +
        Math.log(Math.max(aR, 10) / GALAXY_BAR_LEN) / pitch;
      const aRad = 4 + Math.pow(hash(aid, 303), 2.4) * 36;
      const stretch = 1.4 + Math.pow(hash(aid, 305), 1.5) * 5.5;
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
      bright = (0.35 + Math.pow(hash(i, seed + 58), 2.2) * 1.6) * fall;
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

  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  return geo;
}

function makeBar(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new Color();
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
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  return geo;
}

function makeCore(count: number) {
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
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  return geo;
}

function GalaxyCloud({
  geometry,
  size,
  opacity,
  fadeRef,
  additive = true,
}: {
  geometry: BufferGeometry;
  size: number;
  opacity: number;
  fadeRef: { current: number };
  additive?: boolean;
}) {
  const mat = useRef<ShaderMaterial>(null);
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value = galaxyTimeRef.current;
    m.uniforms.uOpacity.value = opacity * fadeRef.current;
  });
  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={mat}
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uCenter: { value: GALAXY_CENTER_VEC },
          uCamera: { value: CAM_POS },
          uSize: { value: size },
          uOpacity: { value: opacity },
          uPattern: { value: GALAXY_PATTERN_PERIOD },
        }}
        transparent
        depthWrite={false}
        depthTest
        blending={additive ? AdditiveBlending : NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}

const VOL_VERT = /* glsl */ `
varying vec3 vRel;
uniform vec3 uCenter;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vRel = w.xyz - uCenter;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const VOL_FRAG = /* glsl */ `
varying vec3 vRel;
uniform float uTime;
uniform float uOpacity;
uniform float uRot;
uniform float uPitch;
uniform float uBar;
uniform float uSunAngle;
uniform float uSunR;
uniform vec3 uCamera;
uniform float uPattern;

float hn(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hn(i), hn(i + vec2(1.0, 0.0)), f.x),
    mix(hn(i + vec2(0.0, 1.0)), hn(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.58;
  for (int i = 0; i < 3; i++) {
    v += a * vn(p);
    p = p * 2.02 + vec2(13.4, 8.2);
    a *= 0.42;
  }
  return v;
}

void main() {
  float r = length(vRel.xz);
  float R = 900.0;
  if (r > R) discard;
  float period = uPattern;
  float angOff = -uTime * 6.2831853 / period;
  float c = cos(angOff);
  float s = sin(angOff);
  vec2 rest = vec2(c * vRel.x + s * vRel.z, -s * vRel.x + c * vRel.z);
  float ang = atan(rest.y, rest.x);
  float nBig = fbm(rest * 0.0075);
  float nMid = fbm(rest * 0.018 + 14.0);
  vec2 warped = rest + (nBig - 0.5) * 42.0;
  float nShape = fbm(warped * 0.01);
  float wig = 0.028 * (nBig - 0.5);
  float spiral = ang - uRot - log(max(r, 1.0) / 180.0) / uPitch - wig;
  float wrapped = mod(spiral + 6.2831853, 6.2831853);
  float d0 = min(wrapped, 6.2831853 - wrapped);
  float d1 = abs(wrapped - 3.14159265);
  float armDist = min(d0, d1);
  float knots = mix(0.32, 1.0, pow(nShape, 1.55));
  knots *= mix(0.72, 1.12, nMid);
  float core = exp(-pow(armDist / 0.42, 2.0));
  float halo = exp(-pow(armDist / 1.12, 2.0));
  float major = (halo * 0.5 + core * 1.15) * knots;
  float d2 = abs(wrapped - 1.5707963);
  float d3 = abs(wrapped - 4.712389);
  float minor = exp(-pow(min(d2, d3) / 0.62, 2.0)) * 0.18 * nMid;
  float lane = exp(-pow((armDist + 0.28) / 0.2, 2.0));
  vec2 bdir = vec2(cos(uBar), sin(uBar));
  float along = rest.x * bdir.x + rest.y * bdir.y;
  float perp = rest.x * bdir.y - rest.y * bdir.x;
  float bar = exp(-pow(perp / 44.0, 2.0)) * exp(-pow(along / 108.0, 2.0));
  float radial = smoothstep(10.0, 80.0, r) * (1.0 - smoothstep(R * 0.78, R, r));
  float bulge = exp(-pow(r / (R * 0.3), 2.0));
  bulge *= mix(0.32, 1.28, pow(nBig, 1.35));
  radial = max(radial, max(bar * 0.95, bulge));
  float inner = smoothstep(R * 0.48, R * 0.16, r);
  float inter = (1.0 - major) * mix(0.08, 0.7, pow(nBig, 1.8));
  float hii = pow(vn(rest * 0.09 + 6.0), 9.0) * major * (1.0 - inner * 0.5);
  float clump = pow(nMid, 2.6) * major;
  vec3 haze = vec3(0.08, 0.11, 0.2);
  vec3 armBlue = vec3(0.4, 0.62, 1.0);
  vec3 armWarm = vec3(0.95, 0.78, 0.52);
  vec3 armCol = mix(armBlue, armWarm, inner);
  vec3 gold = vec3(1.0, 0.78, 0.42);
  vec3 pink = vec3(1.0, 0.28, 0.48);
  vec3 dustc = vec3(0.14, 0.07, 0.03);
  vec3 col = mix(haze, armCol, major * 0.95 + minor * 0.5);
  col = mix(col, armCol * 1.15, core * knots * 0.55);
  col = mix(col, armCol * 0.28, inter * 0.55);
  col = mix(col, mix(armCol, gold, inner), clump * 0.5);
  col = mix(col, pink, hii * 0.45);
  col = mix(col, dustc, lane * (0.45 + inner * 0.25));
  col = mix(col, gold, max(bulge, bar) * 0.92);
  float scaleH = mix(12.0, 38.0, max(bulge, bar));
  float vert = exp(-abs(vRel.y) / scaleH);
  float alpha =
    (0.07 + major * 0.36 + core * knots * 0.22 + minor * 0.1 + bulge * 0.26 + bar * 0.28 + inter * 0.05 + hii * 0.2 + clump * 0.1) *
    radial * vert * uOpacity;
  alpha *= smoothstep(10.0, 26.0, length(vRel));
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col * alpha * 1.55, alpha);
}
`;

function GalaxyVolume({ fadeRef }: { fadeRef: { current: number } }) {
  const mat = useRef<ShaderMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = galaxyTimeRef.current;
    mat.current.uniforms.uOpacity.value = fadeRef.current;
  });
  return (
    <mesh
      position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-1}
    >
      <circleGeometry args={[GALAXY_RADIUS * 1.04, 96]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VOL_VERT}
        fragmentShader={VOL_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uCenter: { value: GALAXY_CENTER_VEC },
          uRot: { value: GALAXY_ARM_ROT },
          uPitch: { value: GALAXY_PITCH },
          uBar: { value: GALAXY_BAR_ANGLE },
          uSunAngle: { value: GALAXY_SUN_ANGLE },
          uSunR: { value: GALAXY_SUN_R },
          uCamera: { value: CAM_POS },
          uPattern: { value: GALAXY_PATTERN_PERIOD },
        }}
        transparent
        depthWrite={false}
        depthTest
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

const BAR_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
uniform float uTime;
uniform float uPattern;
uniform vec3 uCenter;
void main() {
  vLocal = position;
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 p = world - uCenter;
  float ang = -uTime * 6.2831853 / uPattern;
  float c = cos(ang);
  float s = sin(ang);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + uCenter;
  vWorld = q;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
}
`;

const BAR_FRAG = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
uniform float uOpacity;
uniform vec3 uCenter;
uniform vec3 uCamera;
void main() {
  float dist = length(vWorld - uCenter);
  if (dist < 4.0) discard;
  float d = length(vLocal);
  float a = exp(-d * d * 4.4) * uOpacity * smoothstep(4.0, 6.4, dist);
  if (a < 0.02) discard;
  vec3 col = vec3(1.0, 0.76, 0.4);
  gl_FragColor = vec4(col * a, a);
}
`;

function BarCluster({ fadeRef }: { fadeRef: { current: number } }) {
  const bar = useRef<ShaderMaterial>(null);
  const bulge = useRef<ShaderMaterial>(null);
  const geo = useMemo(() => makeBar(22000), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(() => {
    const o = fadeRef.current;
    const t = galaxyTimeRef.current;
    if (bar.current) {
      bar.current.uniforms.uTime.value = t;
      bar.current.uniforms.uOpacity.value = o * 0.38;
    }
    if (bulge.current) {
      bulge.current.uniforms.uTime.value = t;
      bulge.current.uniforms.uOpacity.value = o * 0.38;
    }
  });
  return (
    <group>
      <GalaxyCloud geometry={geo} size={0.55} opacity={0.9} fadeRef={fadeRef} />
      <group
        position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}
        rotation={[0, -GALAXY_BAR_ANGLE, 0]}
      >
        <mesh scale={[GALAXY_BAR_LEN * 0.78, 30, 62]} renderOrder={-2}>
          <sphereGeometry args={[1, 32, 20]} />
          <shaderMaterial
            ref={bar}
            vertexShader={BAR_VERT}
            fragmentShader={BAR_FRAG}
            uniforms={{
              uTime: { value: 0 },
              uCenter: { value: GALAXY_CENTER_VEC },
              uCamera: { value: CAM_POS },
              uOpacity: { value: 0 },
              uPattern: { value: GALAXY_PATTERN_PERIOD },
            }}
            transparent
            depthWrite={false}
            depthTest
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh scale={[92, 26, 92]} renderOrder={-2}>
          <sphereGeometry args={[1, 32, 20]} />
          <shaderMaterial
            ref={bulge}
            vertexShader={BAR_VERT}
            fragmentShader={BAR_FRAG}
            uniforms={{
              uTime: { value: 0 },
              uCenter: { value: GALAXY_CENTER_VEC },
              uCamera: { value: CAM_POS },
              uOpacity: { value: 0 },
              uPattern: { value: GALAXY_PATTERN_PERIOD },
            }}
            transparent
            depthWrite={false}
            depthTest
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function MilkyWay() {
  const group = useRef<Group>(null);
  const here = useRef<Group>(null);
  const sgrStick = useRef<Group>(null);
  const hereStick = useRef<Group>(null);
  const { camera } = useThree();
  const visible = useSolar((s) => s.galaxyView);
  const showLabels = useSolar((s) => s.showLabels);
  const sgrASelected = useSolar((s) => s.sgrASelected);
  const selectSgrA = useSolar((s) => s.selectSgrA);
  const fade = useRef(0);
  const pick = usePick(() => selectSgrA(!sgrASelected));

  // ~460k points, ~590ms of generation. Nobody pays for it until they open
  // this view; before that MilkyWay is an empty invisible group.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (visible) setArmed(true);
  }, [visible]);

  const clouds = useMemo(
    () =>
      armed
        ? {
            stars: makeCloud(280000, "star", 4),
            dust: makeCloud(42000, "dust", 19),
            clusters: makeCloud(36000, "cluster", 27),
            core: makeCore(100000),
          }
        : null,
    [armed],
  );

  useEffect(() => {
    if (!clouds) return;
    return () => {
      for (const geometry of Object.values(clouds)) geometry.dispose();
    };
  }, [clouds]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const { paused, speed } = useSolar.getState();
    if (!visible) {
      fade.current = 0;
      if (group.current) group.current.visible = false;
      return;
    }
    if (!paused) galaxyTimeRef.current += d * speed * GALAXY_MYR_PER_SEC;
    fade.current = Math.min(1, fade.current + d * 2.8);
    CAM_POS.copy(camera.position);
    if (group.current) group.current.visible = true;
    if (here.current) {
      const cx = GALAXY_CENTER.x;
      const cz = GALAXY_CENTER.z;
      const r = Math.hypot(cx, cz);
      const base = Math.atan2(-cz, -cx);
      // Same rigid pattern as the clouds, so the Sun stays pinned to the
      // Orion spur it is drawn sitting in.
      const ang =
        base - (galaxyTimeRef.current / GALAXY_PATTERN_PERIOD) * Math.PI * 2;
      here.current.position.set(cx + Math.cos(ang) * r, 0, cz + Math.sin(ang) * r);
    }
    const dSgr = camera.position.distanceTo(GALAXY_CENTER_VEC);
    const sgrY = MathUtils.clamp(dSgr / 320, 0.95, 7.5);
    if (sgrStick.current) sgrStick.current.scale.set(1, sgrY, 1);
    if (here.current && hereStick.current) {
      const dHere = camera.position.distanceTo(here.current.position);
      const hereY = MathUtils.clamp(dHere / 280, 0.95, 8.5);
      hereStick.current.scale.set(1, hereY, 1);
    }
  });

  return (
    <group ref={group} visible={false}>
      {clouds ? (
        <>
          <GalaxyVolume fadeRef={fade} />
          <BarCluster fadeRef={fade} />
          <GalaxyCloud
            geometry={clouds.stars}
            size={0.56}
            opacity={1}
            fadeRef={fade}
          />
          <GalaxyCloud
            geometry={clouds.clusters}
            size={0.58}
            opacity={0.95}
            fadeRef={fade}
          />
          <GalaxyCloud
            geometry={clouds.dust}
            size={1.55}
            opacity={0.22}
            fadeRef={fade}
            additive={false}
          />
          <GalaxyCloud
            geometry={clouds.core}
            size={0.22}
            opacity={0.7}
            fadeRef={fade}
          />
          <BlackHole />
          <mesh position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]} {...pick}>
            <sphereGeometry args={[36, 16, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      ) : null}
      {visible && showLabels ? (
        <>
          <group position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}>
            <group ref={sgrStick} position={[0, 11, 0]}>
              <Line
                points={[
                  [0, 0, 0],
                  [0, 26, 0],
                ]}
                color="#efe8d8"
                transparent
                opacity={0.78}
                lineWidth={1.2}
                depthTest={false}
              />
              <Html position={[0, 30, 0]} center zIndexRange={[20, 0]}>
                <button
                  type="button"
                  className="planet-label"
                  data-active={sgrASelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSgrA(!sgrASelected);
                  }}
                >
                  Sagittarius A*
                </button>
              </Html>
            </group>
          </group>
          <group ref={here}>
            <mesh>
              <sphereGeometry args={[1.45, 12, 10]} />
              <meshBasicMaterial color="#dcecff" toneMapped={false} />
            </mesh>
            <group ref={hereStick} position={[0, 2.2, 0]}>
              <Line
                points={[
                  [0, 0, 0],
                  [0, 14, 0],
                ]}
                color="#efe8d8"
                transparent
                opacity={0.78}
                lineWidth={1.2}
                depthTest={false}
              />
              <Html position={[0, 17, 0]} center style={{ pointerEvents: "none" }}>
                <p className="whitespace-nowrap rounded-full bg-surface/80 px-2.5 py-1 text-[0.65rem] tracking-[0.14em] text-fg uppercase">
                  You are here
                </p>
              </Html>
            </group>
          </group>
        </>
      ) : null}
    </group>
  );
}

const NOISE_GLSL = /* glsl */ `
float hash11(float n) {
  return fract(sin(n) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07 + 9.2;
    a *= 0.5;
  }
  return v;
}
vec3 diskShade(float r, float ang, float t) {
  float lr = log(max(r, 0.2));
  vec2 ring = vec2(cos(ang), sin(ang));
  float n = fbm(ring * 2.6 + vec2(lr * 3.6 - t * 0.16, t * 0.05));
  float n2 = fbm(ring * 4.4 + vec2(r * 0.32, -t * 0.3));
  float flow = clamp(n * 0.55 + n2 * 0.6, 0.0, 1.0);
  float swirl = 0.5 + 0.5 * sin(4.0 * ang - 9.0 * lr + t * 0.5);
  flow = mix(flow, swirl, 0.28);
  float dop = pow(clamp(0.5 + 0.5 * sin(ang - 0.7), 0.0, 1.0), 1.15);
  vec3 cool = vec3(0.18, 0.03, 0.01);
  vec3 warm = vec3(1.0, 0.38, 0.08);
  vec3 hot = vec3(1.0, 0.92, 0.72);
  vec3 col = mix(cool, warm, flow);
  col = mix(col, hot, pow(flow, 1.4) * (0.35 + dop));
  col *= 0.45 + flow * 1.1;
  col *= 0.7 + dop * 1.85;
  return col * 1.65;
}
`;

const LENS_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const LENS_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
uniform vec3 uCenter;
uniform float uTime;
${NOISE_GLSL}
void main() {
  const float HALF = 36.0;
  const float rSh = 5.15;
  const float rPh = 6.05;
  const float rIn = 6.6;
  const float rOut = 26.0;

  vec3 ro = cameraPosition - uCenter;
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (abs(rd.y) > 0.0015) {
    float t = -ro.y / rd.y;
    if (t > 0.05) {
      vec3 hit = ro + rd * t;
      float rho = length(hit.xz);
      float ang = atan(hit.z, hit.x);
      float tApp = max(-dot(ro, rd), 0.0);
      float b = length(cross(ro, rd));
      bool behind = t > tApp + 0.4;
      bool blocked = behind && b < rSh;
      if (!blocked && rho > rIn && rho < rOut) {
        float inner = smoothstep(rIn, rIn + 2.2, rho);
        float outer = 1.0 - smoothstep(rOut * 0.62, rOut, rho);
        float dens = inner * outer * 1.05;
        col += diskShade(rho, ang, uTime) * dens;
        alpha = max(alpha, dens);
      }
    }
  }

  vec2 uv = vUv * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;
  float rw = r * HALF;
  float phi = atan(uv.y, uv.x);
  float dop = pow(clamp(0.5 + 0.5 * sin(phi - 0.55), 0.0, 1.0), 1.18);
  float top = smoothstep(-0.4, 0.55, uv.y);

  float shadow = 1.0 - smoothstep(rSh - 0.2, rSh + 0.75, rw);

  float wrapBand =
    smoothstep(rSh * 0.88, rSh + 0.35, rw) *
    (1.0 - smoothstep(rPh + 0.35, rPh + 3.4, rw));
  float wrap = wrapBand * (0.22 + 0.78 * top);
  float wrapRho = mix(rIn, rOut * 0.5, clamp((rw - rSh) / 5.0, 0.0, 1.0));
  float wrapAng = phi + 3.14159265;
  col += diskShade(wrapRho, wrapAng, uTime) * wrap * (1.15 + dop * 1.1);
  alpha = max(alpha, wrap * 0.9);

  float photon = exp(-pow((rw - rPh) * 2.7, 2.0));
  float photon2 = exp(-pow((rw - rPh * 1.22) * 4.6, 2.0)) * 0.55;
  col += vec3(1.0, 0.86, 0.55) * (photon * 2.15 + photon2 * 1.4) * (0.7 + dop * 2.2);
  alpha = max(alpha, (photon + photon2) * (0.75 + dop * 0.3));

  float hole = shadow * (1.0 - wrap * 0.9) * (1.0 - photon);
  col *= 1.0 - hole * 0.92;
  alpha = max(alpha, hole * 0.9);

  if (alpha < 0.02) discard;
  col = col / (1.0 + col * 0.18);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

function BlackHole() {
  const diskMat = useRef<ShaderMaterial>(null);
  const billboard = useRef<Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (diskMat.current) {
      diskMat.current.uniforms.uTime.value = galaxyTimeRef.current * 0.42;
    }
    if (billboard.current) billboard.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}>
      <mesh>
        <sphereGeometry args={[4.4, 32, 24]} />
        <meshBasicMaterial
          color="#000000"
          colorWrite={false}
          depthWrite
          depthTest
        />
      </mesh>
      <group ref={billboard}>
        <mesh renderOrder={50}>
          <planeGeometry args={[72, 72]} />
          <shaderMaterial
            ref={diskMat}
            vertexShader={LENS_VERT}
            fragmentShader={LENS_FRAG}
            uniforms={{
              uTime: { value: 0 },
              uCenter: { value: GALAXY_CENTER_VEC },
            }}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
