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

        // Coordinates & Orthonormal Frame (Zoomed in for intricate 4D Quaternion liquid geometry)
        this.pos = [0.0, 0.0, 1.2];
        this.target = [0.0, 0.0, 0.0];
        this.up = [0.0, 1.0, 0.0];
        this.orbitRadius = 1.2;
        this.idealDistance = 1.2;
        
        // Manual Zoom Override State & Callback
        this.isZoomOverridden = false;
        this.onZoomOverrideChange = null;
        
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

        // Auto-Rotation Turntable (Gentle, majestic multi-axis drift in all directions)
        this.autoRotate = true;
        this.autoRotateSpeed = 0.035; // Horizontal drift
        this.autoRotatePitchSpeed = 0.016; // Vertical pitch drift

        this.hasMoved = true;
        this.setupInputListeners();
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
        this.angularVelYaw = 0.0;
        this.angularVelPitch = 0.0;
        this.yaw = Math.atan2(-dx, -dz);
        this.pitch = 0;
        this.roll = 0;
        this.setZoomOverridden(false);
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

        // Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.mode === 'orbit') {
                const zoomFactor = Math.exp(e.deltaY * 0.001);
                const offset = [
                    (this.pos[0] - this.target[0]) * zoomFactor,
                    (this.pos[1] - this.target[1]) * zoomFactor,
                    (this.pos[2] - this.target[2]) * zoomFactor
                ];
                const newRadius = Math.hypot(offset[0], offset[1], offset[2]);
                if (newRadius >= 0.02 && newRadius <= 100.0) {
                    this.orbitRadius = newRadius;
                    this.pos[0] = this.target[0] + offset[0];
                    this.pos[1] = this.target[1] + offset[1];
                    this.pos[2] = this.target[2] + offset[2];
                    this.hasMoved = true;
                    this.setZoomOverridden(true);
                }
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
    computeFractalBoundingRadius(formula, values) {
        if (!formula) return 1.15;
        const id = formula.id;

        if (id === 'quat_julia') {
            const cx = values.qj_cx ?? -0.2;
            const cy = values.qj_cy ?? 0.6;
            const cz = values.qj_cz ?? 0.4;
            const cw = values.qj_cw ?? 0.0;
            const cLen = Math.hypot(cx, cy, cz, cw);
            return 0.92 + 0.32 * cLen; // typically ~1.15
        } else if (id === 'mandelbulb') {
            const jMix = values.mb_julia_mix ?? 0.0;
            return 1.10 + 0.12 * jMix; // typically ~1.12
        } else if (id === 'mandelbox') {
            const scale = Math.abs(values.mbox_scale ?? 2.2);
            const foldLimit = values.mbox_fold_limit ?? 1.0;
            // Mandelbox outer architecture extends outward with towers and spires to radius ~4.8 - 5.5
            // Setting this correctly frames the entire majestic structure with comfortable 80% coverage
            return 3.6 + foldLimit * 1.2 + Math.min(1.5, Math.max(0.0, scale - 1.0) * 0.5); // ~5.2 - 5.5
        } else if (id === 'kifs') {
            const ox = values.kifs_offset_x ?? 1.0;
            const oy = values.kifs_offset_y ?? 1.0;
            const oz = values.kifs_offset_z ?? 1.0;
            const offLen = Math.hypot(ox, oy, oz);
            return 0.65 + 0.23 * offLen; // precisely ~1.05: 80% inside viewport, 20% outside
        }

        return 1.15;
    }

    // Auto zoom controller: smoothly keeps exactly 80% of the fractal inside the viewport (20% extends outside) at all times
    updateAutoZoom(formula, values, fov = 60, dt = 0.016, formulaMorph = null) {
        if (this.mode !== 'orbit') return;

        let objRadius;
        if (formulaMorph && FORMULAS[formulaMorph.fromId] && FORMULAS[formulaMorph.toId]) {
            const fA = FORMULAS[formulaMorph.fromId];
            const fB = FORMULAS[formulaMorph.toId];
            const rA = this.computeFractalBoundingRadius(fA, values);
            const rB = this.computeFractalBoundingRadius(fB, values);
            const t = formulaMorph.progress;
            const s = t * t * (3.0 - 2.0 * t); // smooth cubic blend
            objRadius = rA + (rB - rA) * s;
        } else {
            objRadius = this.computeFractalBoundingRadius(formula, values);
        }
        
        // Half-angle of visible frustum along shorter screen dimension
        const halfFovRad = (fov * 0.5) * (Math.PI / 180.0);
        const tanHalfFov = Math.tan(halfFovRad);
        
        // Exactly 80% of object inside viewport (20% extends outside)
        // Visible span = 0.80 * Object Diameter ==> D = (0.80 * objRadius) / tanHalfFov
        const idealDistance = (0.80 * objRadius) / tanHalfFov;
        this.idealDistance = idealDistance;

        // If user has overridden the zoom factor, respect manual zoom (do not force orbitRadius)
        if (this.isZoomOverridden) return;

        // Smooth critically damped exponential ease
        const lerpSpeed = Math.min(1.0, 5.5 * dt);
        this.orbitRadius += (idealDistance - this.orbitRadius) * lerpSpeed;

        // Smoothly recenter target if it was panned
        if (Math.hypot(this.target[0], this.target[1], this.target[2]) > 0.001) {
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
        this.currentDE = surfaceDE;

        if (this.mode === 'flight') {
            const safeDE = Math.max(0.0015, Math.min(2.5, surfaceDE));
            this.currentSpeed = this.baseFlightSpeed * safeDE * this.speedMultiplier;

            if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                this.currentSpeed *= 2.5;
            }

            const step = this.currentSpeed * dt;
            const fwd = this.getForwardVector();
            const right = this.getRightVector();

            let moved = false;

            if (this.keys['KeyW']) {
                this.pos[0] += fwd[0] * step;
                this.pos[1] += fwd[1] * step;
                this.pos[2] += fwd[2] * step;
                moved = true;
            }
            if (this.keys['KeyS']) {
                this.pos[0] -= fwd[0] * step;
                this.pos[1] -= fwd[1] * step;
                this.pos[2] -= fwd[2] * step;
                moved = true;
            }
            if (this.keys['KeyA']) {
                this.pos[0] -= right[0] * step;
                this.pos[2] -= right[2] * step;
                moved = true;
            }
            if (this.keys['KeyD']) {
                this.pos[0] += right[0] * step;
                this.pos[2] += right[2] * step;
                moved = true;
            }
            if (this.keys['Space'] || this.keys['KeyE']) {
                this.pos[1] += step;
                moved = true;
            }
            if (this.keys['KeyC'] || this.keys['KeyQ']) {
                this.pos[1] -= step;
                moved = true;
            }

            // Sync target
            this.target[0] = this.pos[0] + fwd[0];
            this.target[1] = this.pos[1] + fwd[1];
            this.target[2] = this.pos[2] + fwd[2];

            if (moved) this.hasMoved = true;
        } else if (this.mode === 'orbit') {
            const hasAngularImpulse = (Math.abs(this.angularVelYaw) > 0.00002 || Math.abs(this.angularVelPitch) > 0.00002);

            if (!this.isDraggingOrbit && hasAngularImpulse) {
                // Apply 360 unconstrained heavy momentum glide when released
                this.rotateOrbit(this.angularVelYaw, this.angularVelPitch);

                // Heavy viscous friction drag (preserves sustained weighty glide)
                this.angularVelYaw *= this.inertiaFriction;
                this.angularVelPitch *= this.inertiaFriction;
            } else if (!this.isDraggingOrbit && this.autoRotate) {
                // Continuous multi-axis auto-rotation in all directions
                this.rotateOrbit(this.autoRotateSpeed * dt, this.autoRotatePitchSpeed * dt * 0.4);
            }
        }

        const wasMoved = this.hasMoved;
        this.hasMoved = false;
        if (wasMoved && this.onMove) {
            this.onMove(this);
        }
        return wasMoved;
    }
}
