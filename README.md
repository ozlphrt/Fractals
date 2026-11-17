# 🌌 3D Fractal Synth Studio

> Real-time WebGL2 raymarched 3D fractal synthesizer studio with continuous multi-axis orbit camera, auto-framing zoom, natural cosine earth materials, and generative morphing.

**Live Demo**: [https://ozlphrt.github.io/Fractals/](https://ozlphrt.github.io/Fractals/)

---

## ✨ Features

- **4 Dedicated Fractal Engines**:
  - **4D Quaternion Julia**: Hypercomplex 4D slices with continuous liquid ribbons and seahorse whorls (Default).
  - **Mandelbulb**: Pure spherical harmonics 3D power fold.
  - **Mandelbox**: Architectural box & sphere inversion folds with massive columns and arches.
  - **Kaleidoscopic IFS (KIFS)**: Polyhedral reflection folding and fractal origami.
- **Smart Auto-Framing Zoom**:
  - Automatically measures the 3D bounding extent of any active fractal and frames it dynamically so 80% of the object is in view (with 20% spilling past the viewport for deep immersion) across both mobile portrait and desktop screens.
- **Full 360° Momentum Orbit Controls**:
  - Desktop: 1-finger / mouse drag with unconstrained momentum glide, wheel zoom.
  - Mobile: Touch gestures with 1-finger 360° trackball orbit, 2-finger pinch-to-zoom, and 2-finger panning.
- **Natural Geological Cosine Palettes**:
  - 10 curated mineral, earth, obsidian, sandstone, marble, and quartz materials based on Inigo Quilez cosine palette math.
- **Organic Liquid Auto-Deformation**:
  - Continuous morphing between mathematical attractors without jumping discrete symmetries or crossing scale zeros.
- **Studio Cockpit HUD**:
  - Minimalist mobile-friendly UI with steppers for Formula & Material, and quick-access Settings and Dice Deform controls.
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

---

## 📄 License

MIT
