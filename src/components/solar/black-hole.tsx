import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Group, ShaderMaterial } from "three";
import { GALAXY_CENTER } from "@/lib/solar/galaxy-generate";
import { galaxyTimeRef } from "@/lib/solar/store";
import { GALAXY_CENTER_VEC } from "./galaxy-space";

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

export function BlackHole() {
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
        <meshBasicMaterial color="#000000" colorWrite={false} depthWrite depthTest />
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
