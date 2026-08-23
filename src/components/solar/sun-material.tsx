import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, ShaderMaterial } from "three";
import { simTimeRef } from "@/lib/solar/store";

const vertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  varying vec3 vPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + 0.13;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vPos);
    float t = uTime;

    vec3 flow = vec3(t * 0.11, t * 0.045, -t * 0.07);
    float warp = fbm(p * 3.1 + flow * 0.35);
    vec3 q = p + warp * 0.32;

    float granule = fbm(q * 13.5 + flow);
    float fine = fbm(q * 34.0 - flow * 1.3);
    float cell = fbm(p * 5.2 + vec3(t * 0.06, -t * 0.04, t * 0.03));
    float spots = fbm(p * 2.15 + vec3(t * 0.018, t * 0.01, -t * 0.012));
    float spotCore = max(0.0, spots - 0.72) * 3.2;

    float heat = 0.72 + (granule - 0.5) * 0.34 + (fine - 0.5) * 0.16 + (cell - 0.5) * 0.06 - spotCore * 0.7;
    heat = clamp(heat, 0.16, 1.0);

    float pivot = 0.7;
    float mapped = heat;
    if (heat > pivot) {
      float s = (heat - pivot) / (1.0 - pivot);
      mapped = pivot + (1.0 - pivot) * pow(s, 0.36);
    }

    float punch = max(0.0, (mapped - pivot) / (1.0 - pivot));
    float flare = punch * punch;

    vec3 col;
    col.r = mapped;
    col.g = 150.0 / 255.0 * mapped + 28.0 / 255.0 + flare * 0.43;
    col.b = 28.0 / 255.0 * mapped + 6.0 / 255.0 + flare * 0.37;

    gl_FragColor = vec4(col * uTint, 1.0);
  }
`;

export function SunMaterial() {
  const ref = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTint: { value: new Color(2.8, 2.25, 1.35) },
    }),
    [],
  );

  // Photosphere churn runs on sim time so pause freezes the surface and the
  // speed control drives it, matching orbits and spin. Same rate at 1x.
  useFrame(() => {
    if (ref.current) ref.current.uniforms.uTime.value = simTimeRef.current;
  });

  return (
    <shaderMaterial
      ref={ref}
      vertexShader={vertex}
      fragmentShader={fragment}
      uniforms={uniforms}
      toneMapped={false}
    />
  );
}
