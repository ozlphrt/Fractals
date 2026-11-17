// js/modulation/engine.js
// Per-slider LFO and Audio reactive modulation engine
// Evaluates active modulation targets and returns the modulated values per frame

export const MOD_SOURCE = {
    NONE: 'none',
    LFO: 'lfo',
    AUDIO: 'audio'
};

export const LFO_WAVE = {
    SINE: 'sine',
    TRIANGLE: 'triangle',
    SAW: 'saw',
    NOISE: 'noise'
};

export const AUDIO_BAND = {
    BASS: 'bass',
    LOW_MID: 'lowMid',
    HIGH_MID: 'highMid',
    TREBLE: 'treble'
};

export class ModulationEngine {
    constructor() {
        // Map of paramId -> modulation configuration
        // e.g.: { source: 'lfo', wave: 'sine', rate: 0.5, depth: 0.3, phase: 0 }
        // or:   { source: 'audio', band: 'bass', gain: 1.5, bipolar: false }
        this.bindings = new Map();
        
        // Internal noise generator state
        this.noiseSeeds = new Map();
        this.time = 0;
    }

    bindLFO(paramId, config = {}) {
        this.bindings.set(paramId, {
            source: MOD_SOURCE.LFO,
            wave: config.wave || LFO_WAVE.SINE,
            rate: config.rate ?? 0.5,     // Hz
            depth: config.depth ?? 0.35,  // fraction of slider range
            phase: config.phase ?? 0.0
        });
    }

    bindAudio(paramId, config = {}) {
        this.bindings.set(paramId, {
            source: MOD_SOURCE.AUDIO,
            band: config.band || AUDIO_BAND.BASS,
            gain: config.gain ?? 1.0,     // multiplier on [0, 1] band
            bipolar: config.bipolar ?? false
        });
    }

    clearBinding(paramId) {
        this.bindings.delete(paramId);
    }

    getBinding(paramId) {
        return this.bindings.get(paramId) || null;
    }

    hasActiveModulation() {
        return this.bindings.size > 0;
    }

    // Evaluate effective value for a specific param given base value and range
    computeModulatedValue(paramId, baseVal, min, max, audioBands, dt) {
        const mod = this.bindings.get(paramId);
        if (!mod || mod.source === MOD_SOURCE.NONE) {
            return baseVal;
        }

        const range = max - min;
        let modFactor = 0.0; // Normalized in [-1, 1] or [0, 1]

        if (mod.source === MOD_SOURCE.LFO) {
            const t = (this.time * mod.rate + mod.phase) % 1.0;
            switch (mod.wave) {
                case LFO_WAVE.SINE:
                    modFactor = Math.sin(t * Math.PI * 2.0);
                    break;
                case LFO_WAVE.TRIANGLE:
                    modFactor = 1.0 - 4.0 * Math.abs(t - 0.5);
                    break;
                case LFO_WAVE.SAW:
                    modFactor = (t * 2.0) - 1.0;
                    break;
                case LFO_WAVE.NOISE:
                    // Smooth random drift via interpolated cubic noise
                    const step = Math.floor(this.time * mod.rate);
                    const fract = (this.time * mod.rate) - step;
                    const s1 = Math.sin(step * 12.9898) * 43758.5453;
                    const s2 = Math.sin((step + 1) * 12.9898) * 43758.5453;
                    const n1 = (s1 - Math.floor(s1)) * 2 - 1;
                    const n2 = (s2 - Math.floor(s2)) * 2 - 1;
                    // Smoothstep
                    const sm = fract * fract * (3.0 - 2.0 * fract);
                    modFactor = n1 + (n2 - n1) * sm;
                    break;
                default:
                    modFactor = Math.sin(t * Math.PI * 2.0);
            }
            const delta = modFactor * mod.depth * (range * 0.5);
            return Math.max(min, Math.min(max, baseVal + delta));
        }

        if (mod.source === MOD_SOURCE.AUDIO && audioBands) {
            const rawBand = audioBands[mod.band] || 0.0;
            const signal = Math.min(1.0, rawBand * mod.gain);
            if (mod.bipolar) {
                modFactor = (signal * 2.0 - 1.0);
                const delta = modFactor * (range * 0.5);
                return Math.max(min, Math.min(max, baseVal + delta));
            } else {
                const delta = signal * range * 0.5;
                return Math.max(min, Math.min(max, baseVal + delta));
            }
        }

        return baseVal;
    }

    update(dt) {
        this.time += dt;
    }
}
