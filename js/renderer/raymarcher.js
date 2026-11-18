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

        // Resolution management (1.0x native full resolution for ultra-smooth gradients)
        this.activeScale = 1.0;
        this.targetScale = 1.0;
        this.stillFrames = 0;

        // Offscreen Framebuffers for smooth cross-morphing
        this.fboA = null;
        this.fboTextureA = null;
        this.fboB = null;
        this.fboTextureB = null;
        this.fboWidth = 0;
        this.fboHeight = 0;

        // Composite shader program
        this.compositeProgram = null;

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
            vec2 rcpFrame = vec2(1.0) / max(vec2(1.0), u_tex_size);
            vec3 colA = sampleFXAA(u_tex_a, v_uv, rcpFrame);
            vec3 rawCol;
            
            if (u_blend > 0.001) {
                vec3 colB = sampleFXAA(u_tex_b, v_uv, rcpFrame);
                // Quintic smoothstep for seamless organic transition
                float t = clamp(u_blend, 0.0, 1.0);
                float s = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
                rawCol = mix(colA, colB, s);
            } else {
                rawCol = colA;
            }
            
            vec3 mapped = aces(rawCol * 0.92);
            mapped = pow(mapped, vec3(1.0 / 2.2));
            float dither = bayer4x4(gl_FragCoord.xy) * 1.5;
            fragColor = vec4(clamp(mapped + vec3(dither), 0.0, 1.0), 1.0);
        }`;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fsComp = this.compileShader(gl.FRAGMENT_SHADER, fsCompositeSource);
        this.compositeProgram = this.createProgram(vs, fsComp);
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

// High-fidelity Continuous Soft Shadow
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 28; i++) {
        if (t >= maxt) break;
        float h = map(ro + rd * t);
        if (h < 0.0005) return 0.0;
        res = min(res, k * h / t);
        t += clamp(h * 0.75, 0.004, 0.20);
    }
    return clamp(res, 0.0, 1.0);
}

// High-efficiency 4-tap Ambient Occlusion
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 4; i++) {
        float h = 0.01 + 0.12 * float(i) / 3.0;
        float d = map(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.75;
    }
    return clamp(1.0 - u_ao_strength * occ, 0.0, 1.0);
}

// High-performance procedural celestial starfield
vec3 hashStar(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx);
}

// Ultra-fine, subtle celestial starfield: tiny pinpricks, delicate and non-intrusive
vec3 getStarField(vec3 dir) {
    vec3 stars = vec3(0.0);
    
    // Layer 1: Tiny, delicate distant pinprick stars
    {
        vec3 p = dir * 420.0;
        vec3 ip = floor(p);
        vec3 fp = fract(p) - 0.5;
        vec3 rnd = hashStar(ip);
        vec3 offset = (rnd - 0.5) * 0.70;
        float d = length(fp - offset);
        // Extremely sharp falloff -> pure tiny subpixel pinprick
        float star = pow(max(0.0, 1.0 - d * 6.5), 36.0);
        float brightness = step(0.965, rnd.x) * (rnd.y * 0.35 + 0.15);
        vec3 starCol = mix(vec3(0.70, 0.85, 1.0), vec3(1.0, 0.95, 0.85), rnd.z);
        stars += starCol * (star * brightness);
    }
    
    // Layer 2: Occasional slightly brighter tiny star (still sharp pinprick, no large halo)
    {
        vec3 p = dir * 240.0;
        vec3 ip = floor(p);
        vec3 fp = fract(p) - 0.5;
        vec3 rnd = hashStar(ip + 51.3);
        vec3 offset = (rnd - 0.5) * 0.70;
        float d = length(fp - offset);
        float star = pow(max(0.0, 1.0 - d * 5.0), 32.0);
        float brightness = step(0.985, rnd.x) * (rnd.y * 0.45 + 0.25);
        vec3 starCol = mix(vec3(0.80, 0.90, 1.0), vec3(1.0, 0.88, 0.75), rnd.z);
        stars += starCol * (star * brightness);
    }
    
    return stars;
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
    float t = max(0.01, u_near_clip);
    float maxDist = 32.0;
    vec4 trap = vec4(100.0);
    vec4 finalTrap = vec4(0.0);
    int stepCount = 0;
    float glow = 0.0;
    bool hit = false;
    
    for (int i = 0; i < 1000; i++) {
        if (i >= u_max_steps || t > maxDist) break;
        stepCount = i;
        vec3 curPos = ro + rd * t;
        float d = mapFractal(curPos, trap);
        
        // Fast polynomial volumetric glow (culled in near clearance zone)
        if (u_glow_intensity > 0.005 && t >= u_near_clip) {
            float g = max(0.0, 1.0 - d * 2.5);
            glow += g * g;
        }
        
        float hitThresh = u_hit_epsilon * (1.0 + t * 0.04);
        if (d < hitThresh) {
            // Near-clip culling: completely do not draw pieces too close to camera
            if (t < u_near_clip) {
                t += max(0.05, abs(d) + 0.02);
                continue;
            }
            hit = true;
            finalTrap = trap;
            break;
        }
        // Conservative 0.65x ray relaxation: prevents ray overshooting & saw-tooth jagged steps on grazing edges
        t += max(u_hit_epsilon * 0.35, d * 0.65);
    }
    
    vec3 sunDir = normalize(vec3(
        cos(u_sun_azimuth) * cos(u_sun_elevation),
        sin(u_sun_elevation),
        sin(u_sun_azimuth) * cos(u_sun_elevation)
    ));
    
    vec3 glowColor = vec3(u_glow_color_r, u_glow_color_g, u_glow_color_b);
    // Dark celestial midnight navy gradient with celestial stars
    vec3 skyTop = vec3(0.006, 0.014, 0.038);
    vec3 skyBottom = vec3(0.002, 0.004, 0.012);
    vec3 skyBg = mix(skyBottom, skyTop, clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = skyBg + getStarField(rd);
    
    if (hit) {
        vec3 pos = ro + rd * t;
        vec3 nor = calcNormal(pos, max(0.0006, u_hit_epsilon * 0.5));
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
        
        // Deep crevice weathering
        albedo = mix(albedo * 0.65, albedo, clamp(ao * 1.2, 0.0, 1.0));
        
        vec3 sunColor = vec3(u_sun_color_r, u_sun_color_g, u_sun_color_b);
        if (length(sunColor) < 0.1) sunColor = vec3(1.0, 0.92, 0.80);
        vec3 rimColor = vec3(u_rim_color_r, u_rim_color_g, u_rim_color_b);
        if (length(rimColor) < 0.1) rimColor = vec3(0.45, 0.65, 0.90);
        
        // Main Sun Light - fully continuous shadow and diffuse, zero step clamp
        float dif = clamp(dot(nor, sunDir), 0.0, 1.0);
        float sha = (dif > 0.001) ? softShadow(pos + nor * 0.015, sunDir, 0.025, 5.0, u_shadow_softness) : 0.0;
        
        // Specular highlight (Fresnel + Blinn-Phong)
        vec3 hal = normalize(sunDir - rd);
        float spe = pow(clamp(dot(nor, hal), 0.0, 1.0), 32.0 / max(0.01, u_roughness));
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
            'u_max_steps', 'u_hit_epsilon', 'u_trap_mode', 'u_color_cycle', 'u_color_phase',
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

        // Adaptive max ray steps: guaranteed sufficient step budget for smooth conservative 0.65x stepping
        const userSteps = this.state.get('max_steps') ?? 220;
        const activeSteps = isMoving ? Math.max(180, Math.min(userSteps, Math.round(userSteps * 0.85))) : Math.max(220, userSteps);
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
        set1f('u_shadow_softness', this.state.get('shadow_softness') ?? 12.0);
        set1f('u_ao_strength', this.state.get('ao_strength') ?? 0.7);
        set1f('u_backlight_intensity', this.state.get('backlight_intensity') ?? 1.2);
        set1f('u_backlight_elevation', this.state.get('backlight_elevation') ?? -0.3);
        set1f('u_rim_color_r', this.state.get('rim_color_r') ?? 0.45);
        set1f('u_rim_color_g', this.state.get('rim_color_g') ?? 0.65);
        set1f('u_rim_color_b', this.state.get('rim_color_b') ?? 0.90);
        set1f('u_glow_intensity', this.state.get('glow_intensity') ?? 0.15);
        set1f('u_glow_color_r', this.state.get('glow_color_r') ?? 0.06);
        set1f('u_glow_color_g', this.state.get('glow_color_g') ?? 0.8);
        set1f('u_glow_color_b', this.state.get('glow_color_b') ?? 1.0);
        set1f('u_fog_density', this.state.get('fog_density') ?? 0.15);

        // Near-clip culling: only active for Mandelbox to prevent camera close-up wall clipping
        if (formula.id === 'mandelbox') {
            set1f('u_near_clip', this.state.get('mbox_near_clip') ?? 0.70);
        } else {
            set1f('u_near_clip', 0.0);
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

    render(camera, time, isMovingOrModulating = false) {
        const gl = this.gl;

        // Always render at native full 1:1 resolution for clean, un-pixelated graphics
        this.activeScale = 1.0;
        const renderW = Math.max(64, this.canvas.width);
        const renderH = Math.max(64, this.canvas.height);
        this.updateFBOs(renderW, renderH);

        const morph = this.state.formulaMorph;
        let blendAmount = 0.0;

        if (morph && FORMULAS[morph.fromId] && FORMULAS[morph.toId]) {
            blendAmount = morph.progress;
            const formulaA = FORMULAS[morph.fromId];
            const formulaB = FORMULAS[morph.toId];

            // Render Formula A into FBO A
            this.renderFormulaPass(formulaA, this.fboA, camera, time, renderW, renderH, isMovingOrModulating);

            // Render Formula B into FBO B
            this.renderFormulaPass(formulaB, this.fboB, camera, time, renderW, renderH, isMovingOrModulating);
        } else {
            const currentFormula = this.state.getActiveFormula();
            this.renderFormulaPass(currentFormula, this.fboA, camera, time, renderW, renderH, isMovingOrModulating);
        }

        // --- DIRECT SCREEN COMPOSITE & BLEND PASS (WITH FXAA ANTI-ALIASING) ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(this.compositeProgram);
        gl.bindVertexArray(this.quadVAO);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTextureA);
        gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_tex_a'), 0);

        if (blendAmount > 0.001) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.fboTextureB);
            gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_tex_b'), 1);
        }

        gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_blend'), blendAmount);
        gl.uniform2f(gl.getUniformLocation(this.compositeProgram, 'u_tex_size'), renderW, renderH);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
