import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import {
  TEXTURE_OPTS,
  canvasFromImageData,
  paintGlow,
  paintRing,
  paintTexture,
  type PaintedCanvas,
  type TextureKind,
  type TextureOpts,
} from "./texture-paint";

/**
 * Sampling setup shared by every procedural map, applied whether the pixels
 * were painted here or handed back from the texture worker as an ImageBitmap.
 */
export function applyTextureOpts(tex: Texture, opts: TextureOpts = {}) {
  if (opts.srgb !== false) tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = opts.mips !== false;
  tex.minFilter = tex.generateMipmaps ? LinearMipmapLinearFilter : LinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 8;
  tex.wrapS = opts.wrap === false ? ClampToEdgeWrapping : RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function toTexture(canvas: PaintedCanvas, opts: TextureOpts = {}) {
  return applyTextureOpts(
    new CanvasTexture(canvas as HTMLCanvasElement),
    opts,
  ) as CanvasTexture;
}

/** Build the same CanvasTexture the synchronous path would, from worker pixels. */
export function textureFromPixels(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  kind: TextureKind,
) {
  return toTexture(
    canvasFromImageData(new ImageData(pixels, width, height)),
    TEXTURE_OPTS[kind],
  );
}

/** Synchronous fallback for when the worker is unavailable. */
export function makeTextureSync(kind: TextureKind, body: string, seed: number) {
  return toTexture(
    canvasFromImageData(paintTexture(kind, body, seed)),
    TEXTURE_OPTS[kind],
  );
}

// Cheap enough (single-digit ms) to keep on the main thread.
export function makeGlowTexture(): Texture {
  return toTexture(paintGlow(), { mips: false, wrap: false });
}

export function makeRingTexture(kind: "saturn" | "uranus"): Texture {
  return toTexture(paintRing(kind), { mips: false, wrap: true });
}
