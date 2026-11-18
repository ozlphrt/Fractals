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

        // Initialize camera to active formula's dramatic canonical framing
        const initialFormula = this.state.getActiveFormula();
        if (initialFormula && initialFormula.defaultCam) {
            this.camera.resetView(initialFormula.defaultCam.pos, initialFormula.defaultCam.target);
        }

        // Initialize sun azimuth and elevation to align with initial camera viewpoint
        this.updateSunAutoTracking(1.0);

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

        // Periodic cinematic camera preset cycling
        this.presetTimer = 0.0;
        this.presetCycleInterval = 28.0 + Math.random() * 10.0;

        this.setupResize();
        this.startLoop();
    }

    // Continuous smooth and gradual auto-adjustment of Sun Light 1 azimuth and elevation
    // Ensures the object is always beautifully and consistently illuminated from the camera's viewpoint
    updateSunAutoTracking(dt) {
        // If user is actively dragging sun sliders in the UI, pause auto-tracking for 4s
        if (this.ui && this.ui.isUserAdjustingSun && (performance.now() - this.ui.lastSunUserInteractionTime) < 4000) {
            return;
        }

        // Compute direction vector from view target towards camera
        let dx, dy, dz;
        if (this.camera.mode === 'flight') {
            const fwd = this.camera.getForwardVector();
            dx = -fwd[0];
            dy = -fwd[1];
            dz = -fwd[2];
        } else {
            dx = this.camera.pos[0] - this.camera.target[0];
            dy = this.camera.pos[1] - this.camera.target[1];
            dz = this.camera.pos[2] - this.camera.target[2];
        }

        const len = Math.hypot(dx, dy, dz) || 1.0;
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        // Angle in horizontal plane towards camera
        const camAzimuth = Math.atan2(nz, nx);
        
        // Sculpted 3/4 photographic key lighting offset (+25° / +0.44 rad)
        let targetSunAzimuth = camAzimuth + 0.44;
        while (targetSunAzimuth > Math.PI) targetSunAzimuth -= Math.PI * 2;
        while (targetSunAzimuth < -Math.PI) targetSunAzimuth += Math.PI * 2;

        // Flattering 35° to 55° elevation above camera horizon
        const baseElevation = Math.asin(Math.max(-0.95, Math.min(0.95, ny)));
        const targetSunElevation = Math.max(0.40, Math.min(1.30, baseElevation + 0.45));

        // Current sun azimuth and elevation
        let curAz = this.state.values['sun_azimuth'] ?? 0.76;
        let curEl = this.state.values['sun_elevation'] ?? 0.90;

        // Shortest arc angular difference for azimuth (handles wraparound seamlessly)
        let dAz = targetSunAzimuth - curAz;
        while (dAz > Math.PI) dAz -= Math.PI * 2;
        while (dAz < -Math.PI) dAz += Math.PI * 2;

        let dEl = targetSunElevation - curEl;

        // Smooth gradual easing (critically damped exponential glide)
        const lerpFactor = 1.0 - Math.exp(-2.2 * dt);
        
        let newAz = curAz + dAz * lerpFactor;
        while (newAz > Math.PI) newAz -= Math.PI * 2;
        while (newAz < -Math.PI) newAz += Math.PI * 2;

        let newEl = curEl + dEl * lerpFactor;
        newEl = Math.max(0.1, Math.min(1.5, newEl));

        this.state.values['sun_azimuth'] = newAz;
        this.state.values['sun_elevation'] = newEl;
        this.state.targetValues['sun_azimuth'] = newAz;
        this.state.targetValues['sun_elevation'] = newEl;

        // Throttled UI sync
        if (this.ui && (!this._lastSunUiSync || (performance.now() - this._lastSunUiSync) > 150)) {
            this._lastSunUiSync = performance.now();
            this.ui.syncSliderUI('sun_azimuth', newAz);
            this.ui.syncSliderUI('sun_elevation', newEl);
        }
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

            // 5. Connect collision provider & settings to camera
            const collisionEnabled = (this.state.get('collision_enabled') ?? 1) === 1;
            const collisionClearance = this.state.get('collision_clearance') ?? 0.02;
            this.camera.setCollisionSettings(collisionEnabled, collisionClearance);
            
            if (activeFormula.cpuEvalDE) {
                this.camera.setCollisionProvider((p) => {
                    try {
                        return activeFormula.cpuEvalDE(p, this.state.values);
                    } catch (e) {
                        return 1.0;
                    }
                });
            } else {
                this.camera.setCollisionProvider(null);
            }

            // 5b. Auto zoom to include 80% of the fractal inside the viewport at all times
            this.camera.updateAutoZoom(activeFormula, this.state.values, this.state.get('fov') || 60, dt, this.state.formulaMorph);

            // 6. Camera flight / orbit update with collision resolution
            const camMoved = this.camera.update(dt, 1.0);
            const surfaceDE = this.camera.currentDE;

            // 6b. Continuous smooth auto-tracking of key lighting to keep visible surface sculpted & well-lit
            this.updateSunAutoTracking(dt);

            // 6c. Periodic automatic camera preset cycling (keeps cinematic views varied & fresh)
            if (this.camera.mode === 'orbit' && !this.camera.isDraggingOrbit && !this.camera.isZoomOverridden) {
                this.presetTimer += dt;
                if (this.presetTimer >= this.presetCycleInterval) {
                    this.presetTimer = 0.0;
                    this.presetCycleInterval = 25.0 + Math.random() * 15.0;
                    const presets = ['turntable', 'action', 'flyby', 'follow', 'dynamic', 'hero'];
                    const candidates = presets.filter(p => p !== this.camera.activeCameraPreset);
                    const nextPreset = candidates[Math.floor(Math.random() * candidates.length)];
                    this.camera.setCameraPreset(nextPreset);
                    if (this.ui && this.ui.syncActiveCameraPreset) {
                        this.ui.syncActiveCameraPreset(nextPreset);
                    }
                }
            } else {
                // Pause / slowly decay timer while user is actively dragging or zooming
                this.presetTimer = Math.max(0.0, this.presetTimer - dt * 0.5);
            }

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
