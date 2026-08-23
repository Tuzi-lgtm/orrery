import { useEffect, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";

/** Squared pixels the pointer may travel between down and up and still count as a click. */
const DRAG_SLOP_SQ = 25;

/**
 * Click-to-pick handlers for a body in the scene: swallows clicks that were
 * really orbit drags, and shows a pointer cursor while hovering.
 *
 * The cursor is also cleared on unmount — leaving the galaxy view (or toggling
 * scale) while hovering a planet unmounts the mesh without firing pointerout,
 * which used to leave the page stuck with a pointer cursor.
 */
export function usePick(onPick: () => void) {
  const down = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);

  useEffect(
    () => () => {
      if (hovering.current) document.body.style.cursor = "";
    },
    [],
  );

  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      down.current.x = e.clientX;
      down.current.y = e.clientY;
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const dx = e.clientX - down.current.x;
      const dy = e.clientY - down.current.y;
      if (dx * dx + dy * dy > DRAG_SLOP_SQ) return;
      e.stopPropagation();
      onPick();
    },
    onPointerOver: () => {
      hovering.current = true;
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      hovering.current = false;
      document.body.style.cursor = "";
    },
  };
}
