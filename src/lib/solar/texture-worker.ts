/**
 * Paints one procedural map per message and transfers the pixels back as an
 * ImageBitmap. Painting all eight planets plus bumps and clouds is ~2.5s of
 * tight per-pixel arithmetic; run on the main thread it froze the tab through
 * the whole of the first scene mount.
 */
import { paintTexture, type TextureKind } from "./texture-paint";

export interface TextureRequest {
  id: number;
  kind: TextureKind;
  body: string;
  seed: number;
}

export interface TextureResponse {
  id: number;
  pixels?: Uint8ClampedArray<ArrayBuffer>;
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<TextureRequest>) => {
  const { id, kind, body, seed } = event.data;
  try {
    const img = paintTexture(kind, body, seed);
    // The pixel buffer is transferred, not copied.
    (self as unknown as Worker).postMessage(
      {
        id,
        pixels: img.data,
        width: img.width,
        height: img.height,
      } satisfies TextureResponse,
      [img.data.buffer],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies TextureResponse);
  }
};
