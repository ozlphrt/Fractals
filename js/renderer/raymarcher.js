// js/renderer/raymarcher.js
// WebGL2 Metamorphic Raymarching Engine:
// - Modular per-formula shaders with instant pre-compilation (zero runtime lag, zero ANGLE stalls)
// - Seamless dual-FBO metamorphic cross-morph with quintic ease and FXAA anti-aliasing
// - Soft shadows, Iteration-based AO, 4-Channel Orbit Traps, Inigo Quilez Cosine Palette, Volumetric Step Glow, Fog

import { FORMULAS } from '../formulas/registry.js';

export class Raymarcher {
    constructor(canvas, stateManager) {
        this.canvas = canvas;
        this.state = stateManager;

        const gl = canvas.getContext('webgl2', {
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true
        });

        if (!gl) {
            throw new Error('WebGL2 is required for this 3D Fractal Synth.');
        }
        this.gl = gl;

        // Enable floating point color buffer extensions if available, or fall back to RGBA8
        this.colorBufferExt = gl.getExtension('EXT_color_buffer_float');
        this.internalFormat = this.colorBufferExt ? gl.RGBA16F : gl.RGBA8;
        this.texType = this.colorBufferExt ? gl.FLOAT : gl.UNSIGNED_BYTE;

        // Quad geometry
        this.quadVAO = null;
        this.quadVBO = null;

        // Program cache per formula ID
        this.programs = new Map();
        this.uniformLocationsMap = new Map();

        // Resolution management: Discrete scale levels (high fidelity, zero crawling)
        this.scaleLevels = [1.0, 0.90, 0.82];
        this.scaleIndex = 0;
        this.activeScale = 1.0;
        this.frameTimeHistory = [];
        this.lastScaleChangeTime = performance.now();
        this.overBudgetDuration = 0;
        this.underBudgetDuration = 0;
        this.stillFrames = 0;

        // GPU Timer query extension (EXT_disjoint_timer_query_webgl2)
        this.timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this.gpuQueries = [];
        this.lastGpuMs = 0.0;

        // Offscreen Framebuffers for smooth cross-morphing
        this.fboA = null;
        this.fboTextureA = null;
        this.fboB = null;
        this.fboTextureB = null;
        this.fboWidth = 0;
        this.fboHeight = 0;

        // Composite shader program & cached uniforms
        this.compositeProgram = null;
        this.compositeUniforms = null;

        this.initQuad();
        this.initCompositeShader();
        this.precompileAllFormulas();

        // Listen for formula changes
        this.state.onFormulaChange(() => {
            this.resetAccumulation();
        });
    }

    initQuad() {
        const gl = this.gl;
        const positions = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            -1.0, 1.0,
            1.0, -1.0,
            1.0, 1.0
        ]);

        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);

        this.quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    initCompositeShader() {
        const gl = this.gl;
        const vsSource = `#version 300 es
        in vec2 a_pos;
        out vec2 v_uv;
        void main() {
            v_uv = a_pos * 0.5 + 0.5;
            gl_Position = vec4(a_pos, 0.0, 1.0);
        }`;

        // Screen output shader: applies FXAA edge-smoothing + seamless morph blend + ACES tone mapping + gamma curve
        const fsCompositeSource = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_tex_a;
        uniform sampler2D u_tex_b;
        uniform float u_blend;
        uniform vec2 u_tex_size;
        uniform vec2 u_uv_scale;
        uniform vec2 u_render_size;
        
        vec3 aces(vec3 x) {
            float a = 2.51;
            float b = 0.03;
            float c = 2.43;
            float d = 0.59;
            float e = 0.14;
            return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        // Fast Approximate Anti-Aliasing (FXAA 3.11)
        vec3 sampleFXAA(sampler2D tex, vec2 uv, vec2 rcpFrame) {
            vec3 rgbM = texture(tex, uv).rgb;
            vec3 rgbNW = texture(tex, uv + vec2(-0.5, -0.5) * rcpFrame).rgb;
            vec3 rgbNE = texture(tex, uv + vec2( 0.5, -0.5) * rcpFrame).rgb;
            vec3 rgbSW = texture(tex, uv + vec2(-0.5,  0.5) * rcpFrame).rgb;
            vec3 rgbSE = texture(tex, uv + vec2( 0.5,  0.5) * rcpFrame).rgb;

            const vec3 luma = vec3(0.299, 0.587, 0.114);
            float lumaM  = dot(rgbM,  luma);
            float lumaNW = dot(rgbNW, luma);
            float lumaNE = dot(rgbNE, luma);
            float lumaSW = dot(rgbSW, luma);
            float lumaSE = dot(rgbSE, luma);

            float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
            float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

            // If contrast below threshold, skip blurring to preserve sharp interior texture
            if ((lumaMax - lumaMin) < max(0.04, lumaMax * 0.125)) {
                return rgbM;
            }

            vec2 dir;
            dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
            dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

            float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * 0.03125, 0.0078125);
            float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
            dir = min(vec2(8.0), max(vec2(-8.0), dir * rcpDirMin)) * rcpFrame;

            vec3 rgbA = 0.5 * (
                texture(tex, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
                texture(tex, uv + dir * (2.0 / 3.0 - 0.5)).rgb
            );
            vec3 rgbB = rgbA * 0.5 + 0.25 * (
                texture(tex, uv + dir * -0.5).rgb +
                texture(tex, uv + dir *  0.5).rgb
            );

            float lumaB = dot(rgbB, luma);
            if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
                return rgbA;
            } else {
                return rgbB;
            }
        }

        // Ordered Bayer 4x4 matrix dither - perfectly eliminates 8-bit Mach bands and contour tearing
        float bayer4x4(vec2 p) {
            vec2 b = floor(mod(p, 4.0));
            int x = int(b.x);
            int y = int(b.y);
            int idx = x + y * 4;
            float m = 0.0;
            if (idx == 0) m = 0.0;
            else if (idx == 1) m = 8.0;
            else if (idx == 2) m = 2.0;
            else if (idx == 3) m = 10.0;
            else if (idx == 4) m = 12.0;
            else if (idx == 5) m = 4.0;
            else if (idx == 6) m = 14.0;
            else if (idx == 7) m = 6.0;
            else if (idx == 8) m = 3.0;
            else if (idx == 9) m = 11.0;
            else if (idx == 10) m = 1.0;
            else if (idx == 11) m = 9.0;
            else if (idx == 12) m = 15.0;
            else if (idx == 13) m = 7.0;
            else if (idx == 14) m = 13.0;
            else m = 5.0;
            return (m / 16.0 - 0.5) / 255.0;
        }

        void main() {
            vec2 rcpFrame = (vec2(1.0) / max(vec2(1.0), u_render_size)) * u_uv_scale;
            vec2 uv = clamp(v_uv * u_uv_scale, vec2(0.5) / u_tex_size, (u_render_size - vec2(0.5)) / u_tex_size);
            vec3 colA = sampleFXAA(u_tex_a, uv, rcpFrame);
            vec3 rawCol;
            
            if (u_blend > 0.001) {
                vec3 colB = sampleFXAA(u_tex_b, uv, rcpFrame);
                // Quintic smoothstep for seamless organic transition
                float t = clamp(u_blend, 0.0, 1.0);
                float s = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
                rawCol = mix(colA, colB, s);
            } else {
                rawCol = colA;
            }
            
            vec3 mapped = aces(rawCol * 0.92);
            mapped = pow(mapped, vec3(1.0 / 2.2));
            float dither = bayer4x4(gl_FragCoord.xy) * 0.75;
            fragColor = vec4(clamp(mapped + vec3(dither), 0.0, 1.0), 1.0);
        }`;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fsComp = this.compileShader(gl.FRAGMENT_SHADER, fsCompositeSource);
        this.compositeProgram = this.createProgram(vs, fsComp);

        // Pre-cache composite program uniform locations (avoids per-frame getUniformLocation calls)
        this.compositeUniforms = {
            u_tex_a: gl.getUniformLocation(this.compositeProgram, 'u_tex_a'),
            u_tex_b: gl.getUniformLocation(this.compositeProgram, 'u_tex_b'),
            u_blend: gl.getUniformLocation(this.compositeProgram, 'u_blend'),
            u_tex_size: gl.getUniformLocation(this.compositeProgram, 'u_tex_size'),
            u_uv_scale: gl.getUniformLocation(this.compositeProgram, 'u_uv_scale'),
            u_render_size: gl.getUniformLocation(this.compositeProgram, 'u_render_size')
        };
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${info}\nSource:\n${source}`);
        }
        return shader;
    }

    createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program linking error: ${info}`);
        }
        return program;
    }

    buildCommonFragmentHeader() {
        return `#version 300 es
precision highp float;

out vec4 fragColor;

// System uniforms
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_cam_pos;
uniform vec3 u_cam_target;
uniform vec3 u_cam_up;
uniform float u_fov;
uniform vec2 u_subpixel_jitter;

// Global settings
uniform int u_max_steps;
uniform float u_hit_epsilon;
uniform float u_bound_radius;
uniform int u_shadow_steps;
uniform int u_ao_taps;

// Shading & Cosine Palette
uniform int u_trap_mode;
uniform float u_color_cycle;
uniform float u_color_phase;
uniform float u_pal_a_r, u_pal_a_g, u_pal_a_b;
uniform float u_pal_b_r, u_pal_b_g, u_pal_b_b;
uniform float u_pal_c_r, u_pal_c_g, u_pal_c_b;
uniform float u_pal_d_r, u_pal_d_g, u_pal_d_b;
uniform float u_roughness;
uniform float u_metallic;

// Lighting & Atmosphere
uniform float u_sun_azimuth;
uniform float u_sun_elevation;
uniform float u_sun_intensity;
uniform float u_sun_color_r, u_sun_color_g, u_sun_color_b;
uniform float u_shadow_softness;
uniform float u_ao_strength;
uniform float u_backlight_intensity;
uniform float u_backlight_elevation;
uniform float u_rim_color_r, u_rim_color_g, u_rim_color_b;
uniform float u_glow_intensity;
uniform float u_glow_color_r, u_glow_color_g, u_glow_color_b;
uniform float u_fog_density;
uniform float u_near_clip;

// Rotation utilities
mat3 rotX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}
mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}
`;
    }

    buildRaymarcherBody(formula) {
        return `
// Active Formula Uniforms
${formula.params.map(p => `uniform ${p.type === 'int' ? 'int' : 'float'} ${p.uniform};`).join('\n')}

// Formula Distance Estimator
${formula.glsl}

// Distance wrapper with dummy trap
float map(vec3 pos) {
    vec4 dummy;
    return mapFractal(pos, dummy);
}

// 4-tap Tetrahedron Normal (Analytic gradient, zero directional bias, smooth across all curved surfaces)
vec3 calcNormal(vec3 p, float eps) {
    const vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * map(p + k.xyy * eps) +
        k.yyx * map(p + k.yyx * eps) +
        k.yxy * map(p + k.yxy * eps) +
        k.xxx * map(p + k.xxx * eps)
    );
}

// Inigo Quilez Cosine Palette
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

// High-fidelity Continuous Soft Shadow with dynamic step budget and acne suppression
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    int maxSteps = clamp(u_shadow_steps, 6, 16);
    for (int i = 0; i < 16; i++) {
        if (i >= maxSteps || t >= maxt) break;
        float h = map(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        if (res < 0.02) return 0.0; // Early exit when already in deep shadow
        t += clamp(h * 0.90, 0.015, 0.35);
    }
    return clamp(res, 0.0, 1.0);
}

// High-efficiency Ambient Occlusion with macro-radius filtering
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    int taps = clamp(u_ao_taps, 2, 4);
    for (int i = 0; i < 4; i++) {
        if (i >= taps) break;
        float h = 0.025 + 0.16 * float(i) / 3.0;
        float d = map(p + h * n);
        occ += max(0.0, h - d) * sca;
        sca *= 0.70;
    }
    return clamp(1.0 - u_ao_strength * occ * 1.35, 0.0, 1.0);
}

// Ray - Bounding Sphere intersection test
// Returns vec2(tNear, tFar) if hit (tFar >= 0), or vec2(-1.0) if missed
vec2 intersectSphere(vec3 ro, vec3 rd, float radius) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - radius * radius;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    float sh = sqrt(h);
    return vec2(-b - sh, -b + sh);
}

// High-performance procedural celestial starfield
vec3 hashStar(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx);
}

// Procedural 3D noise for celestial nebula clouds
float hashNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec3 h1 = hashStar(i);
    vec3 h2 = hashStar(i + vec3(1.0, 0.0, 0.0));
    vec3 h3 = hashStar(i + vec3(0.0, 1.0, 0.0));
    vec3 h4 = hashStar(i + vec3(1.0, 1.0, 0.0));
    vec3 h5 = hashStar(i + vec3(0.0, 0.0, 1.0));
    vec3 h6 = hashStar(i + vec3(1.0, 0.0, 1.0));
    vec3 h7 = hashStar(i + vec3(0.0, 1.0, 1.0));
    vec3 h8 = hashStar(i + vec3(1.0, 1.0, 1.0));
    
    float n1 = mix(h1.x, h2.x, f.x);
    float n2 = mix(h3.x, h4.x, f.x);
    float n3 = mix(h5.x, h6.x, f.x);
    float n4 = mix(h7.x, h8.x, f.x);
    float nA = mix(n1, n2, f.y);
    float nB = mix(n3, n4, f.y);
    return mix(nA, nB, f.z);
}

float nebulaFBM(vec3 p) {
    float f = 0.0;
    f += 0.500 * hashNoise(p);
    f += 0.250 * hashNoise(p * 2.02 + 1.7);
    f += 0.125 * hashNoise(p * 4.05 + 3.2);
    return f;
}

// Subtle, organic Milky Way galactic dust clouds and interstellar nebulosity
vec3 getMilkyWay(vec3 rd) {
    // Tilted galactic equator normal across celestial sphere
    const vec3 galNormal = vec3(0.53, 0.76, 0.37);
    float galLat = dot(rd, galNormal);
    float band = exp(-abs(galLat) * 4.6);
    if (band < 0.01) return vec3(0.0);
    
    // Core bulge toward Sagittarius
    const vec3 galCenter = vec3(-0.62, 0.31, 0.72);
    float centerProx = max(0.0, dot(rd, galCenter));
    float bulge = pow(centerProx, 3.2) * 0.70;
    
    // Organic turbulence & dark absorption rift
    float n = nebulaFBM(rd * 3.2);
    float rift = smoothstep(0.04, 0.22, abs(galLat + (n - 0.5) * 0.16));
    float cloudDensity = band * (n * 0.70 + bulge * 0.85) * (0.35 + 0.65 * rift);
    
    // Cosmic dust & gas colors (deep indigo, interstellar violet dust, warm galactic core)
    vec3 colDust = vec3(0.038, 0.022, 0.048);
    vec3 colCore = vec3(0.065, 0.048, 0.032);
    vec3 colGas  = vec3(0.018, 0.035, 0.065);
    
    vec3 mw = mix(colGas, colDust, n) * (cloudDensity * 1.5);
    mw += colCore * (bulge * band * 0.85);
    return mw;
}

// Crisp, clearly visible celestial starfield with genuine point spread and spectral colors
vec3 getStarField(vec3 dir) {
    vec3 stars = vec3(0.0);
    
    // Pixel angular footprint in radians
    float pixAngle = 2.0 / max(100.0, min(u_resolution.x, u_resolution.y));
    float rBase = pixAngle * 1.25;
    
    // Layer 1: Clearly visible background stars
    {
        float N = 24.0;
        vec3 p = dir * N;
        vec3 base = floor(p);
        
        for (int i = 0; i <= 1; i++) {
            for (int j = 0; j <= 1; j++) {
                for (int k = 0; k <= 1; k++) {
                    vec3 cell = base + vec3(float(i), float(j), float(k));
                    vec3 rnd = hashStar(cell);
                    // ~14% density: pleasant, clear constellation field
                    if (rnd.x < 0.86) continue;
                    
                    vec3 starDir = normalize(cell + (rnd - 0.5) * 0.74);
                    float dist2 = 2.0 * max(0.0, 1.0 - dot(dir, starDir));
                    float dist = sqrt(dist2);
                    
                    if (dist < rBase) {
                        float normD = dist / rBase;
                        float psf = exp(-normD * 2.6) * (1.0 - normD * normD);
                        float mag = pow(rnd.y, 2.6) * 0.65 + 0.16;
                        
                        vec3 starCol;
                        if (rnd.z < 0.45) {
                            starCol = mix(vec3(0.75, 0.88, 1.0), vec3(0.96, 0.98, 1.0), rnd.z / 0.45);
                        } else {
                            starCol = mix(vec3(0.96, 0.98, 1.0), vec3(1.0, 0.90, 0.72), (rnd.z - 0.45) / 0.55);
                        }
                        stars += starCol * (psf * mag * 1.2);
                    }
                }
            }
        }
    }
    
    // Layer 2: Radiant navigational landmark stars
    {
        float N = 12.0;
        vec3 p = dir * N;
        vec3 base = floor(p);
        float rMed = rBase * 1.32;
        
        for (int i = 0; i <= 1; i++) {
            for (int j = 0; j <= 1; j++) {
                for (int k = 0; k <= 1; k++) {
                    vec3 cell = base + vec3(float(i), float(j), float(k));
                    vec3 rnd = hashStar(cell + 47.19);
                    // ~8% density
                    if (rnd.x < 0.92) continue;
                    
                    vec3 starDir = normalize(cell + (rnd - 0.5) * 0.74);
                    float dist2 = 2.0 * max(0.0, 1.0 - dot(dir, starDir));
                    float dist = sqrt(dist2);
                    
                    if (dist < rMed) {
                        float normD = dist / rMed;
                        float psf = exp(-normD * 2.4) * (1.0 - normD * normD);
                        float mag = pow(rnd.y, 2.2) * 0.85 + 0.32;
                        
                        vec3 starCol;
                        if (rnd.z < 0.45) {
                            starCol = mix(vec3(0.78, 0.90, 1.0), vec3(0.98, 0.98, 1.0), rnd.z / 0.45);
                        } else if (rnd.z < 0.85) {
                            starCol = mix(vec3(0.98, 0.98, 1.0), vec3(1.0, 0.92, 0.76), (rnd.z - 0.45) / 0.40);
                        } else {
                            starCol = mix(vec3(1.0, 0.92, 0.76), vec3(1.0, 0.80, 0.62), (rnd.z - 0.85) / 0.15);
                        }
                        stars += starCol * (psf * mag * 1.3);
                    }
                }
            }
        }
    }
    
    return stars;
}

// Luminous celestial comets passing by periodically across the deep sky
vec3 getComet(vec3 rd, float time) {
    float period = 18.0;
    float dur = 4.2;
    float cycle = floor(time / period);
    float tLocal = mod(time, period);
    
    // Only active during duration of crossing
    if (tLocal > dur) return vec3(0.0);
    
    float progress = tLocal / dur;
    float fadeIn = smoothstep(0.0, 0.12, progress);
    float fadeOut = smoothstep(1.0, 0.80, progress);
    float masterAlpha = fadeIn * fadeOut;
    if (masterAlpha <= 0.001) return vec3(0.0);
    
    // Pseudo-random deterministic trajectory per cycle
    vec3 r1 = hashStar(vec3(cycle * 3.1 + 1.5, cycle * 7.7 + 1.2, 5.4));
    vec3 r2 = hashStar(vec3(cycle * 5.3 + 2.1, cycle * 1.9 + 8.6, 9.8));
    
    // Celestial start and end points
    float theta1 = (r1.x * 2.0 - 1.0) * 3.14159;
    float phi1 = (r1.y * 0.7 - 0.35) * 3.14159;
    vec3 p1 = normalize(vec3(cos(phi1) * sin(theta1), sin(phi1), cos(phi1) * cos(theta1)));
    
    float theta2 = theta1 + (r2.x * 0.8 + 0.5) * (r1.z > 0.5 ? 1.0 : -1.0);
    float phi2 = clamp(phi1 + (r2.y - 0.5) * 0.8, -1.2, 1.2);
    vec3 p2 = normalize(vec3(cos(phi2) * sin(theta2), sin(phi2), cos(phi2) * cos(theta2)));
    
    vec3 headPos = normalize(mix(p1, p2, progress));
    vec3 moveDir = normalize(p2 - p1);
    vec3 tailDir = -moveDir;
    
    // Head glowing nucleus & coma
    float distToHead = length(rd - headPos);
    float nucleus = smoothstep(0.005, 0.0, distToHead) * 1.1;
    float coma = exp(-distToHead * 160.0) * 0.55;
    
    // Tail calculation
    vec3 toRd = rd - headPos;
    float tailDistAlong = dot(toRd, tailDir);
    float tailGlow = 0.0;
    
    float maxTailLen = 0.26;
    if (tailDistAlong > 0.0 && tailDistAlong < maxTailLen) {
        vec3 perp = toRd - tailDir * tailDistAlong;
        float distPerp = length(perp);
        
        float tailWidth = 0.0025 + tailDistAlong * 0.032;
        float tailFade = smoothstep(maxTailLen, 0.0, tailDistAlong);
        
        float ionTrail = exp(-distPerp / (tailWidth * 0.4)) * tailFade * 0.55;
        float dustTrail = exp(-distPerp / tailWidth) * tailFade * 0.28;
        
        tailGlow = ionTrail + dustTrail;
    }
    
    vec3 nucleusCol = vec3(0.95, 0.98, 1.0);
    vec3 comaCol = vec3(0.45, 0.80, 1.0);
    vec3 tailCol = mix(vec3(0.30, 0.65, 1.0), vec3(0.15, 0.40, 0.85), tailDistAlong / maxTailLen);
    
    return (nucleus * nucleusCol + coma * comaCol + tailGlow * tailCol) * masterAlpha;
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy + u_subpixel_jitter;
    vec2 p = (2.0 * fragCoord - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Camera ray setup
    vec3 ro = u_cam_pos;
    vec3 ww = normalize(u_cam_target - u_cam_pos);
    vec3 uu = normalize(cross(ww, u_cam_up));
    vec3 vv = cross(uu, ww);
    
    float fovFactor = tan(radians(u_fov * 0.5));
    vec3 rd = normalize(p.x * uu * fovFactor + p.y * vv * fovFactor + ww);
    
    // Raymarching
    float t = max(0.02, u_near_clip);
    float maxDist = 14.0;
    vec4 trap = vec4(100.0);
    vec4 finalTrap = vec4(0.0);
    int stepCount = 0;
    float glow = 0.0;
    bool hit = false;
    
    // Analytic Bounding Sphere skip test
    bool skipMarch = false;
    if (u_bound_radius > 0.0) {
        vec2 hitSph = intersectSphere(ro, rd, u_bound_radius);
        if (hitSph.y < 0.0) {
            // Ray completely misses the bounding sphere -> instant sky/stars exit!
            skipMarch = true;
        } else {
            // Ray hits bounding sphere: skip marching through empty space between camera and sphere entry
            if (hitSph.x > t) {
                t = hitSph.x;
            }
            maxDist = min(maxDist, hitSph.y + 0.25);
        }
    }

    if (!skipMarch) {
        for (int i = 0; i < 500; i++) {
            if (i >= u_max_steps || t > maxDist) break;
            stepCount = i;
            vec3 curPos = ro + rd * t;
            float d = mapFractal(curPos, trap);
            
            // Fast polynomial volumetric glow
            if (u_glow_intensity > 0.005) {
                float g = max(0.0, 1.0 - d * 2.5);
                glow += g * g;
            }
            
            float hitThresh = u_hit_epsilon * (1.0 + t * 0.015);
            if (d < hitThresh) {
                // Refinement step: eliminate step-size discretization chatter
                t += d * 0.5;
                hit = true;
                finalTrap = trap;
                break;
            }
            // Conservative 0.68x ray stepping: completely eliminates grazing overshoots through thin lattice walls
            t += max(u_hit_epsilon * 0.25, d * 0.68);
        }
    }
    
    vec3 sunDir = normalize(vec3(
        cos(u_sun_azimuth) * cos(u_sun_elevation),
        sin(u_sun_elevation),
        sin(u_sun_azimuth) * cos(u_sun_elevation)
    ));
    
    vec3 glowColor = vec3(u_glow_color_r, u_glow_color_g, u_glow_color_b);
    // Dark celestial midnight navy gradient with celestial stars and comets
    vec3 skyTop = vec3(0.006, 0.014, 0.038);
    vec3 skyBottom = vec3(0.002, 0.004, 0.012);
    vec3 skyBg = mix(skyBottom, skyTop, clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = skyBg + getMilkyWay(rd) + getStarField(rd) + getComet(rd, u_time);
    
    if (hit) {
        vec3 pos = ro + rd * t;
        // Macroscopic curvature normal: filters out chaotic sub-pixel micro-grit and noise
        float normEps = max(0.0028, t * 0.0012);
        vec3 nor = calcNormal(pos, normEps);
        float ao = calcAO(pos, nor);
        
        // Orbit trap selection for coloring
        float trapVal = 0.0;
        if (u_trap_mode == 0) {
            trapVal = finalTrap.x;
        } else if (u_trap_mode == 1) {
            trapVal = finalTrap.y;
        } else if (u_trap_mode == 2) {
            trapVal = finalTrap.z;
        } else {
            trapVal = finalTrap.w / 16.0;
        }
        
        vec3 palA = vec3(u_pal_a_r, u_pal_a_g, u_pal_a_b);
        vec3 palB = vec3(u_pal_b_r, u_pal_b_g, u_pal_b_b);
        if (length(palB) < 0.02) palB = vec3(0.38, 0.26, 0.18);
        vec3 palC = vec3(u_pal_c_r, u_pal_c_g, u_pal_c_b);
        if (length(palC) < 0.02) palC = vec3(1.0);
        vec3 palD = vec3(u_pal_d_r, u_pal_d_g, u_pal_d_b) + vec3(u_color_phase);
        
        float tCoord = trapVal * u_color_cycle;
        vec3 albedo = clamp(cosinePalette(tCoord, palA, palB, palC, palD), 0.0, 1.0);
        
        // Smooth crevice weathering (soft continuous transition)
        albedo = mix(albedo * 0.72, albedo, smoothstep(0.08, 0.92, ao));
        
        vec3 sunColor = vec3(u_sun_color_r, u_sun_color_g, u_sun_color_b);
        if (length(sunColor) < 0.1) sunColor = vec3(1.0, 0.92, 0.80);
        vec3 rimColor = vec3(u_rim_color_r, u_rim_color_g, u_rim_color_b);
        if (length(rimColor) < 0.1) rimColor = vec3(0.45, 0.65, 0.90);
        
        // Main Sun Light - fully continuous shadow and diffuse, acne-free offset
        float dif = clamp(dot(nor, sunDir), 0.0, 1.0);
        float sha = (dif > 0.001) ? softShadow(pos + nor * max(0.02, normEps * 5.0), sunDir, 0.035, 5.0, u_shadow_softness) : 0.0;
        
        // Specular highlight (smooth filtered Blinn-Phong)
        vec3 hal = normalize(sunDir - rd);
        float rough = clamp(u_roughness, 0.05, 1.0);
        float specExponent = mix(8.0, 48.0, 1.0 - rough);
        float spe = pow(clamp(dot(nor, hal), 0.0, 1.0), specExponent);
        spe *= (1.0 - rough * 0.65);
        float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 4.0);

        // Rim Light / Backlight
        vec3 backDir = normalize(vec3(-sunDir.x, sin(u_backlight_elevation), -sunDir.z));
        float backDif = clamp(dot(nor, backDir), 0.0, 1.0);
        
        vec3 backHal = normalize(backDir - rd);
        float backSpe = pow(clamp(dot(nor, backHal), 0.0, 1.0), 16.0 / max(0.01, u_roughness));
        float rimFresnel = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 3.0);
        
        // Sky / Ground Hemispheric Light Fill
        float hemi = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);
        vec3 skyCol = vec3(0.24, 0.30, 0.40);
        vec3 groundCol = vec3(0.12, 0.09, 0.06);
        vec3 ambFill = mix(groundCol, skyCol, hemi);

        vec3 lin = vec3(0.0);
        // Direct Sun Diffuse (scaled, energy-conserved)
        lin += albedo * sunColor * dif * sha * u_sun_intensity * 0.85;
        
        // Specular highlight (PBR Fresnel Blinn-Phong, attenuated by roughness & metallic)
        vec3 specColor = mix(sunColor, albedo, u_metallic);
        float specPower = (0.2 + 0.8 * u_metallic) * (1.0 - u_roughness * 0.5);
        lin += specColor * spe * sha * u_sun_intensity * specPower * 0.65;
        
        // Ambient Environmental Fill (strictly attenuated by AO)
        lin += albedo * ambFill * ao * 0.35;
        
        // Backlight Rim Light (controlled silhouette edge accent, not surface washout)
        lin += albedo * rimColor * backDif * u_backlight_intensity * ao * 0.25;
        lin += rimColor * backSpe * u_backlight_intensity * (0.3 + 0.7 * u_metallic) * 0.35;
        lin += rimColor * rimFresnel * clamp(dot(-rd, backDir) * 0.5 + 0.5, 0.0, 1.0) * u_backlight_intensity * 0.30;
        
        if (u_glow_intensity > 0.01) {
            lin += fre * glowColor * 0.35 * u_glow_intensity;
        }
        
        // Distance fog into sky atmosphere
        float fog = 1.0 - exp(-t * u_fog_density * 0.5);
        col = mix(lin, skyBg, fog);
    }
    
    // Add volumetric edge glow
    col += glowColor * (glow * 0.015 * u_glow_intensity);
    
    fragColor = vec4(col, 1.0);
}
`;
    }

    getProgramForFormula(formula) {
        if (this.programs.has(formula.id)) {
            return this.programs.get(formula.id);
        }

        const gl = this.gl;
        const vsSource = `#version 300 es
        in vec2 a_pos;
        void main() {
            gl_Position = vec4(a_pos, 0.0, 1.0);
        }`;

        const fsSource = this.buildCommonFragmentHeader() + this.buildRaymarcherBody(formula);

        try {
            const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
            const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
            const prog = this.createProgram(vs, fs);
            this.programs.set(formula.id, prog);
            this.cacheUniformLocations(formula, prog);
            return prog;
        } catch (e) {
            console.error(`Failed to compile fractal shader for ${formula.id}:`, e);
            return null;
        }
    }

    precompileAllFormulas() {
        for (const formula of Object.values(FORMULAS)) {
            this.getProgramForFormula(formula);
        }
    }

    cacheUniformLocations(formula, prog) {
        const gl = this.gl;
        const uniformMap = new Map();

        const standardUniforms = [
            'u_resolution', 'u_time', 'u_cam_pos', 'u_cam_target', 'u_cam_up', 'u_fov', 'u_subpixel_jitter',
            'u_max_steps', 'u_hit_epsilon', 'u_bound_radius', 'u_shadow_steps', 'u_ao_taps',
            'u_trap_mode', 'u_color_cycle', 'u_color_phase',
            'u_pal_a_r', 'u_pal_a_g', 'u_pal_a_b',
            'u_pal_b_r', 'u_pal_b_g', 'u_pal_b_b',
            'u_pal_c_r', 'u_pal_c_g', 'u_pal_c_b',
            'u_pal_d_r', 'u_pal_d_g', 'u_pal_d_b',
            'u_roughness', 'u_metallic',
            'u_sun_azimuth', 'u_sun_elevation', 'u_sun_intensity',
            'u_sun_color_r', 'u_sun_color_g', 'u_sun_color_b',
            'u_shadow_softness', 'u_ao_strength',
            'u_backlight_intensity', 'u_backlight_elevation',
            'u_rim_color_r', 'u_rim_color_g', 'u_rim_color_b',
            'u_glow_intensity', 'u_glow_color_r', 'u_glow_color_g', 'u_glow_color_b',
            'u_fog_density', 'u_near_clip'
        ];

        for (const u of standardUniforms) {
            uniformMap.set(u, gl.getUniformLocation(prog, u));
        }

        for (const p of formula.params) {
            uniformMap.set(p.uniform, gl.getUniformLocation(prog, p.uniform));
        }

        this.uniformLocationsMap.set(formula.id, uniformMap);
    }

    updateFBOs(width, height) {
        const gl = this.gl;
        if (this.fboWidth === width && this.fboHeight === height) return;

        this.fboWidth = width;
        this.fboHeight = height;

        if (this.fboA) gl.deleteFramebuffer(this.fboA);
        if (this.fboTextureA) gl.deleteTexture(this.fboTextureA);
        if (this.fboB) gl.deleteFramebuffer(this.fboB);
        if (this.fboTextureB) gl.deleteTexture(this.fboTextureB);

        // FBO A
        this.fboTextureA = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.fboTextureA);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, width, height, 0, gl.RGBA, this.texType, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.fboA = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTextureA, 0);

        // FBO B (for smooth cross-morphing)
        this.fboTextureB = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.fboTextureB);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, width, height, 0, gl.RGBA, this.texType, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.fboB = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTextureB, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resetAccumulation() {
        this.stillFrames = 0;
    }

    computeSafeBoundingRadius(formula, values = {}) {
        if (!formula) return 6.5;
        switch (formula.id) {
            case 'mandelbox':
                return 2.2;
            case 'burning_ship': {
                const asym = typeof values.bs_asym === 'number' ? values.bs_asym : (formula.params.find(p => p.id === 'bs_asym')?.default ?? 0.0);
                return Math.max(3.2, 1.85 + asym * 0.95) * 1.35 + 0.35;
            }
            case 'mandelbulb':
                return 4.2;
            case 'quat_julia':
                return 3.8;
            case 'kifs':
                return 4.5;
            case 'apollonian':
                return 4.8;
            case 'jerusalem':
                return 5.4;
            case 'juliabulb':
                return 4.0;
            case 'kalibox':
                return 4.8;
            case 'pseudo_kleinian':
                return 5.2;
            case 'box_bulb':
                return 5.0;
            default:
                return 6.5;
        }
    }

    renderFormulaPass(formula, targetFBO, camera, time, renderW, renderH, isMoving = false) {
        const gl = this.gl;
        const prog = this.getProgramForFormula(formula);
        if (!prog) return;

        const uniformMap = this.uniformLocationsMap.get(formula.id);
        if (!uniformMap) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, renderW, renderH);
        gl.useProgram(prog);
        gl.bindVertexArray(this.quadVAO);

        const set1f = (name, val) => {
            const loc = uniformMap.get(name);
            if (loc) gl.uniform1f(loc, val);
        };
        const set1i = (name, val) => {
            const loc = uniformMap.get(name);
            if (loc) gl.uniform1i(loc, val);
        };

        gl.uniform2f(uniformMap.get('u_resolution'), renderW, renderH);
        gl.uniform1f(uniformMap.get('u_time'), time);
        gl.uniform3fv(uniformMap.get('u_cam_pos'), camera.pos);
        gl.uniform3fv(uniformMap.get('u_cam_target'), camera.target);
        gl.uniform3fv(uniformMap.get('u_cam_up'), camera.getUpVector());
        gl.uniform1f(uniformMap.get('u_fov'), this.state.get('fov'));
        gl.uniform2f(uniformMap.get('u_subpixel_jitter'), 0.0, 0.0);

        // Bounding sphere radius culling (eliminates 40%-60% of sky raymarch steps)
        const boundRadius = this.computeSafeBoundingRadius(formula, this.state.values);
        set1f('u_bound_radius', boundRadius);

        // Dynamic shadow & AO tap allocation based on movement
        set1i('u_shadow_steps', isMoving ? 8 : 16);
        set1i('u_ao_taps', isMoving ? 2 : 4);

        // Adaptive max ray steps: guaranteed sufficient step budget while maintaining 60 FPS
        const userSteps = this.state.get('max_steps') ?? 140;
        const activeSteps = isMoving ? Math.min(105, Math.round(userSteps * 0.72)) : Math.min(150, userSteps);
        set1i('u_max_steps', activeSteps);
        const rawEps = this.state.get('hit_epsilon');
        const hitEps = (typeof rawEps === 'number' && rawEps <= 0.006) ? rawEps : 0.0012;
        set1f('u_hit_epsilon', hitEps);
        set1i('u_trap_mode', this.state.get('trap_mode'));
        set1f('u_color_cycle', this.state.get('color_cycle'));
        set1f('u_color_phase', this.state.get('color_phase'));
        set1f('u_pal_a_r', this.state.get('pal_a_r') ?? 0.65);
        set1f('u_pal_a_g', this.state.get('pal_a_g') ?? 0.42);
        set1f('u_pal_a_b', this.state.get('pal_a_b') ?? 0.28);
        set1f('u_pal_b_r', this.state.get('pal_b_r') ?? 0.38);
        set1f('u_pal_b_g', this.state.get('pal_b_g') ?? 0.26);
        set1f('u_pal_b_b', this.state.get('pal_b_b') ?? 0.18);
        set1f('u_pal_c_r', this.state.get('pal_c_r') ?? 1.0);
        set1f('u_pal_c_g', this.state.get('pal_c_g') ?? 1.0);
        set1f('u_pal_c_b', this.state.get('pal_c_b') ?? 1.0);
        set1f('u_pal_d_r', this.state.get('pal_d_r') ?? 0.0);
        set1f('u_pal_d_g', this.state.get('pal_d_g') ?? 0.12);
        set1f('u_pal_d_b', this.state.get('pal_d_b') ?? 0.25);
        set1f('u_roughness', this.state.get('roughness') ?? 0.35);
        set1f('u_metallic', this.state.get('metallic') ?? 0.25);
        set1f('u_sun_azimuth', this.state.get('sun_azimuth') ?? 0.76);
        set1f('u_sun_elevation', this.state.get('sun_elevation') ?? 0.9);
        set1f('u_sun_intensity', this.state.get('sun_intensity') ?? 1.60);
        set1f('u_sun_color_r', this.state.get('sun_color_r') ?? 1.0);
        set1f('u_sun_color_g', this.state.get('sun_color_g') ?? 0.92);
        set1f('u_sun_color_b', this.state.get('sun_color_b') ?? 0.80);
        set1f('u_sun_color_b', this.state.get('sun_color_b') ?? 0.80);
        set1f('u_shadow_softness', this.state.get('shadow_softness') ?? 12.0);
        set1f('u_shadow_softness', this.state.get('shadow_softness') ?? 12.0);
        set1f('u_ao_strength', this.state.get('ao_strength') ?? 0.7);
        set1f('u_backlight_intensity', this.state.get('backlight_intensity') ?? 1.2);
        set1f('u_backlight_elevation', this.state.get('backlight_elevation') ?? -0.3);
        set1f('u_rim_color_r', this.state.get('rim_color_r') ?? 0.45);
        set1f('u_rim_color_g', this.state.get('rim_color_g') ?? 0.65);
        set1f('u_rim_color_b', this.state.get('rim_color_b') ?? 0.90);
        set1f('u_glow_intensity', this.state.get('glow_intensity') ?? 0.05);
        set1f('u_glow_color_r', this.state.get('glow_color_r') ?? 0.06);
        set1f('u_glow_color_g', this.state.get('glow_color_g') ?? 0.8);
        set1f('u_glow_color_b', this.state.get('glow_color_b') ?? 1.0);
        set1f('u_fog_density', this.state.get('fog_density') ?? 0.15);

        // Near-clip culling: prevents camera close-up wall clipping and interior smears across all formulas
        if (formula.id === 'mandelbox') {
            set1f('u_near_clip', this.state.get('mbox_near_clip') ?? 0.05);
        } else {
            // Universal safety near-clip: drives from camera safe clearance to avoid interior wall smears
            const clearance = this.state.get('collision_clearance') ?? 0.02;
            const boundR = this.computeSafeBoundingRadius(formula, this.state.values) * 0.35;
            const safeNear = Math.max(0.015, clearance * boundR);
            set1f('u_near_clip', safeNear);
        }

        // Upload Active Formula Math Uniforms
        for (const p of formula.params) {
            const val = this.state.get(p.id) ?? p.default;
            if (p.type === 'int') {
                set1i(p.uniform, Math.round(val));
            } else {
                set1f(p.uniform, val);
            }
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    render(camera, time, isMovingOrModulating = false, currentFps = 60) {
        const gl = this.gl;

        // 1. Process GPU Timer Queries (disjoint-safe)
        if (this.timerExt) {
            while (this.gpuQueries.length > 0) {
                const queryInfo = this.gpuQueries[0];
                const available = gl.getQueryParameter(queryInfo.query, gl.QUERY_RESULT_AVAILABLE);
                const disjoint = gl.getParameter(this.timerExt.GPU_DISJOINT_EXT);

                if (available && !disjoint) {
                    const elapsedNs = gl.getQueryParameter(queryInfo.query, gl.QUERY_RESULT);
                    this.lastGpuMs = elapsedNs * 1e-6;
                    gl.deleteQuery(queryInfo.query);
                    this.gpuQueries.shift();
                } else if (available || disjoint) {
                    gl.deleteQuery(queryInfo.query);
                    this.gpuQueries.shift();
                } else {
                    break;
                }
            }
        }

        // 2. Discrete Frame-Budget Resolution Governor (Rolling 30 frames with hysteresis)
        const frameMs = 1000 / Math.max(1, currentFps);
        this.frameTimeHistory.push(frameMs);
        if (this.frameTimeHistory.length > 30) this.frameTimeHistory.shift();

        const avgFrameMs = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
        const nowMs = performance.now();
        const deltaGovernor = this._lastGovernorTime ? (nowMs - this._lastGovernorTime) : 16;
        this._lastGovernorTime = nowMs;
        const timeSinceLastScaleChange = nowMs - this.lastScaleChangeTime;

        const morph = this.state.formulaMorph;
        const isDoublePass = Boolean(morph && FORMULAS[morph.fromId] && FORMULAS[morph.toId]);

        let targetIndex = this.scaleIndex;
        // Step down fast if frame budget exceeds 19.5ms (> 350ms duration)
        if (avgFrameMs > 19.5) {
            this.overBudgetDuration += deltaGovernor;
            this.underBudgetDuration = 0;
            if (this.overBudgetDuration > 350 && timeSinceLastScaleChange > 400) {
                targetIndex = Math.min(this.scaleLevels.length - 1, this.scaleIndex + 1);
                this.overBudgetDuration = 0;
                this.lastScaleChangeTime = nowMs;
            }
        } else if (avgFrameMs < 14.0 && !isDoublePass && !isMovingOrModulating) {
            // Step up cautiously if ample headroom (< 14.0ms for > 1500ms)
            this.underBudgetDuration += deltaGovernor;
            this.overBudgetDuration = 0;
            if (this.underBudgetDuration > 1500 && timeSinceLastScaleChange > 1500) {
                targetIndex = Math.max(0, this.scaleIndex - 1);
                this.underBudgetDuration = 0;
                this.lastScaleChangeTime = nowMs;
            }
        } else {
            this.overBudgetDuration = 0;
            this.underBudgetDuration = 0;
        }

        this.scaleIndex = targetIndex;
        let effectiveIndex = this.scaleIndex;
        // Dual-pass cross-morphing requires 1 step lower scale to maintain 60 FPS
        if (isDoublePass && effectiveIndex === 0) {
            effectiveIndex = 1;
        }
        this.activeScale = this.scaleLevels[effectiveIndex];

        // 3. Keep Framebuffers statically sized to canvas (Zero per-frame reallocation!)
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;
        this.updateFBOs(canvasW, canvasH);

        // Sub-viewport resolution
        const renderW = Math.max(64, Math.round(canvasW * this.activeScale));
        const renderH = Math.max(64, Math.round(canvasH * this.activeScale));

        // 4. Begin GPU Timer Query for raymarch pass
        let activeQuery = null;
        if (this.timerExt && this.gpuQueries.length < 4) {
            activeQuery = gl.createQuery();
            gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, activeQuery);
        }

        let blendAmount = 0.0;
        if (isDoublePass) {
            blendAmount = morph.progress;
            const formulaA = FORMULAS[morph.fromId];
            const formulaB = FORMULAS[morph.toId];

            // Render Formula A into FBO A sub-viewport
            this.renderFormulaPass(formulaA, this.fboA, camera, time, renderW, renderH, isMovingOrModulating);

            // Render Formula B into FBO B sub-viewport
            this.renderFormulaPass(formulaB, this.fboB, camera, time, renderW, renderH, isMovingOrModulating);
        } else {
            const currentFormula = this.state.getActiveFormula();
            this.renderFormulaPass(currentFormula, this.fboA, camera, time, renderW, renderH, isMovingOrModulating);
        }

        // End GPU Timer Query
        if (activeQuery) {
            gl.endQuery(this.timerExt.TIME_ELAPSED_EXT);
            this.gpuQueries.push({ query: activeQuery });
        }

        // 5. Screen Composite & FXAA Anti-Aliasing with Sub-Viewport UV scaling
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvasW, canvasH);
        gl.useProgram(this.compositeProgram);
        gl.bindVertexArray(this.quadVAO);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTextureA);
        gl.uniform1i(this.compositeUniforms.u_tex_a, 0);

        if (blendAmount > 0.001) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.fboTextureB);
            gl.uniform1i(this.compositeUniforms.u_tex_b, 1);
        }

        gl.uniform1f(this.compositeUniforms.u_blend, blendAmount);
        gl.uniform2f(this.compositeUniforms.u_tex_size, this.fboWidth, this.fboHeight);
        gl.uniform2f(this.compositeUniforms.u_uv_scale, renderW / this.fboWidth, renderH / this.fboHeight);
        gl.uniform2f(this.compositeUniforms.u_render_size, renderW, renderH);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    getPerformanceMetrics() {
        return {
            scale: this.activeScale,
            gpuMs: this.lastGpuMs,
            hasGpuTimer: Boolean(this.timerExt)
        };
    }
}
