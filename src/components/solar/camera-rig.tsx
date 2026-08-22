import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type Object3D } from "three";
import { bodyRadius, getBody } from "@/lib/solar/bodies";
import { bodyWorldPos, useSolar } from "@/lib/solar/store";
import { GALAXY_CENTER } from "./galaxy";

const OVERVIEW_VISUAL = new Vector3(0, 26, 68);
const OVERVIEW_TRUE = new Vector3(0, 72, 188);
const GALAXY_CAM = new Vector3(-40, 980, 720);
const ORIGIN = new Vector3(0, 0, 0);
const destCam = new Vector3();
const destTarget = new Vector3();
const deltaPos = new Vector3();
const galaxyLook = new Vector3(GALAXY_CENTER.x * 0.4, 40, GALAXY_CENTER.z * 0.4);
const SGR_CAM = new Vector3(GALAXY_CENTER.x + 28, 16, GALAXY_CENTER.z + 34);
const SGR_LOOK = new Vector3(GALAXY_CENTER.x, 0, GALAXY_CENTER.z);

type OrbitLike = Object3D & {
  target: Vector3;
  enabled: boolean;
  minDistance: number;
  maxDistance: number;
  enableDamping: boolean;
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

function applyLook(
  camera: { position: Vector3; lookAt: (v: Vector3) => void },
  oc: OrbitLike | null,
  fromCam: Vector3,
  fromTarget: Vector3,
  toCam: Vector3,
  toTarget: Vector3,
  e: number,
) {
  camera.position.lerpVectors(fromCam, toCam, e);
  destTarget.lerpVectors(fromTarget, toTarget, e);
  if (oc?.target) oc.target.copy(destTarget);
  camera.lookAt(destTarget);
}

export function CameraRig() {
  const { camera, controls } = useThree();
  const selectedId = useSolar((s) => s.selectedId);
  const focusGen = useSolar((s) => s.focusGen);
  const scaleMode = useSolar((s) => s.scaleMode);
  const galaxyView = useSolar((s) => s.galaxyView);
  const sgrASelected = useSolar((s) => s.sgrASelected);
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
    else startTarget.current.copy(ORIGIN);
    fly.current = reduce.current ? 0 : 1;
    following.current = false;
    if (selectedId) {
      const p = bodyWorldPos.get(selectedId);
      if (p) lastPos.current.set(p.x, p.y, p.z);
    }
    camera.far = galaxyView ? 8000 : scaleMode === "true" ? 900 : 400;
    camera.updateProjectionMatrix();
  }, [selectedId, focusGen, galaxyView, sgrASelected, scaleMode, camera, controls]);

  useFrame((_, delta) => {
    const oc = (controls as OrbitLike | null) ?? null;
    const d = Math.min(delta, 0.1);
    const overview = scaleMode === "true" ? OVERVIEW_TRUE : OVERVIEW_VISUAL;

    if (galaxyView) {
      camera.far = 8000;
      camera.updateProjectionMatrix();
      const toCam = sgrASelected ? SGR_CAM : GALAXY_CAM;
      const toLook = sgrASelected ? SGR_LOOK : galaxyLook;
      if (oc) {
        oc.minDistance = sgrASelected ? 18 : 120;
        oc.maxDistance = 2800;
        oc.enabled = fly.current <= 0;
      }
      if (fly.current > 0) {
        fly.current = Math.max(0, fly.current - d * (sgrASelected ? 1.2 : 0.95));
        const t = 1 - fly.current;
        const e = 1 - (1 - t) ** 2;
        applyLook(camera, oc, startCam.current, startTarget.current, toCam, toLook, e);
        if (fly.current === 0 && oc) oc.enabled = true;
      }
      following.current = false;
      return;
    }

    const comingHome = fly.current > 0 && camera.position.length() > 160;
    if (oc) {
      oc.minDistance = scaleMode === "true" ? 0.45 : 3.5;
      oc.maxDistance = comingHome ? 2800 : scaleMode === "true" ? 520 : 150;
    }

    if (!selectedId) {
      if (oc) oc.enabled = !comingHome;
      if (fly.current > 0) {
        fly.current = Math.max(0, fly.current - d * 1.15);
        const t = 1 - fly.current;
        const e = 1 - (1 - t) ** 3;
        applyLook(camera, oc, startCam.current, startTarget.current, overview, ORIGIN, e);
        if (fly.current === 0 && oc) {
          oc.enabled = true;
          oc.maxDistance = scaleMode === "true" ? 520 : 150;
          oc.update();
        }
      }
      following.current = false;
      return;
    }

    const pos = bodyWorldPos.get(selectedId);
    if (!pos) return;
    const body = getBody(selectedId);
    frameBody(selectedId, pos, bodyRadius(body, scaleMode));

    if (fly.current > 0) {
      if (oc) oc.enabled = false;
      fly.current = Math.max(0, fly.current - d * 1.35);
      const t = 1 - fly.current;
      const e = 1 - (1 - t) ** 3;
      applyLook(camera, oc, startCam.current, startTarget.current, destCam, destTarget, e);
      if (fly.current === 0) {
        lastPos.current.copy(destTarget);
        following.current = true;
        if (oc) oc.enabled = true;
      }
      oc?.update?.();
      return;
    }

    if (!oc?.target) return;
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
  }, 50);

  return null;
}
