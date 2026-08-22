import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  RingGeometry,
  type Texture,
} from "three";
import {
  PLANETS,
  SUN,
  EARTH,
  bodyOrbit,
  bodyRadius,
  orbitPoint,
  satOrbit,
  satRadius,
  type BodyDef,
  type BodyId,
} from "@/lib/solar/bodies";
import { bodyWorldPos, simTimeRef, useSolar } from "@/lib/solar/store";
import {
  makeBlankTexture,
  makeCloudTexture,
  makeGlowTexture,
  makeMoonTexture,
  makePlanetBump,
  makePlanetTexture,
  makeRingTexture,
} from "@/lib/solar/textures";
import { PlanetMaterial } from "./planet-material";
import { SunMaterial } from "./sun-material";

const scratch = { x: 0, y: 0, z: 0 };
const dummy = new Object3D();

function useDisposableTexture(factory: () => Texture) {
  const tex = useMemo(factory, [factory]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export function SimulationClock() {
  useFrame((_, delta) => {
    const { paused, speed } = useSolar.getState();
    const d = Math.min(delta, 0.1);
    if (paused) return;
    simTimeRef.current += d * speed;
  }, -2);
  return null;
}

export function Star() {
  const group = useRef<Group>(null);
  const glowTex = useDisposableTexture(makeGlowTexture);
  const select = useSolar((s) => s.select);
  const scaleMode = useSolar((s) => s.scaleMode);
  const pointer = useRef({ x: 0, y: 0 });
  const radius = bodyRadius(SUN, scaleMode);
  const glow = scaleMode === "true" ? radius * 4.4 : 14;
  const haze = scaleMode === "true" ? radius * 10 : 32;

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * SUN.spin * 0.15;
    let pos = bodyWorldPos.get("sun");
    if (!pos) {
      pos = { x: 0, y: 0, z: 0 };
      bodyWorldPos.set("sun", pos);
    }
    pos.x = 0;
    pos.y = 0;
    pos.z = 0;
  }, -1);

  return (
    <group ref={group}>
      <mesh
        onPointerDown={(e) => {
          pointer.current.x = e.clientX;
          pointer.current.y = e.clientY;
        }}
        onClick={(e) => {
          const dx = e.clientX - pointer.current.x;
          const dy = e.clientY - pointer.current.y;
          if (dx * dx + dy * dy > 25) return;
          e.stopPropagation();
          select("sun");
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <SunMaterial />
      </mesh>
      <sprite scale={[glow, glow, 1]}>
        <spriteMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      <sprite scale={[haze, haze, 1]}>
        <spriteMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          opacity={0.28}
        />
      </sprite>
      <pointLight
        color="#fff6e0"
        intensity={scaleMode === "true" ? 22000 : 3200}
        decay={2}
      />
      <BodyLabel id="sun" name="Sun" radius={radius} />
    </group>
  );
}

export function Planet({ body }: { body: BodyDef }) {
  const group = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const texFactory = useMemo(
    () => () => makePlanetTexture(body.id, body.textureSeed),
    [body.id, body.textureSeed],
  );
  const tex = useDisposableTexture(texFactory);
  const rocky = body.kind === "terrestrial";
  const bumpFactory = useMemo(
    () => () =>
      rocky ? makePlanetBump(body.id, body.textureSeed) : makeBlankTexture(),
    [body.id, body.textureSeed, rocky],
  );
  const bump = useDisposableTexture(bumpFactory);
  const cloudFactory = useMemo(
    () => () =>
      body.id === "earth"
        ? makeCloudTexture(body.textureSeed + 9)
        : makeBlankTexture(),
    [body.id, body.textureSeed],
  );
  const cloudTex = useDisposableTexture(cloudFactory);
  const select = useSolar((s) => s.select);
  const scaleMode = useSolar((s) => s.scaleMode);
  const pointer = useRef({ x: 0, y: 0 });
  const radius = bodyRadius(body, scaleMode);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    orbitPoint(body, simTimeRef.current, scratch, scaleMode);
    g.position.set(scratch.x, scratch.y, scratch.z);
    let pos = bodyWorldPos.get(body.id);
    if (!pos) {
      pos = { x: scratch.x, y: scratch.y, z: scratch.z };
      bodyWorldPos.set(body.id, pos);
    } else {
      pos.x = scratch.x;
      pos.y = scratch.y;
      pos.z = scratch.z;
    }
    if (spin.current) {
      spin.current.rotation.y += delta * body.spin * 0.35;
    }
  }, -1);

  return (
    <group ref={group}>
      <group ref={spin} rotation={[0, 0, body.tilt]}>
        <mesh
          onPointerDown={(e) => {
            pointer.current.x = e.clientX;
            pointer.current.y = e.clientY;
          }}
          onClick={(e) => {
            const dx = e.clientX - pointer.current.x;
            const dy = e.clientY - pointer.current.y;
            if (dx * dx + dy * dy > 25) return;
            e.stopPropagation();
            select(body.id);
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[radius, 96, 64]} />
          <PlanetMaterial
            map={tex}
            bumpMap={rocky ? bump : null}
            bumpScale={rocky ? 0.055 : 0}
            roughness={rocky ? 0.82 : 0.48}
            gas={body.kind === "gas-giant" || body.kind === "ice-giant"}
            atmosphere={body.id === "earth"}
            refDist={bodyOrbit(EARTH, scaleMode)}
          />
        </mesh>
        {body.id === "earth" ? (
          <mesh>
            <sphereGeometry args={[radius * 1.018, 64, 48]} />
            <meshStandardMaterial
              map={cloudTex}
              transparent
              opacity={0.28}
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ) : null}
        {body.rings ? <PlanetRings body={body} radius={radius} /> : null}
      </group>
      {body.satellites?.map((sat) => (
        <Satellite key={sat.name} parent={body} sat={sat} />
      ))}
      <BodyLabel id={body.id} name={body.name} radius={radius} />
    </group>
  );
}

function createRingGeometry(inner: number, outer: number) {
  const geo = new RingGeometry(inner, outer, 192, 32);
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  if (!pos || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    const theta = Math.atan2(y, x);
    uv.setXY(
      i,
      (theta + Math.PI) / (Math.PI * 2),
      (r - inner) / Math.max(1e-6, outer - inner),
    );
  }
  uv.needsUpdate = true;
  return geo;
}

function PlanetRings({ body, radius }: { body: BodyDef; radius: number }) {
  const factory = useMemo(
    () => () => makeRingTexture(body.id === "uranus" ? "uranus" : "saturn"),
    [body.id],
  );
  const tex = useDisposableTexture(factory);
  const geometry = useMemo(() => {
    if (!body.rings) return new RingGeometry(1, 2, 3);
    return createRingGeometry(
      radius * body.rings.inner,
      radius * body.rings.outer,
    );
  }, [body, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!body.rings) return null;
  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        map={tex}
        transparent
        side={DoubleSide}
        depthWrite={false}
        roughness={0.72}
        metalness={0.12}
        alphaTest={0.02}
      />
    </mesh>
  );
}

function Satellite({
  parent,
  sat,
}: {
  parent: BodyDef;
  sat: NonNullable<BodyDef["satellites"]>[number];
}) {
  const ref = useRef<Mesh>(null);
  const scaleMode = useSolar((s) => s.scaleMode);
  const factory = useMemo(
    () => () => makeMoonTexture(sat.name.length * 13),
    [sat.name],
  );
  const tex = useDisposableTexture(factory);
  const radius = satRadius(parent, sat, scaleMode);
  const orbit = satOrbit(parent, sat, scaleMode);
  useFrame(() => {
    if (!ref.current) return;
    const a = (simTimeRef.current / sat.period) * Math.PI * 2 + sat.phase;
    ref.current.position.set(Math.cos(a) * orbit, 0, Math.sin(a) * orbit);
  }, -1);
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
}

function BodyLabel({
  id,
  name,
  radius,
}: {
  id: BodyId;
  name: string;
  radius: number;
}) {
  const show = useSolar((s) => s.showLabels);
  const selectedId = useSolar((s) => s.selectedId);
  const galaxyView = useSolar((s) => s.galaxyView);
  const select = useSolar((s) => s.select);
  if (!show || galaxyView) return null;
  if (selectedId && selectedId !== id) return null;
  const lift = radius + Math.max(0.22, radius * 0.18);
  return (
    <Html
      position={[0, lift, 0]}
      center
      style={{ pointerEvents: "none" }}
      zIndexRange={[20, 0]}
    >
      <div className="planet-label-anchor">
        <button
          type="button"
          className="planet-label"
          data-active={selectedId === id}
          onClick={(e) => {
            e.stopPropagation();
            select(id);
          }}
        >
          {name}
        </button>
      </div>
    </Html>
  );
}

export function OrbitTrails() {
  const show = useSolar((s) => s.showTrails);
  const scaleMode = useSolar((s) => s.scaleMode);
  if (!show) return null;
  return (
    <group>
      {PLANETS.map((body) => (
        <OrbitTrail key={`${body.id}-${scaleMode}`} body={body} />
      ))}
    </group>
  );
}

function OrbitTrail({ body }: { body: BodyDef }) {
  const scaleMode = useSolar((s) => s.scaleMode);
  const geometry = useMemo(() => {
    const segs = 160;
    const arr = new Float32Array((segs + 1) * 3);
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * body.period;
      orbitPoint(body, t, scratch, scaleMode);
      arr[i * 3] = scratch.x;
      arr[i * 3 + 1] = scratch.y;
      arr[i * 3 + 2] = scratch.z;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(arr, 3));
    return g;
  }, [body, scaleMode]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#c8ccd4" transparent opacity={0.16} />
    </lineLoop>
  );
}

export function AsteroidBelt() {
  const mesh = useRef<InstancedMesh>(null);
  const scaleMode = useSolar((s) => s.scaleMode);
  const count = 260;
  const mars = PLANETS.find((b) => b.id === "mars")!;
  const jupiter = PLANETS.find((b) => b.id === "jupiter")!;
  const inner = bodyOrbit(mars, scaleMode) + 2.2;
  const outer = bodyOrbit(jupiter, scaleMode) - 6;

  useEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    const span = Math.max(1.2, outer - inner);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = inner + Math.random() * span;
      dummy.position.set(
        Math.cos(a) * r,
        (Math.random() - 0.5) * (scaleMode === "true" ? 1.1 : 0.45),
        Math.sin(a) * r,
      );
      dummy.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      dummy.scale.setScalar(
        (scaleMode === "true" ? 0.03 : 0.018) + Math.random() * 0.05,
      );
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [count, inner, outer, scaleMode]);

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.012;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#7a7368" roughness={0.95} />
    </instancedMesh>
  );
}

export function SolarBodies() {
  return (
    <>
      <Star />
      {PLANETS.map((body) => (
        <Planet key={body.id} body={body} />
      ))}
    </>
  );
}
