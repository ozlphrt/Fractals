// js/formulas/registry.js
// Definitions for the 5 dedicated fractal engines:
// GLSL Distance Estimator snippet + Uniform definitions + CPU DE Mirror (for lag-free camera flight proximity) + Presets

export const FORMULA_IDS = {
    QUAT_JULIA: 'quat_julia',
    MANDELBULB: 'mandelbulb',
    MANDELBOX: 'mandelbox',
    KIFS: 'kifs'
};

export const FORMULAS = {
    [FORMULA_IDS.MANDELBULB]: {
        id: FORMULA_IDS.MANDELBULB,
        name: 'Mandelbulb',
        subtitle: 'Spherical 3D Power Fold',
        defaultCam: {
            pos: [0.0, 0.0, 1.55],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'mb_power', name: 'Power', min: 4.0, max: 12.0, step: 0.05, default: 8.0, uniform: 'u_mb_power', type: 'float' },
            { id: 'mb_iterations', name: 'Iterations', min: 4, max: 24, step: 1, default: 12, uniform: 'u_mb_iterations', type: 'int' },
            { id: 'mb_julia_mix', name: 'Julia Morph', min: 0.0, max: 0.4, step: 0.01, default: 0.0, uniform: 'u_mb_julia_mix', type: 'float' },
            { id: 'mb_julia_cx', name: 'Julia C.X', min: -0.8, max: 0.8, step: 0.01, default: -0.3, uniform: 'u_mb_julia_cx', type: 'float' },
            { id: 'mb_julia_cy', name: 'Julia C.Y', min: -0.8, max: 0.8, step: 0.01, default: 0.25, uniform: 'u_mb_julia_cy', type: 'float' },
            { id: 'mb_julia_cz', name: 'Julia C.Z', min: -0.8, max: 0.8, step: 0.01, default: 0.15, uniform: 'u_mb_julia_cz', type: 'float' }
        ],
        presets: [
            {
                name: 'Classic Power 8',
                values: { mb_power: 8.0, mb_iterations: 12, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            },
            {
                name: 'Organic Power 7',
                values: { mb_power: 7.0, mb_iterations: 12, mb_julia_mix: 0.08, mb_julia_cx: -0.2, mb_julia_cy: 0.15, mb_julia_cz: 0.1 }
            },
            {
                name: 'Smooth Romanesco Power 6',
                values: { mb_power: 6.0, mb_iterations: 12, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            },
            {
                name: 'Monolithic Power 9',
                values: { mb_power: 9.0, mb_iterations: 14, mb_julia_mix: 0.05, mb_julia_cx: -0.15, mb_julia_cy: 0.2, mb_julia_cz: -0.1 }
            }
        ],
        glsl: `
// Canonical Smooth Mandelbulb DE (Pure spherical harmonics, zero spikes, zero horns)
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 w = pos;
    vec4 orbit = vec4(100.0);
    
    vec3 juliaC = vec3(u_mb_julia_cx, u_mb_julia_cy, u_mb_julia_cz);
    vec3 c = mix(pos, juliaC, u_mb_julia_mix);
    
    float dz = 1.0;
    float power = u_mb_power;
    int maxIt = int(u_mb_iterations);
    float m = dot(w, w);
    
    for (int i = 0; i < 30; i++) {
        if (i >= maxIt) break;
        
        float r = sqrt(m);
        dz = power * pow(r, power - 1.0) * dz + 1.0;
        
        // Canonical continuous spherical harmonics (Inigo Quilez / Daniel White)
        float b = power * acos(clamp(w.y / max(1e-5, r), -1.0, 1.0));
        float a = power * atan(w.x, w.z);
        
        w = c + pow(r, power) * vec3(sin(b) * sin(a), cos(b), sin(b) * cos(a));
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(w.x) + abs(w.y));
        orbit.z = min(orbit.z, abs(dot(w, vec3(0.577))));
        orbit.w = float(i);
        
        m = dot(w, w);
        if (m > 8.0) break;
    }
    
    trap = orbit;
    if (m < 1.0) return 0.0;
    return 0.25 * log(m) * sqrt(m) / max(1e-4, dz);
}
`,
        cpuEvalDE: (p, state) => {
            const power = state.mb_power ?? 8.0;
            const maxIt = Math.min(16, state.mb_iterations ?? 12);
            let x = p[0], y = p[1], z = p[2];
            const jMix = state.mb_julia_mix ?? 0.0;
            const cx = (1.0 - jMix) * x + jMix * (state.mb_julia_cx ?? -0.3);
            const cy = (1.0 - jMix) * y + jMix * (state.mb_julia_cy ?? 0.25);
            const cz = (1.0 - jMix) * z + jMix * (state.mb_julia_cz ?? 0.15);
            let dz = 1.0;
            let m = x * x + y * y + z * z;

            for (let i = 0; i < maxIt; i++) {
                const r = Math.sqrt(m);
                dz = power * Math.pow(r, power - 1.0) * dz + 1.0;
                const b = power * Math.acos(Math.max(-1.0, Math.min(1.0, y / Math.max(1e-5, r))));
                const a = power * Math.atan2(x, z);
                const rPow = Math.pow(r, power);
                x = cx + rPow * Math.sin(b) * Math.sin(a);
                y = cy + rPow * Math.cos(b);
                z = cz + rPow * Math.sin(b) * Math.cos(a);
                m = x * x + y * y + z * z;
                if (m > 8.0) break;
            }
            if (m < 1.0) return 0.0;
            return 0.25 * Math.log(m) * Math.sqrt(m) / Math.max(1e-4, dz);
        }
    },

    [FORMULA_IDS.MANDELBOX]: {
        id: FORMULA_IDS.MANDELBOX,
        name: 'Mandelbox',
        subtitle: 'Brutalist Box & Sphere Inversion Fold',
        defaultCam: {
            pos: [4.2, 3.2, 4.6],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'mbox_scale', name: 'Scale', min: -3.5, max: 3.5, step: 0.02, default: 2.2, uniform: 'u_mbox_scale', type: 'float' },
            { id: 'mbox_iterations', name: 'Iterations', min: 4, max: 16, step: 1, default: 9, uniform: 'u_mbox_iterations', type: 'int' },
            { id: 'mbox_fold_limit', name: 'Box Fold Limit', min: 0.2, max: 2.0, step: 0.02, default: 1.0, uniform: 'u_mbox_fold_limit', type: 'float' },
            { id: 'mbox_min_radius', name: 'Min Radius', min: 0.05, max: 1.0, step: 0.01, default: 0.5, uniform: 'u_mbox_min_radius', type: 'float' },
            { id: 'mbox_fixed_radius', name: 'Fixed Radius', min: 0.5, max: 2.5, step: 0.02, default: 1.0, uniform: 'u_mbox_fixed_radius', type: 'float' },
            { id: 'mbox_rot_x', name: 'Step Rot X', min: -0.5, max: 0.5, step: 0.01, default: 0.0, uniform: 'u_mbox_rot_x', type: 'float' },
            { id: 'mbox_rot_y', name: 'Step Rot Y', min: -0.5, max: 0.5, step: 0.01, default: 0.0, uniform: 'u_mbox_rot_y', type: 'float' },
            { id: 'mbox_rot_z', name: 'Step Rot Z', min: -0.5, max: 0.5, step: 0.01, default: 0.0, uniform: 'u_mbox_rot_z', type: 'float' },
            { id: 'mbox_offset_x', name: 'Offset Shift X', min: -1.0, max: 1.0, step: 0.01, default: 0.0, uniform: 'u_mbox_offset_x', type: 'float' },
            { id: 'mbox_offset_y', name: 'Offset Shift Y', min: -1.0, max: 1.0, step: 0.01, default: 0.0, uniform: 'u_mbox_offset_y', type: 'float' },
            { id: 'mbox_offset_z', name: 'Offset Shift Z', min: -1.0, max: 1.0, step: 0.01, default: 0.0, uniform: 'u_mbox_offset_z', type: 'float' },
            { id: 'mbox_near_clip', name: 'Camera Clearance', min: 0.2, max: 2.5, step: 0.05, default: 0.70, uniform: 'u_mbox_near_clip', type: 'float' }
        ],
        presets: [
            {
                name: 'Default Metropolis',
                values: { mbox_scale: 2.2, mbox_iterations: 9, mbox_fold_limit: 1.0, mbox_min_radius: 0.5, mbox_fixed_radius: 1.0, mbox_rot_x: 0, mbox_rot_y: 0, mbox_rot_z: 0, mbox_offset_x: 0, mbox_offset_y: 0, mbox_offset_z: 0, mbox_near_clip: 0.70 }
            },
            {
                name: 'Infinite Sci-Fi Grid',
                values: { mbox_scale: -1.9, mbox_iterations: 10, mbox_fold_limit: 0.85, mbox_min_radius: 0.35, mbox_fixed_radius: 1.15, mbox_rot_x: 0.08, mbox_rot_y: -0.05, mbox_rot_z: 0.06, mbox_offset_x: 0.1, mbox_offset_y: -0.05, mbox_offset_z: 0.12, mbox_near_clip: 0.70 }
            },
            {
                name: 'Gothic Colosseum',
                values: { mbox_scale: 2.8, mbox_iterations: 10, mbox_fold_limit: 1.2, mbox_min_radius: 0.45, mbox_fixed_radius: 1.4, mbox_rot_x: 0.0, mbox_rot_y: 0.15, mbox_rot_z: 0.0, mbox_offset_x: -0.2, mbox_offset_y: 0.0, mbox_offset_z: 0.1, mbox_near_clip: 0.70 }
            },
            {
                name: 'Negative Folding Hive',
                values: { mbox_scale: -2.6, mbox_iterations: 10, mbox_fold_limit: 0.7, mbox_min_radius: 0.28, mbox_fixed_radius: 0.9, mbox_rot_x: 0.12, mbox_rot_y: 0.2, mbox_rot_z: -0.1, mbox_offset_x: 0.0, mbox_offset_y: 0.2, mbox_offset_z: 0.0, mbox_near_clip: 0.70 }
            }
        ],
        glsl: `
// Canonical Robust Mandelbox DE (Smooth, continuous distance estimation with zero branch stutter)
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 offset = pos + vec3(u_mbox_offset_x, u_mbox_offset_y, u_mbox_offset_z);
    vec3 z = offset;
    float dr = 1.0;
    vec4 orbit = vec4(100.0);
    
    mat3 rotStep = rotX(u_mbox_rot_x) * rotY(u_mbox_rot_y) * rotZ(u_mbox_rot_z);
    
    float minR2 = u_mbox_min_radius * u_mbox_min_radius;
    float fixedR2 = u_mbox_fixed_radius * u_mbox_fixed_radius;
    float foldLimit = u_mbox_fold_limit;
    float scale = u_mbox_scale;
    float absScale = abs(scale);
    int maxIt = min(14, int(u_mbox_iterations));
    
    for (int n = 0; n < 16; n++) {
        if (n >= maxIt) break;
        
        // Box fold (clamp fold)
        z = clamp(z, -foldLimit, foldLimit) * 2.0 - z;
        
        // Sphere fold
        float r2 = dot(z, z);
        if (r2 < minR2) {
            float temp = fixedR2 / minR2;
            z *= temp;
            dr *= temp;
        } else if (r2 < fixedR2) {
            float temp = fixedR2 / r2;
            z *= temp;
            dr *= temp;
        }
        
        z = rotStep * z;
        z = scale * z + offset;
        dr = dr * absScale + 1.0;
        
        float r = length(z);
        if (r > 600.0) break; // Escape threshold early out
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(z.x * z.y));
        orbit.z = min(orbit.z, abs(z.z));
        orbit.w = float(n);
    }
    
    trap = orbit;
    float r = length(z);
    return 0.65 * r / max(1e-4, abs(dr));
}
`,
        cpuEvalDE: (p, state) => {
            const scale = state.mbox_scale ?? 2.3;
            const foldLimit = state.mbox_foldLimit ?? state.mbox_fold_limit ?? 1.0;
            const minR = state.mbox_min_radius ?? 0.5;
            const fixR = state.mbox_fixed_radius ?? 1.0;
            const minR2 = minR * minR;
            const fixR2 = fixR * fixR;
            const maxIt = Math.min(14, state.mbox_iterations ?? 11);

            let zx = p[0] + (state.mbox_offset_x ?? 0);
            let zy = p[1] + (state.mbox_offset_y ?? 0);
            let zz = p[2] + (state.mbox_offset_z ?? 0);
            const ox = zx, oy = zy, oz = zz;
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                // box fold
                zx = Math.max(-foldLimit, Math.min(foldLimit, zx)) * 2 - zx;
                zy = Math.max(-foldLimit, Math.min(foldLimit, zy)) * 2 - zy;
                zz = Math.max(-foldLimit, Math.min(foldLimit, zz)) * 2 - zz;

                // sphere fold
                const r2 = zx * zx + zy * zy + zz * zz;
                if (r2 < minR2) {
                    const temp = fixR2 / minR2;
                    zx *= temp; zy *= temp; zz *= temp;
                    dr *= temp;
                } else if (r2 < fixR2) {
                    const temp = fixR2 / r2;
                    zx *= temp; zy *= temp; zz *= temp;
                    dr *= temp;
                }

                zx = scale * zx + ox;
                zy = scale * zy + oy;
                zz = scale * zz + oz;
                dr = dr * Math.abs(scale) + 1.0;
                const r = Math.sqrt(zx * zx + zy * zy + zz * zz);
                if (r > 500.0) break;
            }
            const r = Math.sqrt(zx * zx + zy * zy + zz * zz);
            return 0.65 * r / Math.max(1e-4, Math.abs(dr));
        }
    },

    [FORMULA_IDS.KIFS]: {
        id: FORMULA_IDS.KIFS,
        name: 'Kaleidoscopic IFS',
        subtitle: 'Polyhedral Reflection & Fractal Origami',
        defaultCam: {
            pos: [0.83, 0.68, 0.98],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'kifs_symmetry', name: 'Symmetry Mode', min: 0, max: 3, step: 1, default: 1, uniform: 'u_kifs_symmetry', type: 'int', enumNames: ['Tetrahedral', 'Octahedral', 'Prismatic', 'Cubic'] },
            { id: 'kifs_scale', name: 'Scale Factor', min: 1.5, max: 2.8, step: 0.02, default: 2.0, uniform: 'u_kifs_scale', type: 'float' },
            { id: 'kifs_iterations', name: 'Iterations', min: 4, max: 18, step: 1, default: 10, uniform: 'u_kifs_iterations', type: 'int' },
            { id: 'kifs_offset_x', name: 'Fold Offset X', min: 0.5, max: 1.8, step: 0.02, default: 1.0, uniform: 'u_kifs_offset_x', type: 'float' },
            { id: 'kifs_offset_y', name: 'Fold Offset Y', min: 0.5, max: 1.8, step: 0.02, default: 1.0, uniform: 'u_kifs_offset_y', type: 'float' },
            { id: 'kifs_offset_z', name: 'Fold Offset Z', min: 0.5, max: 1.8, step: 0.02, default: 1.0, uniform: 'u_kifs_offset_z', type: 'float' },
            { id: 'kifs_pre_rot_x', name: 'Pre-Rot X', min: -0.35, max: 0.35, step: 0.01, default: 0.0, uniform: 'u_kifs_pre_rot_x', type: 'float' },
            { id: 'kifs_pre_rot_y', name: 'Pre-Rot Y', min: -0.35, max: 0.35, step: 0.01, default: 0.08, uniform: 'u_kifs_pre_rot_y', type: 'float' },
            { id: 'kifs_pre_rot_z', name: 'Pre-Rot Z', min: -0.35, max: 0.35, step: 0.01, default: 0.0, uniform: 'u_kifs_pre_rot_z', type: 'float' },
            { id: 'kifs_post_rot_x', name: 'Post-Rot X', min: -0.35, max: 0.35, step: 0.01, default: 0.0, uniform: 'u_kifs_post_rot_x', type: 'float' },
            { id: 'kifs_post_rot_y', name: 'Post-Rot Y', min: -0.35, max: 0.35, step: 0.01, default: 0.0, uniform: 'u_kifs_post_rot_y', type: 'float' },
            { id: 'kifs_post_rot_z', name: 'Post-Rot Z', min: -0.35, max: 0.35, step: 0.01, default: 0.05, uniform: 'u_kifs_post_rot_z', type: 'float' }
        ],
        presets: [
            {
                name: 'Octahedral Clockwork Matrix',
                values: { kifs_symmetry: 1, kifs_scale: 2.1, kifs_iterations: 11, kifs_offset_x: 1.0, kifs_offset_y: 1.0, kifs_offset_z: 1.0, kifs_pre_rot_x: 0.04, kifs_pre_rot_y: 0.08, kifs_pre_rot_z: -0.02, kifs_post_rot_x: -0.03, kifs_post_rot_y: 0.05, kifs_post_rot_z: 0.06 }
            },
            {
                name: 'Prismatic Crystal Pavilion',
                values: { kifs_symmetry: 2, kifs_scale: 2.0, kifs_iterations: 10, kifs_offset_x: 1.1, kifs_offset_y: 1.0, kifs_offset_z: 0.9, kifs_pre_rot_x: 0.0, kifs_pre_rot_y: 0.1, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.05, kifs_post_rot_y: -0.05, kifs_post_rot_z: 0.08 }
            },
            {
                name: 'Cubic Menger Temple',
                values: { kifs_symmetry: 3, kifs_scale: 2.3, kifs_iterations: 10, kifs_offset_x: 1.0, kifs_offset_y: 1.0, kifs_offset_z: 1.0, kifs_pre_rot_x: 0.02, kifs_pre_rot_y: 0.05, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.0, kifs_post_rot_y: 0.03, kifs_post_rot_z: 0.04 }
            },
            {
                name: 'Sierpinski Cathedral',
                values: { kifs_symmetry: 0, kifs_scale: 2.0, kifs_iterations: 11, kifs_offset_x: 1.0, kifs_offset_y: 1.0, kifs_offset_z: 1.0, kifs_pre_rot_x: 0.0, kifs_pre_rot_y: 0.06, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.0, kifs_post_rot_y: 0.0, kifs_post_rot_z: 0.04 }
            }
        ],
        glsl: `
// Canonical Robust Kaleidoscopic IFS DE (Lipschitz scale-invariant, 100% surface preservation)
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 z = pos;
    float scale = u_kifs_scale;
    vec3 offset = vec3(u_kifs_offset_x, u_kifs_offset_y, u_kifs_offset_z);
    
    mat3 preR = rotX(u_kifs_pre_rot_x) * rotY(u_kifs_pre_rot_y) * rotZ(u_kifs_pre_rot_z);
    mat3 postR = rotX(u_kifs_post_rot_x) * rotY(u_kifs_post_rot_y) * rotZ(u_kifs_post_rot_z);
    
    int sym = int(u_kifs_symmetry);
    int maxIt = int(u_kifs_iterations);
    vec4 orbit = vec4(100.0);
    float dr = 1.0;
    
    for (int i = 0; i < 20; i++) {
        if (i >= maxIt) break;
        
        z = preR * z;
        
        if (sym == 0) {
            // Tetrahedral folds
            if (z.x + z.y < 0.0) z.xy = -z.yx;
            if (z.x + z.z < 0.0) z.xz = -z.zx;
            if (z.y + z.z < 0.0) z.yz = -z.zy;
        } else if (sym == 1) {
            // Octahedral folds
            z = abs(z);
            if (z.x < z.y) z.xy = z.yx;
            if (z.x < z.z) z.xz = z.zx;
            if (z.y < z.z) z.yz = z.zy;
        } else if (sym == 2) {
            // Prismatic polyhedral folds
            z = abs(z);
            if (z.x < z.y) z.xy = z.yx;
            if (z.x + z.z < 1.0) {
                float t = -z.x;
                z.x = -z.z + 1.0;
                z.z = t + 1.0;
            }
        } else {
            // Cubic / Menger folds
            z = abs(z);
            if (z.x - z.y < 0.0) z.xy = z.yx;
            if (z.x - z.z < 0.0) z.xz = z.zx;
            if (z.y - z.z < 0.0) z.yz = z.zy;
        }
        
        z = postR * z;
        z = z * scale - offset * (scale - 1.0);
        dr = dr * scale;
        
        orbit.x = min(orbit.x, length(z));
        orbit.y = min(orbit.y, abs(z.x) + abs(z.y));
        orbit.z = min(orbit.z, abs(z.z));
        orbit.w = float(i);
    }
    
    trap = orbit;
    return 0.75 * (length(z) - 1.0) / max(1e-4, dr);
}
`,
        cpuEvalDE: (p, state) => {
            const scale = state.kifs_scale ?? 2.0;
            const maxIt = Math.min(10, state.kifs_iterations ?? 10);
            let zx = p[0], zy = p[1], zz = p[2];
            const ox = state.kifs_offset_x ?? 1.0;
            const oy = state.kifs_offset_y ?? 1.0;
            const oz = state.kifs_offset_z ?? 1.0;
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                zx = Math.abs(zx); zy = Math.abs(zy); zz = Math.abs(zz);
                if (zx < zy) { const t = zx; zx = zy; zy = t; }
                if (zx < zz) { const t = zx; zx = zz; zz = t; }
                if (zy < zz) { const t = zy; zy = zz; zz = t; }
                zx = zx * scale - ox * (scale - 1.0);
                zy = zy * scale - oy * (scale - 1.0);
                zz = zz * scale - oz * (scale - 1.0);
                dr = dr * scale;
            }
            const r = Math.sqrt(zx * zx + zy * zy + zz * zz);
            return 0.75 * (r - 1.0) / Math.max(1e-4, dr);
        }
    },

    [FORMULA_IDS.QUAT_JULIA]: {
        id: FORMULA_IDS.QUAT_JULIA,
        name: '4D Quaternion Julia',
        subtitle: 'Hypercomplex 4D Julia Slice & Liquid Ribbons',
        defaultCam: {
            pos: [0.0, 0.0, 1.58],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'qj_cx', name: '4D C.X', min: -1.5, max: 1.5, step: 0.01, default: -0.2, uniform: 'u_qj_cx', type: 'float' },
            { id: 'qj_cy', name: '4D C.Y', min: -1.5, max: 1.5, step: 0.01, default: 0.6, uniform: 'u_qj_cy', type: 'float' },
            { id: 'qj_cz', name: '4D C.Z', min: -1.5, max: 1.5, step: 0.01, default: 0.4, uniform: 'u_qj_cz', type: 'float' },
            { id: 'qj_cw', name: '4D C.W', min: -1.5, max: 1.5, step: 0.01, default: 0.0, uniform: 'u_qj_cw', type: 'float' },
            { id: 'qj_slice_w', name: '4D W-Slice', min: -1.5, max: 1.5, step: 0.01, default: 0.0, uniform: 'u_qj_slice_w', type: 'float' },
            { id: 'qj_rot_xw', name: '4D Rot X-W', min: -3.14, max: 3.14, step: 0.02, default: 0.0, uniform: 'u_qj_rot_xw', type: 'float' },
            { id: 'qj_rot_yw', name: '4D Rot Y-W', min: -3.14, max: 3.14, step: 0.02, default: 0.0, uniform: 'u_qj_rot_yw', type: 'float' },
            { id: 'qj_iterations', name: 'Iterations', min: 4, max: 20, step: 1, default: 11, uniform: 'u_qj_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Liquid Hyper-Ribbon',
                values: { qj_cx: -0.2, qj_cy: 0.6, qj_cz: 0.4, qj_cw: 0.0, qj_slice_w: 0.0, qj_rot_xw: 0, qj_rot_yw: 0, qj_iterations: 11 }
            },
            {
                name: 'Seahorse Hyper-Whorl',
                values: { qj_cx: -0.4, qj_cy: -0.25, qj_cz: 0.35, qj_cw: 0.22, qj_slice_w: 0.28, qj_rot_xw: 0.45, qj_rot_yw: -0.3, qj_iterations: 13 }
            },
            {
                name: 'Alien Dendrite',
                values: { qj_cx: 0.28, qj_cy: 0.0, qj_cz: 0.65, qj_cw: -0.3, qj_slice_w: -0.15, qj_rot_xw: -0.6, qj_rot_yw: 0.5, qj_iterations: 12 }
            }
        ],
        glsl: `
// 4D Quaternion Julia DE
vec4 quatSq(vec4 q) {
    return vec4(
        q.x * q.x - dot(q.yzw, q.yzw),
        2.0 * q.x * q.yzw
    );
}

float mapFractal(vec3 pos, out vec4 trap) {
    vec4 z = vec4(pos, u_qj_slice_w);
    
    // Exact 4D Plane Rotations
    float cosXW = cos(u_qj_rot_xw); float sinXW = sin(u_qj_rot_xw);
    float cosYW = cos(u_qj_rot_yw); float sinYW = sin(u_qj_rot_yw);
    
    // Rotate in X-W plane
    vec2 xw = mat2(cosXW, -sinXW, sinXW, cosXW) * vec2(z.x, z.w);
    z.x = xw.x; z.w = xw.y;
    
    // Rotate in Y-W plane
    vec2 yw = mat2(cosYW, -sinYW, sinYW, cosYW) * vec2(z.y, z.w);
    z.y = yw.x; z.w = yw.y;
    
    vec4 c = vec4(u_qj_cx, u_qj_cy, u_qj_cz, u_qj_cw);
    float md2 = 1.0;
    float mz2 = dot(z, z);
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_qj_iterations);
    
    for (int i = 0; i < 20; i++) {
        if (i >= maxIt) break;
        
        md2 *= 4.0 * mz2;
        z = quatSq(z) + c;
        mz2 = dot(z, z);
        
        orbit.x = min(orbit.x, sqrt(mz2));
        orbit.y = min(orbit.y, abs(z.y) + abs(z.z));
        orbit.z = min(orbit.z, abs(z.w));
        orbit.w = float(i);
        
        if (mz2 > 16.0) break;
    }
    
    trap = orbit;
    return 0.25 * sqrt(mz2 / max(md2, 1e-6)) * log(max(1.0001, mz2));
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2], zw = state.qj_slice_w ?? 0.0;
            const cosXW = Math.cos(state.qj_rot_xw ?? 0.0), sinXW = Math.sin(state.qj_rot_xw ?? 0.0);
            const cosYW = Math.cos(state.qj_rot_yw ?? 0.0), sinYW = Math.sin(state.qj_rot_yw ?? 0.0);
            const nxw0 = cosXW * zx - sinXW * zw, nxw1 = sinXW * zx + cosXW * zw;
            zx = nxw0; zw = nxw1;
            const nyw0 = cosYW * zy - sinYW * zw, nyw1 = sinYW * zy + cosYW * zw;
            zy = nyw0; zw = nyw1;

            const cx = state.qj_cx ?? -0.2;
            const cy = state.qj_cy ?? 0.6;
            const cz = state.qj_cz ?? 0.4;
            const cw = state.qj_cw ?? 0.0;
            const maxIt = Math.min(12, state.qj_iterations ?? 11);

            let md2 = 1.0;
            let mz2 = zx * zx + zy * zy + zz * zz + zw * zw;

            for (let i = 0; i < maxIt; i++) {
                md2 *= 4.0 * mz2;
                const nx = zx * zx - (zy * zy + zz * zz + zw * zw) + cx;
                const ny = 2.0 * zx * zy + cy;
                const nz = 2.0 * zx * zz + cz;
                const nw = 2.0 * zx * zw + cw;
                zx = nx; zy = ny; zz = nz; zw = nw;
                mz2 = zx * zx + zy * zy + zz * zz + zw * zw;
                if (mz2 > 16.0) break;
            }
            return 0.25 * Math.sqrt(mz2 / Math.max(1e-6, md2)) * Math.log(Math.max(1.0001, mz2));
        }
    }
};
