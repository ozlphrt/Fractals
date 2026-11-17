// js/main.js
// Main entry point orchestrating Raymarcher, State, Audio, Modulation, Camera, and UI

import { StateManager } from './state/parameters.js';
import { ModulationEngine } from './modulation/engine.js';
import { AudioEngine } from './audio/analyzer.js';
import { CameraController } from './camera/controller.js';
import { Raymarcher } from './renderer/raymarcher.js';
import { CockpitUI } from './ui/cockpit.js';

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

        this.lastTime = performance.now();
        this.fps = 60;
        this.fpsAlpha = 0.05;

        this.setupResize();
        this.startLoop();
    }

    setupResize() {
        const resize = () => {
            // Cap DPR at 1.0 for silky 60 FPS performance (FXAA delivers clean smooth edges)
            const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
            const w = window.innerWidth;
            const h = window.innerHeight;
            if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
                this.canvas.width = Math.floor(w * dpr);
                this.canvas.height = Math.floor(h * dpr);
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

            // 3. Step physical slider inertia (heavy moment of inertia for sliders)
            const slidersMoving = this.state.updateInertia(dt);

            // 4. Compute modulated parameter values for active formula and globals
            const modulatedValues = {};
            const activeFormula = this.state.getActiveFormula();
            const allParams = [...activeFormula.params, ...this.ui.sliderEls.values()].map(v => v.param || v);

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
            this.camera.updateAutoZoom(activeFormula, this.state.values, this.state.get('fov') || 60, dt);

            // 6. Camera flight / orbit update
            const camMoved = this.camera.update(dt, surfaceDE);

            const isMorphing = (this.state.morphAnim !== null);
            const isDynamic = camMoved || slidersMoving || isMorphing || (hasMod && (this.audio.isPlaying || this.modulation.bindings.size > 0));

            // 7. Raymarch render
            this.raymarcher.render(this.camera, now * 0.001, isDynamic);

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
