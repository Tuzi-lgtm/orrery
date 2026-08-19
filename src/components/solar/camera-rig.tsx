import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type Object3D } from "three";
import { bodyRadius, getBody } from "@/lib/solar/bodies";
import { bodyWorldPos, useSolar } from "@/lib/solar/store";

const OVERVIEW_VISUAL = new Vector3(0, 26, 68);
const OVERVIEW_TRUE = new Vector3(0, 72, 188);
const ORIGIN = new Vector3(0, 0, 0);
const destCam = new Vector3();
const destTarget = new Vector3();
const deltaPos = new Vector3();

type OrbitLike = Object3D & {
  target: Vector3;
  enabled: boolean;
  update: () => void;
};

function frameBody(
  id: string,
  pos: { x: number; y: number; z: number },
  radius: number,
) {
  destTarget.set(pos.x, pos.y, pos.z);
  const dist = Math.max(radius * 5.8, id === "sun" ? 8 : 1.15);
  if (id === "sun") {
    destCam.set(dist * 0.7, dist * 0.45, dist);
    return;
  }
  const len = Math.hypot(pos.x, pos.y, pos.z) || 1;
  const rx = pos.x / len;
  const rz = pos.z / len;
  destCam.set(
    pos.x - rx * dist * 0.85 + rz * dist * 0.55,
    pos.y + dist * 0.38,
    pos.z - rz * dist * 0.85 - rx * dist * 0.55,
  );
}

export function CameraRig() {
  const { camera, controls } = useThree();
  const selectedId = useSolar((s) => s.selectedId);
  const focusGen = useSolar((s) => s.focusGen);
  const scaleMode = useSolar((s) => s.scaleMode);
  const fly = useRef(0);
  const startCam = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const lastPos = useRef(new Vector3());
  const following = useRef(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const oc = controls as OrbitLike | null;
    startCam.current.copy(camera.position);
    if (oc?.target) startTarget.current.copy(oc.target);
    fly.current = reduce.current ? 0 : 1;
    following.current = false;
    if (selectedId) {
      const p = bodyWorldPos.get(selectedId);
      if (p) lastPos.current.set(p.x, p.y, p.z);
    }
  }, [selectedId, focusGen, camera, controls]);

  useFrame((_, delta) => {
    const oc = controls as OrbitLike | null;
    if (!oc?.target) return;
    const d = Math.min(delta, 0.1);
    const overview = scaleMode === "true" ? OVERVIEW_TRUE : OVERVIEW_VISUAL;

    if (!selectedId) {
      oc.enabled = true;
      if (fly.current > 0) {
        fly.current = Math.max(0, fly.current - d * 1.15);
        const t = 1 - fly.current;
        const e = 1 - (1 - t) ** 3;
        camera.position.lerpVectors(startCam.current, overview, e);
        oc.target.lerpVectors(startTarget.current, ORIGIN, e);
        oc.update();
      }
      following.current = false;
      return;
    }

    const pos = bodyWorldPos.get(selectedId);
    if (!pos) return;
    const body = getBody(selectedId);
    frameBody(selectedId, pos, bodyRadius(body, scaleMode));

    if (fly.current > 0) {
      oc.enabled = false;
      fly.current = Math.max(0, fly.current - d * 1.35);
      const t = 1 - fly.current;
      const e = 1 - (1 - t) ** 3;
      camera.position.lerpVectors(startCam.current, destCam, e);
      oc.target.lerpVectors(startTarget.current, destTarget, e);
      if (fly.current === 0) {
        lastPos.current.copy(destTarget);
        following.current = true;
        oc.enabled = true;
      }
      oc.update();
      return;
    }

    if (!following.current) {
      lastPos.current.copy(destTarget);
      following.current = true;
      oc.enabled = true;
    }
    deltaPos.copy(destTarget).sub(lastPos.current);
    camera.position.add(deltaPos);
    oc.target.add(deltaPos);
    lastPos.current.copy(destTarget);
    oc.update();
  });

  return null;
}