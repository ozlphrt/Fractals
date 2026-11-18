// js/formulas/registry.js
// Definitions for the 5 dedicated fractal engines:
// GLSL Distance Estimator snippet + Uniform definitions + CPU DE Mirror (for lag-free camera flight proximity) + Presets

export const FORMULA_IDS = {
    QUAT_JULIA: 'quat_julia',
    MANDELBULB: 'mandelbulb',
    MANDELBOX: 'mandelbox',
    KIFS: 'kifs',
    APOLLONIAN: 'apollonian',
    DODECAHEDRON: 'dodecahedron',
    BURNING_SHIP: 'burning_ship',
    TRIG_SINE: 'trig_sine',
    JERUSALEM: 'jerusalem',
    QUAT_MANDELBROT: 'quat_mandelbrot'
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
                name: 'Classic Power 8 Romanesco',
                values: { mb_power: 8.0, mb_iterations: 14, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            },
            {
                name: 'Power 4 Quad-Lobe Biological',
                values: { mb_power: 4.0, mb_iterations: 10, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            },
            {
                name: 'Power 11 Crystalline Spire',
                values: { mb_power: 11.0, mb_iterations: 16, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            },
            {
                name: 'Power 6 Monolithic Coral Bulb',
                values: { mb_power: 6.0, mb_iterations: 11, mb_julia_mix: 0.0, mb_julia_cx: 0.0, mb_julia_cy: 0.0, mb_julia_cz: 0.0 }
            }
        ],
        glsl: `
// Canonical Symmetrical Mandelbulb DE (Equally distributed spherical harmonics, zero polar sheets/pancakes)
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
        
        // Canonical Symmetrical Spherical Coordinates (removes polar pinch & stretched sheets)
        float theta = acos(clamp(w.z / max(1e-5, r), -1.0, 1.0));
        float phi = atan(w.y, w.x);
        
        theta *= power;
        phi *= power;
        
        float zr = pow(r, power);
        w = c + zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(sin(theta) * cos(phi)));
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
            const cx = (1.0 - jMix) * x + jMix * (state.mb_julia_cx ?? 0.0);
            const cy = (1.0 - jMix) * y + jMix * (state.mb_julia_cy ?? 0.0);
            const cz = (1.0 - jMix) * z + jMix * (state.mb_julia_cz ?? 0.0);
            let dz = 1.0;
            let m = x * x + y * y + z * z;

            for (let i = 0; i < maxIt; i++) {
                const r = Math.sqrt(m);
                dz = power * Math.pow(r, power - 1.0) * dz + 1.0;
                let theta = Math.acos(Math.max(-1.0, Math.min(1.0, z / Math.max(1e-5, r))));
                let phi = Math.atan2(y, x);
                theta *= power;
                phi *= power;
                const zr = Math.pow(r, power);
                x = cx + zr * Math.sin(theta) * Math.cos(phi);
                y = cy + zr * Math.sin(theta) * Math.sin(phi);
                z = cz + zr * Math.cos(theta);
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
                name: 'Metropolis Citadel',
                values: { mbox_scale: 2.25, mbox_iterations: 10, mbox_fold_limit: 1.0, mbox_min_radius: 0.5, mbox_fixed_radius: 1.0, mbox_rot_x: 0.0, mbox_rot_y: 0.0, mbox_rot_z: 0.0, mbox_offset_x: 0.0, mbox_offset_y: 0.0, mbox_offset_z: 0.0, mbox_near_clip: 0.70 }
            },
            {
                name: 'Brutalist Flying Buttresses',
                values: { mbox_scale: 2.75, mbox_iterations: 11, mbox_fold_limit: 1.22, mbox_min_radius: 0.42, mbox_fixed_radius: 1.35, mbox_rot_x: 0.04, mbox_rot_y: 0.08, mbox_rot_z: 0.0, mbox_offset_x: -0.15, mbox_offset_y: 0.0, mbox_offset_z: 0.12, mbox_near_clip: 0.70 }
            },
            {
                name: 'Sub-Zero Crystalline Lattice',
                values: { mbox_scale: -1.85, mbox_iterations: 10, mbox_fold_limit: 0.82, mbox_min_radius: 0.36, mbox_fixed_radius: 1.18, mbox_rot_x: 0.07, mbox_rot_y: -0.06, mbox_rot_z: 0.05, mbox_offset_x: 0.12, mbox_offset_y: -0.08, mbox_offset_z: 0.14, mbox_near_clip: 0.70 }
            },
            {
                name: 'Monolithic Hyper-Sanctuary',
                values: { mbox_scale: 2.05, mbox_iterations: 9, mbox_fold_limit: 1.15, mbox_min_radius: 0.58, mbox_fixed_radius: 1.05, mbox_rot_x: -0.05, mbox_rot_y: 0.06, mbox_rot_z: -0.04, mbox_offset_x: 0.05, mbox_offset_y: 0.1, mbox_offset_z: -0.05, mbox_near_clip: 0.70 }
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
                values: { kifs_symmetry: 1, kifs_scale: 2.12, kifs_iterations: 11, kifs_offset_x: 1.0, kifs_offset_y: 1.0, kifs_offset_z: 1.0, kifs_pre_rot_x: 0.04, kifs_pre_rot_y: 0.08, kifs_pre_rot_z: -0.02, kifs_post_rot_x: -0.03, kifs_post_rot_y: 0.05, kifs_post_rot_z: 0.06 }
            },
            {
                name: 'Sierpinski Sacred Pyramid',
                values: { kifs_symmetry: 0, kifs_scale: 1.95, kifs_iterations: 10, kifs_offset_x: 1.15, kifs_offset_y: 1.15, kifs_offset_z: 1.15, kifs_pre_rot_x: 0.0, kifs_pre_rot_y: 0.0, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.0, kifs_post_rot_y: 0.0, kifs_post_rot_z: 0.0 }
            },
            {
                name: 'Prismatic Crystal Spire',
                values: { kifs_symmetry: 2, kifs_scale: 2.25, kifs_iterations: 12, kifs_offset_x: 1.25, kifs_offset_y: 0.85, kifs_offset_z: 1.05, kifs_pre_rot_x: 0.06, kifs_pre_rot_y: 0.14, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.08, kifs_post_rot_y: -0.06, kifs_post_rot_z: 0.1 }
            },
            {
                name: 'Cubic Menger Fortress',
                values: { kifs_symmetry: 3, kifs_scale: 2.45, kifs_iterations: 10, kifs_offset_x: 1.0, kifs_offset_y: 1.0, kifs_offset_z: 1.0, kifs_pre_rot_x: 0.03, kifs_pre_rot_y: 0.06, kifs_pre_rot_z: 0.0, kifs_post_rot_x: 0.0, kifs_post_rot_y: 0.04, kifs_post_rot_z: 0.05 }
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
                values: { qj_cx: -0.2, qj_cy: 0.6, qj_cz: 0.4, qj_cw: 0.0, qj_slice_w: 0.0, qj_rot_xw: 0.0, qj_rot_yw: 0.0, qj_iterations: 11 }
            },
            {
                name: 'Seahorse 4D Hyper-Nebula',
                values: { qj_cx: -0.38, qj_cy: -0.28, qj_cz: 0.38, qj_cw: 0.22, qj_slice_w: 0.26, qj_rot_xw: 0.52, qj_rot_yw: -0.35, qj_iterations: 13 }
            },
            {
                name: 'Alien Crystalline Dendrite',
                values: { qj_cx: 0.32, qj_cy: 0.02, qj_cz: 0.62, qj_cw: -0.28, qj_slice_w: -0.18, qj_rot_xw: -0.65, qj_rot_yw: 0.55, qj_iterations: 12 }
            },
            {
                name: 'Hypercomplex Torus Ring',
                values: { qj_cx: -0.12, qj_cy: 0.18, qj_cz: 0.56, qj_cw: 0.14, qj_slice_w: 0.42, qj_rot_xw: -0.85, qj_rot_yw: 0.62, qj_iterations: 12 }
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
    },

    [FORMULA_IDS.APOLLONIAN]: {
        id: FORMULA_IDS.APOLLONIAN,
        name: 'Apollonian Gasket',
        subtitle: 'Kleinian 3D Sphere Inversion Packing',
        defaultCam: {
            pos: [0.0, 0.0, 1.6],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'apol_scale', name: 'Scale Factor', min: 1.2, max: 2.8, step: 0.02, default: 1.82, uniform: 'u_apol_scale', type: 'float' },
            { id: 'apol_radius', name: 'Sphere Radius', min: 0.4, max: 1.6, step: 0.02, default: 0.84, uniform: 'u_apol_radius', type: 'float' },
            { id: 'apol_dist', name: 'Cell Offset', min: 0.2, max: 1.8, step: 0.02, default: 0.68, uniform: 'u_apol_dist', type: 'float' },
            { id: 'apol_rot_x', name: 'Fold Rot X', min: -0.5, max: 0.5, step: 0.01, default: 0.0, uniform: 'u_apol_rot_x', type: 'float' },
            { id: 'apol_rot_y', name: 'Fold Rot Y', min: -0.5, max: 0.5, step: 0.01, default: 0.0, uniform: 'u_apol_rot_y', type: 'float' },
            { id: 'apol_iterations', name: 'Iterations', min: 4, max: 14, step: 1, default: 9, uniform: 'u_apol_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Celestial Geodesic Foam',
                values: { apol_scale: 1.82, apol_radius: 0.84, apol_dist: 0.68, apol_rot_x: 0.0, apol_rot_y: 0.0, apol_iterations: 9 }
            },
            {
                name: 'Pearl Lattice Cathedral',
                values: { apol_scale: 2.15, apol_radius: 0.96, apol_dist: 0.85, apol_rot_x: 0.08, apol_rot_y: -0.05, apol_iterations: 10 }
            },
            {
                name: 'Bubble Chamber Matrix',
                values: { apol_scale: 1.55, apol_radius: 0.72, apol_dist: 0.45, apol_rot_x: -0.06, apol_rot_y: 0.12, apol_iterations: 8 }
            },
            {
                name: 'Cosmic Bead Necklace',
                values: { apol_scale: 2.45, apol_radius: 1.15, apol_dist: 1.05, apol_rot_x: 0.14, apol_rot_y: 0.08, apol_iterations: 11 }
            }
        ],
        glsl: `
// 3D Apollonian Sphere Inversion Packing DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float scale = u_apol_scale;
    vec4 orbit = vec4(100.0);
    float dr = 1.0;
    int maxIt = int(u_apol_iterations);
    float r2_limit = u_apol_radius * u_apol_radius;
    mat3 rot = rotX(u_apol_rot_x) * rotY(u_apol_rot_y);
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;
        p = rot * p;
        p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
        
        float r2 = dot(p, p);
        orbit.x = min(orbit.x, sqrt(r2));
        orbit.y = min(orbit.y, abs(p.x * p.y));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);
        
        float k = max(r2_limit / max(1e-4, r2), 1.0);
        p *= k;
        dr *= k;
        
        p = p * scale - vec3(u_apol_dist);
        dr = dr * scale;
    }
    
    trap = orbit;
    return 0.5 * (length(p) - 0.25) / max(1e-4, dr);
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2];
            const scale = state.apol_scale ?? 1.82;
            const r2_limit = (state.apol_radius ?? 0.84) ** 2;
            const dist = state.apol_dist ?? 0.68;
            const maxIt = Math.min(10, state.apol_iterations ?? 9);
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                zx = -1.0 + 2.0 * (((0.5 * zx + 0.5) % 1.0 + 1.0) % 1.0);
                zy = -1.0 + 2.0 * (((0.5 * zy + 0.5) % 1.0 + 1.0) % 1.0);
                zz = -1.0 + 2.0 * (((0.5 * zz + 0.5) % 1.0 + 1.0) % 1.0);

                const r2 = zx * zx + zy * zy + zz * zz;
                const k = Math.max(r2_limit / Math.max(1e-4, r2), 1.0);
                zx *= k; zy *= k; zz *= k;
                dr *= k;

                zx = zx * scale - dist;
                zy = zy * scale - dist;
                zz = zz * scale - dist;
                dr = dr * scale;
            }
            const len = Math.sqrt(zx * zx + zy * zy + zz * zz);
            return 0.5 * (len - 0.25) / Math.max(1e-4, dr);
        }
    },

    [FORMULA_IDS.DODECAHEDRON]: {
        id: FORMULA_IDS.DODECAHEDRON,
        name: 'Dodecahedron IFS',
        subtitle: 'Golden Ratio 12-Face Sacred Geometry',
        defaultCam: {
            pos: [0.0, 0.0, 1.55],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'dodec_scale', name: 'Scale Factor', min: 1.5, max: 2.8, step: 0.02, default: 2.15, uniform: 'u_dodec_scale', type: 'float' },
            { id: 'dodec_offset', name: 'Offset', min: 0.4, max: 1.8, step: 0.02, default: 1.0, uniform: 'u_dodec_offset', type: 'float' },
            { id: 'dodec_phi', name: 'Golden Ratio Mod', min: 1.3, max: 1.9, step: 0.01, default: 1.618, uniform: 'u_dodec_phi', type: 'float' },
            { id: 'dodec_rot_x', name: 'Fold Rot X', min: -0.3, max: 0.3, step: 0.01, default: 0.05, uniform: 'u_dodec_rot_x', type: 'float' },
            { id: 'dodec_rot_y', name: 'Fold Rot Y', min: -0.3, max: 0.3, step: 0.01, default: 0.08, uniform: 'u_dodec_rot_y', type: 'float' },
            { id: 'dodec_iterations', name: 'Iterations', min: 4, max: 14, step: 1, default: 10, uniform: 'u_dodec_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Keplerian Sacred Stellation',
                values: { dodec_scale: 2.15, dodec_offset: 1.0, dodec_phi: 1.618, dodec_rot_x: 0.05, dodec_rot_y: 0.08, dodec_iterations: 10 }
            },
            {
                name: 'Golden Ratio Origami Pavilion',
                values: { dodec_scale: 1.95, dodec_offset: 0.85, dodec_phi: 1.62, dodec_rot_x: 0.0, dodec_rot_y: 0.14, dodec_iterations: 11 }
            },
            {
                name: 'Icosahedral Crystal Lotus',
                values: { dodec_scale: 2.35, dodec_offset: 1.15, dodec_phi: 1.58, dodec_rot_x: -0.08, dodec_rot_y: -0.06, dodec_iterations: 9 }
            },
            {
                name: 'Celestial Dodeca Sanctuary',
                values: { dodec_scale: 2.5, dodec_offset: 1.3, dodec_phi: 1.68, dodec_rot_x: 0.12, dodec_rot_y: 0.0, dodec_iterations: 11 }
            }
        ],
        glsl: `
// Dodecahedron / Icosahedron Golden Ratio IFS DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float scale = u_dodec_scale;
    vec4 orbit = vec4(100.0);
    float dr = 1.0;
    int maxIt = int(u_dodec_iterations);
    
    float phi = u_dodec_phi;
    vec3 n1 = normalize(vec3(1.0, 0.0, phi));
    vec3 n2 = normalize(vec3(0.0, phi, 1.0));
    vec3 n3 = normalize(vec3(phi, 1.0, 0.0));
    
    mat3 rot = rotX(u_dodec_rot_x) * rotY(u_dodec_rot_y);
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;
        p = rot * p;
        p = abs(p);
        
        float d1 = dot(p, n1);
        if (d1 < 0.0) p -= 2.0 * d1 * n1;
        
        float d2 = dot(p, n2);
        if (d2 < 0.0) p -= 2.0 * d2 * n2;
        
        float d3 = dot(p, n3);
        if (d3 < 0.0) p -= 2.0 * d3 * n3;
        
        p = p * scale - vec3(u_dodec_offset) * (scale - 1.0);
        dr = dr * scale;
        
        orbit.x = min(orbit.x, length(p));
        orbit.y = min(orbit.y, abs(p.x) + abs(p.y));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);
    }
    
    trap = orbit;
    return 0.7 * (length(p) - 1.0) / max(1e-4, dr);
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2];
            const scale = state.dodec_scale ?? 2.15;
            const off = state.dodec_offset ?? 1.0;
            const phi = state.dodec_phi ?? 1.618;
            const l = Math.hypot(1.0, phi);
            const n1 = [1.0 / l, 0.0, phi / l];
            const n2 = [0.0, phi / l, 1.0 / l];
            const n3 = [phi / l, 1.0 / l, 0.0];
            const maxIt = Math.min(10, state.dodec_iterations ?? 10);
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                zx = Math.abs(zx); zy = Math.abs(zy); zz = Math.abs(zz);
                const d1 = zx * n1[0] + zy * n1[1] + zz * n1[2];
                if (d1 < 0.0) { zx -= 2.0 * d1 * n1[0]; zy -= 2.0 * d1 * n1[1]; zz -= 2.0 * d1 * n1[2]; }
                const d2 = zx * n2[0] + zy * n2[1] + zz * n2[2];
                if (d2 < 0.0) { zx -= 2.0 * d2 * n2[0]; zy -= 2.0 * d2 * n2[1]; zz -= 2.0 * d2 * n2[2]; }
                const d3 = zx * n3[0] + zy * n3[1] + zz * n3[2];
                if (d3 < 0.0) { zx -= 2.0 * d3 * n3[0]; zy -= 2.0 * d3 * n3[1]; zz -= 2.0 * d3 * n3[2]; }

                zx = zx * scale - off * (scale - 1.0);
                zy = zy * scale - off * (scale - 1.0);
                zz = zz * scale - off * (scale - 1.0);
                dr = dr * scale;
            }
            const len = Math.hypot(zx, zy, zz);
            return 0.7 * (len - 1.0) / Math.max(1e-4, dr);
        }
    },

    [FORMULA_IDS.BURNING_SHIP]: {
        id: FORMULA_IDS.BURNING_SHIP,
        name: '3D Burning Ship',
        subtitle: 'Volcanic Absolute Value Spires',
        defaultCam: {
            pos: [0.0, 0.25, 1.65],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'bs_power', name: 'Power', min: 2.0, max: 7.0, step: 0.05, default: 3.0, uniform: 'u_bs_power', type: 'float' },
            { id: 'bs_iterations', name: 'Iterations', min: 4, max: 20, step: 1, default: 12, uniform: 'u_bs_iterations', type: 'int' },
            { id: 'bs_asym', name: 'Asymmetry Shift', min: -0.4, max: 0.4, step: 0.01, default: 0.0, uniform: 'u_bs_asym', type: 'float' }
        ],
        presets: [
            {
                name: 'Ghost Ship Masts (Power 3)',
                values: { bs_power: 3.0, bs_iterations: 13, bs_asym: 0.0 }
            },
            {
                name: 'Obsidian Dragon Spire (Power 2)',
                values: { bs_power: 2.0, bs_iterations: 12, bs_asym: 0.05 }
            },
            {
                name: 'Volcanic Buffalo Fortress (Power 4)',
                values: { bs_power: 4.0, bs_iterations: 14, bs_asym: -0.08 }
            },
            {
                name: 'Gothic Needle Fleet (Power 5)',
                values: { bs_power: 5.0, bs_iterations: 15, bs_asym: 0.0 }
            }
        ],
        glsl: `
// 3D Burning Ship / Buffalo DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 w = pos;
    vec3 c = pos + vec3(u_bs_asym, 0.0, 0.0);
    float power = u_bs_power;
    int maxIt = int(u_bs_iterations);
    float dz = 1.0;
    vec4 orbit = vec4(100.0);
    float m = dot(w, w);
    
    for (int i = 0; i < 24; i++) {
        if (i >= maxIt) break;
        
        // Canonical Burning Ship absolute fold
        w = abs(w);
        w.y = -w.y;
        
        float r = sqrt(m);
        dz = power * pow(r, power - 1.0) * dz + 1.0;
        
        float theta = acos(clamp(w.z / max(1e-5, r), -1.0, 1.0)) * power;
        float phi = atan(w.y, w.x) * power;
        
        float zr = pow(r, power);
        w = c + zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(w.x * w.y));
        orbit.z = min(orbit.z, abs(w.z));
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
            const power = state.bs_power ?? 3.0;
            const maxIt = Math.min(14, state.bs_iterations ?? 12);
            let x = p[0], y = p[1], z = p[2];
            const cx = x + (state.bs_asym ?? 0.0), cy = y, cz = z;
            let dz = 1.0;
            let m = x * x + y * y + z * z;

            for (let i = 0; i < maxIt; i++) {
                x = Math.abs(x); y = -Math.abs(y); z = Math.abs(z);
                const r = Math.sqrt(m);
                dz = power * Math.pow(r, power - 1.0) * dz + 1.0;
                let theta = Math.acos(Math.max(-1.0, Math.min(1.0, z / Math.max(1e-5, r)))) * power;
                let phi = Math.atan2(y, x) * power;
                const zr = Math.pow(r, power);
                x = cx + zr * Math.sin(theta) * Math.cos(phi);
                y = cy + zr * Math.sin(theta) * Math.sin(phi);
                z = cz + zr * Math.cos(theta);
                m = x * x + y * y + z * z;
                if (m > 8.0) break;
            }
            if (m < 1.0) return 0.0;
            return 0.25 * Math.log(m) * Math.sqrt(m) / Math.max(1e-4, dz);
        }
    },

    [FORMULA_IDS.TRIG_SINE]: {
        id: FORMULA_IDS.TRIG_SINE,
        name: 'Complex Sine Silk',
        subtitle: 'Hyperbolic Trigonometric Drapery & Curtains',
        defaultCam: {
            pos: [0.0, 0.0, 1.5],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'trig_scale', name: 'Spatial Frequency', min: 0.5, max: 2.5, step: 0.02, default: 1.15, uniform: 'u_trig_scale', type: 'float' },
            { id: 'trig_amplitude', name: 'Harmonic Amp', min: 0.4, max: 2.0, step: 0.02, default: 0.95, uniform: 'u_trig_amplitude', type: 'float' },
            { id: 'trig_cx', name: 'Vector C.X', min: -1.0, max: 1.0, step: 0.02, default: 0.15, uniform: 'u_trig_cx', type: 'float' },
            { id: 'trig_cy', name: 'Vector C.Y', min: -1.0, max: 1.0, step: 0.02, default: -0.20, uniform: 'u_trig_cy', type: 'float' },
            { id: 'trig_cz', name: 'Vector C.Z', min: -1.0, max: 1.0, step: 0.02, default: 0.25, uniform: 'u_trig_cz', type: 'float' },
            { id: 'trig_iterations', name: 'Iterations', min: 4, max: 14, step: 1, default: 9, uniform: 'u_trig_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Liquid Silk Drapery',
                values: { trig_scale: 1.15, trig_amplitude: 0.95, trig_cx: 0.15, trig_cy: -0.20, trig_cz: 0.25, trig_iterations: 9 }
            },
            {
                name: 'Oceanic Tsunami Ribbon',
                values: { trig_scale: 1.45, trig_amplitude: 1.10, trig_cx: -0.30, trig_cy: 0.10, trig_cz: 0.35, trig_iterations: 10 }
            },
            {
                name: 'Hyperbolic Mineral Vein',
                values: { trig_scale: 0.85, trig_amplitude: 0.80, trig_cx: 0.25, trig_cy: -0.35, trig_cz: 0.12, trig_iterations: 8 }
            },
            {
                name: 'Aeolian Canyon Ripples',
                values: { trig_scale: 1.70, trig_amplitude: 1.25, trig_cx: 0.0, trig_cy: 0.25, trig_cz: -0.20, trig_iterations: 11 }
            }
        ],
        glsl: `
// 3D Hyperbolic Sine Silk DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 z = pos * u_trig_scale;
    vec3 c = vec3(u_trig_cx, u_trig_cy, u_trig_cz);
    float dz = 1.0;
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_trig_iterations);
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;
        
        vec3 nZ = vec3(
            sin(z.x) * cosh(clamp(z.y, -3.0, 3.0)),
            cos(z.x) * sinh(clamp(z.y, -3.0, 3.0)),
            sin(z.z) * cosh(clamp(z.x, -3.0, 3.0))
        );
        
        float lenNZ = length(nZ);
        dz = max(1.0, lenNZ) * dz * 1.25;
        z = nZ * u_trig_amplitude + c;
        
        orbit.x = min(orbit.x, length(z));
        orbit.y = min(orbit.y, abs(sin(z.x * 2.0)));
        orbit.z = min(orbit.z, abs(z.z));
        orbit.w = float(i);
        
        if (dot(z, z) > 30.0) break;
    }
    
    trap = orbit;
    return 0.35 * log(length(z) + 1.0) / max(1e-4, dz);
}
`,
        cpuEvalDE: (p, state) => {
            const scale = state.trig_scale ?? 1.15;
            let zx = p[0] * scale, zy = p[1] * scale, zz = p[2] * scale;
            const cx = state.trig_cx ?? 0.15, cy = state.trig_cy ?? -0.2, cz = state.trig_cz ?? 0.25;
            const amp = state.trig_amplitude ?? 0.95;
            const maxIt = Math.min(10, state.trig_iterations ?? 9);
            let dz = 1.0;

            for (let i = 0; i < maxIt; i++) {
                const cy_c = Math.max(-3.0, Math.min(3.0, zy));
                const cx_c = Math.max(-3.0, Math.min(3.0, zx));
                const nx = Math.sin(zx) * Math.cosh(cy_c);
                const ny = Math.cos(zx) * Math.sinh(cy_c);
                const nz = Math.sin(zz) * Math.cosh(cx_c);
                const lenNZ = Math.hypot(nx, ny, nz);
                dz = Math.max(1.0, lenNZ) * dz * 1.25;
                zx = nx * amp + cx; zy = ny * amp + cy; zz = nz * amp + cz;
                if (zx * zx + zy * zy + zz * zz > 30.0) break;
            }
            const len = Math.hypot(zx, zy, zz);
            return 0.35 * Math.log(len + 1.0) / Math.max(1e-4, dz);
        }
    },

    [FORMULA_IDS.JERUSALEM]: {
        id: FORMULA_IDS.JERUSALEM,
        name: 'Jerusalem Cube',
        subtitle: 'Sub-Atomic Borg Megastructure & Cross Cuts',
        defaultCam: {
            pos: [0.0, 0.0, 1.6],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'jerus_scale', name: 'Scale Factor', min: 2.5, max: 3.8, step: 0.02, default: 3.2, uniform: 'u_jerus_scale', type: 'float' },
            { id: 'jerus_cut', name: 'Cross Cut Width', min: 0.4, max: 1.4, step: 0.02, default: 0.85, uniform: 'u_jerus_cut', type: 'float' },
            { id: 'jerus_offset', name: 'Offset', min: 0.5, max: 1.5, step: 0.02, default: 1.0, uniform: 'u_jerus_offset', type: 'float' },
            { id: 'jerus_rot_x', name: 'Fold Rot X', min: -0.2, max: 0.2, step: 0.01, default: 0.0, uniform: 'u_jerus_rot_x', type: 'float' },
            { id: 'jerus_rot_y', name: 'Fold Rot Y', min: -0.2, max: 0.2, step: 0.01, default: 0.0, uniform: 'u_jerus_rot_y', type: 'float' },
            { id: 'jerus_iterations', name: 'Iterations', min: 4, max: 12, step: 1, default: 8, uniform: 'u_jerus_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Borg Spaceport Core',
                values: { jerus_scale: 3.2, jerus_cut: 0.85, jerus_offset: 1.0, jerus_rot_x: 0.0, jerus_rot_y: 0.0, jerus_iterations: 8 }
            },
            {
                name: 'Quantum Processor Lattice',
                values: { jerus_scale: 2.9, jerus_cut: 0.65, jerus_offset: 0.9, jerus_rot_x: 0.04, jerus_rot_y: 0.06, jerus_iterations: 9 }
            },
            {
                name: 'Gothic Microchip Megastructure',
                values: { jerus_scale: 3.45, jerus_cut: 1.05, jerus_offset: 1.15, jerus_rot_x: -0.05, jerus_rot_y: 0.03, jerus_iterations: 8 }
            },
            {
                name: 'Infinite Sub-Atomic Bastion',
                values: { jerus_scale: 3.65, jerus_cut: 1.25, jerus_offset: 1.2, jerus_rot_x: 0.08, jerus_rot_y: -0.08, jerus_iterations: 10 }
            }
        ],
        glsl: `
// Jerusalem Cube / Cross Menger DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float scale = u_jerus_scale;
    vec4 orbit = vec4(100.0);
    float dr = 1.0;
    int maxIt = int(u_jerus_iterations);
    float cut = u_jerus_cut;
    mat3 rot = rotX(u_jerus_rot_x) * rotY(u_jerus_rot_y);
    
    for (int i = 0; i < 14; i++) {
        if (i >= maxIt) break;
        p = rot * p;
        p = abs(p);
        
        if (p.x < p.y) p.xy = p.yx;
        if (p.x < p.z) p.xz = p.zx;
        if (p.y < p.z) p.yz = p.zy;
        
        p.x -= cut;
        p.y -= cut;
        
        p = p * scale - vec3(u_jerus_offset) * (scale - 1.0);
        dr = dr * scale;
        
        orbit.x = min(orbit.x, length(p));
        orbit.y = min(orbit.y, max(p.x, max(p.y, p.z)));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);
        
        if (length(p) > 200.0) break;
    }
    
    trap = orbit;
    vec3 d = abs(p) - vec3(1.0);
    float boxDist = min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
    return 0.65 * boxDist / max(1e-4, dr);
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2];
            const scale = state.jerus_scale ?? 3.2;
            const cut = state.jerus_cut ?? 0.85;
            const off = state.jerus_offset ?? 1.0;
            const maxIt = Math.min(8, state.jerus_iterations ?? 8);
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                zx = Math.abs(zx); zy = Math.abs(zy); zz = Math.abs(zz);
                if (zx < zy) { const t = zx; zx = zy; zy = t; }
                if (zx < zz) { const t = zx; zx = zz; zz = t; }
                if (zy < zz) { const t = zy; zy = zz; zz = t; }

                zx -= cut; zy -= cut;
                zx = zx * scale - off * (scale - 1.0);
                zy = zy * scale - off * (scale - 1.0);
                zz = zz * scale - off * (scale - 1.0);
                dr = dr * scale;
                if (zx * zx + zy * zy + zz * zz > 40000.0) break;
            }
            const dx = Math.max(0.0, Math.abs(zx) - 1.0);
            const dy = Math.max(0.0, Math.abs(zy) - 1.0);
            const dz = Math.max(0.0, Math.abs(zz) - 1.0);
            const boxDist = Math.hypot(dx, dy, dz);
            return 0.65 * boxDist / Math.max(1e-4, dr);
        }
    },

    [FORMULA_IDS.QUAT_MANDELBROT]: {
        id: FORMULA_IDS.QUAT_MANDELBROT,
        name: '4D Quat Mandelbrot',
        subtitle: 'Hypercomplex 4D Mandelbrot Escape-Time Set',
        defaultCam: {
            pos: [0.0, 0.0, 1.55],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'qm_slice_w', name: '4D W-Slice', min: -1.0, max: 1.0, step: 0.02, default: 0.0, uniform: 'u_qm_slice_w', type: 'float' },
            { id: 'qm_rot_xw', name: '4D Rot X-W', min: -3.14, max: 3.14, step: 0.02, default: 0.0, uniform: 'u_qm_rot_xw', type: 'float' },
            { id: 'qm_rot_yw', name: '4D Rot Y-W', min: -3.14, max: 3.14, step: 0.02, default: 0.0, uniform: 'u_qm_rot_yw', type: 'float' },
            { id: 'qm_iterations', name: 'Iterations', min: 6, max: 24, step: 1, default: 13, uniform: 'u_qm_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Classic 4D Cardioid Core',
                values: { qm_slice_w: 0.0, qm_rot_xw: 0.0, qm_rot_yw: 0.0, qm_iterations: 13 }
            },
            {
                name: 'Satellite Needle Spire',
                values: { qm_slice_w: 0.22, qm_rot_xw: 0.45, qm_rot_yw: -0.30, qm_iterations: 14 }
            },
            {
                name: 'Hyper-Seahorse Valley',
                values: { qm_slice_w: -0.15, qm_rot_xw: -0.65, qm_rot_yw: 0.50, qm_iterations: 15 }
            },
            {
                name: 'Antennae Starburst',
                values: { qm_slice_w: 0.38, qm_rot_xw: 0.85, qm_rot_yw: 0.60, qm_iterations: 16 }
            }
        ],
        glsl: `
// 4D Quaternion Mandelbrot Set DE (Hubbard-Douady analytic distance estimator)
float mapFractal(vec3 pos, out vec4 trap) {
    vec4 c = vec4(pos, u_qm_slice_w);
    
    // 4D Hyperplane Rotations
    float cosXW = cos(u_qm_rot_xw); float sinXW = sin(u_qm_rot_xw);
    float cosYW = cos(u_qm_rot_yw); float sinYW = sin(u_qm_rot_yw);
    vec2 xw = mat2(cosXW, -sinXW, sinXW, cosXW) * vec2(c.x, c.w);
    c.x = xw.x; c.w = xw.y;
    vec2 yw = mat2(cosYW, -sinYW, sinYW, cosYW) * vec2(c.y, c.w);
    c.y = yw.x; c.w = yw.y;
    
    vec4 z = c;
    float md2 = 1.0;
    float mz2 = dot(z, z);
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_qm_iterations);
    
    for (int i = 0; i < 24; i++) {
        if (i >= maxIt) break;
        
        md2 = 4.0 * mz2 * md2 + 1.0;
        z = quatSq(z) + c;
        mz2 = dot(z, z);
        
        orbit.x = min(orbit.x, sqrt(mz2));
        orbit.y = min(orbit.y, abs(z.x * z.y));
        orbit.z = min(orbit.z, abs(z.z * z.w));
        orbit.w = float(i);
        
        if (mz2 > 16.0) break;
    }
    
    trap = orbit;
    if (mz2 < 1.0) return 0.0;
    return 0.35 * sqrt(mz2) * log(mz2) / max(1e-4, sqrt(md2));
}
`,
        cpuEvalDE: (p, state) => {
            let cx = p[0], cy = p[1], cz = p[2], cw = state.qm_slice_w ?? 0.0;
            const cosXW = Math.cos(state.qm_rot_xw ?? 0.0), sinXW = Math.sin(state.qm_rot_xw ?? 0.0);
            const cosYW = Math.cos(state.qm_rot_yw ?? 0.0), sinYW = Math.sin(state.qm_rot_yw ?? 0.0);
            const nxw0 = cosXW * cx - sinXW * cw, nxw1 = sinXW * cx + cosXW * cw;
            cx = nxw0; cw = nxw1;
            const nyw0 = cosYW * cy - sinYW * cw, nyw1 = sinYW * cy + cosYW * cw;
            cy = nyw0; cw = nyw1;

            let zx = cx, zy = cy, zz = cz, zw = cw;
            const maxIt = Math.min(14, state.qm_iterations ?? 13);
            let md2 = 1.0;
            let mz2 = zx * zx + zy * zy + zz * zz + zw * zw;

            for (let i = 0; i < maxIt; i++) {
                md2 = 4.0 * mz2 * md2 + 1.0;
                const nx = zx * zx - (zy * zy + zz * zz + zw * zw) + cx;
                const ny = 2.0 * zx * zy + cy;
                const nz = 2.0 * zx * zz + cz;
                const nw = 2.0 * zx * zw + cw;
                zx = nx; zy = ny; zz = nz; zw = nw;
                mz2 = zx * zx + zy * zy + zz * zz + zw * zw;
                if (mz2 > 16.0) break;
            }
            if (mz2 < 1.0) return 0.0;
            return 0.35 * Math.sqrt(mz2) * Math.log(mz2) / Math.max(1e-4, Math.sqrt(md2));
        }
    }
};
