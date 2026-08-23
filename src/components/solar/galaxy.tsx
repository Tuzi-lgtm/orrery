import { Html, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Group,
  MathUtils,
  NormalBlending,
  ShaderMaterial,
} from "three";
import { GALAXY_MYR_PER_SEC, galaxyTimeRef, useSolar } from "@/lib/solar/store";
import {
  GALAXY_ARM_ROT,
  GALAXY_BAR_ANGLE,
  GALAXY_BAR_LEN,
  GALAXY_CENTER,
  GALAXY_PATTERN_PERIOD,
  GALAXY_PITCH,
  GALAXY_RADIUS,
  GALAXY_SUN_ANGLE,
  GALAXY_SUN_R,
} from "@/lib/solar/galaxy-generate";
import { requestGalaxy, type GalaxyGeometries } from "@/lib/solar/galaxy-client";
import { BlackHole } from "./black-hole";
import { CAM_POS, GALAXY_CENTER_VEC } from "./galaxy-space";
import { usePick } from "./use-pick";


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

function BarCluster({
  fadeRef,
  geometry,
}: {
  fadeRef: { current: number };
  geometry: BufferGeometry;
}) {
  const bar = useRef<ShaderMaterial>(null);
  const bulge = useRef<ShaderMaterial>(null);
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
      <GalaxyCloud geometry={geometry} size={0.55} opacity={0.9} fadeRef={fadeRef} />
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

  // ~460k points. Nobody pays for it until they open this view, and the work
  // itself now happens in a worker -- before both, MilkyWay is an empty group.
  const [clouds, setClouds] = useState<GalaxyGeometries | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!visible || requested.current) return;
    requested.current = true;
    let live = true;
    void requestGalaxy().then((built) => {
      if (!live) {
        for (const geometry of Object.values(built)) geometry.dispose();
        return;
      }
      setClouds(built);
    });
    return () => {
      live = false;
    };
  }, [visible]);

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
          <BarCluster fadeRef={fade} geometry={clouds.bar} />
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
