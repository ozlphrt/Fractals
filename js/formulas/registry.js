// js/formulas/registry.js
// Definitions for the 5 dedicated fractal engines:
// GLSL Distance Estimator snippet + Uniform definitions + CPU DE Mirror (for lag-free camera flight proximity) + Presets

export const FORMULA_IDS = {
    QUAT_JULIA: 'quat_julia',
    MANDELBULB: 'mandelbulb',
    MANDELBOX: 'mandelbox',
    KIFS: 'kifs',
    APOLLONIAN: 'apollonian',
    BURNING_SHIP: 'burning_ship',
    JERUSALEM: 'jerusalem',
    JULIABULB: 'juliabulb',
    KALISET: 'kalibox',
    PSEUDO_KLEINIAN: 'pseudo_kleinian',
    BOX_BULB: 'box_bulb'
};

export const FORMULAS = {
    [FORMULA_IDS.MANDELBULB]: {
        id: FORMULA_IDS.MANDELBULB,
        name: 'Mandelbulb',
        subtitle: 'Spherical 3D Power Fold',
        defaultCam: {
            pos: [0.0, 0.0, 2.35],
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
            if (m <= 8.0) return 0.0;
            return 0.25 * Math.log(m) * Math.sqrt(m) / Math.max(1e-4, dz);
        }
    },

    [FORMULA_IDS.MANDELBOX]: {
        id: FORMULA_IDS.MANDELBOX,
        name: 'Mandelbox',
        subtitle: 'Brutalist Box & Sphere Inversion Fold',
        defaultCam: {
            pos: [1.8, 1.4, 2.2],
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
            { id: 'mbox_near_clip', name: 'Camera Clearance', min: 0.01, max: 1.0, step: 0.01, default: 0.05, uniform: 'u_mbox_near_clip', type: 'float' }
        ],
        presets: [
            {
                name: 'Metropolis Citadel',
                values: { mbox_scale: 2.25, mbox_iterations: 10, mbox_fold_limit: 1.0, mbox_min_radius: 0.5, mbox_fixed_radius: 1.0, mbox_rot_x: 0.0, mbox_rot_y: 0.0, mbox_rot_z: 0.0, mbox_offset_x: 0.0, mbox_offset_y: 0.0, mbox_offset_z: 0.0, mbox_near_clip: 0.05 }
            },
            {
                name: 'Brutalist Flying Buttresses',
                values: { mbox_scale: 2.75, mbox_iterations: 11, mbox_fold_limit: 1.22, mbox_min_radius: 0.42, mbox_fixed_radius: 1.35, mbox_rot_x: 0.04, mbox_rot_y: 0.08, mbox_rot_z: 0.0, mbox_offset_x: -0.15, mbox_offset_y: 0.0, mbox_offset_z: 0.12, mbox_near_clip: 0.05 }
            },
            {
                name: 'Sub-Zero Crystalline Lattice',
                values: { mbox_scale: -1.85, mbox_iterations: 10, mbox_fold_limit: 0.82, mbox_min_radius: 0.36, mbox_fixed_radius: 1.18, mbox_rot_x: 0.07, mbox_rot_y: -0.06, mbox_rot_z: 0.05, mbox_offset_x: 0.12, mbox_offset_y: -0.08, mbox_offset_z: 0.14, mbox_near_clip: 0.05 }
            },
            {
                name: 'Monolithic Hyper-Sanctuary',
                values: { mbox_scale: 2.05, mbox_iterations: 9, mbox_fold_limit: 1.15, mbox_min_radius: 0.58, mbox_fixed_radius: 1.05, mbox_rot_x: -0.05, mbox_rot_y: 0.06, mbox_rot_z: -0.04, mbox_offset_x: 0.05, mbox_offset_y: 0.1, mbox_offset_z: -0.05, mbox_near_clip: 0.05 }
            }
        ],
        glsl: `
// Canonical Robust Mandelbox DE (Normalized to unified scale, fits within radius 2.0)
float mapFractal(vec3 pos, out vec4 trap) {
    const float MBOX_WORLD_SCALE = 5.0;
    vec3 p = pos * MBOX_WORLD_SCALE;
    vec3 offset = p + vec3(u_mbox_offset_x, u_mbox_offset_y, u_mbox_offset_z);
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
        if (r > 600.0) break;
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(z.x * z.y));
        orbit.z = min(orbit.z, abs(z.z));
        orbit.w = float(n);
    }
    
    trap = orbit;
    float r = length(z);
    return (0.65 * r / max(1e-4, abs(dr))) / MBOX_WORLD_SCALE;
}
`,
        cpuEvalDE: (p, state) => {
            const MBOX_WORLD_SCALE = 5.0;
            const scale = state.mbox_scale ?? 2.3;
            const foldLimit = state.mbox_foldLimit ?? state.mbox_fold_limit ?? 1.0;
            const minR = state.mbox_min_radius ?? 0.5;
            const fixR = state.mbox_fixed_radius ?? 1.0;
            const minR2 = minR * minR;
            const fixR2 = fixR * fixR;
            const maxIt = Math.min(14, state.mbox_iterations ?? 11);

            const rx = state.mbox_rot_x ?? 0.0;
            const ry = state.mbox_rot_y ?? 0.0;
            const rz = state.mbox_rot_z ?? 0.0;
            const cx = Math.cos(rx), sx = Math.sin(rx);
            const cy = Math.cos(ry), sy = Math.sin(ry);
            const cz = Math.cos(rz), sz = Math.sin(rz);

            let zx = p[0] * MBOX_WORLD_SCALE + (state.mbox_offset_x ?? 0);
            let zy = p[1] * MBOX_WORLD_SCALE + (state.mbox_offset_y ?? 0);
            let zz = p[2] * MBOX_WORLD_SCALE + (state.mbox_offset_z ?? 0);
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

                // Rotations matching GLSL rotX * rotY * rotZ
                if (Math.abs(rx) > 1e-5 || Math.abs(ry) > 1e-5 || Math.abs(rz) > 1e-5) {
                    const y1 = cx * zy - sx * zz;
                    const z1 = sx * zy + cx * zz;
                    const x2 = cy * zx + sy * z1;
                    const z2 = -sy * zx + cy * z1;
                    zx = cz * x2 - sz * y1;
                    zy = sz * x2 + cz * y1;
                    zz = z2;
                }

                zx = scale * zx + ox;
                zy = scale * zy + oy;
                zz = scale * zz + oz;
                dr = dr * Math.abs(scale) + 1.0;
                const r = Math.sqrt(zx * zx + zy * zy + zz * zz);
                if (r > 500.0) break;
            }
            const r = Math.sqrt(zx * zx + zy * zy + zz * zz);
            return (0.65 * r / Math.max(1e-4, Math.abs(dr))) / MBOX_WORLD_SCALE;
        }
    },

    [FORMULA_IDS.KIFS]: {
        id: FORMULA_IDS.KIFS,
        name: 'Kaleidoscopic IFS',
        subtitle: 'Polyhedral Reflection & Fractal Origami',
        defaultCam: {
            pos: [1.8, 1.5, 2.2],
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
            pos: [1.3, 0.9, 1.8],
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
                values: { qj_cx: -0.22, qj_cy: 0.55, qj_cz: 0.42, qj_cw: 0.15, qj_slice_w: 0.18, qj_rot_xw: 0.48, qj_rot_yw: -0.38, qj_iterations: 11 }
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
        
        orbit.x = min(orbit.x, mz2);
        orbit.y = min(orbit.y, abs(z.y * z.z));
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
            pos: [1.7, 1.2, 2.6],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'apol_scale', name: 'Inversion Scale', min: 0.8, max: 1.8, step: 0.02, default: 1.18, uniform: 'u_apol_scale', type: 'float' },
            { id: 'apol_core', name: 'Core Voids', min: 0.01, max: 0.6, step: 0.01, default: 0.22, uniform: 'u_apol_core', type: 'float' },
            { id: 'apol_radius', name: 'Sculptural Bound', min: 1.0, max: 2.5, step: 0.02, default: 1.55, uniform: 'u_apol_radius', type: 'float' },
            { id: 'apol_rot_x', name: 'Fold Rot X', min: -0.3, max: 0.3, step: 0.01, default: 0.04, uniform: 'u_apol_rot_x', type: 'float' },
            { id: 'apol_rot_y', name: 'Fold Rot Y', min: -0.3, max: 0.3, step: 0.01, default: 0.08, uniform: 'u_apol_rot_y', type: 'float' },
            { id: 'apol_iterations', name: 'Iterations', min: 4, max: 12, step: 1, default: 8, uniform: 'u_apol_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Celestial Geodesic Geode',
                values: { apol_scale: 1.18, apol_core: 0.22, apol_radius: 1.55, apol_rot_x: 0.04, apol_rot_y: 0.08, apol_iterations: 8 }
            },
            {
                name: 'Hollow Pearl Lattice',
                values: { apol_scale: 1.35, apol_core: 0.32, apol_radius: 1.65, apol_rot_x: -0.06, apol_rot_y: 0.12, apol_iterations: 9 }
            },
            {
                name: 'Nested Bubble Relic',
                values: { apol_scale: 1.05, apol_core: 0.15, apol_radius: 1.45, apol_rot_x: 0.0, apol_rot_y: 0.15, apol_iterations: 8 }
            },
            {
                name: 'Crystalline Foam Pavilion',
                values: { apol_scale: 1.45, apol_core: 0.40, apol_radius: 1.75, apol_rot_x: 0.10, apol_rot_y: -0.08, apol_iterations: 9 }
            }
        ],
        glsl: `
// Sculptural Bounded Apollonian Sphere Packing DE
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    vec4 orbit = vec4(100.0);
    float scale = 1.0;
    int maxIt = int(u_apol_iterations);
    float invScale = u_apol_scale * u_apol_scale;
    mat3 rot = rotX(u_apol_rot_x) * rotY(u_apol_rot_y);
    
    for (int i = 0; i < 14; i++) {
        if (i >= maxIt) break;
        p = rot * p;
        p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
        
        float r2 = dot(p, p);
        orbit.x = min(orbit.x, sqrt(r2));
        orbit.y = min(orbit.y, abs(p.x * p.y));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);
        
        float k = invScale / max(1e-3, r2);
        p *= k;
        scale *= k;
    }
    
    trap = orbit;
    float dFractal = 0.35 * (length(p) - u_apol_core) / max(1e-4, scale);
    float dBound = length(pos) - u_apol_radius;
    return max(dFractal, dBound);
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2];
            const invScale = (state.apol_scale ?? 1.18) ** 2;
            const core = state.apol_core ?? 0.22;
            const radius = state.apol_radius ?? 1.55;
            const maxIt = Math.min(8, state.apol_iterations ?? 8);
            let scale = 1.0;

            for (let i = 0; i < maxIt; i++) {
                zx = -1.0 + 2.0 * (((0.5 * zx + 0.5) % 1.0 + 1.0) % 1.0);
                zy = -1.0 + 2.0 * (((0.5 * zy + 0.5) % 1.0 + 1.0) % 1.0);
                zz = -1.0 + 2.0 * (((0.5 * zz + 0.5) % 1.0 + 1.0) % 1.0);

                const r2 = zx * zx + zy * zy + zz * zz;
                const k = invScale / Math.max(1e-3, r2);
                zx *= k; zy *= k; zz *= k;
                scale *= k;
            }
            const dFractal = 0.35 * (Math.hypot(zx, zy, zz) - core) / Math.max(1e-4, scale);
            const dBound = Math.hypot(p[0], p[1], p[2]) - radius;
            return Math.max(dFractal, dBound);
        }
    },

    [FORMULA_IDS.BURNING_SHIP]: {
        id: FORMULA_IDS.BURNING_SHIP,
        name: '3D Burning Ship',
        subtitle: 'Volcanic Absolute Value Spires',
        defaultCam: {
            pos: [0.0, 0.8, 2.7],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'bs_power', name: 'Power', min: 3.0, max: 15.0, step: 0.1, default: 3.0, uniform: 'u_bs_power', type: 'float' },
            { id: 'bs_iterations', name: 'Iterations', min: 4, max: 24, step: 1, default: 12, uniform: 'u_bs_iterations', type: 'int' },
            { id: 'bs_asym', name: 'Asymmetry Shift', min: 0.0, max: 5.0, step: 0.02, default: 0.0, uniform: 'u_bs_asym', type: 'float' }
        ],
        presets: [
            {
                name: 'Ghost Ship Masts (Power 3)',
                values: { bs_power: 3.0, bs_iterations: 13, bs_asym: 0.0 }
            },
            {
                name: 'Obsidian Citadel (Power 6)',
                values: { bs_power: 6.0, bs_iterations: 12, bs_asym: 0.25 }
            },
            {
                name: 'Volcanic Buffalo Spire (Power 9)',
                values: { bs_power: 9.0, bs_iterations: 14, bs_asym: 0.8 }
            },
            {
                name: 'Gothic Needle Fleet (Power 14)',
                values: { bs_power: 14.0, bs_iterations: 15, bs_asym: 1.5 }
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
    
    for (int i = 0; i < 20; i++) {
        if (i >= maxIt) break;
        
        // Canonical Burning Ship absolute fold
        w = abs(w);
        w.y = -w.y;
        
        float r = sqrt(m);
        dz = power * pow(max(1e-4, r), clamp(power - 1.0, 0.0, 14.0)) * dz + 1.0;
        dz = min(1e8, dz);
        
        float theta = acos(clamp(w.z / max(1e-5, r), -1.0, 1.0)) * power;
        float phi = atan(w.y, w.x) * power;
        
        float zr = pow(max(1e-4, r), power);
        w = c + zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        
        orbit.x = min(orbit.x, r);
        orbit.y = min(orbit.y, abs(w.x * w.y));
        orbit.z = min(orbit.z, abs(w.z));
        
        m = dot(w, w);
        if (m > 8.0) break;
    }
    
    trap = orbit;
    float r = sqrt(max(1e-5, m));
    return 0.5 * log(max(1.0, r)) * r / max(1e-4, dz);
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
            if (m <= 8.0) return 0.0;
            return 0.25 * Math.log(m) * Math.sqrt(m) / Math.max(1e-4, dz);
        }
    },

    [FORMULA_IDS.JERUSALEM]: {
        id: FORMULA_IDS.JERUSALEM,
        name: 'Jerusalem Cube',
        subtitle: 'Sub-Atomic Borg Megastructure & Cross Cuts',
        defaultCam: {
            pos: [1.8, 1.4, 2.3],
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

    [FORMULA_IDS.JULIABULB]: {
        id: FORMULA_IDS.JULIABULB,
        name: 'Juliabulb',
        subtitle: 'Hyper-Organic Complex Spherical Coral',
        defaultCam: {
            pos: [1.2, 0.8, 2.0],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'jb_power', name: 'Power', min: 2.0, max: 10.0, step: 0.05, default: 6.0, uniform: 'u_jb_power', type: 'float' },
            { id: 'jb_cx', name: 'Julia C.X', min: -1.2, max: 1.2, step: 0.01, default: -0.45, uniform: 'u_jb_cx', type: 'float' },
            { id: 'jb_cy', name: 'Julia C.Y', min: -1.2, max: 1.2, step: 0.01, default: 0.35, uniform: 'u_jb_cy', type: 'float' },
            { id: 'jb_cz', name: 'Julia C.Z', min: -1.2, max: 1.2, step: 0.01, default: 0.25, uniform: 'u_jb_cz', type: 'float' },
            { id: 'jb_phase', name: 'Twist Phase', min: -3.14, max: 3.14, step: 0.02, default: 0.0, uniform: 'u_jb_phase', type: 'float' },
            { id: 'jb_iterations', name: 'Iterations', min: 4, max: 18, step: 1, default: 10, uniform: 'u_jb_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Tentacled Anemone',
                values: { jb_power: 6.0, jb_cx: -0.45, jb_cy: 0.35, jb_cz: 0.25, jb_phase: 0.0, jb_iterations: 10 }
            },
            {
                name: 'Glass Sea Urchin',
                values: { jb_power: 7.5, jb_cx: -0.32, jb_cy: 0.52, jb_cz: 0.12, jb_phase: 0.45, jb_iterations: 11 }
            },
            {
                name: 'Coral Bloom',
                values: { jb_power: 4.8, jb_cx: 0.25, jb_cy: -0.40, jb_cz: 0.38, jb_phase: -0.30, jb_iterations: 9 }
            },
            {
                name: 'Alien Seed Pod',
                values: { jb_power: 8.2, jb_cx: -0.55, jb_cy: 0.20, jb_cz: -0.25, jb_phase: 0.85, jb_iterations: 12 }
            }
        ],
        glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 z = pos;
    vec3 c = vec3(u_jb_cx, u_jb_cy, u_jb_cz);
    float dr = 1.0;
    float r = 0.0;
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_jb_iterations);

    for (int i = 0; i < 18; i++) {
        if (i >= maxIt) break;
        r = length(z);
        if (r > 4.0) break;

        float theta = acos(clamp(z.z / max(r, 1e-6), -1.0, 1.0)) * u_jb_power + u_jb_phase;
        float phi = atan(z.y, z.x) * u_jb_power;
        float zr = pow(r, u_jb_power);
        dr = pow(r, u_jb_power - 1.0) * u_jb_power * dr;

        float sinT = sin(theta);
        z = zr * vec3(sinT * cos(phi), sinT * sin(phi), cos(theta)) + c;

        orbit.x = min(orbit.x, r * r);
        orbit.y = min(orbit.y, abs(z.x * z.y));
        orbit.z = min(orbit.z, abs(z.z));
        orbit.w = float(i);
    }

    trap = orbit;
    return 0.5 * log(max(1.0001, r)) * r / max(dr, 1e-6);
}
`,
        cpuEvalDE: (p, state) => {
            let zx = p[0], zy = p[1], zz = p[2];
            const cx = state.jb_cx ?? -0.45;
            const cy = state.jb_cy ?? 0.35;
            const cz = state.jb_cz ?? 0.25;
            const power = state.jb_power ?? 6.0;
            const phase = state.jb_phase ?? 0.0;
            const maxIt = Math.min(10, state.jb_iterations ?? 10);
            let dr = 1.0;
            let r = 0.0;

            for (let i = 0; i < maxIt; i++) {
                r = Math.hypot(zx, zy, zz);
                if (r > 4.0) break;

                const theta = Math.acos(Math.max(-1.0, Math.min(1.0, zz / Math.max(r, 1e-6)))) * power + phase;
                const phi = Math.atan2(zy, zx) * power;
                const zr = Math.pow(r, power);
                dr = Math.pow(r, power - 1.0) * power * dr;

                const sinT = Math.sin(theta);
                zx = zr * sinT * Math.cos(phi) + cx;
                zy = zr * sinT * Math.sin(phi) + cy;
                zz = zr * Math.cos(theta) + cz;
            }
            if (r < 1.0) return 0.0;
            return 0.5 * Math.log(r) * r / Math.max(1e-4, dr);
        }
    },

    [FORMULA_IDS.KALISET]: {
        id: FORMULA_IDS.KALISET,
        name: 'Kaliset / Kalibox',
        subtitle: 'Inverted Bio-Mechanical Crystal Nebula',
        defaultCam: {
            pos: [1.6, 1.2, 2.4],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'kb_scale', name: 'Scale Factor', min: 1.2, max: 2.6, step: 0.02, default: 1.85, uniform: 'u_kb_scale', type: 'float' },
            { id: 'kb_cx', name: 'Shift C.X', min: -1.5, max: 0.5, step: 0.01, default: -0.75, uniform: 'u_kb_cx', type: 'float' },
            { id: 'kb_cy', name: 'Shift C.Y', min: -1.5, max: 0.5, step: 0.01, default: -0.55, uniform: 'u_kb_cy', type: 'float' },
            { id: 'kb_cz', name: 'Shift C.Z', min: -1.5, max: 0.5, step: 0.01, default: -0.95, uniform: 'u_kb_cz', type: 'float' },
            { id: 'kb_box_mix', name: 'Box Fold Mix', min: 0.0, max: 1.0, step: 0.02, default: 0.35, uniform: 'u_kb_box_mix', type: 'float' },
            { id: 'kb_rot', name: 'Planar Twist', min: -0.5, max: 0.5, step: 0.01, default: 0.08, uniform: 'u_kb_rot', type: 'float' },
            { id: 'kb_iterations', name: 'Iterations', min: 6, max: 16, step: 1, default: 11, uniform: 'u_kb_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Bio-Mech Hive',
                values: { kb_scale: 1.85, kb_cx: -0.75, kb_cy: -0.55, kb_cz: -0.95, kb_box_mix: 0.35, kb_rot: 0.08, kb_iterations: 11 }
            },
            {
                name: 'Nebula Crystal',
                values: { kb_scale: 2.10, kb_cx: -0.82, kb_cy: -0.48, kb_cz: -0.88, kb_box_mix: 0.15, kb_rot: -0.12, kb_iterations: 12 }
            },
            {
                name: 'Ancient Circuit Coral',
                values: { kb_scale: 1.68, kb_cx: -0.68, kb_cy: -0.62, kb_cz: -1.02, kb_box_mix: 0.55, kb_rot: 0.15, kb_iterations: 10 }
            },
            {
                name: 'Obsidian Reliquary',
                values: { kb_scale: 1.95, kb_cx: -0.70, kb_cy: -0.50, kb_cz: -0.90, kb_box_mix: 0.70, kb_rot: 0.0, kb_iterations: 11 }
            }
        ],
        glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    vec3 c = vec3(u_kb_cx, u_kb_cy, u_kb_cz);
    float dr = 1.0;
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_kb_iterations);
    float cosR = cos(u_kb_rot);
    float sinR = sin(u_kb_rot);
    mat2 rotMat = mat2(cosR, -sinR, sinR, cosR);

    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;
        if (u_kb_box_mix > 0.001) {
            vec3 bf = clamp(p, -1.0, 1.0) * 2.0 - p;
            p = mix(p, bf, u_kb_box_mix);
        }

        p = abs(p);
        float d2 = dot(p, p);
        if (d2 < 1e-4) d2 = 1e-4;

        dr = dr * (u_kb_scale / d2);
        p = (p / d2) * u_kb_scale + c;

        p.xy = rotMat * p.xy;

        orbit.x = min(orbit.x, d2);
        orbit.y = min(orbit.y, abs(p.x * p.y));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);

        if (dot(p, p) > 400.0) break;
    }

    trap = orbit;
    return 0.65 * (length(p) - 0.15) / max(dr, 1e-5);
}
`,
        cpuEvalDE: (p, state) => {
            let px = p[0], py = p[1], pz = p[2];
            const cx = state.kb_cx ?? -0.75;
            const cy = state.kb_cy ?? -0.55;
            const cz = state.kb_cz ?? -0.95;
            const scale = state.kb_scale ?? 1.85;
            const boxMix = state.kb_box_mix ?? 0.35;
            const rot = state.kb_rot ?? 0.08;
            const cosR = Math.cos(rot), sinR = Math.sin(rot);
            const maxIt = Math.min(10, state.kb_iterations ?? 11);
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                if (boxMix > 0.001) {
                    const bfx = Math.max(-1.0, Math.min(1.0, px)) * 2.0 - px;
                    const bfy = Math.max(-1.0, Math.min(1.0, py)) * 2.0 - py;
                    const bfz = Math.max(-1.0, Math.min(1.0, pz)) * 2.0 - pz;
                    px = px + (bfx - px) * boxMix;
                    py = py + (bfy - py) * boxMix;
                    pz = pz + (bfz - pz) * boxMix;
                }

                px = Math.abs(px); py = Math.abs(py); pz = Math.abs(pz);
                let d2 = px * px + py * py + pz * pz;
                if (d2 < 1e-4) d2 = 1e-4;

                dr = dr * (scale / d2);
                px = (px / d2) * scale + cx;
                py = (py / d2) * scale + cy;
                pz = (pz / d2) * scale + cz;

                const rx = cosR * px - sinR * py;
                const ry = sinR * px + cosR * py;
                px = rx; py = ry;

                if (px * px + py * py + pz * pz > 400.0) break;
            }
            const lenP = Math.hypot(px, py, pz);
            return 0.65 * Math.max(0.0, lenP - 0.15) / Math.max(1e-5, dr);
        }
    },

    [FORMULA_IDS.PSEUDO_KLEINIAN]: {
        id: FORMULA_IDS.PSEUDO_KLEINIAN,
        name: 'Pseudo-Kleinian',
        subtitle: 'Infinite Gothic Nave & Monolithic Colonnade Relic',
        defaultCam: {
            pos: [0.0, 0.45, 2.6],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'pk_csize_x', name: 'Box Size X', min: 0.6, max: 1.4, step: 0.02, default: 0.92, uniform: 'u_pk_csize_x', type: 'float' },
            { id: 'pk_csize_y', name: 'Box Size Y', min: 0.6, max: 1.4, step: 0.02, default: 0.92, uniform: 'u_pk_csize_y', type: 'float' },
            { id: 'pk_csize_z', name: 'Box Size Z', min: 0.6, max: 1.4, step: 0.02, default: 1.0, uniform: 'u_pk_csize_z', type: 'float' },
            { id: 'pk_size', name: 'Inversion Size', min: 0.8, max: 1.4, step: 0.02, default: 1.02, uniform: 'u_pk_size', type: 'float' },
            { id: 'pk_offset_x', name: 'Offset X', min: -0.3, max: 0.3, step: 0.01, default: 0.0, uniform: 'u_pk_offset_x', type: 'float' },
            { id: 'pk_offset_y', name: 'Offset Y', min: -0.3, max: 0.3, step: 0.01, default: 0.0, uniform: 'u_pk_offset_y', type: 'float' },
            { id: 'pk_offset_z', name: 'Offset Z', min: -0.3, max: 0.3, step: 0.01, default: 0.0, uniform: 'u_pk_offset_z', type: 'float' },
            { id: 'pk_thickness', name: 'Arch Thickness', min: 0.005, max: 0.08, step: 0.002, default: 0.02, uniform: 'u_pk_thickness', type: 'float' },
            { id: 'pk_iterations', name: 'Iterations', min: 6, max: 14, step: 1, default: 10, uniform: 'u_pk_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Gothic Nave',
                values: { pk_csize_x: 0.92, pk_csize_y: 0.92, pk_csize_z: 1.0, pk_size: 1.02, pk_offset_x: 0.0, pk_offset_y: 0.0, pk_offset_z: 0.0, pk_thickness: 0.02, pk_iterations: 10 }
            },
            {
                name: 'Infinite Colonnade',
                values: { pk_csize_x: 0.85, pk_csize_y: 0.98, pk_csize_z: 1.05, pk_size: 1.08, pk_offset_x: 0.05, pk_offset_y: -0.04, pk_offset_z: 0.02, pk_thickness: 0.025, pk_iterations: 11 }
            },
            {
                name: 'Crystal Cloister',
                values: { pk_csize_x: 0.96, pk_csize_y: 0.88, pk_csize_z: 0.95, pk_size: 0.98, pk_offset_x: -0.06, pk_offset_y: 0.05, pk_offset_z: -0.03, pk_thickness: 0.016, pk_iterations: 10 }
            },
            {
                name: 'Bone Basilica',
                values: { pk_csize_x: 1.05, pk_csize_y: 1.02, pk_csize_z: 1.10, pk_size: 1.12, pk_offset_x: 0.0, pk_offset_y: 0.08, pk_offset_z: 0.0, pk_thickness: 0.032, pk_iterations: 11 }
            }
        ],
        glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    vec3 csize = vec3(u_pk_csize_x, u_pk_csize_y, u_pk_csize_z);
    vec3 offset = vec3(u_pk_offset_x, u_pk_offset_y, u_pk_offset_z);
    float deFactor = 1.0;
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_pk_iterations);

    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;
        p = 2.0 * clamp(p, -csize, csize) - p;

        float d2 = dot(p, p);
        float k = max(u_pk_size / max(d2, 1e-6), 1.0);
        p = p * k + offset;
        deFactor = deFactor * k;

        orbit.x = min(orbit.x, d2);
        orbit.y = min(orbit.y, abs(p.z));
        orbit.z = min(orbit.z, deFactor * 0.05);
        orbit.w = float(i);

        if (d2 > 100.0) break;
    }

    trap = orbit;
    float rawDE = 0.5 * (abs(p.z) - u_pk_thickness) / max(deFactor, 1e-6);
    vec3 dBox = abs(pos) - vec3(1.7, 1.4, 1.7);
    float boundingBox = length(max(dBox, 0.0)) - 0.25;
    return max(rawDE * 0.8, boundingBox);
}
`,
        cpuEvalDE: (p, state) => {
            let px = p[0], py = p[1], pz = p[2];
            const cx = state.pk_csize_x ?? 0.92;
            const cy = state.pk_csize_y ?? 0.92;
            const cz = state.pk_csize_z ?? 1.0;
            const size = state.pk_size ?? 1.02;
            const ox = state.pk_offset_x ?? 0.0;
            const oy = state.pk_offset_y ?? 0.0;
            const oz = state.pk_offset_z ?? 0.0;
            const thick = state.pk_thickness ?? 0.02;
            const maxIt = Math.min(10, state.pk_iterations ?? 10);
            let deFactor = 1.0;

            for (let i = 0; i < maxIt; i++) {
                px = 2.0 * Math.max(-cx, Math.min(cx, px)) - px;
                py = 2.0 * Math.max(-cy, Math.min(cy, py)) - py;
                pz = 2.0 * Math.max(-cz, Math.min(cz, pz)) - pz;

                const d2 = px * px + py * py + pz * pz;
                const k = Math.max(size / Math.max(d2, 1e-6), 1.0);
                px = px * k + ox;
                py = py * k + oy;
                pz = pz * k + oz;
                deFactor = deFactor * k;

                if (d2 > 100.0) break;
            }

            const rawDE = 0.5 * Math.max(0.0, Math.abs(pz) - thick) / Math.max(1e-6, deFactor);
            const bx = Math.max(0.0, Math.abs(p[0]) - 1.7);
            const by = Math.max(0.0, Math.abs(p[1]) - 1.4);
            const bz = Math.max(0.0, Math.abs(p[2]) - 1.7);
            const boundingBox = Math.hypot(bx, by, bz) - 0.25;
            return Math.max(rawDE * 0.8, boundingBox);
        }
    },

    [FORMULA_IDS.BOX_BULB]: {
        id: FORMULA_IDS.BOX_BULB,
        name: 'Amazing Box-Bulb',
        subtitle: 'Symbiotic Architectural & Organic Power Hybrid',
        defaultCam: {
            pos: [1.7, 1.3, 2.3],
            target: [0.0, 0.0, 0.0]
        },
        params: [
            { id: 'bb_mix', name: 'Box-Bulb Blend', min: 0.0, max: 1.0, step: 0.02, default: 0.45, uniform: 'u_bb_mix', type: 'float' },
            { id: 'bb_scale', name: 'Box Scale', min: 1.6, max: 2.8, step: 0.02, default: 2.1, uniform: 'u_bb_scale', type: 'float' },
            { id: 'bb_power', name: 'Bulb Power', min: 3.0, max: 9.0, step: 0.05, default: 6.0, uniform: 'u_bb_power', type: 'float' },
            { id: 'bb_min_radius', name: 'Min Radius', min: 0.2, max: 0.8, step: 0.02, default: 0.5, uniform: 'u_bb_min_radius', type: 'float' },
            { id: 'bb_fold', name: 'Fold Limit', min: 0.7, max: 1.4, step: 0.02, default: 1.0, uniform: 'u_bb_fold', type: 'float' },
            { id: 'bb_iterations', name: 'Iterations', min: 6, max: 14, step: 1, default: 9, uniform: 'u_bb_iterations', type: 'int' }
        ],
        presets: [
            {
                name: 'Flesh Cathedral',
                values: { bb_mix: 0.45, bb_scale: 2.1, bb_power: 6.0, bb_min_radius: 0.5, bb_fold: 1.0, bb_iterations: 9 }
            },
            {
                name: 'Bone Monolith',
                values: { bb_mix: 0.28, bb_scale: 2.35, bb_power: 5.2, bb_min_radius: 0.42, bb_fold: 1.15, bb_iterations: 10 }
            },
            {
                name: 'Organic Reactor',
                values: { bb_mix: 0.62, bb_scale: 1.95, bb_power: 7.2, bb_min_radius: 0.55, bb_fold: 0.90, bb_iterations: 9 }
            },
            {
                name: 'Coral Fortress',
                values: { bb_mix: 0.50, bb_scale: 2.20, bb_power: 6.8, bb_min_radius: 0.48, bb_fold: 1.05, bb_iterations: 10 }
            }
        ],
        glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float dr = 1.0;
    vec4 orbit = vec4(100.0);
    int maxIt = int(u_bb_iterations);

    for (int i = 0; i < 16; i++) {
        if (i >= maxIt) break;

        // 1. Box fold step
        vec3 pB = clamp(p, -u_bb_fold, u_bb_fold) * 2.0 - p;
        float r2 = dot(pB, pB);
        float minR2 = u_bb_min_radius * u_bb_min_radius;
        float drB = dr;
        if (r2 < minR2) {
            float factor = 1.0 / minR2;
            pB *= factor;
            drB *= factor;
        } else if (r2 < 1.0) {
            float factor = 1.0 / r2;
            pB *= factor;
            drB *= factor;
        }
        pB = pB * u_bb_scale + pos;
        drB = drB * abs(u_bb_scale) + 1.0;

        // 2. Bulb step
        float r = length(p);
        float theta = acos(clamp(p.z / max(r, 1e-6), -1.0, 1.0)) * u_bb_power;
        float phi = atan(p.y, p.x) * u_bb_power;
        float zr = pow(r, u_bb_power);
        float drBulb = pow(r, u_bb_power - 1.0) * u_bb_power * dr + 1.0;
        float sinT = sin(theta);
        vec3 pBlb = zr * vec3(sinT * cos(phi), sinT * sin(phi), cos(theta)) + pos;

        // Smooth blend between architectural box and organic bulb
        p = mix(pB, pBlb, u_bb_mix);
        dr = mix(drB, drBulb, u_bb_mix);

        orbit.x = min(orbit.x, dot(p, p));
        orbit.y = min(orbit.y, abs(p.x * p.y));
        orbit.z = min(orbit.z, abs(p.z));
        orbit.w = float(i);

        if (dot(p, p) > 64.0) break;
    }

    trap = orbit;
    float lenP = length(p);
    return 0.75 * (0.5 * log(max(1.0001, lenP)) * lenP / max(dr, 1e-5));
}
`,
        cpuEvalDE: (p, state) => {
            let px = p[0], py = p[1], pz = p[2];
            const mixRatio = state.bb_mix ?? 0.45;
            const scale = state.bb_scale ?? 2.1;
            const power = state.bb_power ?? 6.0;
            const minR = state.bb_min_radius ?? 0.5;
            const fold = state.bb_fold ?? 1.0;
            const minR2 = minR * minR;
            const maxIt = Math.min(8, state.bb_iterations ?? 9);
            let dr = 1.0;

            for (let i = 0; i < maxIt; i++) {
                // Box
                let bx = Math.max(-fold, Math.min(fold, px)) * 2.0 - px;
                let by = Math.max(-fold, Math.min(fold, py)) * 2.0 - py;
                let bz = Math.max(-fold, Math.min(fold, pz)) * 2.0 - pz;
                let r2 = bx * bx + by * by + bz * bz;
                let drB = dr;
                if (r2 < minR2) {
                    const factor = 1.0 / minR2;
                    bx *= factor; by *= factor; bz *= factor; drB *= factor;
                } else if (r2 < 1.0) {
                    const factor = 1.0 / r2;
                    bx *= factor; by *= factor; bz *= factor; drB *= factor;
                }
                bx = bx * scale + p[0];
                by = by * scale + p[1];
                bz = bz * scale + p[2];
                drB = drB * Math.abs(scale) + 1.0;

                // Bulb
                const r = Math.hypot(px, py, pz);
                const theta = Math.acos(Math.max(-1.0, Math.min(1.0, pz / Math.max(r, 1e-6)))) * power;
                const phi = Math.atan2(py, px) * power;
                const zr = Math.pow(r, power);
                const drBulb = Math.pow(r, power - 1.0) * power * dr + 1.0;
                const sinT = Math.sin(theta);
                const blbx = zr * sinT * Math.cos(phi) + p[0];
                const blby = zr * sinT * Math.sin(phi) + p[1];
                const blbz = zr * Math.cos(theta) + p[2];

                px = bx + (blbx - bx) * mixRatio;
                py = by + (blby - by) * mixRatio;
                pz = bz + (blbz - bz) * mixRatio;
                dr = drB + (drBulb - drB) * mixRatio;

                if (px * px + py * py + pz * pz > 64.0) break;
            }

            const lenP = Math.hypot(px, py, pz);
            if (lenP < 1.0) return 0.0;
            return 0.75 * (0.5 * Math.log(lenP) * lenP / Math.max(1e-5, dr));
        }
    }
};
