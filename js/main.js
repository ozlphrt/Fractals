// js/main.js
// Main entry point orchestrating Raymarcher, State, Audio, Modulation, Camera, and UI

import { StateManager } from './state/parameters.js';
import { ModulationEngine } from './modulation/engine.js';
import { AudioEngine } from './audio/analyzer.js';
import { CameraController } from './camera/controller.js';
import { Raymarcher } from './renderer/raymarcher.js';
import { CockpitUI } from './ui/cockpit.js';
import { GalleryManager } from './gallery/community.js';
import { FORMULAS } from './formulas/registry.js';
import { PALETTE_PRESETS } from './state/palettes.js';

class FractalSynthApp {
    constructor() {
        this.canvas = document.getElementById('fractal-canvas');
        this.state = new StateManager();
        this.modulation = new ModulationEngine();
        this.audio = new AudioEngine();
        this.camera = new CameraController(this.canvas, () => {
            this.raymarcher.resetAccumulation();
        });
        this.raymarcher = new Raymarcher(this.canvas, this.state);
        this.ui = new CockpitUI(this.state, this.modulation, this.audio, this.camera, this.raymarcher);

        // Community Folder & URL Creation Sharing System
        const self = this;
        const appAdapter = {
            canvas: this.canvas,
            formulaRegistry: {
                get activeFormula() { return self.state.getActiveFormula(); },
                getFormula: (id) => FORMULAS[id]
            },
            params: this.state,
            materials: {
                get currentPresetId() {
                    const idx = self.ui.activeMaterialIndex || 0;
                    return PALETTE_PRESETS[idx]?.id || 'dark_loam';
                },
                applyPreset: (id) => self.ui.applyMaterialPreset(id)
            },
            camera: this.camera,
            setFormula: (id, imm = true) => this.state.setFormula(id, imm)
        };
        this.gallery = new GalleryManager(appAdapter);

        this.lastTime = performance.now();
        this.fps = 60;
        this.fpsAlpha = 0.05;

        this.setupResize();
        this.startLoop();
    }

    setupResize() {
        const resize = () => {
            // Cap DPR at 1.0 and limit maximum dimensions to 1600x1000 so 4K/Retina displays maintain silky 60 FPS
            const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
            let w = Math.floor(window.innerWidth * dpr);
            let h = Math.floor(window.innerHeight * dpr);
            const maxDim = 1600;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.floor(w * ratio);
                h = Math.floor(h * ratio);
            }
            if (this.canvas.width !== w || this.canvas.height !== h) {
                this.canvas.width = w;
                this.canvas.height = h;
                this.raymarcher.resetAccumulation();
            }
        };
        window.addEventListener('resize', resize);
        resize();
    }

    startLoop() {
        const frame = (now) => {
            requestAnimationFrame(frame);

            const dt = Math.min(0.1, (now - this.lastTime) * 0.001);
            this.lastTime = now;

            // Instant FPS estimate
            const instantFps = dt > 0 ? (1.0 / dt) : 60;
            this.fps = this.fps * (1.0 - this.fpsAlpha) + instantFps * this.fpsAlpha;

            // 1. Audio update
            const audioBands = this.audio.update(dt);

            // 2. Modulation update
            this.modulation.update(dt);

            // 2b. Step 3D metamorphic formula morphing
            const isFormulaMorphing = this.state.updateFormulaMorph(dt);

            // 2c. Step synchronized parameter morphing (eliminates dual-rAF frame rate race condition)
            const isParamMorphing = this.state.updateParamMorph(dt);

            // 3. Step physical slider inertia (heavy moment of inertia for sliders)
            const slidersMoving = this.state.updateInertia(dt);

            // 4. Compute modulated parameter values for active formula and globals
            const modulatedValues = {};
            const activeFormula = this.state.getActiveFormula();
            const hasMod = this.modulation.hasActiveModulation();

            for (const p of activeFormula.params) {
                const baseVal = this.state.getCurrent(p.id);
                const modVal = this.modulation.computeModulatedValue(p.id, baseVal, p.min, p.max, audioBands, dt);
                modulatedValues[p.id] = modVal;
                // Temporarily mirror modulated value to state values for GPU upload without pushing history
                this.state.values[p.id] = modVal;
            }

            // 5. Mirror lightweight CPU Distance Estimator at camera position for proximity flight
            let surfaceDE = 1.0;
            if (activeFormula.cpuEvalDE) {
                try {
                    surfaceDE = activeFormula.cpuEvalDE(this.camera.pos, this.state.values);
                } catch (e) {
                    surfaceDE = 1.0;
                }
            }

            // 5b. Auto zoom to include 80% of the fractal inside the viewport at all times
            this.camera.updateAutoZoom(activeFormula, this.state.values, this.state.get('fov') || 60, dt, this.state.formulaMorph);

            // 6. Camera flight / orbit update
            const camMoved = this.camera.update(dt, surfaceDE);

            const isMorphing = (this.state.morphAnim !== null) || isFormulaMorphing || isParamMorphing;
            const isDynamic = camMoved || slidersMoving || isMorphing || (hasMod && (this.audio.isPlaying || this.modulation.bindings.size > 0));

            // 7. Raymarch render (with live FPS for dynamic resolution governor)
            this.raymarcher.render(this.camera, now * 0.001, isDynamic, this.fps);

            // 7. UI update
            this.ui.updateFrame(modulatedValues, audioBands, this.fps, surfaceDE, this.camera.currentSpeed);
        };
        requestAnimationFrame(frame);
    }
}

// Boot application once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new FractalSynthApp();
});
