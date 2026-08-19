import { useEffect, useState, type ComponentType } from "react";
import { Hud } from "./hud";

export function SolarApp() {
  const [Scene, setScene] = useState<ComponentType | null>(null);

  useEffect(() => {
    let live = true;
    void import("./scene").then((mod) => {
      if (live) setScene(() => mod.Scene);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="relative h-dvh overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        {Scene ? (
          <Scene />
        ) : (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-muted">Aligning the spheres</p>
          </div>
        )}
      </div>
      <Hud />
    </main>
  );
}
