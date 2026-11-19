# 🌌 3D Fractal Synth Studio

> Real-time WebGL2 raymarched 3D fractal synthesizer studio with continuous multi-axis orbit camera, auto-framing zoom, natural cosine earth materials, and generative morphing.

**Live Demo**: [https://ozlphrt.github.io/Fractals/](https://ozlphrt.github.io/Fractals/)

---

## ✨ Features

- **20 Fractal Formulas**:
  - **4D Quaternion Julia**: Hypercomplex 4D slices with continuous liquid ribbons and seahorse whorls.
  - **Mandelbulb**: Pure spherical harmonics 3D power fold.
  - **Kaleidoscopic IFS (KIFS)**: Polyhedral reflection folding and fractal origami.
  - Apollonian Gasket, Burning Ship, Jerusalem Cube, Juliabulb, Kaliset, and Pseudo-Kleinian.
  - Helix Bulb, Twist Cube, Ribbon Julia, Pearl Gasket, Wind Ship, Vault Cube, Lace Gasket, Cathedral, and Quartz Julia add adjustable twist and bend to existing formula families.
  - Menger cuts nested square tunnels through a cube. Tetra folds a pyramid into smaller tetrahedra.
- **Smart Auto-Framing Zoom**:
  - Uses a reference camera pose per formula, with collision clearance and a manual zoom override. The preview resizes when a settings panel opens.
- **Full 360° Momentum Orbit Controls**:
  - Desktop: 1-finger / mouse drag with unconstrained momentum glide, wheel zoom.
  - Mobile: Touch gestures with 1-finger 360° trackball orbit, 2-finger pinch-to-zoom, and 2-finger panning.
- **Natural Geological Cosine Palettes**:
  - 10 curated mineral, earth, obsidian, sandstone, marble, and quartz materials based on Inigo Quilez cosine palette math.
- **Organic Liquid Auto-Deformation**:
  - Continuous morphing between mathematical attractors without jumping discrete symmetries or crossing scale zeros.
- **Studio Cockpit HUD**:
  - Minimalist mobile-friendly UI with steppers for Formula & Material, and quick-access Settings and Dice Deform controls.
  - **Lighting** lets you switch between camera-tracked and manual sun angles. **Optics** includes a Background Detail slider.
  - **Creations Folder** saves palette, lighting, geometry, and camera settings locally or in a share link.
  - Add keyframes from any Settings tab. Each formula and tab has its own loop. **Shuffle** picks a new order each time you start. The dice adds a generated variation between each pair when enabled. Browser captures are saved locally. **Export All JS** downloads every capture in one file. Put it at `js/state/user-keyframes.js` to ship the captures with the project.
- **Audio & LFO Modulation Engine**:
  - Real-time audio FFT reactivity (mic or synth beat) + multi-waveform LFO parameter modulation.

---

## 🚀 Running Locally

Because this project uses native ES6 JavaScript modules, serve it using any local static HTTP server:

```bash
# Python 3
python -m http.server 8085

# Node npx
npx serve .
```

Open `http://localhost:8085` in any WebGL2-compatible browser (Chrome, Edge, Safari, Firefox).

Run the state, scene, and audio regression tests with Node.js 22.

```bash
node --experimental-default-type=module --test tests/studio.test.mjs
```

---

## 📄 License

MIT
