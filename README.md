# Orrery

Interactive 3D solar system. Orbiting planets, pause / speed, labels, orbital trails, click-to-focus camera, **Orrery / True size** scale, and optional OM ambient sound.

## Run locally

You need **Node.js 20+** and npm.

```bash
unzip orrery.zip
cd orrery
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080) on this computer.

## Try it on an iPhone

The zip is the source — iPhone Safari cannot run `npm` itself. Start the app on your computer, then open it from the phone on the **same Wi‑Fi**.

1. On the computer: `npm run dev`
2. Find that computer’s LAN address (macOS: System Settings → Network, or `ipconfig getifaddr en0`)
3. On the iPhone, open Safari to `http://YOUR_LAN_IP:8080`  
   Example: `http://192.168.1.23:8080`
4. If it fails to load, allow incoming connections for Node in the firewall.

**iPhone notes**
- Use Safari (WebGL2).
- Sound is off until you tap the speaker — required by iOS.
- Add to Home Screen works (touch icon is included).
- iPhone 12 and newer feel best. Low Power Mode may drop frames.

Optional login uses a local PGLite database. A real database is not required.

## Where the solar system lives

| Path | Role |
|---|---|
| `src/routes/index.tsx` | Home page |
| `src/components/solar/solar-app.tsx` | App shell (HUD + canvas) |
| `src/components/solar/scene.tsx` | Three.js canvas, lights, bloom |
| `src/components/solar/bodies.tsx` | Sun, planets, moons, rings, trails |
| `src/components/solar/planet-material.tsx` | Live close-up surface detail |
| `src/components/solar/sun-material.tsx` | Animated photosphere |
| `src/components/solar/camera-rig.tsx` | Click-to-focus fly-ins |
| `src/components/solar/hud.tsx` | Controls and info panel |
| `src/lib/solar/bodies.ts` | Planet data and true-size math |
| `src/lib/solar/store.ts` | Pause, speed, selected world, scale, mute |
| `src/lib/solar/textures.ts` | Procedural maps |
| `src/lib/solar/audio.ts` | OM drone / whoosh |

## Controls

- Drag to orbit, pinch/scroll to zoom
- Click a planet or use the world list to focus
- Space pause, `[` `]` speed, `Esc` system view, `M` mute
- **True size** uses real diameter ratios. Distances stay compressed so Neptune fits.
