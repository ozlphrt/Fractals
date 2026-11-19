// js/main.js
// Main entry point orchestrating Raymarcher, State, Audio, Modulation, Camera, and UI

import { GLOBAL_PARAMS, StateManager } from './state/parameters.js';
import { ModulationEngine } from './modulation/engine.js';
import { AudioEngine } from './audio/analyzer.js';
import { CameraController } from './camera/controller.js';
import { Raymarcher } from './renderer/raymarcher.js';
import { CockpitUI } from './ui/cockpit.js';
import { GalleryManager, normalizeScene } from './gallery/community.js';
import { FORMULAS } from './formulas/registry.js';
import { PALETTE_PRESETS } from './state/palettes.js';
import { KeyframeLoop, interpolateCamera, keyframeSignature, keyframesForTrack, mergeKeyframeSources, playableKeyframeTab, resolveKeyframe, serializeKeyframes } from './state/keyframes.js';
import { USER_KEYFRAMES } from './state/user-keyframes.js';

const KEYFRAME_STORAGE = 'fractal-studio-keyframes-v3';
const DEFAULT_KEYFRAME_TAB = 'tab-settings-quick';

const parameterMetadata = new Map(
    [...GLOBAL_PARAMS, ...Object.values(FORMULAS).flatMap(formula => formula.params)]
        .map(param => [param.id, param])
);

class FractalSynthApp {
    constructor() {
        this.canvas = document.getElementById('fractal-canvas');
        this.state = new StateManager();
        this.modulation = new ModulationEngine();
        this.audio = new AudioEngine();
        this.camera = new CameraController(this.canvas);

        // Initialize camera to active formula's dramatic canonical framing
        const initialFormula = this.state.getActiveFormula();
        if (initialFormula && initialFormula.defaultCam) {
            this.camera.resetView(initialFormula.defaultCam.pos, initialFormula.defaultCam.target);
        }

        // Initialize sun azimuth and elevation to align with initial camera viewpoint
        this.updateSunAutoTracking(1.0, this.state.getValues());

        this.raymarcher = new Raymarcher(this.canvas, this.state);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.camera.autoRotate = false;
        this.ui = new CockpitUI(this.state, this.modulation, this.audio, this.camera, this.raymarcher);
        this.ui.app = this;
        this.keyframes = new KeyframeLoop(parameterMetadata);
        this.loadKeyframes();
        this.ui.setupKeyframes({
            add: () => {
                if (this.keyframes.playing) return;
                this.userKeyframes.push(this.captureKeyframe());
                this.saveKeyframes();
                this.refreshKeyframeTrack();
            },
            edit: (index, announce) => this.editKeyframe(index, announce),
            save: (index, draft) => {
                if (draft && this.keyframes.previewing) this.stopKeyframes();
                const frame = this.keyframes.frames[index];
                if (draft?.omitted?.length === 0) delete draft.omitted;
                this.changeKeyframe(index, draft ?? { ...this.captureKeyframe(), ...(frame?.omitted && { omitted: frame.omitted }) });
            },
            remove: index => this.changeKeyframe(index, null),
            toggle: shuffle => {
                if (this.keyframes.playing) this.stopKeyframes();
                else this.playKeyframes(shuffle);
            },
            dice: () => {
                if (this.keyframes.playing && !this.keyframes.previewing && this.keyframes.useInterludes) {
                    this.stopKeyframes();
                } else {
                    this.startDicePlayback();
                }
            },
            export: () => this.exportKeyframes(),
            import: file => this.importKeyframes(file),
            stop: () => this.stopKeyframes(),
            tabChange: () => {
                if (!this.ui?.isAutoDeforming) this.stopKeyframes();
                this.refreshKeyframeTrack();
            }
        });
        this.state.onFormulaChange(() => this.refreshKeyframeTrack());
        this.state.onFormulaMorph(() => this.refreshKeyframeTrack());
        this.refreshKeyframeTrack();

        let userInteractTimer = null;
        this.notifyUserInteraction = () => {
            this.isUserInteracting = true;
            if (this.ui?.isAutoDeforming && this.keyframes.playing) {
                this.keyframes.stop();
            }
            if (userInteractTimer) clearTimeout(userInteractTimer);
            userInteractTimer = setTimeout(() => {
                this.isUserInteracting = false;
                if (this.ui?.isAutoDeforming && !this.keyframes.playing && !this.state.formulaMorph) {
                    this.playCurrentFormulaKeyframes();
                }
            }, 2000);
        };

        for (const event of ['pointerdown', 'wheel']) {
            this.canvas.addEventListener(event, () => this.notifyUserInteraction(), { capture: true, passive: true });
        }
        this.canvas.addEventListener('pointermove', e => {
            if (e.buttons > 0) this.notifyUserInteraction();
        }, { capture: true, passive: true });

        // Community Folder & URL Creation Sharing System
        const self = this;
        const appAdapter = {
            canvas: this.canvas,
            formulaRegistry: {
                get activeFormula() { return self.state.getActiveFormula(); }
            },
            params: this.state,
            materials: {
                get currentPresetId() {
                    const idx = self.ui.activeMaterialIndex || 0;
                    return PALETTE_PRESETS[idx]?.id || 'dark_loam';
                },
                applyPreset: id => self.ui.applyMaterialPreset(id, false)
            },
            camera: this.camera,
            prepareSceneLoad: () => {
                this.stopKeyframes();
                const wasSwitching = this.state.formulaMorph !== null;
                this.state.activeParamMorph = null;
                this.state.formulaMorph = null;
                if (wasSwitching) this.ui.updateHeaderInfo();
            },
            setFormula: id => this.state.setFormula(id, true, false),
            syncCamera: () => {
                this.ui.syncActiveCameraPreset(this.camera.activeCameraPreset);
                this.ui.syncAutoRotate?.();
            }
        };
        this.gallery = new GalleryManager(appAdapter);

        this.lastTime = performance.now();
        this.fps = 60;
        this.fpsAlpha = 0.05;

        this.modulatedValues = Object.create(null);
        this.camera.setCollisionProvider(position => {
            const evaluate = this.state.getActiveFormula().cpuEvalDE;
            return evaluate ? evaluate(position, this.effectiveValues) : 1.0;
        });

        this.setupResize();
        this.gallery.checkSharedUrl();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.ui.stopContinuousAutoMorph?.();
        }
        this.startLoop();
    }

    playKeyframes(shuffle, dice = false) {
        this.ui.stopContinuousAutoMorph?.();
        const entry = this.captureKeyframe();
        if (!this.keyframes.start(entry, {
            shuffle,
            interludes: false,
            resolve: frame => resolveKeyframe(frame, entry),
            makeInterlude: null
        })) return;
        this.ui.syncKeyframeDice(false);
        this.state.activeParamMorph = null;
        this.state.formulaMorph = null;
        this.trackedSun = null;
        this.refreshKeyframeTrack();
    }

    startDicePlayback(announce = true) {
        if (this.keyframes.playing && !this.keyframes.previewing) {
            this.keyframes.setInterludes(false);
            this.ui.syncKeyframeDice(false);
            return;
        }
        const { formulaId, tabId } = this.getKeyframeScope();
        const playableTab = playableKeyframeTab(this.userKeyframes, formulaId, tabId);
        if (!playableTab) {
            if (announce) this.ui.showToast('Add at least two keyframes in one tab to play this formula.');
            return;
        }
        this.stopKeyframes();
        if (playableTab !== tabId) this.ui.selectKeyframeTab(playableTab);
        this.playKeyframes(this.ui.shouldShuffleKeyframes(), false);
    }

    playCurrentFormulaKeyframes() {
        const { formulaId, tabId } = this.getKeyframeScope();
        const frames = keyframesForTrack(this.userKeyframes, formulaId, tabId);
        if (frames.length < 2) return false;
        const entry = this.captureKeyframe();
        this.keyframes.stop();
        this.keyframes.frames = frames;
        if (!this.keyframes.start(entry, {
            shuffle: false,
            interludes: false,
            resolve: frame => resolveKeyframe(frame, entry),
            makeInterlude: null
        })) return false;
        this.state.activeParamMorph = null;
        this.state.formulaMorph = null;
        this.trackedSun = null;
        this.refreshKeyframeTrack();
        return true;
    }

    startFormulaTransition(nextId, duration = 3.0) {
        if (!FORMULAS[nextId]) return;
        const currentActive = this.state.formulaMorph ? this.state.formulaMorph.toId : this.state.activeFormulaId;
        if (currentActive === nextId) return;

        this.stopKeyframes();

        const fromCamera = this.camera.getState();
        const frames = keyframesForTrack(this.userKeyframes, nextId, 'tab-settings-geo');
        const targetFrame = frames[0] || null;
        const targetCamera = targetFrame?.camera || this.camera.getState();
        const targetValues = targetFrame?.values || null;

        this.cameraMorph = {
            from: fromCamera,
            to: targetCamera,
            duration: Math.max(0.6, duration),
            elapsed: 0.0
        };

        this.state.startFormulaMorph(nextId, duration, targetValues, () => {
            this.cameraMorph = null;
            this.formulaDwellTime = 0.0;
            if (this.ui?.isAutoDeforming) {
                this.playCurrentFormulaKeyframes();
            }
        });

        this.ui?.syncFormulaDisplay?.(nextId);
        this.refreshKeyframeTrack();
    }

    getKeyframeScope() {
        const formulaId = this.state.formulaMorph?.toId ?? this.state.activeFormulaId;
        const currentTab = this.ui.getKeyframeTab() ?? DEFAULT_KEYFRAME_TAB;
        const currentFrames = keyframesForTrack(this.userKeyframes, formulaId, currentTab);
        if (currentFrames.length > 0) {
            return { formulaId, tabId: currentTab };
        }
        const fallbackTab = playableKeyframeTab(this.userKeyframes, formulaId, 'tab-settings-geo') ?? 'tab-settings-geo';
        return { formulaId, tabId: fallbackTab };
    }

    refreshKeyframeTrack() {
        const { formulaId, tabId } = this.getKeyframeScope();
        if (!this.keyframes.playing) {
            this.keyframes.frames = keyframesForTrack(this.userKeyframes, formulaId, tabId);
        }
        this.ui.syncKeyframes(this.keyframes, this.userKeyframes.length, `${formulaId}/${tabId}`);
    }

    editKeyframe(index, announce = true) {
        const frame = this.keyframes.frames[index];
        if ((this.keyframes.playing && !this.keyframes.previewing) || !frame) return;
        const from = this.captureKeyframe();
        this.state.formulaMorph = null;
        this.state.activeParamMorph = null;
        this.keyframes.preview(from, resolveKeyframe(frame, from));
        this.refreshKeyframeTrack();
        if (announce) this.ui.showToast(`Moving to keyframe ${index + 1}. Adjust the scene when it arrives, then click Save.`);
    }

    changeKeyframe(index, replacement) {
        const frame = this.keyframes.frames[index];
        if (this.keyframes.playing || !frame) return;
        const position = this.userKeyframes.indexOf(frame);
        if (this.bundledKeyframes.delete(frame)) {
            const key = keyframeSignature(frame);
            this.dismissedKeyframes.set(key, (this.dismissedKeyframes.get(key) ?? 0) + 1);
        }
        if (replacement) this.userKeyframes[position] = replacement;
        else this.userKeyframes.splice(position, 1);
        if (this.saveKeyframes()) {
            this.ui.showToast(replacement ? `Keyframe ${index + 1} saved.` : `Keyframe ${index + 1} deleted.`);
        }
        this.refreshKeyframeTrack();
    }

    loadKeyframes() {
        let savedFrames = [];
        this.dismissedKeyframes = new Map();
        try {
            localStorage.removeItem('fractal-studio-keyframes-v1');
            localStorage.removeItem('fractal-studio-keyframes-v2');
            const saved = JSON.parse(localStorage.getItem(KEYFRAME_STORAGE));
            if (Array.isArray(saved)) savedFrames = saved;
            else if (saved) {
                if (Array.isArray(saved.frames)) savedFrames = saved.frames;
                if (Array.isArray(saved.dismissed)) this.dismissedKeyframes = new Map(saved.dismissed);
            }
        } catch {
            this.ui.showToast('Saved keyframes could not be read.');
        }
        const defaults = this.state.getValues();
        const tabIds = new Set(Array.from(this.ui.elSettingsDrawer.querySelectorAll('.tab-pane'), pane => pane.id));
        const normalizeKeyframe = frame => {
            const normalized = normalizeScene({ formula: frame?.formulaId, camera: frame?.camera });
            if (!normalized?.camera?.pos || !normalized.camera.target || !normalized.camera.up) return null;
            const values = { ...defaults };
            for (const [id, param] of parameterMetadata) {
                const value = frame.values?.[id];
                if (Number.isFinite(value)) {
                    const clamped = Math.max(param.min, Math.min(param.max, value));
                    values[id] = param.type === 'int' ? Math.round(clamped) : clamped;
                }
            }
            return {
                formulaId: normalized.formula,
                tabId: tabIds.has(frame.tabId) ? frame.tabId : 'tab-settings-geo',
                camera: normalized.camera,
                values,
                ...(Array.isArray(frame.omitted) && {
                    omitted: frame.omitted.filter(field => Array.isArray(field) && (
                        (field.length === 1 && parameterMetadata.has(field[0])) ||
                        (field.length === 2 && ['pos', 'target', 'up'].includes(field[0]) && [0, 1, 2].includes(field[1]))
                    ))
                })
            };
        };
        const { frames, bundled } = mergeKeyframeSources(
            USER_KEYFRAMES.map(normalizeKeyframe).filter(Boolean),
            savedFrames.map(normalizeKeyframe).filter(Boolean),
            this.dismissedKeyframes
        );
        this.userKeyframes = frames;
        this.bundledKeyframes = bundled;
    }

    saveKeyframes() {
        try {
            localStorage.setItem(KEYFRAME_STORAGE, JSON.stringify({
                frames: this.userKeyframes,
                dismissed: [...this.dismissedKeyframes]
            }));
            return true;
        } catch {
            this.ui.showToast('Keyframes could not be saved. Export them before refreshing.');
            return false;
        }
    }

    exportKeyframes() {
        const count = this.userKeyframes.length;
        if (count === 0) return;
        const code = serializeKeyframes(this.userKeyframes);
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'user-keyframes.js';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.ui.showToast(`Exported ${count} keyframe${count === 1 ? '' : 's'} from all tracks to user-keyframes.js.`);
    }

    async importKeyframes(file) {
        try {
            const text = await file.text();
            let rawFrames = null;
            const match = text.match(/export\s+const\s+USER_KEYFRAMES\s*=\s*(\[[\s\S]*\])\s*;?/);
            if (match) {
                try {
                    rawFrames = JSON.parse(match[1]);
                } catch {
                    const blob = new Blob([text], { type: 'text/javascript' });
                    const url = URL.createObjectURL(blob);
                    const mod = await import(url);
                    rawFrames = mod.USER_KEYFRAMES;
                    URL.revokeObjectURL(url);
                }
            } else {
                const blob = new Blob([text], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                const mod = await import(url);
                rawFrames = mod.USER_KEYFRAMES;
                URL.revokeObjectURL(url);
            }
            if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
                this.ui.showToast('No valid keyframes found in file.');
                return;
            }
            const defaults = this.state.getValues();
            const tabIds = new Set(Array.from(this.ui.elSettingsDrawer.querySelectorAll('.tab-pane'), pane => pane.id));
            const normalizeKeyframe = frame => {
                const normalized = normalizeScene({ formula: frame?.formulaId, camera: frame?.camera });
                if (!normalized?.camera?.pos || !normalized.camera.target || !normalized.camera.up) return null;
                const values = { ...defaults };
                for (const [id, param] of parameterMetadata) {
                    const value = frame.values?.[id];
                    if (Number.isFinite(value)) {
                        const clamped = Math.max(param.min, Math.min(param.max, value));
                        values[id] = param.type === 'int' ? Math.round(clamped) : clamped;
                    }
                }
                return {
                    formulaId: normalized.formula,
                    tabId: tabIds.has(frame.tabId) ? frame.tabId : 'tab-settings-geo',
                    camera: normalized.camera,
                    values,
                    ...(Array.isArray(frame.omitted) && {
                        omitted: frame.omitted.filter(field => Array.isArray(field) && (
                            (field.length === 1 && parameterMetadata.has(field[0])) ||
                            (field.length === 2 && ['pos', 'target', 'up'].includes(field[0]) && [0, 1, 2].includes(field[1]))
                        ))
                    })
                };
            };
            const valid = rawFrames.map(normalizeKeyframe).filter(Boolean);
            if (valid.length === 0) {
                this.ui.showToast('Could not normalize keyframes in file.');
                return;
            }
            this.userKeyframes = valid;
            this.dismissedKeyframes.clear();
            this.saveKeyframes();
            this.refreshKeyframeTrack();
            this.ui.showToast(`Imported ${valid.length} keyframes successfully.`);
        } catch (err) {
            console.error('Import error:', err);
            this.ui.showToast('Failed to import keyframes: ' + err.message);
        }
    }

    makeRandomKeyframe(from, to, camera) {
        const formulaId = from.formulaId;
        const values = { ...from.values };
        for (const [id, value] of Object.entries(values)) {
            const end = to.values[id] ?? value;
            if (parameterMetadata.get(id)?.type === 'int') continue;
            const delta = id === 'sun_azimuth' ? Math.atan2(Math.sin(end - value), Math.cos(end - value)) : end - value;
            values[id] = value + delta * 0.5;
        }
        for (const param of FORMULAS[formulaId].params) {
            if (param.type === 'int') continue;
            const offset = (Math.random() - 0.5) * (param.max - param.min) * 0.08;
            values[param.id] = Math.max(param.min, Math.min(param.max, values[param.id] + offset));
        }
        return { formulaId, tabId: from.tabId, values, camera };
    }

    captureKeyframe() {
        return {
            ...this.getKeyframeScope(),
            values: { ...(this.effectiveValues ?? this.state.getValues()) },
            camera: { ...this.camera.getState(), up: [...this.camera.getUpVector()] }
        };
    }

    stopKeyframes() {
        if (!this.keyframes.playing) return;
        this.keyframes.stop();
        const sample = this.keyframeSample;
        this.keyframeSample = null;
        this.state.formulaMorph = null;
        if (sample) {
            this.state.setFormula(sample.progress < 0.5 ? sample.fromId : sample.toId, true, false);
            this.state.setMany(sample.values);
            this.trackedSun = { azimuth: sample.values.sun_azimuth, elevation: sample.values.sun_elevation };
            this.ui.updateHeaderInfo();
            this.ui.syncActiveCameraPreset(this.camera.activeCameraPreset);
            this.ui.syncAutoRotate?.();
        }
        this.refreshKeyframeTrack();
        this.ui.syncKeyframeDice(false);
    }

    applyKeyframeSample(sample) {
        if (this.state.activeFormulaId !== sample.fromId) {
            this.state.setFormula(sample.fromId, true, false);
        }
        this.state.formulaMorph = sample.crossfade ? {
            fromId: sample.fromId,
            toId: sample.toId,
            progress: sample.progress,
            discreteFrom: sample.discreteFrom,
            discreteTo: sample.discreteTo
        } : null;
        this.camera.setState({ ...sample.camera, autoRotate: false, zoomOverridden: true });
        if (this.lastKeyframeIndex !== this.keyframes.index) {
            this.lastKeyframeIndex = this.keyframes.index;
            this.refreshKeyframeTrack();
        }
        this.keyframeSample = sample;
    }

    // Continuous smooth and gradual auto-adjustment of Sun Light 1 azimuth and elevation
    // Ensures the object is always beautifully and consistently illuminated from the camera's viewpoint
    updateSunAutoTracking(dt, values) {
        if (!this.state.get('sun_follow_camera')) {
            this.trackedSun = null;
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
        let curAz = this.trackedSun?.azimuth ?? values.sun_azimuth;
        let curEl = this.trackedSun?.elevation ?? values.sun_elevation;

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

        this.trackedSun = { azimuth: newAz, elevation: newEl };
        values.sun_azimuth = newAz;
        values.sun_elevation = newEl;
    }

    setupResize() {
        const resize = () => {
            // Limit fragment work on high-DPI and large displays.
            const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
            let w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
            let h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
            const maxDim = 1600;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.floor(w * ratio);
                h = Math.floor(h * ratio);
            }
            if (this.canvas.width !== w || this.canvas.height !== h) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
        };
        this.resizeObserver = new ResizeObserver(resize);
        this.resizeObserver.observe(this.canvas);
        resize();
    }

    startLoop() {
        const frame = (now) => {
            requestAnimationFrame(frame);

            const elapsed = (now - this.lastTime) * 0.001;
            const dt = Math.min(0.1, elapsed);
            this.lastTime = now;

            // Instant FPS estimate
            const instantFps = elapsed > 0 ? (1.0 / elapsed) : 60;
            this.fps = this.fps * (1.0 - this.fpsAlpha) + instantFps * this.fpsAlpha;

            // 1. Audio update
            const audioBands = this.audio.update(dt);

            // 2. Modulation update
            this.modulation.update(dt);

            // 2b. Step 3D metamorphic formula morphing
            const keyframeSample = this.keyframes.step(dt);
            if (keyframeSample) {
                this.applyKeyframeSample(keyframeSample);
                if (keyframeSample.finished) this.stopKeyframes();
            }

            // Step camera transition during formula morph
            if (this.cameraMorph) {
                this.cameraMorph.elapsed += dt;
                const rawT = Math.min(1.0, this.cameraMorph.elapsed / this.cameraMorph.duration);
                const easeT = rawT * rawT * (3.0 - 2.0 * rawT);
                const blendedCam = interpolateCamera([this.cameraMorph.from, this.cameraMorph.from, this.cameraMorph.to, this.cameraMorph.to], easeT);
                this.camera.setState({ ...blendedCam, autoRotate: false, zoomOverridden: true });
            }

            // Step continuous formula cycling across user keyframes
            if (this.ui?.isAutoDeforming) {
                if (this.state.formulaMorph || this.cameraMorph) {
                    this.formulaDwellTime = 0.0;
                } else if (!this.isUserInteracting) {
                    if (this.keyframes.playing) {
                        // Wait until the formula's stored keyframes have completed a full cycle!
                        if (this.keyframes.completedCycles >= 1) {
                            this.keyframes.completedCycles = 0;
                            this.formulaDwellTime = 0.0;
                            this.ui.switchFormulaByIndex?.(1);
                        }
                    } else {
                        // Formula has no active keyframes playing: try to start or dwell for 18.0s
                        const started = this.playCurrentFormulaKeyframes?.();
                        if (!started) {
                            this.formulaDwellTime = (this.formulaDwellTime || 0) + dt;
                            if (this.formulaDwellTime >= 18.0) {
                                this.formulaDwellTime = 0.0;
                                this.ui.switchFormulaByIndex?.(1);
                            }
                        }
                    }
                }
            }
            const isFormulaMorphing = !keyframeSample && this.state.updateFormulaMorph(dt);

            // 2c. Step synchronized parameter morphing (eliminates dual-rAF frame rate race condition)
            const isParamMorphing = !keyframeSample && this.state.updateParamMorph(dt);

            // 3. Step physical slider inertia (heavy moment of inertia for sliders)
            const slidersMoving = !keyframeSample && this.state.updateInertia(dt);

            // 4. Compute modulated parameter values for active formula and globals
            const modulatedValues = this.modulatedValues;
            for (const id of Object.keys(modulatedValues)) delete modulatedValues[id];
            const effectiveValues = keyframeSample?.values ?? this.state.getValues();
            this.effectiveValues = effectiveValues;
            const activeFormula = this.state.getActiveFormula();
            for (const id of keyframeSample ? [] : this.modulation.bindings.keys()) {
                const p = parameterMetadata.get(id);
                if (!p) continue;
                const value = this.modulation.computeModulatedValue(id, effectiveValues[id], p.min, p.max, audioBands, dt);
                effectiveValues[id] = modulatedValues[id] = p.type === 'int' ? Math.round(value) : value;
            }

            // 5. Connect collision provider & settings to camera
            const collisionEnabled = (effectiveValues.collision_enabled ?? 1) >= 0.5;
            const collisionClearance = effectiveValues.collision_clearance ?? 0.02;
            this.camera.setCollisionSettings(collisionEnabled, collisionClearance);
            
            // Suspend camera collision while the formula is morphing (outgoing DE is meaningless then)
            this.camera.collisionSuspended = Boolean(this.state.formulaMorph);

            // 5b. Auto zoom to include 80% of the fractal inside the viewport at all times
            if (!keyframeSample) this.camera.updateAutoZoom(activeFormula, effectiveValues, effectiveValues.fov || 60, dt, this.state.formulaMorph);

            // 6. Camera flight / orbit update with collision resolution
            const camMoved = Boolean(keyframeSample) || Boolean(this.cameraMorph) || this.camera.update(dt, 1.0);

            // 6b. Continuous smooth auto-tracking of key lighting to keep visible surface sculpted & well-lit
            if (!keyframeSample && !this.cameraMorph) this.updateSunAutoTracking(dt, effectiveValues);

            const isMorphing = (this.state.morphAnim !== null) || isFormulaMorphing || isParamMorphing || Boolean(this.cameraMorph);
            const isDynamic = camMoved || slidersMoving || isMorphing || Object.keys(modulatedValues).length > 0;

            // 7. Raymarch render (with live FPS for dynamic resolution governor)
            this.raymarcher.render(this.camera, now * 0.001, isDynamic, this.fps, effectiveValues, elapsed * 1000, Boolean(keyframeSample));

            // 7. UI update
            this.ui.updateFrame(modulatedValues, audioBands, this.fps, now, keyframeSample?.values);
        };
        requestAnimationFrame(frame);
    }
}

// Boot application once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        new FractalSynthApp();
    } catch (error) {
        console.error(error);
        const status = document.getElementById('graphics-status');
        status.textContent = 'The fractal studio could not start. Check that WebGL2 is available and reload the page.';
        status.hidden = false;
    }
});
