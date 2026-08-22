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
import { MilkyWay } from "./galaxy";

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
  const galaxyView = useSolar((s) => s.galaxyView);
  const sgrASelected = useSolar((s) => s.sgrASelected);
  const paused = useSolar((s) => s.paused);
  const dismissHint = useSolar((s) => s.dismissHint);
  const maxDistance = galaxyView ? 2800 : scaleMode === "true" ? 520 : 150;

  return (
    <Canvas
      camera={{ position: [0, 26, 68], fov: 42, near: 0.08, far: 8000 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.toneMappingExposure = 1.2;
        camera.far = 8000;
        camera.updateProjectionMatrix();
      }}
      onPointerDown={dismissHint}
      style={{ touchAction: "none" }}
      aria-label="Interactive solar system"
    >
      <color attach="background" args={["#050508"]} />
      <ambientLight intensity={galaxyView ? 0.22 : 0.1} />
      <hemisphereLight args={["#c5cdd8", "#0a080c", galaxyView ? 0.12 : 0.28]} />
      <group visible={!galaxyView}>
        <Stars
          radius={140}
          depth={60}
          count={4500}
          factor={3.2}
          saturation={0}
          fade
          speed={0.35}
        />
      </group>
      <Suspense fallback={null}>
        <CameraFar far={8000} />
        <SimulationClock />
        <group visible={!galaxyView}>
          <SolarBodies />
          <OrbitTrails />
          <AsteroidBelt />
        </group>
        <MilkyWay />
        <CameraRig />
        <OrbitControls
          makeDefault
          enableDamping={!galaxyView}
          dampingFactor={0.08}
          minDistance={
            sgrASelected ? 12 : galaxyView ? 120 : scaleMode === "true" ? 0.45 : 3.5
          }
          maxDistance={maxDistance}
          enablePan={false}
          autoRotate={selectedId === null && !sgrASelected && !paused}
          autoRotateSpeed={galaxyView ? 0.12 : 0.18}
        />
        <EffectComposer>
          <Bloom
            luminanceThreshold={sgrASelected ? 0.7 : galaxyView ? 0.82 : 1.15}
            mipmapBlur
            intensity={galaxyView ? 0.55 : 0.95}
            radius={0.85}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
