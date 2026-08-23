import { useFrame, useThree } from "@react-three/fiber";
import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { useMemo, useRef } from "react";
import { Uniform, Vector2, Vector3 } from "three";
import { GALAXY_CENTER_VEC } from "./galaxy";
import { useSolar } from "@/lib/solar/store";

const FRAG = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uK;
uniform float uAspect;

vec4 samplePolar(vec2 center, vec2 aspect, float r, float phi) {
  vec2 p = vec2(cos(phi), sin(phi)) * r;
  vec2 uv = center + p / aspect;
  return texture(inputBuffer, clamp(uv, 0.0, 1.0));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uK < 0.001 || uRadius < 0.0005) {
    outputColor = inputColor;
    return;
  }
  vec2 aspect = vec2(uAspect, 1.0);
  vec2 d = (uv - uCenter) * aspect;
  float r = length(d);
  float rSh = uRadius;
  if (r < rSh * 0.9) {
    outputColor = inputColor;
    return;
  }

  float fall = pow(1.0 - smoothstep(rSh * 0.92, rSh * 5.5, r), 1.15);
  float k = uK * fall;
  float phi = atan(d.y, d.x);
  phi += 0.22 * k * (rSh / max(r, rSh));

  float extra = k * rSh * rSh / max(r, rSh * 0.25);
  extra *= 1.0 + 1.4 * (1.0 - smoothstep(rSh, rSh * 2.4, r));
  float rSrc = max(r - extra, rSh * 1.03);

  float shear = 0.55 * k * pow(rSh / max(r, rSh), 1.6);
  vec4 a = samplePolar(uCenter, aspect, rSrc, phi);
  vec4 b = samplePolar(uCenter, aspect, rSrc, phi + shear);
  vec4 c = samplePolar(uCenter, aspect, rSrc, phi - shear);
  vec4 primary = (a * 0.5 + b * 0.25 + c * 0.25);

  float rSec = max(rSh * rSh / max(r, rSh), rSh * 1.04);
  vec4 sec = samplePolar(uCenter, aspect, rSec, phi + 3.14159265);
  float secW = k * smoothstep(rSh * 3.4, rSh * 1.05, r);
  outputColor = mix(primary, sec, clamp(secW * 0.5, 0.0, 0.55));
}
`;

export class GravityLensImpl extends Effect {
  constructor() {
    super("GravityLens", FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<any>>([
        ["uCenter", new Uniform(new Vector2(0.5, 0.5))],
        ["uRadius", new Uniform(0.08)],
        ["uK", new Uniform(0)],
        ["uAspect", new Uniform(1)],
      ]),
    });
  }
}

const GravityLens = wrapEffect(GravityLensImpl);

export function GravityLensPass() {
  const ref = useRef<GravityLensImpl>(null);
  const { camera, size } = useThree();
  const galaxyView = useSolar((s) => s.galaxyView);
  const ndc = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const edge = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const fx = ref.current;
    if (!fx) return;
    const u = fx.uniforms;
    u.get("uAspect")!.value = size.width / Math.max(size.height, 1);
    if (!galaxyView) {
      u.get("uK")!.value = 0;
      return;
    }
    ndc.copy(GALAXY_CENTER_VEC).project(camera);
    if (ndc.z < 0 || ndc.z > 1) {
      u.get("uK")!.value = 0;
      return;
    }
    u.get("uCenter")!.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    edge.copy(GALAXY_CENTER_VEC).addScaledVector(right, 5.2).project(camera);
    const rUv = Math.hypot(edge.x - ndc.x, edge.y - ndc.y) * 0.5;
    u.get("uRadius")!.value = Math.max(rUv, 0.006);
    u.get("uK")!.value = 1.05;
  });

  return <GravityLens ref={ref} />;
}
