import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

function hash3(x: number, y: number, z: number, seed: number) {
  let n =
    (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1103515245) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  let n = 0;
  for (let i = 0; i <= 1; i++) {
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        const h = hash3(xi + i, yi + j, zi + k, seed);
        n += h * (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? w : 1 - w);
      }
    }
  }
  return n;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves = 5) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise3(x * freq, y * freq, z * freq, seed + i * 19);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

function hash(x: number, y: number, seed: number) {
  let n = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

type Sph = { x: number; y: number; z: number; lat: number };

function sphereP(u: number, v: number): Sph {
  const lon = u * Math.PI * 2;
  const lat = (0.5 - v) * Math.PI;
  const cl = Math.cos(lat);
  return {
    x: cl * Math.cos(lon),
    y: Math.sin(lat),
    z: cl * Math.sin(lon),
    lat: (v - 0.5) * 2,
  };
}

function sphFbm(p: Sph, scale: number, seed: number, octaves: number) {
  return fbm3(p.x * scale, p.y * scale, p.z * scale, seed, octaves);
}

export function planetHeight(id: string, p: Sph, seed: number) {
  switch (id) {
    case "mercury": {
      const n = sphFbm(p, 7, seed, 5);
      const crater = Math.max(0, 0.58 - sphFbm(p, 16, seed + 3, 4));
      return 0.42 + n * 0.35 - crater * 0.45;
    }
    case "venus":
      return 0.45 + sphFbm(p, 5, seed, 5) * 0.25;
    case "earth":
      return sphFbm(p, 2.6, seed, 6);
    case "mars":
      return 0.4 + sphFbm(p, 5.5, seed, 5) * 0.5;
    default:
      return 0.5 + sphFbm(p, 4, seed, 3) * 0.08;
  }
}

function toTexture(
  canvas: HTMLCanvasElement,
  opts: { mips?: boolean; wrap?: boolean; srgb?: boolean } = {},
): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = opts.mips !== false;
  tex.minFilter = tex.generateMipmaps ? LinearMipmapLinearFilter : LinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 8;
  tex.wrapS = opts.wrap === false ? ClampToEdgeWrapping : RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function paint(
  w: number,
  h: number,
  fn: (u: number, v: number, p: Sph) => [number, number, number, number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fn(u, v, sphereP(u, v));
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function makeBlankTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return toTexture(canvas, { mips: false, wrap: false });
}

export function makeGlowTexture(): Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.72);
  g.addColorStop(0, "rgba(255, 248, 230, 0.95)");
  g.addColorStop(0.12, "rgba(255, 220, 150, 0.42)");
  g.addColorStop(0.28, "rgba(255, 180, 90, 0.16)");
  g.addColorStop(0.5, "rgba(255, 150, 60, 0.05)");
  g.addColorStop(0.78, "rgba(255, 130, 40, 0.012)");
  g.addColorStop(1, "rgba(255, 120, 30, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, { mips: false, wrap: false });
}

export function makePlanetTexture(id: string, seed: number): Texture {
  const canvas = paint(1024, 512, (u, v, p) => {
    switch (id) {
      case "mercury":
        return mercury(p, seed);
      case "venus":
        return venus(p, seed);
      case "earth":
        return earth(p, seed);
      case "mars":
        return mars(p, seed);
      case "jupiter":
        return jupiter(p, u, v, seed);
      case "saturn":
        return saturn(p, v, seed);
      case "uranus":
        return ice(p, v, seed, 150, 205, 210);
      case "neptune":
        return ice(p, v, seed, 40, 90, 190);
      default:
        return [180, 180, 180, 255];
    }
  });
  return toTexture(canvas);
}

export function makePlanetBump(id: string, seed: number): Texture {
  const canvas = paint(512, 256, (_u, _v, p) => {
    const h = Math.max(0, Math.min(1, planetHeight(id, p, seed)));
    const c = h * 255;
    return [c, c, c, 255];
  });
  return toTexture(canvas, { srgb: false });
}

export function makeCloudTexture(seed: number): Texture {
  const canvas = paint(1024, 512, (_u, v, p) => {
    const n = sphFbm(p, 4.2, seed, 6);
    const streak = sphFbm(p, 9, seed + 8, 3);
    const band = Math.sin(v * Math.PI);
    const a = Math.max(0, n * 0.7 + streak * 0.3 - 0.46) * 2.6 * band;
    const c = 236 + n * 16;
    return [c, c, c + 4, Math.min(255, a * 220)];
  });
  return toTexture(canvas);
}

function saturnRing(t: number): [number, number, number, number] {
  const grain = 0.78 + 0.22 * hash(Math.floor(t * 420), 3, 9);
  let density = 0;
  if (t < 0.1) density = 0.12 * (t / 0.1);
  else if (t < 0.28) density = 0.22 + 0.1 * Math.sin((t - 0.1) * 40);
  else if (t < 0.56) density = 0.82 + 0.12 * Math.sin(t * 90);
  else if (t < 0.64) density = 0.03;
  else if (t < 0.88) density = 0.48 + 0.1 * Math.sin(t * 70);
  else if (t < 0.905) density = 0.04;
  else if (t < 0.97) density = 0.32;
  else density = 0.08 * (1 - (t - 0.97) / 0.03);
  const edge = Math.min(1, t * 18) * Math.min(1, (1 - t) * 22);
  const alpha = Math.max(0, Math.min(1, density * grain * edge));
  const warm = 0.55 + density * 0.45;
  return [218 * warm, 198 * warm, 158 * warm, alpha * 235];
}

function uranusRing(t: number): [number, number, number, number] {
  const rings = [0.22, 0.48, 0.71, 0.88];
  let density = 0;
  for (const c of rings) {
    const d = Math.abs(t - c);
    if (d < 0.018) density = Math.max(density, 1 - d / 0.018);
  }
  const edge = Math.min(1, t * 10) * Math.min(1, (1 - t) * 10);
  const alpha = density * 0.45 * edge;
  return [196, 214, 222, alpha * 180];
}

export function makeRingTexture(kind: "saturn" | "uranus"): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(8, 1024);
  const data = img.data;
  for (let y = 0; y < 1024; y++) {
    const rgba = kind === "saturn" ? saturnRing(y / 1023) : uranusRing(y / 1023);
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, { mips: false, wrap: true });
}

function mercury(p: Sph, seed: number): [number, number, number, number] {
  const h = planetHeight("mercury", p, seed);
  const fine = sphFbm(p, 26, seed + 5, 3);
  const g = 70 + h * 150 + fine * 14;
  return [g + 10, g, g - 8, 255];
}

function venus(p: Sph, seed: number): [number, number, number, number] {
  const h = planetHeight("venus", p, seed);
  const streak = sphFbm({ ...p, x: p.x + p.y * 0.4 }, 8, seed + 4, 4);
  return [190 + h * 70 + streak * 12, 150 + h * 55, 92 + h * 28, 255];
}

function earth(p: Sph, seed: number): [number, number, number, number] {
  const land = planetHeight("earth", p, seed);
  const fine = sphFbm(p, 22, seed + 9, 3);
  if (Math.abs(p.lat) > 0.76 + land * 0.1) {
    const c = 228 + land * 18 + fine * 8;
    return [c, c, 246, 255];
  }
  if (land > 0.5) {
    const desert = Math.exp(-(((Math.abs(p.lat) - 0.22) * 4.2) ** 2)) * (0.4 + land);
    const mtn = Math.max(0, land - 0.68);
    return [
      52 + land * 38 + desert * 90 + mtn * 40 + fine * 12,
      78 + land * 70 - desert * 30 + mtn * 10 + fine * 8,
      46 + land * 22 - desert * 20 + mtn * 8,
      255,
    ];
  }
  const deep = 0.38 + sphFbm(p, 2.2, seed + 7, 4) * 0.28;
  return [14 + deep * 28, 62 + deep * 55, 128 + deep * 90, 255];
}

function mars(p: Sph, seed: number): [number, number, number, number] {
  const h = planetHeight("mars", p, seed);
  const dark = sphFbm(p, 2.4, seed + 6, 4);
  const fine = sphFbm(p, 24, seed + 2, 3);
  if (Math.abs(p.lat) > 0.84 + h * 0.04) return [222, 224, 232, 255];
  return [
    90 + h * 150 - dark * 28 + fine * 12,
    40 + h * 70 - dark * 10 + fine * 6,
    24 + h * 28,
    255,
  ];
}

function jupiter(
  p: Sph,
  u: number,
  v: number,
  seed: number,
): [number, number, number, number] {
  const warp = sphFbm(p, 3.2, seed, 5);
  const bands = Math.sin(v * Math.PI * 16 + warp * 3.2);
  const n = sphFbm(p, 8, seed + 2, 4);
  const fine = sphFbm(p, 22, seed + 8, 3);
  const mix = 0.5 + bands * 0.32 + n * 0.16 + fine * 0.08;
  const du = Math.min(Math.abs(u - 0.32), 1 - Math.abs(u - 0.32));
  const spot = Math.exp(-((du * 10) ** 2 + ((v - 0.58) * 18) ** 2)) * 0.88;
  return [
    188 + mix * 46 + spot * 52,
    138 + mix * 32 - spot * 42,
    86 + mix * 22 - spot * 18,
    255,
  ];
}

function saturn(p: Sph, v: number, seed: number): [number, number, number, number] {
  const warp = sphFbm(p, 2.6, seed, 4);
  const bands = Math.sin(v * Math.PI * 12 + warp * 1.8);
  const n = sphFbm(p, 6, seed + 3, 4);
  const mix = 0.54 + bands * 0.22 + n * 0.12;
  return [208 + mix * 34, 182 + mix * 28, 126 + mix * 22, 255];
}

function ice(
  p: Sph,
  v: number,
  seed: number,
  r0: number,
  g0: number,
  b0: number,
): [number, number, number, number] {
  const n = sphFbm(p, 4.5, seed, 5);
  const storm = sphFbm(p, 10, seed + 5, 3);
  const band = 0.84 + Math.sin(v * Math.PI * 7 + n) * 0.08 + n * 0.12 + storm * 0.05;
  return [r0 * band, g0 * band, b0 * band + n * 18, 255];
}

export function makeMoonTexture(seed: number): Texture {
  const canvas = paint(512, 256, (_u, _v, p) => {
    const n = sphFbm(p, 7, seed, 6);
    const crater = Math.max(0, 0.6 - sphFbm(p, 16, seed + 4, 4));
    const c = 132 + n * 78 - crater * 40;
    return [c, c - 4, c - 10, 255];
  });
  return toTexture(canvas);
}
