import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useEffect } from "react";
import { useSolar } from "@/lib/solar/store";
import {
  AsteroidBelt,
  OrbitTrails,
  SimulationClock,
  SolarBodies,
} from "./bodies";
import { CameraRig } from "./camera-rig";

function CameraFar({ far }: { far: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, far]);
  return null;
}

export function Scene() {
  const selectedId = useSolar((s) => s.selectedId);
  const scaleMode = useSolar((s) => s.scaleMode);
  const dismissHint = useSolar((s) => s.dismissHint);
  const far = scaleMode === "true" ? 900 : 400;
  const maxDistance = scaleMode === "true" ? 520 : 150;
  const starRadius = scaleMode === "true" ? 320 : 140;

  return (
    <Canvas
      camera={{ position: [0, 26, 68], fov: 42, near: 0.08, far }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.toneMappingExposure = 1.2;
        camera.far = far;
        camera.updateProjectionMatrix();
      }}
      onPointerDown={dismissHint}
      style={{ touchAction: "none" }}
      aria-label="Interactive solar system"
    >
      <color attach="background" args={["#050508"]} />
      <ambientLight intensity={0.1} />
      <hemisphereLight args={["#c5cdd8", "#0a080c", 0.28]} />
      <Stars
        radius={starRadius}
        depth={60}
        count={4500}
        factor={3.2}
        saturation={0}
        fade
        speed={0.35}
      />
      <Suspense fallback={null}>
        <CameraFar far={far} />
        <SimulationClock />
        <SolarBodies />
        <OrbitTrails />
        <AsteroidBelt />
        <CameraRig />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={scaleMode === "true" ? 0.45 : 3.5}
          maxDistance={maxDistance}
          enablePan={false}
          autoRotate={selectedId === null}
          autoRotateSpeed={0.18}
        />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.85}
            mipmapBlur
            intensity={1.05}
            radius={0.85}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

