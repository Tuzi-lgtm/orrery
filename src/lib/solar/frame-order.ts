/**
 * `useFrame` priorities, in one place because the ordering is load-bearing.
 *
 * R3F runs frame callbacks in ascending priority order, so anything that READS
 * the camera has to run after the rig has MOVED it:
 *
 *   clock (-3)  ->  bodies (-2)  ->  camera (-1)  ->  0  ->  1
 *                                                     |      |
 *                          drei <Html> projects labels        |
 *                          GravityLensPass reads the camera   |
 *                                    EffectComposer RENDERS the frame
 *
 * The camera rig used to sit at 50 — after the renderer. Every frame was drawn
 * with the camera still at the previous frame's position, so a followed planet
 * slid across the screen by however far it had moved that frame. Worst on the
 * inner planets, which move fastest and are framed closest.
 */
export const FRAME = {
  /** Advances simulated time. Must be first — everything else reads it. */
  clock: -3,
  /** Bodies write their world positions for the rig to follow. */
  bodies: -2,
  /** Camera follows the selected body. Must beat Html, the lens pass and the renderer. */
  camera: -1,
} as const;
