// js/camera/controller.js
// Dual camera system: Full 360-Degree Spherical Trackball Orbit + 6-DOF Proximity-Scaled Free-Flight

import { FORMULAS } from '../formulas/registry.js';

function rotateVec(v, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const cx = axis[1] * v[2] - axis[2] * v[1];
    const cy = axis[2] * v[0] - axis[0] * v[2];
    const cz = axis[0] * v[1] - axis[1] * v[0];
    const dot = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
    const factor = dot * (1.0 - c);
    return [
        v[0] * c + cx * s + axis[0] * factor,
        v[1] * c + cy * s + axis[1] * factor,
        v[2] * c + cz * s + axis[2] * factor
    ];
}

function normalizeVec(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1.0;
    return [v[0] / len, v[1] / len, v[2] / len];
}

function crossVec(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

export class CameraController {
    constructor(canvas, onMoveCallback) {
        this.canvas = canvas;
        this.onMove = onMoveCallback;

        // Camera Modes
        this.mode = 'orbit'; // 'orbit' | 'flight'

        // Coordinates & Orthonormal Frame (Default: Mandelbulb framing)
        this.pos = [0.0, 0.0, 2.35];
        this.target = [0.0, 0.0, 0.0];
        this.up = [0.0, 1.0, 0.0];
        this.orbitRadius = 2.35;
        this.idealDistance = 2.35;

        // Manual Zoom Override State & Heavy Inertial Zoom Physics
        this.isZoomOverridden = false;
        this.onZoomOverrideChange = null;
        this.targetOrbitRadius = 2.35;
        this.zoomDamping = 5.2; // Heavy viscous damping: cinematic weighty glide
        this.zoomSensitivity = 0.00042; // Controlled, weighted zoom step per wheel notch

        // Flight rotation euler (yaw, pitch, roll)
        this.yaw = 0.0;
        this.pitch = 0.0;
        this.roll = 0.0;

        // Moment of Inertia (Full 360 Unconstrained Angular Velocity)
        this.angularVelYaw = 0.0;
        this.angularVelPitch = 0.0;
        this.inertiaFriction = 0.978; // Sustained monumental flywheel inertia (heavy physical mass)
        this.dragResponsiveness = 0.00065; // Heavy mass resistance to mouse dragging

        // Flight controls state
        this.keys = {};
        this.isPointerLocked = false;
        this.isDraggingOrbit = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Proximity Flight Speed Scaling
        this.baseFlightSpeed = 0.8;
        this.speedMultiplier = 1.0;
        this.currentDE = 1.0; // Distance to fractal surface
        this.currentSpeed = 0.5;

        // Auto-Rotation Turntable (Gentle, majestic, slow multi-axis drift in all directions)
        this.autoRotate = true;
        this.autoRotateSpeed = 0.012; // Slowed down 3X for serene, majestic drift
        this.autoRotatePitchSpeed = 0.005; // Slowed down 3.2X

        // Cinematic Camera Presets ('turntable' | 'action' | 'flyby' | 'follow' | 'dynamic' | 'hero')
        this.activeCameraPreset = 'turntable';
        this.presetTime = 0.0;
        this.presetBlendProgress = 1.0;
        this.presetBlendDuration = 2.5; // 2.5 seconds seamless spherical cinematic crossfade
        this.transitionStartPos = [0.0, 0.0, 1.2];
        this.transitionStartTarget = [0.0, 0.0, 0.0];

        // Collision Avoidance & Safety Bubble State
        this.collisionEnabled = true;
        this.collisionClearance = 0.02; // Clearance ratio relative to object radius
        this.safeRadius = 0.045; // Absolute clearance distance in world units
        this.collisionProvider = null; // (pos) => surfaceDE
        this.collisionSuspended = false;
        this.lastSafePos = [0.0, 0.0, 1.2];
        this.lastSafeTarget = [0.0, 0.0, 0.0];
        this.collisionPushed = false;
        this.objRadius = 1.5;

        this.hasMoved = true;
        this.setupInputListeners();
    }

    setCollisionProvider(fn) {
        this.collisionProvider = fn;
    }

    setCollisionSettings(enabled, clearance) {
        this.collisionEnabled = Boolean(enabled);
        if (typeof clearance === 'number' && clearance > 0) {
            this.collisionClearance = clearance;
        }
    }

    estimateNormal(pos, eps = 0.005) {
        if (!this.collisionProvider) return [0, 1, 0];
        const k0 = [1.0, -1.0, -1.0];
        const k1 = [-1.0, -1.0, 1.0];
        const k2 = [-1.0, 1.0, -1.0];
        const k3 = [1.0, 1.0, 1.0];

        const d0 = this.collisionProvider([pos[0] + k0[0] * eps, pos[1] + k0[1] * eps, pos[2] + k0[2] * eps]);
        const d1 = this.collisionProvider([pos[0] + k1[0] * eps, pos[1] + k1[1] * eps, pos[2] + k1[2] * eps]);
        const d2 = this.collisionProvider([pos[0] + k2[0] * eps, pos[1] + k2[1] * eps, pos[2] + k2[2] * eps]);
        const d3 = this.collisionProvider([pos[0] + k3[0] * eps, pos[1] + k3[1] * eps, pos[2] + k3[2] * eps]);

        let nx = k0[0] * d0 + k1[0] * d1 + k2[0] * d2 + k3[0] * d3;
        let ny = k0[1] * d0 + k1[1] * d1 + k2[1] * d2 + k3[1] * d3;
        let nz = k0[2] * d0 + k1[2] * d1 + k2[2] * d2 + k3[2] * d3;

        let len = Math.hypot(nx, ny, nz);
        if (len < 1e-6) {
            nx = pos[0] - this.target[0];
            ny = pos[1] - this.target[1];
            nz = pos[2] - this.target[2];
            len = Math.hypot(nx, ny, nz) || 1.0;
        }
        return [nx / len, ny / len, nz / len];
    }

    resolveCollision(pos, minClearance = null) {
        if (!this.collisionEnabled || !this.collisionProvider) return false;
        const R_safe = minClearance !== null ? minClearance : this.safeRadius;
        let de = this.collisionProvider(pos);

        // Vector from target to camera pos (radial outward direction)
        const dx = pos[0] - this.target[0];
        const dy = pos[1] - this.target[1];
        const dz = pos[2] - this.target[2];
        const curR = Math.hypot(dx, dy, dz) || 1.0;
        const outX = dx / curR;
        const outY = dy / curR;
        const outZ = dz / curR;

            // Inside solid or non-numerical value: raymarch outward along radial vector until safely outside
            // Completely prevents the camera from ever staying inside or teleporting into geometry
            if (isNaN(de) || de <= 0.0005) {
                let totalPush = 0.0;
                for (let step = 0; step < 16; step++) {
                    const pushStep = Math.max(0.04, R_safe * 1.25);
                    pos[0] += outX * pushStep;
                    pos[1] += outY * pushStep;
                    pos[2] += outZ * pushStep;
                    totalPush += pushStep;
                    de = this.collisionProvider(pos);
                    if (!isNaN(de) && de >= R_safe) break;
                }
                if (this.mode === 'orbit') {
                    const newDist = curR + totalPush;
                    this.orbitRadius = Math.max(this.orbitRadius, newDist);
                    this.targetOrbitRadius = Math.max(this.targetOrbitRadius, newDist);
                }
                return true;
            }

            if (de >= R_safe) {
                return false;
            }

            // Push out iteratively along combined surface normal and radial direction
            let corrected = false;
                for (let iter = 0; iter < 4; iter++) {
                    if (de >= R_safe) break;
                    const norm = this.estimateNormal(pos, Math.max(0.002, R_safe * 0.25));
                    const pushX = norm[0] * 0.7 + outX * 0.3;
                    const pushY = norm[1] * 0.7 + outY * 0.3;
                    const pushZ = norm[2] * 0.7 + outZ * 0.3;
                    const pushLen = Math.hypot(pushX, pushY, pushZ) || 1.0;

                    const pushDist = (R_safe - de) * 1.15;
                    pos[0] += (pushX / pushLen) * pushDist;
                    pos[1] += (pushY / pushLen) * pushDist;
                    pos[2] += (pushZ / pushLen) * pushDist;
                    corrected = true;
                    de = this.collisionProvider(pos);
                    if (isNaN(de) || de <= 0.0005) break;
                }

                // When in orbit mode, synchronize orbit radius with the corrected distance
                // Prevents the camera from penetrating inside the shape when rotating or zooming
                if (corrected && this.mode === 'orbit') {
                    const newDist = Math.hypot(pos[0] - this.target[0], pos[1] - this.target[1], pos[2] - this.target[2]);
                    if (newDist > this.orbitRadius) {
                        this.orbitRadius = newDist;
                        this.targetOrbitRadius = newDist;
                    }
                }

                return corrected;
            }

            // Distance estimate at radius r along the current camera->target ray (orbit mode)
    deAtRadius(dir, r) {
        const p = [this.target[0] + dir[0] * r, this.target[1] + dir[1] * r, this.target[2] + dir[2] * r];
        const d = this.collisionProvider(p);
        return isNaN(d) ? 0.0 : d;
    }

    // Silky orbit clearance: never teleports. Eases the camera outward with a critically-damped
    // exponential whenever it enters the soft zone around the surface, so the camera "glides off"
    // the shape instead of bouncing.
    smoothOrbitClearance(dt) {
        const soft = this.safeRadius * 2.5;
        const off = [this.pos[0] - this.target[0], this.pos[1] - this.target[1], this.pos[2] - this.target[2]];
        const curR = Math.hypot(off[0], off[1], off[2]);
        if (curR < 1e-6) return false;
        const dir = [off[0] / curR, off[1] / curR, off[2] / curR];
        if (this.deAtRadius(dir, curR) >= soft) return false;

        // Find the nearest clear radius further out along the ray
        let needR = curR;
        for (let i = 0; i < 40; i++) {
            needR += 0.04 + i * 0.01;
            if (this.deAtRadius(dir, needR) >= soft) break;
        }
        const k = 1.0 - Math.exp(-6.0 * dt);
        const newR = curR + (needR - curR) * k;
        this.pos[0] = this.target[0] + dir[0] * newR;
        this.pos[1] = this.target[1] + dir[1] * newR;
        this.pos[2] = this.target[2] + dir[2] * newR;
        this.orbitRadius = newR;
        this.targetOrbitRadius = Math.max(this.targetOrbitRadius, newR);
        this.hasMoved = true;
        return true;
    }

    // True if moving to radius r (same direction) would enter the surface soft zone
    wouldEnterSurface(r) {
        if (!this.collisionEnabled || !this.collisionProvider || this.collisionSuspended) return false;
        const off = [this.pos[0] - this.target[0], this.pos[1] - this.target[1], this.pos[2] - this.target[2]];
        const curR = Math.hypot(off[0], off[1], off[2]);
        if (curR < 1e-6) return false;
        const dir = [off[0] / curR, off[1] / curR, off[2] / curR];
        return this.deAtRadius(dir, r) < this.safeRadius * 3.0;
    }

    setMode(newMode) {
                if (this.mode === newMode) return;
                this.mode = newMode;
                if (newMode === 'flight') {
                    // Compute yaw and pitch from current vector towards target
                    const dx = this.target[0] - this.pos[0];
                    const dy = this.target[1] - this.pos[1];
                    const dz = this.target[2] - this.pos[2];
                    this.yaw = Math.atan2(dx, -dz);
                    const distXZ = Math.hypot(dx, dz);
                    this.pitch = Math.atan2(dy, distXZ);
                    this.roll = 0;
                } else {
                    // Exit pointer lock if active
                    if (document.pointerLockElement === this.canvas) {
                        document.exitPointerLock();
                    }
                    const dx = this.pos[0] - this.target[0];
                    const dy = this.pos[1] - this.target[1];
                    const dz = this.pos[2] - this.target[2];
                    this.orbitRadius = Math.max(0.01, Math.hypot(dx, dy, dz));
                }
                this.hasMoved = true;
            }

            setZoomOverridden(overridden) {
                if (this.isZoomOverridden !== overridden) {
                    this.isZoomOverridden = overridden;
                    if (this.onZoomOverrideChange) {
                        this.onZoomOverrideChange(this.isZoomOverridden);
                    }
                }
            }

            resetToDefaultZoom() {
                this.setZoomOverridden(false);
                this.targetOrbitRadius = this.idealDistance;
                this.hasMoved = true;
            }

            reset(pos, target) {
                this.resetView(pos, target);
            }

            resetView(pos, target) {
                this.pos = [...pos];
                this.target = [...target];
                this.up = [0.0, 1.0, 0.0];
                const dx = this.pos[0] - this.target[0];
                const dy = this.pos[1] - this.target[1];
                const dz = this.pos[2] - this.target[2];
                this.orbitRadius = Math.max(0.01, Math.hypot(dx, dy, dz));
                this.targetOrbitRadius = this.orbitRadius;
                this.angularVelYaw = 0.0;
                this.angularVelPitch = 0.0;
                this.yaw = Math.atan2(-dx, -dz);
                this.pitch = 0;
                this.roll = 0;
                this.activeCameraPreset = 'turntable';
                this.presetTime = 0.0;
                this.setZoomOverridden(false);
                this.hasMoved = true;
            }

            setCameraPreset(presetName) {
                if (this.activeCameraPreset === presetName) return;
                this.transitionStartPos = [...this.pos];
                this.transitionStartTarget = [...this.target];
                this.presetBlendProgress = 0.0;
                this.activeCameraPreset = presetName;
                if (this.mode !== 'orbit') {
                    this.setMode('orbit');
                }
                this.hasMoved = true;
            }

            applyCameraPreset(dt) {
                // Canonical authored distance for the active formula (dramatic, immersive framing)
                const baseR = this.idealDistance || 1.6;
                const zoomScale = this.isZoomOverridden ? (this.orbitRadius / baseR) : 1.0;
                const R = baseR * zoomScale;

                // Keep target centered strictly on origin [0, 0, 0] across all presets
                // Eliminates the issue where fractals were shoved to the right hand side of the screen
                let goalTx = 0.0, goalTy = 0.0, goalTz = 0.0;
                let goalPx = this.pos[0], goalPy = this.pos[1], goalPz = this.pos[2];

                if (this.activeCameraPreset === 'turntable') {
                    // Smoothly return to canonical orbit turntable
                    const offset = [
                        this.pos[0] - this.target[0],
                        this.pos[1] - this.target[1],
                        this.pos[2] - this.target[2]
                    ];
                    const curDist = Math.hypot(offset[0], offset[1], offset[2]) || 1.0;
                    goalPx = this.target[0] + (offset[0] / curDist) * R;
                    goalPy = this.target[1] + (offset[1] / curDist) * R;
                    goalPz = this.target[2] + (offset[2] / curDist) * R;
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                } else if (this.activeCameraPreset === 'action') {
                    // Action Cam: Serene cinema fly-around
                    const t = this.presetTime * 0.18;
                    const rMod = R * (1.0 + 0.06 * Math.sin(2.2 * t));
                    goalPx = rMod * Math.cos(t);
                    goalPy = R * 0.22 * Math.cos(1.6 * t);
                    goalPz = rMod * Math.sin(t);

                    // Subtle organic breathing
                    const shakeX = 0.0012 * Math.sin(t * 8.0);
                    const shakeY = 0.0012 * Math.cos(t * 9.0);
                    const shakeZ = 0.0008 * Math.sin(t * 11.0);
                    goalPx += shakeX; goalPy += shakeY; goalPz += shakeZ;
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                } else if (this.activeCameraPreset === 'flyby') {
                    // Fly-By Cam: Sweeping majestic slalom
                    const t = this.presetTime * 0.09;
                    const flyR = R * (1.04 + 0.06 * Math.sin(t * 1.5));
                    goalPx = flyR * Math.sin(t);
                    goalPy = R * 0.28 * Math.sin(2.0 * t);
                    goalPz = flyR * Math.cos(t);
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                } else if (this.activeCameraPreset === 'follow') {
                    // Follow Cam: Centered contour glide
                    const t = this.presetTime * 0.07;
                    const followR = R * 0.96;
                    goalPx = followR * Math.cos(t);
                    goalPy = followR * 0.18 * Math.sin(t * 2.0);
                    goalPz = followR * Math.sin(t);
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                } else if (this.activeCameraPreset === 'dynamic') {
                    // Dynamic Cam: Hypnotic slow vortex dive
                    const t = this.presetTime * 0.08;
                    const spiralR = R * (0.96 + 0.08 * Math.sin(t * 0.55));
                    goalPx = spiralR * Math.sin(t);
                    goalPy = R * 0.32 * Math.cos(t * 0.55);
                    goalPz = spiralR * Math.cos(t);
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                } else if (this.activeCameraPreset === 'hero') {
                    // Hero Shot: Monumental low-angle panoramic tilt
                    const t = this.presetTime * 0.04;
                    const heroR = R * 0.94;
                    goalPx = heroR * Math.sin(t);
                    goalPy = -R * 0.22 + 0.04 * Math.sin(t * 0.8);
                    goalPz = heroR * Math.cos(t);
                    goalTx = 0.0; goalTy = 0.0; goalTz = 0.0;
                }

                // Seamless spherical slerp crossfade: glides gracefully around the orbital perimeter
                // Completely prevents cutting through the center/core of the fractal during preset transitions
                if (this.presetBlendProgress < 1.0) {
                    this.presetBlendProgress = Math.min(1.0, this.presetBlendProgress + dt / this.presetBlendDuration);
                    const rawT = this.presetBlendProgress;
                    // Quintic smoothstep for zero acceleration jump at start and end
                    const blendT = rawT * rawT * rawT * (rawT * (rawT * 6.0 - 15.0) + 10.0);
                    
                    const startOff = [
                        this.transitionStartPos[0] - this.transitionStartTarget[0],
                        this.transitionStartPos[1] - this.transitionStartTarget[1],
                        this.transitionStartPos[2] - this.transitionStartTarget[2]
                    ];
                    const goalOff = [
                        goalPx - goalTx,
                        goalPy - goalTy,
                        goalPz - goalTz
                    ];
                    const startDist = Math.hypot(startOff[0], startOff[1], startOff[2]) || 1.0;
                    const goalDist = Math.hypot(goalOff[0], goalOff[1], goalOff[2]) || 1.0;
                    
                    const uA = [startOff[0] / startDist, startOff[1] / startDist, startOff[2] / startDist];
                    const uB = [goalOff[0] / goalDist, goalOff[1] / goalDist, goalOff[2] / goalDist];
                    
                    let dot = Math.max(-1.0, Math.min(1.0, uA[0] * uB[0] + uA[1] * uB[1] + uA[2] * uB[2]));
                    let dir;
                    if (dot > 0.9995) {
                        dir = [
                            uA[0] + (uB[0] - uA[0]) * blendT,
                            uA[1] + (uB[1] - uA[1]) * blendT,
                            uA[2] + (uB[2] - uA[2]) * blendT
                        ];
                    } else {
                        const theta = Math.acos(dot);
                        const sinTheta = Math.sin(theta);
                        const wA = Math.sin((1.0 - blendT) * theta) / sinTheta;
                        const wB = Math.sin(blendT * theta) / sinTheta;
                        dir = [
                            uA[0] * wA + uB[0] * wB,
                            uA[1] * wA + uB[1] * wB,
                            uA[2] * wA + uB[2] * wB
                        ];
                    }
                    const dirLen = Math.hypot(dir[0], dir[1], dir[2]) || 1.0;
                    const blendRadius = startDist + (goalDist - startDist) * blendT;
                    
                    goalTx = this.transitionStartTarget[0] + (goalTx - this.transitionStartTarget[0]) * blendT;
                    goalTy = this.transitionStartTarget[1] + (goalTy - this.transitionStartTarget[1]) * blendT;
                    goalTz = this.transitionStartTarget[2] + (goalTz - this.transitionStartTarget[2]) * blendT;
                    
                    goalPx = goalTx + (dir[0] / dirLen) * blendRadius;
                    goalPy = goalTy + (dir[1] / dirLen) * blendRadius;
                    goalPz = goalTz + (dir[2] / dirLen) * blendRadius;
                }

                // Heavy, silky-smooth fluid camera head damping
                const lerpSpeed = 1.0 - Math.exp(-2.2 * dt);
                this.pos[0] += (goalPx - this.pos[0]) * lerpSpeed;
                this.pos[1] += (goalPy - this.pos[1]) * lerpSpeed;
                this.pos[2] += (goalPz - this.pos[2]) * lerpSpeed;
                this.target[0] += (goalTx - this.target[0]) * lerpSpeed;
                this.target[1] += (goalTy - this.target[1]) * lerpSpeed;
                this.target[2] += (goalTz - this.target[2]) * lerpSpeed;

                this.orbitRadius = Math.hypot(this.pos[0] - this.target[0], this.pos[1] - this.target[1], this.pos[2] - this.target[2]);
                this.hasMoved = true;
            }

            setupInputListeners() {
                // Keyboard
                window.addEventListener('keydown', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                    this.keys[e.code] = true;
                    if (e.code === 'KeyV') {
                        this.setMode(this.mode === 'orbit' ? 'flight' : 'orbit');
                    }
                });

                window.addEventListener('keyup', (e) => {
                    this.keys[e.code] = false;
                });

                // Mouse Drag Controls
                this.canvas.addEventListener('mousedown', (e) => {
                    if (this.mode === 'orbit') {
                        this.isDraggingOrbit = true;
                        this.lastMouseX = e.clientX;
                        this.lastMouseY = e.clientY;
                        this.angularVelYaw = 0.0;
                        this.angularVelPitch = 0.0;
                    } else if (this.mode === 'flight') {
                        if (!this.isPointerLocked) {
                            this.canvas.requestPointerLock();
                        }
                    }
                });

                window.addEventListener('mouseup', () => {
                    this.isDraggingOrbit = false;
                });

                window.addEventListener('mousemove', (e) => {
                    if (this.mode === 'flight') {
                        if (document.pointerLockElement === this.canvas) {
                            const sens = 0.0022;
                            this.yaw += e.movementX * sens;
                            this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * sens));
                            this.hasMoved = true;
                        }
                    } else if (this.isDraggingOrbit) {
                        const dx = e.clientX - this.lastMouseX;
                        const dy = e.clientY - this.lastMouseY;
                        this.lastMouseX = e.clientX;
                        this.lastMouseY = e.clientY;

                        if (e.buttons === 1) { // Left drag -> Heavy moment of inertia 360 orbit
                            const targetVelX = dx * 0.0028;
                            const targetVelY = dy * 0.0028;
                            // Heavy physical flywheel drag: smoothly accumulates torque with mass resistance
                            this.angularVelYaw += (targetVelX - this.angularVelYaw) * 0.22;
                            this.angularVelPitch += (targetVelY - this.angularVelPitch) * 0.22;
                            this.rotateOrbit(this.angularVelYaw, this.angularVelPitch);
                        } else if (e.buttons === 2) { // Right drag -> Pan
                            const panSpeed = this.orbitRadius * 0.0015;
                            const right = this.getRightVector();
                            const up = this.getUpVector();

                            this.target[0] -= (right[0] * dx - up[0] * dy) * panSpeed;
                            this.target[1] -= (right[1] * dx - up[1] * dy) * panSpeed;
                            this.target[2] -= (right[2] * dx - up[2] * dy) * panSpeed;
                            this.pos[0] -= (right[0] * dx - up[0] * dy) * panSpeed;
                            this.pos[1] -= (right[1] * dx - up[1] * dy) * panSpeed;
                            this.pos[2] -= (right[2] * dx - up[2] * dy) * panSpeed;
                            this.hasMoved = true;
                        }
                    }
                });

                // Heavy Inertial Wheel Zoom (Buttery smooth exponential glide with physical mass feeling)
                this.canvas.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    if (this.mode === 'orbit') {
                        this.setZoomOverridden(true);
                        // Clamp delta to prevent platform-specific mousewheel surges
                        const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));

                        // Keep target synced if external systems changed orbitRadius
                        if (Math.abs(this.targetOrbitRadius - this.orbitRadius) > 3.0) {
                            this.targetOrbitRadius = this.orbitRadius;
                        }

                        // Weighted exponential distance scaling
                        const zoomFactor = Math.exp(clampedDelta * this.zoomSensitivity);
                        this.targetOrbitRadius = Math.max(0.04, Math.min(60.0, this.targetOrbitRadius * zoomFactor));
                    } else {
                        this.speedMultiplier = Math.max(0.1, Math.min(10.0, this.speedMultiplier * (e.deltaY < 0 ? 1.15 : 0.87)));
                    }
                }, { passive: false });

                // Mobile Touch Gestures (1-finger 360 orbit + momentum, 2-finger pinch-zoom & pan)
                let initialPinchDist = 0;
                let initialRadius = this.orbitRadius;
                let lastTouchX = 0;
                let lastTouchY = 0;

                this.canvas.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 1) {
                        this.isDraggingOrbit = true;
                        lastTouchX = e.touches[0].clientX;
                        lastTouchY = e.touches[0].clientY;
                        this.angularVelYaw = 0.0;
                        this.angularVelPitch = 0.0;
                    } else if (e.touches.length === 2) {
                        this.isDraggingOrbit = false;
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        initialPinchDist = Math.hypot(dx, dy);
                        initialRadius = this.orbitRadius;
                        lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
                        lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
                    }
                }, { passive: true });

                this.canvas.addEventListener('touchmove', (e) => {
                    if (e.touches.length === 1 && this.isDraggingOrbit) {
                        if (e.cancelable) e.preventDefault();
                        const curX = e.touches[0].clientX;
                        const curY = e.touches[0].clientY;
                        const dx = curX - lastTouchX;
                        const dy = curY - lastTouchY;
                        lastTouchX = curX;
                        lastTouchY = curY;

                        const targetVelX = dx * 0.0028;
                        const targetVelY = dy * 0.0028;
                        this.angularVelYaw += (targetVelX - this.angularVelYaw) * 0.22;
                        this.angularVelPitch += (targetVelY - this.angularVelPitch) * 0.22;
                        this.rotateOrbit(this.angularVelYaw, this.angularVelPitch);
                    } else if (e.touches.length === 2) {
                        if (e.cancelable) e.preventDefault();
                        // Pinch to Zoom
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        const currentPinchDist = Math.hypot(dx, dy);
                        if (initialPinchDist > 5 && currentPinchDist > 5) {
                            const ratio = initialPinchDist / currentPinchDist;
                            if (Math.abs(ratio - 1.0) > 0.02) {
                                this.setZoomOverridden(true);
                            }
                            const targetRadius = Math.max(0.02, Math.min(60.0, initialRadius * ratio));
                            const currentOffset = [
                                this.pos[0] - this.target[0],
                                this.pos[1] - this.target[1],
                                this.pos[2] - this.target[2]
                            ];
                            const currentLen = Math.hypot(currentOffset[0], currentOffset[1], currentOffset[2]) || 1.0;
                            const scale = targetRadius / currentLen;
                            this.orbitRadius = targetRadius;
                            this.pos[0] = this.target[0] + currentOffset[0] * scale;
                            this.pos[1] = this.target[1] + currentOffset[1] * scale;
                            this.pos[2] = this.target[2] + currentOffset[2] * scale;
                            this.hasMoved = true;
                        }

                        // Two-finger Pan
                        const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
                        const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
                        const panDx = midX - lastTouchX;
                        const panDy = midY - lastTouchY;
                        lastTouchX = midX;
                        lastTouchY = midY;

                        const panSpeed = this.orbitRadius * 0.002;
                        const right = this.getRightVector();
                        const up = this.getUpVector();
                        this.target[0] -= (right[0] * panDx - up[0] * panDy) * panSpeed;
                        this.target[1] -= (right[1] * panDx - up[1] * panDy) * panSpeed;
                        this.target[2] -= (right[2] * panDx - up[2] * panDy) * panSpeed;
                        this.pos[0] -= (right[0] * panDx - up[0] * panDy) * panSpeed;
                        this.pos[1] -= (right[1] * panDx - up[1] * panDy) * panSpeed;
                        this.pos[2] -= (right[2] * panDx - up[2] * panDy) * panSpeed;
                        this.hasMoved = true;
                    }
                }, { passive: false });

                this.canvas.addEventListener('touchend', (e) => {
                    if (e.touches.length === 0) {
                        this.isDraggingOrbit = false;
                    } else if (e.touches.length === 1) {
                        lastTouchX = e.touches[0].clientX;
                        lastTouchY = e.touches[0].clientY;
                        this.isDraggingOrbit = true;
                    }
                });

                document.addEventListener('pointerlockchange', () => {
                    this.isPointerLocked = (document.pointerLockElement === this.canvas);
                });

                // Prevent context menu on canvas
                this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            }

            // Unconstrained 360-degree rotation in all directions around target
            rotateOrbit(dYaw, dPitch) {
                let offset = [
                    this.pos[0] - this.target[0],
                    this.pos[1] - this.target[1],
                    this.pos[2] - this.target[2]
                ];

                // Orthonormal camera frame
                const fwd = normalizeVec([-offset[0], -offset[1], -offset[2]]);
                let right = normalizeVec(crossVec(fwd, this.up));
                this.up = normalizeVec(crossVec(right, fwd));

                // Pitch (Vertical 360 rotation around camera right axis)
                if (Math.abs(dPitch) > 1e-7) {
                    offset = rotateVec(offset, right, -dPitch);
                    this.up = normalizeVec(rotateVec(this.up, right, -dPitch));
                }

                // Yaw (Horizontal 360 rotation around camera up axis)
                if (Math.abs(dYaw) > 1e-7) {
                    offset = rotateVec(offset, this.up, -dYaw);
                }

                this.pos[0] = this.target[0] + offset[0];
                this.pos[1] = this.target[1] + offset[1];
                this.pos[2] = this.target[2] + offset[2];
                this.orbitRadius = Math.hypot(offset[0], offset[1], offset[2]);
                this.hasMoved = true;
            }

            getForwardVector() {
                if (this.mode === 'orbit') {
                    const dx = this.target[0] - this.pos[0];
                    const dy = this.target[1] - this.pos[1];
                    const dz = this.target[2] - this.pos[2];
                    const len = Math.max(1e-6, Math.hypot(dx, dy, dz));
                    return [dx / len, dy / len, dz / len];
                } else {
                    const cosPitch = Math.cos(this.pitch);
                    return [
                        Math.sin(this.yaw) * cosPitch,
                        Math.sin(this.pitch),
                        -Math.cos(this.yaw) * cosPitch
                    ];
                }
            }

            getRightVector() {
                if (this.mode === 'orbit') {
                    const f = this.getForwardVector();
                    return normalizeVec(crossVec(f, this.up));
                } else {
                    const f = this.getForwardVector();
                    const rx = f[2];
                    const rz = -f[0];
                    const len = Math.max(1e-6, Math.hypot(rx, rz));
                    return [rx / len, 0, rz / len];
                }
            }

            getUpVector() {
                if (this.mode === 'orbit') {
                    return this.up;
                } else {
                    const f = this.getForwardVector();
                    const r = this.getRightVector();
                    return [
                        r[1] * f[2] - r[2] * f[1],
                        r[2] * f[0] - r[0] * f[2],
                        r[0] * f[1] - r[1] * f[0]
                    ];
                }
            }

            // Dynamic 3D fractal boundary estimator
            computeFractalBoundingRadius(formula, values = {}) {
                if (!formula) return 1.5;
                const id = formula.id;

                if (id === 'quat_julia') {
                    const cx = values.qj_cx ?? -0.2;
                    const cy = values.qj_cy ?? 0.6;
                    const cz = values.qj_cz ?? 0.4;
                    const cw = values.qj_cw ?? 0.0;
                    const cLen = Math.hypot(cx, cy, cz, cw);
                    return 1.25 + 0.35 * cLen; // ~1.40
                } else if (id === 'mandelbulb') {
                    const jMix = values.mb_julia_mix ?? 0.0;
                    return 1.45 + 0.15 * jMix; // Mandelbulb expands to ~1.45 - 1.55
                } else if (id === 'mandelbox') {
                    return 2.0; // Normalized Mandelbox citadel fits inside 2.0
                } else if (id === 'kifs') {
                    const ox = values.kifs_offset_x ?? 1.0;
                    const oy = values.kifs_offset_y ?? 1.0;
                    const oz = values.kifs_offset_z ?? 1.0;
                    const offLen = Math.hypot(ox, oy, oz);
                    return 1.25 + 0.35 * offLen; // ~1.85
                } else if (id === 'apollonian') {
                    return (values.apol_radius ?? 1.55) + 0.65; // ~2.20
                } else if (id === 'burning_ship') {
                    const asym = values.bs_asym ?? 0.0;
                    return 1.85 + asym * 0.95; // Burning ship with asymmetry expands
                } else if (id === 'jerusalem') {
                    return 2.35; // Jerusalem cube reaches ~2.35
                }

                return 1.5;
            }

            // Auto zoom controller: smoothly frames the fractal at its authored dramatic canonical distance
            updateAutoZoom(formula, values, fov = 60, dt = 0.016, formulaMorph = null) {
                if (this.mode !== 'orbit') return;

                let canonDist;
                if (formulaMorph && FORMULAS[formulaMorph.fromId] && FORMULAS[formulaMorph.toId]) {
                    const fA = FORMULAS[formulaMorph.fromId];
                    const fB = FORMULAS[formulaMorph.toId];
                    const distA = Math.hypot(fA.defaultCam.pos[0] - fA.defaultCam.target[0], fA.defaultCam.pos[1] - fA.defaultCam.target[1], fA.defaultCam.pos[2] - fA.defaultCam.target[2]);
                    const distB = Math.hypot(fB.defaultCam.pos[0] - fB.defaultCam.target[0], fB.defaultCam.pos[1] - fB.defaultCam.target[1], fB.defaultCam.pos[2] - fB.defaultCam.target[2]);
                    const t = formulaMorph.progress;
                    const s = t * t * (3.0 - 2.0 * t); // smooth cubic blend
                    canonDist = distA + (distB - distA) * s;
                } else if (formula && formula.defaultCam) {
                    const p = formula.defaultCam.pos;
                    const t = formula.defaultCam.target;
                    canonDist = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
                } else {
                    canonDist = 1.6;
                }

                this.idealDistance = canonDist;
                this.objRadius = canonDist * 0.72;
                this.safeRadius = Math.max(0.015, Math.min(0.08, this.collisionClearance * this.objRadius));

                // If a cinematic preset path is actively driving camera position, let applyCameraPreset own pos/target
                if (this.activeCameraPreset !== 'turntable' && this.presetBlendProgress >= 1.0) {
                    return;
                }

                // If user has overridden the zoom factor, respect manual zoom (do not force orbitRadius)
                if (this.isZoomOverridden) return;

                let targetDist = canonDist;
        // Look-ahead: never glide inward into the surface soft zone (prevents zoom/collision bounce)
        if (targetDist < this.orbitRadius && this.wouldEnterSurface(this.orbitRadius - Math.min(0.05, this.orbitRadius - targetDist))) {
            targetDist = this.orbitRadius;
        }
                // If canonDist is closer than the safe surface distance along the current viewing ray,
                // clamp targetDist so auto-zoom NEVER pulls the camera into the solid
                if (this.collisionEnabled && this.collisionProvider && !this.collisionSuspended) {
                    const curDE = this.collisionProvider(this.pos);
                    if (!isNaN(curDE) && curDE < this.safeRadius * 1.5 && (targetDist < this.orbitRadius)) {
                        targetDist = this.orbitRadius;
                    }
                }

                const diff = targetDist - this.orbitRadius;
                const targetOffset = Math.hypot(this.target[0], this.target[1], this.target[2]);

                // Deadband threshold: if settled, avoid float churn and spurious movement flags
                if (Math.abs(diff) < 0.0002 && targetOffset < 0.0002) return;

                // Smooth critically damped exponential ease
                const lerpSpeed = 1.0 - Math.exp(-4.5 * dt);
                this.orbitRadius += diff * lerpSpeed;
                this.targetOrbitRadius = this.orbitRadius;

                // Smoothly recenter target if it was panned
                if (targetOffset > 0.0002) {
                    this.target[0] += (0.0 - this.target[0]) * lerpSpeed;
                    this.target[1] += (0.0 - this.target[1]) * lerpSpeed;
                    this.target[2] += (0.0 - this.target[2]) * lerpSpeed;
                }

                // Reposition camera pos smoothly along orbit vector
                const offset = [
                    this.pos[0] - this.target[0],
                    this.pos[1] - this.target[1],
                    this.pos[2] - this.target[2]
                ];
                const curDist = Math.hypot(offset[0], offset[1], offset[2]) || 1.0;
                const scale = this.orbitRadius / curDist;
                this.pos[0] = this.target[0] + offset[0] * scale;
                this.pos[1] = this.target[1] + offset[1] * scale;
                this.pos[2] = this.target[2] + offset[2] * scale;
                this.hasMoved = true;
            }

            // Called every frame
            update(dt, surfaceDE = 1.0) {
                const curDE = this.collisionProvider ? this.collisionProvider(this.pos) : surfaceDE;
                this.currentDE = isNaN(curDE) ? 1.0 : curDE;

                if (this.mode === 'flight') {
                    // Deceleration curve when approaching surface safety bubble
                    let speedFactor = 1.0;
                    if (this.collisionEnabled) {
                        const edge0 = this.safeRadius;
                        const edge1 = this.safeRadius * 5.0;
                        const t = Math.max(0.0, Math.min(1.0, (this.currentDE - edge0) / Math.max(1e-4, edge1 - edge0)));
                        speedFactor = t * t * (3.0 - 2.0 * t);
                        speedFactor = Math.max(0.05, speedFactor);
                    } else {
                        speedFactor = Math.max(0.015, Math.min(2.5, this.currentDE));
                    }

                    this.currentSpeed = this.baseFlightSpeed * speedFactor * this.speedMultiplier;

                    if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                        this.currentSpeed *= 2.5;
                    }

                    const step = this.currentSpeed * dt;
                    const fwd = this.getForwardVector();
                    const right = this.getRightVector();

                    let moveDir = [0, 0, 0];
                    if (this.keys['KeyW']) { moveDir[0] += fwd[0]; moveDir[1] += fwd[1]; moveDir[2] += fwd[2]; }
                    if (this.keys['KeyS']) { moveDir[0] -= fwd[0]; moveDir[1] -= fwd[1]; moveDir[2] -= fwd[2]; }
                    if (this.keys['KeyA']) { moveDir[0] -= right[0]; moveDir[2] -= right[2]; }
                    if (this.keys['KeyD']) { moveDir[0] += right[0]; moveDir[2] += right[2]; }
                    if (this.keys['Space'] || this.keys['KeyE']) { moveDir[1] += 1.0; }
                    if (this.keys['KeyC'] || this.keys['KeyQ']) { moveDir[1] -= 1.0; }

                    const moveLen = Math.hypot(moveDir[0], moveDir[1], moveDir[2]);
                    if (moveLen > 0.0001) {
                        let dx = (moveDir[0] / moveLen) * step;
                        let dy = (moveDir[1] / moveLen) * step;
                        let dz = (moveDir[2] / moveLen) * step;

                        // Wall sliding: deflect movement tangential to surface normal
                        if (this.collisionEnabled && this.currentDE < this.safeRadius * 2.5) {
                            const norm = this.estimateNormal(this.pos, Math.max(0.002, this.safeRadius * 0.25));
                            const dot = dx * norm[0] + dy * norm[1] + dz * norm[2];
                            if (dot < 0.0) {
                                dx -= norm[0] * dot;
                                dy -= norm[1] * dot;
                                dz -= norm[2] * dot;
                            }
                        }

                        // Sub-stepping to prevent tunneling through thin geometry
                        const totalStep = Math.hypot(dx, dy, dz);
                        const subStepLimit = Math.max(0.005, 0.45 * Math.max(this.currentDE, this.safeRadius));
                        const numSubSteps = Math.min(6, Math.max(1, Math.ceil(totalStep / subStepLimit)));
                        const subDx = dx / numSubSteps;
                        const subDy = dy / numSubSteps;
                        const subDz = dz / numSubSteps;

                        for (let s = 0; s < numSubSteps; s++) {
                            this.pos[0] += subDx;
                            this.pos[1] += subDy;
                            this.pos[2] += subDz;
                            if (this.collisionEnabled) {
                                this.resolveCollision(this.pos);
                            }
                        }

                        // Sync target
                        this.target[0] = this.pos[0] + fwd[0];
                        this.target[1] = this.pos[1] + fwd[1];
                        this.target[2] = this.pos[2] + fwd[2];

                        this.hasMoved = true;
                    }
                } else if (this.mode === 'orbit') {
                    // Smooth heavy viscous zoom glide towards target distance
                    if (this.isZoomOverridden) {
                        const minOrbitR = (this.idealDistance || 1.6) * 0.42;
                        if (this.collisionEnabled && this.targetOrbitRadius < minOrbitR) {
                            this.targetOrbitRadius = minOrbitR;
                        }

                        let diff = this.targetOrbitRadius - this.orbitRadius;
                        if (diff < 0 && this.wouldEnterSurface(this.orbitRadius + diff * (1.0 - Math.exp(-this.zoomDamping * dt)))) {
                            this.targetOrbitRadius = this.orbitRadius;
                            diff = 0.0;
                        }
                        if (Math.abs(diff) > 0.0001) {
                            const factor = 1.0 - Math.exp(-this.zoomDamping * dt);
                            this.orbitRadius += diff * factor;
                            if (this.collisionEnabled && this.orbitRadius < minOrbitR) {
                                this.orbitRadius = minOrbitR;
                            }

                            // Reposition camera pos smoothly along current view direction
                            const offset = [
                                this.pos[0] - this.target[0],
                                this.pos[1] - this.target[1],
                                this.pos[2] - this.target[2]
                            ];
                            const curDist = Math.hypot(offset[0], offset[1], offset[2]) || 1.0;
                            const scale = this.orbitRadius / curDist;
                            this.pos[0] = this.target[0] + offset[0] * scale;
                            this.pos[1] = this.target[1] + offset[1] * scale;
                            this.pos[2] = this.target[2] + offset[2] * scale;
                            this.hasMoved = true;
                        }
                    }

                    const hasAngularImpulse = (Math.abs(this.angularVelYaw) > 0.00002 || Math.abs(this.angularVelPitch) > 0.00002);

                    if (!this.isDraggingOrbit && hasAngularImpulse) {
                        // Apply 360 unconstrained heavy momentum glide when released
                        this.rotateOrbit(this.angularVelYaw, this.angularVelPitch);

                        // Heavy viscous friction drag (preserves sustained weighty glide)
                        const fr = Math.pow(this.inertiaFriction, Math.min(3.0, dt * 60.0));
                this.angularVelYaw *= fr;
                        this.angularVelPitch *= fr;
                    } else if (!this.isDraggingOrbit) {
                        if (this.activeCameraPreset === 'turntable' && this.presetBlendProgress >= 1.0) {
                            if (this.autoRotate) {
                                // Continuous multi-axis auto-rotation in all directions (slow, majestic)
                                this.rotateOrbit(this.autoRotateSpeed * dt, this.autoRotatePitchSpeed * dt * 0.4);
                            }
                        } else {
                            this.presetTime += dt;
                            this.applyCameraPreset(dt);
                        }
                    }
                }

                // Global collision resolution & surface penetration prevention (Active across Orbit and Flight)
                // Camera can get as close as safeRadius to the surface, but NEVER penetrates inside solid geometry
                this.collisionPushed = false;
                if (this.collisionEnabled && this.collisionProvider && !this.collisionSuspended) {
                        const pushed = (this.mode === 'orbit') ? this.smoothOrbitClearance(dt) : this.resolveCollision(this.pos);
                        if (pushed) {
                            this.collisionPushed = true;
                            this.hasMoved = true;
                        }
                        const finalDE = this.collisionProvider(this.pos);
                        this.currentDE = isNaN(finalDE) ? 1.0 : finalDE;
                        if (!isNaN(finalDE) && finalDE >= this.safeRadius) {
                            this.lastSafePos[0] = this.pos[0];
                            this.lastSafePos[1] = this.pos[1];
                            this.lastSafePos[2] = this.pos[2];
                            this.lastSafeTarget[0] = this.target[0];
                            this.lastSafeTarget[1] = this.target[1];
                            this.lastSafeTarget[2] = this.target[2];
                        }
                    }

                    const wasMoved = this.hasMoved;
                    this.hasMoved = false;
                    if (wasMoved && this.onMove) {
                        this.onMove(this);
                    }
                    return wasMoved;
                }

                getState() {
                    return {
                        mode: this.mode,
                        pos: [Number(this.pos[0].toFixed(4)), Number(this.pos[1].toFixed(4)), Number(this.pos[2].toFixed(4))],
                        target: [Number(this.target[0].toFixed(4)), Number(this.target[1].toFixed(4)), Number(this.target[2].toFixed(4))],
                        orbitRadius: Number(this.orbitRadius.toFixed(4)),
                        preset: this.activeCameraPreset,
                        autoRotate: this.autoRotate
                    };
                }

                setState(s, smooth = true) {
                    if (!s) return;
                    if (s.mode) this.mode = s.mode;
                    if (s.preset) this.activeCameraPreset = s.preset;
                    if (s.autoRotate !== undefined) this.autoRotate = s.autoRotate;
                    if (s.orbitRadius) {
                        this.orbitRadius = s.orbitRadius;
                        this.targetOrbitRadius = s.orbitRadius;
                    }
                    if (s.target) {
                        this.target[0] = s.target[0];
                        this.target[1] = s.target[1];
                        this.target[2] = s.target[2];
                    }
                    if (s.pos) {
                        if (smooth) {
                            this.startSmoothTransition(s.pos, s.target || this.target, 1.5);
                        } else {
                            this.pos[0] = s.pos[0];
                            this.pos[1] = s.pos[1];
                            this.pos[2] = s.pos[2];
                            this.hasMoved = true;
                        }
                    }
                }
            }
