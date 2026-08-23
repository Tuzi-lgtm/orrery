import type { Texture } from "three";
import { makeTextureSync, textureFromPixels } from "./textures";
import type { TextureKind } from "./texture-paint";
import type { TextureRequest, TextureResponse } from "./texture-worker";
import { createPool } from "./worker-pool";

/**
 * Painting is embarrassingly parallel — one request is one independent map —
 * so a handful of workers turns ~1.8s of serial main-thread work into roughly
 * a third of that, off-thread.
 */
const POOL_SIZE = 4;

let pool: ReturnType<typeof createPool<Omit<TextureRequest, "id">, TextureResponse>> | undefined;

function texturePool() {
  if (pool === undefined) {
    pool = createPool<Omit<TextureRequest, "id">, TextureResponse>(
      () =>
        new Worker(new URL("./texture-worker.ts", import.meta.url), {
          type: "module",
        }),
      POOL_SIZE,
    );
  }
  return pool;
}

/**
 * Paint one procedural map. Resolves off the main thread where the platform
 * allows it, and falls back to painting inline (blocking, as before) where it
 * does not.
 */
export async function requestTexture(
  kind: TextureKind,
  body: string,
  seed: number,
): Promise<Texture> {
  const workers = texturePool();
  if (!workers) return makeTextureSync(kind, body, seed);
  try {
    const { pixels, width, height, error } = await workers.send({
      kind,
      body,
      seed,
    });
    if (!pixels || !width || !height) {
      throw new Error(error ?? "texture worker failed");
    }
    return textureFromPixels(pixels, width, height, kind);
  } catch {
    return makeTextureSync(kind, body, seed);
  }
}
