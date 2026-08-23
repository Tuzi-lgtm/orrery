/**
 * Generates the Milky Way point clouds off the main thread. ~460k points of
 * arm placement, noise and clustering is ~590ms of arithmetic; run inline it
 * hitched the frame that opened the galaxy view.
 */
import { makeBar, makeCloud, makeCore, type CloudBuffers, type CloudKind } from "./galaxy-generate";

export type GalaxyJob =
  | { kind: "cloud"; cloud: CloudKind; count: number; seed: number }
  | { kind: "bar"; count: number }
  | { kind: "core"; count: number };

export type GalaxyRequest = { id: number } & GalaxyJob;

export interface GalaxyResponse {
  id: number;
  buffers?: CloudBuffers;
  error?: string;
}

function run(job: GalaxyJob): CloudBuffers {
  switch (job.kind) {
    case "cloud":
      return makeCloud(job.count, job.cloud, job.seed);
    case "bar":
      return makeBar(job.count);
    case "core":
      return makeCore(job.count);
  }
}

self.onmessage = (event: MessageEvent<GalaxyRequest>) => {
  const { id, ...job } = event.data;
  try {
    const buffers = run(job);
    (self as unknown as Worker).postMessage({ id, buffers } satisfies GalaxyResponse, [
      buffers.positions.buffer,
      buffers.colors.buffer,
      buffers.sizes.buffer,
    ]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies GalaxyResponse);
  }
};
