/**
 * Request/response plumbing shared by the texture and galaxy workers: hand it
 * a worker factory and it round-robins jobs across a small pool, matching
 * replies to callers by id.
 */
export interface Pool<Req, Res> {
  send(job: Req, transfer?: Transferable[]): Promise<Res>;
  /** Release the workers once the results are in and nothing else is queued. */
  dispose(): void;
}

type Waiting<Res> = {
  resolve: (value: Res) => void;
  reject: (err: Error) => void;
};

/**
 * `size` is capped against hardwareConcurrency, leaving a core for the main
 * thread. Returns null where workers are unavailable so callers can fall back
 * to running the job inline.
 */
export function createPool<Req extends object, Res extends { id: number }>(
  factory: () => Worker,
  size: number,
): Pool<Req, Res> | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;

  const waiting = new Map<number, Waiting<Res>>();
  let workers: Worker[];
  try {
    const count = Math.max(1, Math.min(size, (navigator.hardwareConcurrency || 4) - 1));
    workers = Array.from({ length: count }, () => {
      const worker = factory();
      worker.onmessage = (event: MessageEvent<Res>) => {
        const entry = waiting.get(event.data.id);
        if (!entry) return;
        waiting.delete(event.data.id);
        entry.resolve(event.data);
      };
      // A dead worker must not strand every caller queued behind it.
      worker.onerror = () => {
        for (const [id, entry] of waiting) {
          waiting.delete(id);
          entry.reject(new Error("worker crashed"));
        }
      };
      return worker;
    });
  } catch {
    return null;
  }

  let nextId = 1;
  let next = 0;

  return {
    send(job, transfer) {
      const id = nextId++;
      const worker = workers[next % workers.length]!;
      next += 1;
      return new Promise<Res>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        worker.postMessage({ ...job, id }, transfer ?? []);
      });
    },
    dispose() {
      if (waiting.size > 0) return;
      for (const worker of workers) worker.terminate();
      workers = [];
    },
  };
}
