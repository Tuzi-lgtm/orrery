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

## Deploy to Vercel (iPhone, no PC left on)

The project is already set up for Vercel. Easiest path if you have GitHub:

### GitHub + Vercel

In PowerShell, in `F:\AI\Grok\GrokBuild\orrery`:

```powershell
git init
git add .
git commit -m "Orrery"
gh repo create orrery --public --source=. --remote=origin --push
```

If you don’t have `gh`, create an empty repo at [github.com/new](https://github.com/new), then:

```powershell
git init
git add .
git commit -m "Orrery"
git branch -M main
git remote add origin https://github.com/YOUR_USER/orrery.git
git push -u origin main
```

Then:

1. Open [vercel.com/new](https://vercel.com/new)
2. Import the `orrery` repo
3. Leave the defaults (build is `npm run build`)
4. Click **Deploy**

You’ll get `https://orrery-xxxx.vercel.app`. Open it on the iPhone. Share → **Add to Home Screen**. Later pushes to `main` redeploy automatically.

No `DATABASE_URL` needed.

### Or just the Vercel CLI

```powershell
npx vercel login
npx vercel
npx vercel --prod
```
## Try it on an iPhone (local PC still running)

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
| `src/components/solar/camera-rig.tsx` | Click-to-focus fly-ins, orbit limits |
| `src/components/solar/hud.tsx` | Controls and info panel |
| `src/components/solar/galaxy.tsx` | Milky Way view |
| `src/components/solar/black-hole.tsx` | Sagittarius A* disc and photon ring |
| `src/components/solar/gravity-lens.tsx` | Screen-space lensing pass |
| `src/lib/solar/bodies.ts` | Planet data, Kepler orbits, true-size math |
| `src/lib/solar/store.ts` | Pause, speed, selected world, scale, mute |
| `src/lib/solar/galaxy-generate.ts` | Star / dust / bar / core generation |
| `src/lib/solar/texture-paint.ts` | Procedural maps, painted pixel by pixel |
| `src/lib/solar/audio.ts` | OM drone / whoosh |

Planet textures and the galaxy point clouds are generated in web workers
(`*-worker.ts`, dispatched through `worker-pool.ts`), so neither blocks the
first frame. The galaxy is only built once you open that view.

## Controls

- Drag to orbit, pinch/scroll to zoom
- Click a planet or use the world list to focus

| Key | Does |
|---|---|
| `Space` | Pause / resume |
| `[` `]` | Halve / double speed (0.25x–16x) |
| `Esc` | Back out: Sgr A* → Milky Way → system view |
| `0`–`8` | Jump to the Sun, then Mercury outward to Neptune |
| `G` | Milky Way view |
| `L` | World list |
| `M` | Mute |

Shortcuts are ignored while a modifier is held, so browser bindings still work.

- **True size** uses real diameter ratios. Distances stay compressed so Neptune fits.
- Orbits follow Kepler's second law, so eccentric worlds visibly speed up near
  the Sun — Mercury runs 2.3x faster at perihelion than at aphelion.
