// js/state/parameters.js
// Centralized state manager for all fractal math, shading, lighting, atmosphere, and camera parameters
// Supports A/B snapshotting, smooth morph crossfade, Mutation with undo/redo history stack, and URL state encoding

import { FORMULAS, FORMULA_IDS } from '../formulas/registry.js';
import { PALETTE_PRESETS } from './palettes.js';

export const GLOBAL_PARAMS = [
    // Raymarcher Quality
    { id: 'max_steps', name: 'Max Ray Steps', min: 40, max: 200, step: 5, default: 70, uniform: 'u_max_steps', type: 'int', group: 'render' },
    { id: 'hit_epsilon', name: 'Hit Threshold', min: 0.0005, max: 0.008, step: 0.0005, default: 0.0015, uniform: 'u_hit_epsilon', type: 'float', group: 'render' },
    { id: 'fov', name: 'Field of View', min: 30, max: 100, step: 1, default: 60, uniform: 'u_fov', type: 'float', group: 'camera' },
    
    // Shading & Cosine Palette (Inigo Quilez natural earth/mineral formula)
    { id: 'trap_mode', name: 'Orbit Trap Source', min: 0, max: 3, step: 1, default: 0, uniform: 'u_trap_mode', type: 'int', group: 'shading', enumNames: ['Origin Dist', 'Coord Planes', 'Spherical/Axis', 'Iteration Count'] },
    { id: 'color_cycle', name: 'Color Frequency', min: 0.1, max: 3.0, step: 0.05, default: 0.45, uniform: 'u_color_cycle', type: 'float', group: 'shading' },
    { id: 'color_phase', name: 'Color Phase', min: 0.0, max: 6.28, step: 0.05, default: 0.05, uniform: 'u_color_phase', type: 'float', group: 'shading' },
    // Cosine Palette A (Base Center)
    { id: 'pal_a_r', name: 'Base Red', min: 0.0, max: 1.0, step: 0.01, default: 0.30, uniform: 'u_pal_a_r', type: 'float', group: 'shading' },
    { id: 'pal_a_g', name: 'Base Green', min: 0.0, max: 1.0, step: 0.01, default: 0.24, uniform: 'u_pal_a_g', type: 'float', group: 'shading' },
    { id: 'pal_a_b', name: 'Base Blue', min: 0.0, max: 1.0, step: 0.01, default: 0.18, uniform: 'u_pal_a_b', type: 'float', group: 'shading' },
    // Cosine Palette B (Amplitude / Vibrancy)
    { id: 'pal_b_r', name: 'Vibrancy Red', min: 0.0, max: 1.0, step: 0.01, default: 0.18, uniform: 'u_pal_b_r', type: 'float', group: 'shading' },
    { id: 'pal_b_g', name: 'Vibrancy Green', min: 0.0, max: 1.0, step: 0.01, default: 0.14, uniform: 'u_pal_b_g', type: 'float', group: 'shading' },
    { id: 'pal_b_b', name: 'Vibrancy Blue', min: 0.0, max: 1.0, step: 0.01, default: 0.10, uniform: 'u_pal_b_b', type: 'float', group: 'shading' },
    // Cosine Palette C (Frequency)
    { id: 'pal_c_r', name: 'Freq Red', min: 0.1, max: 3.0, step: 0.05, default: 1.0, uniform: 'u_pal_c_r', type: 'float', group: 'shading' },
    { id: 'pal_c_g', name: 'Freq Green', min: 0.1, max: 3.0, step: 0.05, default: 1.0, uniform: 'u_pal_c_g', type: 'float', group: 'shading' },
    { id: 'pal_c_b', name: 'Freq Blue', min: 0.1, max: 3.0, step: 0.05, default: 1.0, uniform: 'u_pal_c_b', type: 'float', group: 'shading' },
    // Cosine Palette D (Phase Spread)
    { id: 'pal_d_r', name: 'Phase Red', min: 0.0, max: 1.0, step: 0.01, default: 0.05, uniform: 'u_pal_d_r', type: 'float', group: 'shading' },
    { id: 'pal_d_g', name: 'Phase Green', min: 0.0, max: 1.0, step: 0.01, default: 0.10, uniform: 'u_pal_d_g', type: 'float', group: 'shading' },
    { id: 'pal_d_b', name: 'Phase Blue', min: 0.0, max: 1.0, step: 0.01, default: 0.15, uniform: 'u_pal_d_b', type: 'float', group: 'shading' },
    
    // Lighting Studio
    // Light 1: Key Directional Sun
    { id: 'sun_intensity', name: 'Sun Intensity', min: 0.0, max: 3.0, step: 0.05, default: 1.60, uniform: 'u_sun_intensity', type: 'float', group: 'light_sun' },
    { id: 'sun_azimuth', name: 'Azimuth (Heading)', min: -3.14, max: 3.14, step: 0.05, default: 0.91, uniform: 'u_sun_azimuth', type: 'float', group: 'light_sun' },
    { id: 'sun_elevation', name: 'Elevation (Pitch)', min: 0.1, max: 1.5, step: 0.05, default: 0.90, uniform: 'u_sun_elevation', type: 'float', group: 'light_sun' },
    { id: 'sun_color_r', name: 'Sun Red', min: 0.0, max: 1.0, step: 0.02, default: 0.96, uniform: 'u_sun_color_r', type: 'float', group: 'light_sun' },
    { id: 'sun_color_g', name: 'Sun Green', min: 0.0, max: 1.0, step: 0.02, default: 0.90, uniform: 'u_sun_color_g', type: 'float', group: 'light_sun' },
    { id: 'sun_color_b', name: 'Sun Blue', min: 0.0, max: 1.0, step: 0.02, default: 0.80, uniform: 'u_sun_color_b', type: 'float', group: 'light_sun' },
    { id: 'shadow_softness', name: 'Shadow Softness', min: 2.0, max: 32.0, step: 1.0, default: 12.0, uniform: 'u_shadow_softness', type: 'float', group: 'light_sun' },

    // Light 2: Rim & Silhouette Backlight
    { id: 'backlight_intensity', name: 'Rim Intensity', min: 0.0, max: 3.0, step: 0.05, default: 1.50, uniform: 'u_backlight_intensity', type: 'float', group: 'light_rim' },
    { id: 'backlight_elevation', name: 'Vertical Angle', min: -1.5, max: 1.5, step: 0.05, default: -0.30, uniform: 'u_backlight_elevation', type: 'float', group: 'light_rim' },
    { id: 'rim_color_r', name: 'Rim Red', min: 0.0, max: 1.0, step: 0.02, default: 0.10, uniform: 'u_rim_color_r', type: 'float', group: 'light_rim' },
    { id: 'rim_color_g', name: 'Rim Green', min: 0.0, max: 1.0, step: 0.02, default: 0.12, uniform: 'u_rim_color_g', type: 'float', group: 'light_rim' },
    { id: 'rim_color_b', name: 'Rim Blue', min: 0.0, max: 1.0, step: 0.02, default: 0.34, uniform: 'u_rim_color_b', type: 'float', group: 'light_rim' },

    // Light 3: Environment & Ambient Occlusion
    { id: 'ao_strength', name: 'Ambient Occlusion (AO)', min: 0.0, max: 1.5, step: 0.05, default: 1.40, uniform: 'u_ao_strength', type: 'float', group: 'light_env' },
    { id: 'fog_density', name: 'Atmospheric Fog', min: 0.0, max: 0.8, step: 0.02, default: 0.15, uniform: 'u_fog_density', type: 'float', group: 'light_env' },

    // Light 4: Volumetric Core Glow
    { id: 'glow_intensity', name: 'Glow Intensity', min: 0.0, max: 2.5, step: 0.05, default: 0.05, uniform: 'u_glow_intensity', type: 'float', group: 'light_glow' },
    { id: 'glow_color_r', name: 'Glow Red', min: 0.0, max: 1.0, step: 0.02, default: 0.0, uniform: 'u_glow_color_r', type: 'float', group: 'light_glow' },
    { id: 'glow_color_g', name: 'Glow Green', min: 0.0, max: 1.0, step: 0.02, default: 0.8, uniform: 'u_glow_color_g', type: 'float', group: 'light_glow' },
    { id: 'glow_color_b', name: 'Glow Blue', min: 0.0, max: 1.0, step: 0.02, default: 1.0, uniform: 'u_glow_color_b', type: 'float', group: 'light_glow' },
    { id: 'roughness', name: 'Surface Roughness', min: 0.05, max: 1.0, step: 0.02, default: 0.85, uniform: 'u_roughness', type: 'float', group: 'shading' },
    { id: 'metallic', name: 'Metallic Reflectance', min: 0.0, max: 1.0, step: 0.02, default: 0.02, uniform: 'u_metallic', type: 'float', group: 'shading' }
];

// Parameter boundaries that guarantee solid, interconnected sculptural forms
// Prevents chaotic parameter combinations that disintegrate into scattered dust/speckles
export const COHESIVE_FORMULA_BOUNDS = {
    // Mandelbulb: Maintain monolithic solid rounded body with silky smooth flow, zero spikes
    mb_power: { min: 6.0, max: 8.5 },
    mb_julia_mix: { min: 0.0, max: 0.0 }, // Keep 0 to eliminate spiky needle distortion
    mb_julia_cx: { min: 0.0, max: 0.0 },
    mb_julia_cy: { min: 0.0, max: 0.0 },
    mb_julia_cz: { min: 0.0, max: 0.0 },

    // Mandelbox: Maintain massive connected architectural columns & arches (strictly positive scale to prevent crossing 0)
    mbox_scale: { min: 2.0, max: 2.65 },
    mbox_fold_limit: { min: 0.9, max: 1.25 },
    mbox_min_radius: { min: 0.3, max: 0.55 },
    mbox_fixed_radius: { min: 1.0, max: 1.35 },
    mbox_rot_x: { min: -0.12, max: 0.12 },
    mbox_rot_y: { min: -0.12, max: 0.12 },
    mbox_rot_z: { min: -0.12, max: 0.12 },
    mbox_offset_x: { min: -0.25, max: 0.25 },
    mbox_offset_y: { min: -0.25, max: 0.25 },
    mbox_offset_z: { min: -0.25, max: 0.25 },

    // Kaleidoscopic IFS: Keep interconnected polyhedral origami
    kifs_scale: { min: 1.8, max: 2.5 },
    kifs_offset_x: { min: 0.8, max: 1.3 },
    kifs_offset_y: { min: 0.8, max: 1.3 },
    kifs_offset_z: { min: 0.8, max: 1.3 },
    kifs_pre_rot_x: { min: -0.15, max: 0.15 },
    kifs_pre_rot_y: { min: -0.15, max: 0.15 },
    kifs_pre_rot_z: { min: -0.15, max: 0.15 },
    kifs_post_rot_x: { min: -0.15, max: 0.15 },
    kifs_post_rot_y: { min: -0.15, max: 0.15 },
    kifs_post_rot_z: { min: -0.15, max: 0.15 },

    // 4D Quaternion Julia: Continuous liquid ribbons
    qj_cx: { min: -0.4, max: 0.4 },
    qj_cy: { min: 0.3, max: 0.65 },
    qj_cz: { min: 0.2, max: 0.55 },
    qj_cw: { min: -0.15, max: 0.15 },
    qj_slice_w: { min: -0.25, max: 0.25 }
};

export class StateManager {
    constructor() {
        this.activeFormulaId = FORMULA_IDS.QUAT_JULIA;
        this.values = {}; // Actual current evaluated values (with inertia)
        this.targetValues = {}; // User target values set by sliders
        this.velocities = {}; // Inertial rate of change
        this.snapshotA = null;
        this.snapshotB = null;
        this.morphProgress = 0.0;
        
        // Smooth deformation animation
        this.morphAnim = null;
        this.formulaMorphCount = 0;
        this.minMorphsPerFormula = 3; // At least 3 morphs on same formula before switching
        
        // Undo / Redo history
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 30;

        // Metamorphic 3D formula transition
        this.formulaMorph = null;
        this.formulaMorphListeners = new Set();
        
        // Listeners for UI / Renderer sync
        this.listeners = new Set();
        this.formulaChangeListeners = new Set();

        // Initialize default values for all formulas and globals
        this.initDefaults();
        this.pushHistory();
    }

    initDefaults() {
        // Global params
        for (const p of GLOBAL_PARAMS) {
            this.values[p.id] = p.default;
            this.targetValues[p.id] = p.default;
            this.velocities[p.id] = 0.0;
        }
        // Apply Obsidian & Gold as default material look
        if (PALETTE_PRESETS.length > 0) {
            Object.assign(this.values, PALETTE_PRESETS[0].values);
            Object.assign(this.targetValues, PALETTE_PRESETS[0].values);
        }
        // Formula params
        for (const fId of Object.keys(FORMULAS)) {
            const form = FORMULAS[fId];
            for (const p of form.params) {
                this.values[p.id] = p.default;
                this.targetValues[p.id] = p.default;
                this.velocities[p.id] = 0.0;
            }
        }
        // Initialize A/B snapshots
        this.snapshotA = { ...this.values };
        this.snapshotB = { ...this.values };
    }

    get(id) {
        return this.values[id] ?? this.targetValues[id];
    }

    getCurrent(id) {
        return this.values[id] ?? this.targetValues[id];
    }

    getTarget(id) {
        return this.targetValues[id] ?? this.values[id];
    }

    set(id, val, pushHist = false) {
        this.targetValues[id] = val;
        // If morph animation is running, let it drive directly
        if (this.morphAnim) {
            this.values[id] = val;
            this.notify(id, val);
        }
        if (pushHist) {
            this.pushHistory();
        }
    }

    setWithInertia(id, val, pushHist = false) {
        this.set(id, val, pushHist);
    }

    setMany(dict, pushHist = false) {
        for (const [id, val] of Object.entries(dict)) {
            this.targetValues[id] = val;
            this.values[id] = val;
            this.notify(id, val);
        }
        if (pushHist) {
            this.pushHistory();
        }
    }

    // Step physical inertia towards targetValues each frame
    updateInertia(dt) {
        if (this.morphAnim) return false; // Handled by morph animation loop

        let anyMoving = false;
        // Heavy moment of inertia: slow acceleration + viscous damping
        const responsiveness = 4.0; // Higher = faster, ~3-4 = heavy gradual glide
        const damping = Math.exp(-responsiveness * dt);

        const allParams = [...this.getActiveFormula().params, ...GLOBAL_PARAMS];

        for (const p of allParams) {
            const id = p.id;
            const target = this.targetValues[id];
            if (target === undefined) continue;

            const current = this.values[id];
            const diff = target - current;

            if (Math.abs(diff) > 0.0001) {
                anyMoving = true;
                // Critically damped spring-like transition
                const nextVal = target - diff * damping;
                this.values[id] = nextVal;
                this.notify(id, nextVal);
            } else if (current !== target) {
                this.values[id] = target;
                this.notify(id, target);
            }
        }

        return anyMoving;
    }

    getActiveFormula() {
        return FORMULAS[this.activeFormulaId];
    }

    setFormula(formulaId, immediate = false) {
        if (!FORMULAS[formulaId] || this.activeFormulaId === formulaId) return;
        if (immediate) {
            this.formulaMorph = null;
            this.activeFormulaId = formulaId;
            this.snapshotA = null;
            this.snapshotB = null;
            this.morphProgress = 0.0;
            this.morphAnim = null;
            this.formulaMorphCount = 0;
            this.formulaChangeListeners.forEach(cb => cb(this.getActiveFormula()));
            this.pushHistory();
        } else {
            this.startFormulaMorph(formulaId, 1.6);
        }
    }

    startFormulaMorph(toFormulaId, duration = 1.6) {
        if (!FORMULAS[toFormulaId] || this.activeFormulaId === toFormulaId) return;
        if (this.formulaMorph && this.formulaMorph.toId === toFormulaId) return;

        const fromId = this.activeFormulaId;
        this.formulaMorph = {
            fromId: fromId,
            toId: toFormulaId,
            duration: Math.max(0.2, duration),
            elapsed: 0.0,
            progress: 0.0
        };

        this.formulaMorphListeners.forEach(cb => cb(this.formulaMorph));
    }

    updateFormulaMorph(dt) {
        if (!this.formulaMorph) return false;

        this.formulaMorph.elapsed += dt;
        const rawT = Math.min(1.0, this.formulaMorph.elapsed / this.formulaMorph.duration);
        this.formulaMorph.progress = rawT;

        if (rawT >= 1.0) {
            const nextId = this.formulaMorph.toId;
            this.formulaMorph = null;
            this.activeFormulaId = nextId;
            this.formulaMorphCount = 0;
            this.formulaChangeListeners.forEach(cb => cb(this.getActiveFormula()));
            this.pushHistory();
        }
        return true;
    }

    onFormulaMorph(cb) {
        this.formulaMorphListeners.add(cb);
        return () => this.formulaMorphListeners.delete(cb);
    }

    subscribe(paramOrCb, maybeCb) {
        if (typeof paramOrCb === 'string' && typeof maybeCb === 'function') {
            const wrapper = (id, val) => {
                if (id === paramOrCb) maybeCb(val, id);
            };
            this.listeners.add(wrapper);
            return () => this.listeners.delete(wrapper);
        }
        if (typeof paramOrCb === 'function') {
            this.listeners.add(paramOrCb);
            return () => this.listeners.delete(paramOrCb);
        }
    }

    onFormulaChange(callback) {
        this.formulaChangeListeners.add(callback);
        return () => this.formulaChangeListeners.delete(callback);
    }

    notify(id, val) {
        this.listeners.forEach(cb => cb(id, val));
    }

    // A/B Morphing
    snapA() {
        this.snapshotA = { ...this.values };
        return true;
    }

    snapB() {
        this.snapshotB = { ...this.values };
        return true;
    }

    setMorphProgress(t) {
        this.morphProgress = Math.max(0.0, Math.min(1.0, t));
        if (!this.snapshotA || !this.snapshotB) return;
        
        const formula = this.getActiveFormula();
        const relevantParams = [...formula.params, ...GLOBAL_PARAMS];
        
        for (const p of relevantParams) {
            const valA = this.snapshotA[p.id];
            const valB = this.snapshotB[p.id];
            if (valA !== undefined && valB !== undefined) {
                let interpolated;
                if (p.type === 'int') {
                    interpolated = Math.round(valA + (valB - valA) * t);
                } else {
                    interpolated = valA + (valB - valA) * t;
                }
                this.values[p.id] = interpolated;
                this.targetValues[p.id] = interpolated;
                this.notify(p.id, interpolated);
            }
        }
    }

    // Generate randomized target parameters and smoothly morph towards them over durationSec
    smoothDeformRandom(durationSec = 10.0, onProgress = null, onComplete = null) {
        if (this.morphAnim) {
            cancelAnimationFrame(this.morphAnim);
            this.morphAnim = null;
        }

        // Maintain the active formula chosen by the user — never jump formulas in auto morph
        this.formulaMorphCount++;
        const formula = this.getActiveFormula();
        const morphStartValues = {};
        const morphTargetValues = {};

        // Randomize ONLY Formula Geometry Parameters within Cohesive Sculptural Bounds
        // Never modifies material palette, shading, or lighting values (preserves user look & light)
        // User can freely change materials or lighting at any time without the morph loop fighting them!
        for (const p of formula.params) {
            // Skip discrete integers (iterations, symmetry groups) to ensure strictly continuous smooth deformation
            if (p.type === 'int' || p.id.endsWith('_iterations') || p.id === 'iterations' || p.id.includes('symmetry')) {
                continue;
            }
            const bounds = COHESIVE_FORMULA_BOUNDS[p.id];
            let val;
            if (typeof bounds === 'function') {
                val = bounds();
            } else if (bounds) {
                val = bounds.min + Math.random() * (bounds.max - bounds.min);
            } else {
                val = p.min + Math.random() * (p.max - p.min);
            }
            morphTargetValues[p.id] = val;
            morphStartValues[p.id] = this.values[p.id] ?? p.default;
        }

        const startTime = performance.now();
        const durationMs = durationSec * 1000;

        // Smooth cosine ease-in-out for immediately visible organic flow
        const easeInOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);

        const step = (now) => {
            const elapsed = now - startTime;
            const linearT = Math.min(1.0, Math.max(0.0, elapsed / durationMs));
            const easedT = easeInOut(linearT);

            // Interpolate strictly formula geometry parameters
            for (const [id, targetVal] of Object.entries(morphTargetValues)) {
                const startVal = morphStartValues[id];
                if (startVal !== undefined) {
                    const p = formula.params.find(param => param.id === id);
                    let interpolated;
                    if (p && p.type === 'int') {
                        interpolated = Math.round(startVal + (targetVal - startVal) * easedT);
                    } else {
                        interpolated = startVal + (targetVal - startVal) * easedT;
                    }
                    this.values[id] = interpolated;
                    this.targetValues[id] = interpolated;
                    this.notify(id, interpolated);
                }
            }

            if (onProgress) onProgress(linearT);

            if (linearT < 1.0) {
                this.morphAnim = requestAnimationFrame(step);
            } else {
                this.morphAnim = null;
                this.pushHistory();
                if (onComplete) onComplete();
            }
        };

        this.morphAnim = requestAnimationFrame(step);
    }

    // Instant mutation
    mutate(amount = 0.25) {
        const formula = this.getActiveFormula();
        // Mutate formula-specific mathematical parameters and color cycle/phase
        const mutatable = [...formula.params, ...GLOBAL_PARAMS.filter(g => g.group === 'shading')];
        
        for (const p of mutatable) {
            if (p.type === 'int' && p.enumNames) {
                // Occasionally swap enum if high mutation
                if (Math.random() < amount * 0.4) {
                    this.values[p.id] = Math.floor(Math.random() * (p.max - p.min + 1)) + p.min;
                    this.notify(p.id, this.values[p.id]);
                }
                continue;
            }
            if (p.type === 'int') {
                const range = p.max - p.min;
                const delta = Math.round((Math.random() * 2.0 - 1.0) * range * amount * 0.3);
                this.values[p.id] = Math.max(p.min, Math.min(p.max, this.values[p.id] + delta));
            } else {
                const range = p.max - p.min;
                const delta = (Math.random() * 2.0 - 1.0) * range * amount * 0.25;
                this.values[p.id] = Math.max(p.min, Math.min(p.max, this.values[p.id] + delta));
            }
            this.notify(p.id, this.values[p.id]);
        }
        this.pushHistory();
    }

    // History stack
    pushHistory() {
        // truncate forward history
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            formulaId: this.activeFormulaId,
            values: { ...this.values }
        });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const item = this.history[this.historyIndex];
            const formulaChanged = (this.activeFormulaId !== item.formulaId);
            this.activeFormulaId = item.formulaId;
            this.values = { ...item.values };
            if (formulaChanged) {
                this.formulaChangeListeners.forEach(cb => cb(this.getActiveFormula()));
            }
            for (const [k, v] of Object.entries(this.values)) {
                this.notify(k, v);
            }
            return true;
        }
        return false;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const item = this.history[this.historyIndex];
            const formulaChanged = (this.activeFormulaId !== item.formulaId);
            this.activeFormulaId = item.formulaId;
            this.values = { ...item.values };
            if (formulaChanged) {
                this.formulaChangeListeners.forEach(cb => cb(this.getActiveFormula()));
            }
            for (const [k, v] of Object.entries(this.values)) {
                this.notify(k, v);
            }
            return true;
        }
        return false;
    }
}
