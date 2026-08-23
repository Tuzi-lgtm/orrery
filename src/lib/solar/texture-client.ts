import type { Texture } from "three";
import { makeTextureSync, textureFromPixels } from "./textures";
import type { TextureKind } from "./texture-paint";
import type { TextureRequest, TextureResponse } from "./texture-worker";

/**
 * Small pool of texture workers. Painting is embarrassingly parallel — one
 * request is one independent map — so a handful of workers turns ~2.5s of
 * serial main-thread work into roughly a quarter of that, off-thread.
 */
const POOL_SIZE = 4;

type Pending = {
  resolve: (tex: Texture) => void;
  reject: (err: Error) => void;
  kind: TextureKind;
};

let workers: Worker[] | null = null;
let nextWorker = 0;
let nextId = 1;
const pending = new Map<number, Pending>();

function supported() {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined"
  );
}

function pool(): Worker[] | null {
  if (workers) return workers;
  if (!supported()) return null;
  try {
    const size = Math.max(
      1,
      Math.min(POOL_SIZE, (navigator.hardwareConcurrency || 4) - 1),
    );
    workers = Array.from({ length: size }, () => {
      const worker = new Worker(
        new URL("./texture-worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<TextureResponse>) => {
        const { id, pixels, width, height, error } = event.data;
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (pixels && width && height) {
          entry.resolve(textureFromPixels(pixels, width, height, entry.kind));
        } else {
          entry.reject(new Error(error ?? "texture worker failed"));
        }
      };
      // A dead worker must not strand every caller waiting on it.
      worker.onerror = () => {
        for (const [id, entry] of pending) {
          pending.delete(id);
          entry.reject(new Error("texture worker crashed"));
        }
      };
      return worker;
    });
    return workers;
  } catch {
    workers = null;
    return null;
  }
}

/**
 * Paint one procedural map. Resolves off the main thread where the platform
 * allows it, and falls back to painting inline (blocking, as before) where it
 * does not — Safari before 16.4, or any context without OffscreenCanvas.
 */
export function requestTexture(
  kind: TextureKind,
  body: string,
  seed: number,
): Promise<Texture> {
  const available = pool();
  if (!available) {
    return Promise.resolve(makeTextureSync(kind, body, seed));
  }
  const id = nextId++;
  const worker = available[nextWorker % available.length]!;
  nextWorker += 1;
  return new Promise<Texture>((resolve, reject) => {
    pending.set(id, { resolve, reject, kind });
    worker.postMessage({ id, kind, body, seed } satisfies TextureRequest);
  }).catch(() => makeTextureSync(kind, body, seed));
}
