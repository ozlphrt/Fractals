export const MENGER = {
    id: 'menger',
    name: 'Menger',
    subtitle: 'Nested square tunnels through a cubic lattice',
    boundRadius: 2.5,
    defaultCam: { pos: [2.5, 1.75, 2.65], target: [0, 0, 0] },
    params: [
        { id: 'menger_opening', name: 'Tunnel Width', min: 0.22, max: 0.42, step: 0.01, default: 0.33, uniform: 'u_menger_opening', type: 'float' },
        { id: 'menger_iterations', name: 'Depth', min: 1, max: 5, step: 1, default: 4, uniform: 'u_menger_iterations', type: 'int' }
    ],
    presets: [
        { name: 'Open Lattice', values: { menger_opening: 0.33, menger_iterations: 4 } },
        { name: 'Thick Walls', values: { menger_opening: 0.25, menger_iterations: 4 } },
        { name: 'Fine Scaffold', values: { menger_opening: 0.39, menger_iterations: 5 } }
    ],
    glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 box = abs(pos) - 1.0;
    float distance = length(max(box, vec3(0.0))) + min(max(box.x, max(box.y, box.z)), 0.0);
    float scale = 1.0;
    trap = vec4(dot(pos, pos), 1.0, 1.0, 0.0);
    for (int i = 0; i < 5; i++) {
        if (i >= u_menger_iterations) break;
        vec3 cell = abs(mod(pos * scale + 1.0, 2.0) - 1.0);
        float middle = max(min(cell.x, cell.y), min(max(cell.x, cell.y), cell.z));
        float cut = (u_menger_opening - middle) / scale;
        if (cut > distance) trap.w = float(i);
        distance = max(distance, cut);
        trap.y = min(trap.y, middle);
        trap.z = min(trap.z, abs(cut));
        scale *= 3.0;
    }
    return distance;
}
`,
    cpuEvalDE(pos, values) {
        const box = pos.map(value => Math.abs(value) - 1);
        let distance = Math.hypot(...box.map(value => Math.max(0, value))) + Math.min(0, Math.max(...box));
        let scale = 1;
        const openings = values.menger_opening ?? 0.33;
        const iterations = Math.min(5, values.menger_iterations ?? 4);
        for (let i = 0; i < iterations; i++) {
            const [x, y, z] = pos.map(value => {
                const shifted = value * scale + 1;
                return Math.abs(shifted - 2 * Math.floor(shifted / 2) - 1);
            });
            const middle = Math.max(Math.min(x, y), Math.min(Math.max(x, y), z));
            distance = Math.max(distance, (openings - middle) / scale);
            scale *= 3;
        }
        return distance;
    }
};

export const TETRA = {
    id: 'tetra',
    name: 'Tetra',
    subtitle: 'Repeating tetrahedra with triangular openings',
    boundRadius: 2.5,
    defaultCam: { pos: [2.5, 1.15, 2.85], target: [0, 0, 0] },
    params: [
        { id: 'tetra_scale', name: 'Fold Scale', min: 1.85, max: 2.18, step: 0.01, default: 2, uniform: 'u_tetra_scale', type: 'float' },
        { id: 'tetra_iterations', name: 'Depth', min: 1, max: 9, step: 1, default: 6, uniform: 'u_tetra_iterations', type: 'int' }
    ],
    presets: [
        { name: 'Open Pyramid', values: { tetra_scale: 2, tetra_iterations: 6 } },
        { name: 'Joined Pyramid', values: { tetra_scale: 1.9, tetra_iterations: 6 } },
        { name: 'Separated Tips', values: { tetra_scale: 2.12, tetra_iterations: 7 } }
    ],
    glsl: `
float mapFractal(vec3 pos, out vec4 trap) {
    vec3 p = pos;
    float scale = 1.0;
    trap = vec4(dot(pos, pos), 1.0, 1.0, 0.0);
    for (int i = 0; i < 9; i++) {
        if (i >= u_tetra_iterations) break;
        if (p.x + p.y < 0.0) p.xy = -p.yx;
        if (p.x + p.z < 0.0) p.xz = -p.zx;
        if (p.y + p.z < 0.0) p.yz = -p.zy;
        p = p * u_tetra_scale - (u_tetra_scale - 1.0);
        scale *= u_tetra_scale;
        trap.y = min(trap.y, min(abs(p.x), min(abs(p.y), abs(p.z))));
        trap.z = min(trap.z, length(p) / scale);
        trap.w = float(i);
    }
    float plane = max(max(-p.x - p.y - p.z, p.x + p.y - p.z),
                      max(p.x - p.y + p.z, -p.x + p.y + p.z));
    return (plane - 1.0) / (sqrt(3.0) * scale);
}
`,
    cpuEvalDE(pos, values) {
        let [x, y, z] = pos;
        const scale = values.tetra_scale ?? 2;
        const iterations = Math.min(9, values.tetra_iterations ?? 6);
        let derivative = 1;
        for (let i = 0; i < iterations; i++) {
            if (x + y < 0) [x, y] = [-y, -x];
            if (x + z < 0) [x, z] = [-z, -x];
            if (y + z < 0) [y, z] = [-z, -y];
            x = x * scale - (scale - 1);
            y = y * scale - (scale - 1);
            z = z * scale - (scale - 1);
            derivative *= scale;
        }
        const plane = Math.max(-x - y - z, x + y - z, x - y + z, -x + y + z);
        return (plane - 1) / (Math.sqrt(3) * derivative);
    }
};
