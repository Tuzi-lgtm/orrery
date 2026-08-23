import { useMemo } from "react";
import type { Texture } from "three";

const NOISE = /* glsl */ `
float pHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pHash(i), pHash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(pHash(i + vec3(0.0, 1.0, 0.0)), pHash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(pHash(i + vec3(0.0, 0.0, 1.0)), pHash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(pHash(i + vec3(0.0, 1.0, 1.0)), pHash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}
float pFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * pNoise(p);
    p = p * 2.05 + 0.17;
    a *= 0.5;
  }
  return v;
}
`;

export function PlanetMaterial({
  map,
  fallbackColor,
  bumpMap,
  bumpScale,
  roughness,
  gas,
  atmosphere,
  refDist,
}: {
  /** Absent until the texture worker delivers it. */
  map?: Texture | null;
  fallbackColor: string;
  bumpMap?: Texture | null;
  bumpScale: number;
  roughness: number;
  gas: boolean;
  atmosphere: boolean;
  refDist: number;
}) {
  const extras = useMemo(
    () => ({
      uGas: { value: gas ? 1 : 0 },
      uAtmos: { value: atmosphere ? 1 : 0 },
      uRefDist: { value: refDist },
    }),
    [gas, atmosphere, refDist],
  );
  extras.uRefDist.value = refDist;

  return (
    <meshStandardMaterial
      map={map ?? undefined}
      // three multiplies map by color, so the tint has to be white once the
      // map is in -- otherwise every surface would be shaded twice.
      color={map ? "#ffffff" : fallbackColor}
      bumpMap={bumpMap ?? undefined}
      bumpScale={bumpScale}
      roughness={roughness}
      metalness={0.04}
      onBeforeCompile={(shader) => {
        shader.uniforms.uGas = extras.uGas;
        shader.uniforms.uAtmos = extras.uAtmos;
        shader.uniforms.uRefDist = extras.uRefDist;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vWorldPos;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\nvObjPos = normalize(position);\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vWorldPos;\nuniform float uGas;\nuniform float uAtmos;\nuniform float uRefDist;\n${NOISE}`,
          )
          .replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
             float grainN = pFbm(vObjPos * mix(34.0, 18.0, uGas));
             float bandN = sin(vObjPos.y * 52.0 * uGas + grainN * 2.4);
             normal = normalize(normal + vObjPos * ((grainN - 0.5) * mix(0.4, 0.07, uGas) + bandN * 0.045 * uGas));
            `,
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
             float g = pFbm(vObjPos * mix(58.0, 30.0, uGas));
             float swirl = pFbm(vec3(vObjPos.x, vObjPos.y * 3.4, vObjPos.z) * 7.0);
             diffuseColor.rgb *= 0.88 + g * 0.2 + swirl * 0.05 * uGas;
            `,
          )
          .replace(
            "#include <opaque_fragment>",
            `float sunD = max(length(vWorldPos), 0.4);
             float inner = smoothstep(uRefDist * 1.08, uRefDist * 0.48, sunD);
             outgoingLight *= mix(1.0, 0.26, inner);
             #include <opaque_fragment>
             if (uAtmos > 0.5) {
               float fres = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 2.5);
               gl_FragColor.rgb += vec3(0.22, 0.42, 0.95) * fres * 0.42;
             }
            `,
          );
      }}
      customProgramCacheKey={() =>
        `planet-${gas ? 1 : 0}-${atmosphere ? 1 : 0}-${map ? 1 : 0}-dim2`
      }
    />
  );
}
