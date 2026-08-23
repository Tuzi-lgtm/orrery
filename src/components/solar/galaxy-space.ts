import { Vector3 } from "three";
import { GALAXY_CENTER } from "@/lib/solar/galaxy-generate";

/** Galactic centre as a three vector, shared by the shaders and the lens pass. */
export const GALAXY_CENTER_VEC = new Vector3(GALAXY_CENTER.x, 0, GALAXY_CENTER.z);

/** Scratch camera position, refreshed once per frame by MilkyWay. */
export const CAM_POS = new Vector3();
