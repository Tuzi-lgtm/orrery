import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
} from "three";
import { GALAXY_MYR_PER_SEC, galaxyTimeRef, useSolar } from "@/lib/solar/store";

export const GALAXY_CENTER = { x: -460, y: 0, z: -90 };
export const GALAXY_RADIUS = 900;
const GALAXY_CENTER_VEC = new Vector3(GALAXY_CENTER.x, 0, GALAXY_CENTER.z);
const GALAXY_PITCH = 0.38;
const GALAXY_SUN_R = Math.hypot(GALAXY_CENTER.x, GALAXY_CENTER.z);
const GALAXY_SUN_ANGLE = Math.atan2(-GALAXY_CENTER.z, -GALAXY_CENTER.x);
const GALAXY_BAR_ANGLE = GALAXY_SUN_ANGLE + 0.48;
const GALAXY_ARM_ROT = GALAXY_BAR_ANGLE;
const GALAXY_BAR_LEN = GALAXY_RADIUS * 0.2;
const BAR_PERIOD = 28 + GALAXY_BAR_LEN * 0.12;

const STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float aSize;
uniform float uTime;
uniform vec3 uCenter;
uniform float uSize;
varying vec3 vColor;
void main() {
  vColor = color;
  vec3 p = position - uCenter;
  float r = length(p.xz);
  float period = 28.0 + r * 0.12;
  float ang = -uTime * 6.2831853 / period;
  float c = cos(ang);
  float s = sin(ang);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + uCenter;
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uSize * (240.0 / max(-mv.z, 1.0)), 1.2);
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = dot(uv, uv);
  float a = uOpacity * smoothstep(1.0, 0.15, d);
  if (a < 0.02) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

function hash(i: number, salt: number) {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function makeCloud(
  count: number,
  kind: "star" | "dust",
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
    const clump = Math.pow(hash(i, seed + 21), 1.85);

    let r: number;
    let theta: number;
    let spread: number;
    let size = 0.4;
    let bright = 0.4;

    if (kind === "dust") {
      const major = n < 0.74;
      const arm = major ? (i % 2) * Math.PI : Math.PI / 2 + (i % 2) * Math.PI;
      r = GALAXY_BAR_LEN + Math.pow(u, 0.68) * (GALAXY_RADIUS - GALAXY_BAR_LEN);
      theta = GALAXY_ARM_ROT + arm + Math.log(r / GALAXY_BAR_LEN) / pitch;
      spread = -12 - v * (28 + r * 0.08) + (w - 0.5) * 12;
      color.setRGB(0.42 + w * 0.12, 0.22 + w * 0.08, 0.12);
      size = 1.6 + q * 2.4;
      bright = 0.12 + w * 0.18;
    } else if (n < 0.14) {
      r = Math.pow(u, 0.52) * GALAXY_RADIUS * 0.18;
      theta = v * Math.PI * 2;
      spread = (w - 0.5) * (5 + r * 0.22);
      color.setRGB(1, 0.78 + w * 0.16, 0.42 + w * 0.12);
      size = 0.35 + q * 0.85 + (1 - r / (GALAXY_RADIUS * 0.2)) * 0.5;
      bright = 0.75 + w * 0.45;
    } else if (n < 0.32) {
      r = Math.pow(u, 0.5) * GALAXY_RADIUS;
      theta = v * Math.PI * 2;
      spread = (w - 0.5) * (36 + r * 0.09);
      color.setRGB(0.55 + w * 0.15, 0.62 + w * 0.12, 0.78);
      size = 0.2 + q * 0.28;
      bright = 0.1 + w * 0.14;
    } else {
      const major = n < 0.84;
      const arm = major ? (i % 2) * Math.PI : Math.PI / 2 + (i % 2) * Math.PI;
      r = GALAXY_BAR_LEN + Math.pow(u, 0.55) * (GALAXY_RADIUS - GALAXY_BAR_LEN);
      theta =
        GALAXY_ARM_ROT +
        arm +
        Math.log(r / GALAXY_BAR_LEN) / pitch +
        (clump - 0.5) * 0.14;
      spread =
        (v - 0.5) * (major ? 52 : 32) * (0.55 + clump * 1.1) * (1 + r * 0.003);
      if (q > 0.91) {
        color.setRGB(1, 0.32 + w * 0.18, 0.55 + w * 0.2);
        size = 0.9 + w * 1.5;
        bright = 0.55 + clump * 0.5;
      } else if (r > GALAXY_RADIUS * 0.38) {
        color.setRGB(0.55 + w * 0.2, 0.72 + w * 0.18, 1);
        size = 0.28 + q * 0.55;
        bright = (major ? 0.38 : 0.22) + clump * 0.5;
      } else {
        color.setRGB(0.95, 0.82 + w * 0.12, 0.62 + w * 0.1);
        size = 0.3 + q * 0.5;
        bright = (major ? 0.42 : 0.26) + clump * 0.4;
      }
    }

    const bulge = Math.exp(-((r / (GALAXY_RADIUS * 0.2)) ** 2));
    const x = cx + Math.cos(theta) * r + Math.cos(theta + 1.57) * spread;
    const z = cz + Math.sin(theta) * r + Math.sin(theta + 1.57) * spread;
    const thick = 5 + bulge * bulge * 38 + (1 - r / GALAXY_RADIUS) * 4;
    const y = (hash(i, seed + 11) - 0.5) * thick;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
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
    const side = (v - 0.5) * (14 + endFade ** 1.15 * 64);
    const y = (w - 0.5) * (8 + endFade ** 1.1 * 26);
    positions[i * 3] = cx + along * ca - side * sa;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = cz + along * sa + side * ca;
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
    const rho = Math.sqrt(-Math.log(u)) * 34;
    const theta = v * Math.PI * 2;
    const h = 5 + 34 * Math.exp(-((rho / 26) ** 2));
    const y = (w - 0.5) * h;
    positions[i * 3] = cx + Math.cos(theta) * rho;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = cz + Math.sin(theta) * rho;
    const fade = Math.exp(-((rho / 40) ** 2));
    const hot = 0.28 + fade * 0.75;
    colors[i * 3] = 1 * hot;
    colors[i * 3 + 1] = 0.78 * hot;
    colors[i * 3 + 2] = 0.42 * hot;
    sizes[i] = 0.16 + hash(i, 53) * 0.4 + fade * 0.35;
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
          uSize: { value: size },
          uOpacity: { value: opacity },
        }}
        transparent
        depthWrite={false}
        depthTest={false}
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

void main() {
  float r = length(vRel.xz);
  float R = 900.0;
  if (r > R) discard;
  float period = 28.0 + r * 0.12;
  float angOff = -uTime * 6.2831853 / period;
  float c = cos(angOff);
  float s = sin(angOff);
  vec2 rest = vec2(c * vRel.x + s * vRel.z, -s * vRel.x + c * vRel.z);
  float ang = atan(rest.y, rest.x);
  float spiral = ang - uRot - log(max(r, 1.0) / 180.0) / uPitch;
  float wrapped = mod(spiral + 6.2831853, 6.2831853);
  float d0 = min(wrapped, 6.2831853 - wrapped);
  float d1 = abs(wrapped - 3.14159265);
  float armDist = min(d0, d1);
  float major = exp(-pow(armDist / 0.78, 2.0));
  float d2 = abs(wrapped - 1.5707963);
  float d3 = abs(wrapped - 4.712389);
  float minor = exp(-pow(min(d2, d3) / 0.55, 2.0)) * 0.42;
  float lane = exp(-pow((armDist - 0.28) / 0.16, 2.0));
  vec2 bdir = vec2(cos(uBar), sin(uBar));
  float along = rest.x * bdir.x + rest.y * bdir.y;
  float perp = rest.x * bdir.y - rest.y * bdir.x;
  float bar = exp(-pow(perp / 44.0, 2.0)) * exp(-pow(along / 108.0, 2.0));
  float radial = smoothstep(10.0, 90.0, r) * (1.0 - smoothstep(R * 0.72, R, r));
  float bulge = exp(-pow(r / (R * 0.34), 2.0));
  radial = max(radial, max(bar * 0.95, bulge));
  vec3 haze = vec3(0.09, 0.12, 0.22);
  vec3 armCol = vec3(0.28, 0.46, 0.88);
  vec3 gold = vec3(0.95, 0.72, 0.38);
  vec3 pink = vec3(0.72, 0.2, 0.42);
  vec3 dustc = vec3(0.2, 0.1, 0.06);
  vec3 col = haze;
  col = mix(col, armCol, major * 0.85 + minor * 0.5);
  col = mix(col, pink, major * 0.16);
  col = mix(col, dustc, lane * 0.5);
  col = mix(col, gold, max(bulge, bar) * 0.9);
  float scaleH = mix(13.0, 40.0, max(bulge, bar));
  float vert = exp(-abs(vRel.y) / scaleH);
  float alpha =
    (0.09 + major * 0.16 + minor * 0.07 + bulge * 0.18 + bar * 0.22) *
    radial * vert * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col * alpha * 1.4, alpha);
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
        }}
        transparent
        depthWrite={false}
        depthTest={false}
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

const BAR_STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float aSize;
uniform float uSize;
uniform float uTime;
uniform float uPeriod;
varying vec3 vColor;
void main() {
  vColor = color;
  float ang = -uTime * 6.2831853 / uPeriod;
  float c = cos(ang);
  float s = sin(ang);
  vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uSize * (240.0 / max(-mv.z, 1.0)), 1.2);
}
`;

const BAR_VERT = /* glsl */ `
varying vec3 vLocal;
uniform float uTime;
uniform vec3 uCenter;
void main() {
  vLocal = position;
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 p = world - uCenter;
  float r = length(p.xz);
  float period = 28.0 + r * 0.12;
  float ang = -uTime * 6.2831853 / period;
  float c = cos(ang);
  float s = sin(ang);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + uCenter;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
}
`;

const BAR_FRAG = /* glsl */ `
varying vec3 vLocal;
uniform float uOpacity;
void main() {
  float d = length(vLocal);
  float a = exp(-d * d * 4.4) * uOpacity;
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
              uOpacity: { value: 0 },
            }}
            transparent
            depthWrite={false}
            depthTest={false}
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
              uOpacity: { value: 0 },
            }}
            transparent
            depthWrite={false}
            depthTest={false}
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
  const visible = useSolar((s) => s.galaxyView);
  const showLabels = useSolar((s) => s.showLabels);
  const sgrASelected = useSolar((s) => s.sgrASelected);
  const selectSgrA = useSolar((s) => s.selectSgrA);
  const fade = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  const stars = useMemo(() => makeCloud(145000, "star", 4), []);
  const dust = useMemo(() => makeCloud(33000, "dust", 19), []);
  const core = useMemo(() => makeCore(100000), []);

  useEffect(
    () => () => {
      stars.dispose();
      dust.dispose();
      core.dispose();
    },
    [stars, dust, core],
  );

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
    if (group.current) group.current.visible = true;
    if (here.current) {
      const cx = GALAXY_CENTER.x;
      const cz = GALAXY_CENTER.z;
      const r = Math.hypot(cx, cz);
      const base = Math.atan2(-cz, -cx);
      const period = 28 + r * 0.12;
      const ang = base - (galaxyTimeRef.current / period) * Math.PI * 2;
      here.current.position.set(cx + Math.cos(ang) * r, 0, cz + Math.sin(ang) * r);
    }
  });

  return (
    <group ref={group} visible={false}>
      <GalaxyVolume fadeRef={fade} />
      <BarCluster fadeRef={fade} />
      <GalaxyCloud geometry={stars} size={0.48} opacity={0.78} fadeRef={fade} />
      <GalaxyCloud
        geometry={dust}
        size={1.35}
        opacity={0.12}
        fadeRef={fade}
        additive={false}
      />
      <GalaxyCloud geometry={core} size={0.22} opacity={0.7} fadeRef={fade} />
      <BlackHole />
      <mesh
        position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}
        onPointerDown={(e) => {
          pointer.current.x = e.clientX;
          pointer.current.y = e.clientY;
        }}
        onClick={(e) => {
          const dx = e.clientX - pointer.current.x;
          const dy = e.clientY - pointer.current.y;
          if (dx * dx + dy * dy > 25) return;
          e.stopPropagation();
          selectSgrA(!sgrASelected);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[36, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {visible && showLabels ? (
        <>
          <Html
            position={[GALAXY_CENTER.x, 30, GALAXY_CENTER.z]}
            center
            zIndexRange={[20, 0]}
          >
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
          <group ref={here}>
            <Html position={[0, 8, 0]} center style={{ pointerEvents: "none" }}>
              <p className="whitespace-nowrap rounded-full bg-surface/80 px-2.5 py-1 text-[0.65rem] tracking-[0.14em] text-fg uppercase">
                You are here
              </p>
            </Html>
          </group>
        </>
      ) : null}
    </group>
  );
}

const CUTOUT_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CUTOUT_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float a = 1.0 - smoothstep(0.7, 1.0, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

const DISK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DISK_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;

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

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float t = uTime;
  vec2 ring = vec2(cos(ang), sin(ang));
  float lr = log(r + 0.04);

  float rs = 0.39;
  float rPh = 0.455;
  if (r < rs) discard;

  float n = fbm(ring * 2.15 + vec2(lr * 3.2 - t * 0.08, t * 0.04));
  float n2 = fbm(ring * 3.4 + vec2(r * 6.5, -t * 0.22));
  float flow = clamp(n * 0.65 + n2 * 0.5, 0.0, 1.0);
  float swirl = 0.5 + 0.5 * sin(2.0 * ang - 6.0 * lr + t * 0.25);
  flow = mix(flow, swirl, 0.16);

  float disk = smoothstep(rs, rs + 0.05, r) * (1.0 - smoothstep(0.58, 0.96, r));
  float photon = exp(-pow((r - rPh) * 52.0, 2.0));
  float cres = pow(clamp(0.5 + 0.5 * sin(ang - 0.9), 0.0, 1.0), 1.35);

  vec3 cool = vec3(0.28, 0.02, 0.0);
  vec3 warm = vec3(0.95, 0.22, 0.03);
  vec3 hot = vec3(1.0, 0.7, 0.22);

  vec3 col = mix(cool, warm, flow);
  col = mix(col, hot, flow * flow * (0.35 + cres));
  col *= disk * (0.35 + flow * 0.75) * (0.4 + cres * 0.9);
  col += vec3(1.0, 0.75, 0.32) * photon * (0.55 + cres * 2.4);

  float alpha = disk * (0.28 + flow * 0.55) + photon * (0.65 + cres * 0.5);
  if (alpha < 0.03) discard;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

function BlackHole() {
  const diskMat = useRef<ShaderMaterial>(null);
  const billboard = useRef<Group>(null);
  const { camera } = useThree();

  useFrame((_, delta) => {
    const { paused, speed } = useSolar.getState();
    if (diskMat.current && !paused) {
      diskMat.current.uniforms.uTime.value += delta * speed * 0.28;
    }
    if (billboard.current) billboard.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={[GALAXY_CENTER.x, 0, GALAXY_CENTER.z]}>
      <group ref={billboard}>
        <mesh renderOrder={990}>
          <planeGeometry args={[21.2, 21.2]} />
          <shaderMaterial
            ref={diskMat}
            vertexShader={DISK_VERT}
            fragmentShader={DISK_FRAG}
            uniforms={{ uTime: { value: 0 } }}
            transparent
            depthWrite={false}
            depthTest={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={1000}>
          <planeGeometry args={[8.5, 8.5]} />
          <shaderMaterial
            vertexShader={CUTOUT_VERT}
            fragmentShader={CUTOUT_FRAG}
            transparent
            depthWrite={false}
            depthTest={false}
            blending={NormalBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
