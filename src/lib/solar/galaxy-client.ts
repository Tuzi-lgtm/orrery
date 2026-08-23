import { BufferGeometry, Float32BufferAttribute } from "three";
import { makeBar, makeCloud, makeCore, type CloudBuffers } from "./galaxy-generate";
import type { GalaxyJob, GalaxyResponse } from "./galaxy-worker";
import { createPool } from "./worker-pool";

export interface GalaxyGeometries {
  stars: BufferGeometry;
  dust: BufferGeometry;
  clusters: BufferGeometry;
  core: BufferGeometry;
  bar: BufferGeometry;
}

/** The five clouds, in the order they are dispatched. */
const JOBS = {
  stars: { kind: "cloud", cloud: "star", count: 280_000, seed: 4 },
  dust: { kind: "cloud", cloud: "dust", count: 42_000, seed: 19 },
  clusters: { kind: "cloud", cloud: "cluster", count: 36_000, seed: 27 },
  core: { kind: "core", count: 100_000 },
  bar: { kind: "bar", count: 22_000 },
} satisfies Record<keyof GalaxyGeometries, GalaxyJob>;

function toGeometry({ positions, colors, sizes }: CloudBuffers) {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  return geo;
}

function runInline(job: GalaxyJob): CloudBuffers {
  switch (job.kind) {
    case "cloud":
      return makeCloud(job.count, job.cloud, job.seed);
    case "bar":
      return makeBar(job.count);
    case "core":
      return makeCore(job.count);
  }
}

/**
 * Build every cloud, off the main thread where possible. The 280k-point star
 * cloud dominates, so a pool of three is enough to hide the rest behind it.
 */
export async function requestGalaxy(): Promise<GalaxyGeometries> {
  const names = Object.keys(JOBS) as (keyof GalaxyGeometries)[];
  const pool = createPool<GalaxyJob, GalaxyResponse>(
    () => new Worker(new URL("./galaxy-worker.ts", import.meta.url), { type: "module" }),
    3,
  );

  const built = await Promise.all(
    names.map(async (name) => {
      if (!pool) return [name, toGeometry(runInline(JOBS[name]))] as const;
      try {
        const res = await pool.send(JOBS[name]);
        if (!res.buffers) throw new Error(res.error ?? "galaxy worker failed");
        return [name, toGeometry(res.buffers)] as const;
      } catch {
        return [name, toGeometry(runInline(JOBS[name]))] as const;
      }
    }),
  );

  // Generation happens once per session; the workers have nothing left to do.
  pool?.dispose();
  return Object.fromEntries(built) as unknown as GalaxyGeometries;
}
