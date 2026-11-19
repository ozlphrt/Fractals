const SEGMENT_SECONDS = 6;

export function keyframesForTrack(frames, formulaId, tabId) {
    return frames.filter(frame => frame.formulaId === formulaId && frame.tabId === tabId);
}

export function playableKeyframeTab(frames, formulaId, preferredTab) {
    const counts = new Map();
    for (const { formulaId: id, tabId } of frames) {
        if (id === formulaId) counts.set(tabId, (counts.get(tabId) ?? 0) + 1);
    }
    return [preferredTab, 'tab-settings-geo', ...counts.keys()].find(tabId => counts.get(tabId) >= 2);
}

export function serializeKeyframes(frames) {
    return `export const USER_KEYFRAMES = ${JSON.stringify(frames, null, 4)};\n`;
}

export function resolveKeyframe(frame, baseline) {
    if (!frame.omitted?.length) return frame;
    const values = { ...frame.values };
    const camera = { ...frame.camera };
    for (const [key, axis] of frame.omitted) {
        if (axis === undefined) {
            values[key] = baseline.values[key];
        } else {
            camera[key] = [...camera[key]];
            camera[key][axis] = baseline.camera[key][axis];
        }
    }
    return { ...frame, values, camera };
}

export function keyframeSignature(frame) {
    return JSON.stringify(frame);
}

export function mergeKeyframeSources(bundled, saved, dismissed = new Map()) {
    const skipped = new Map(dismissed);
    const visibleBundled = bundled.filter(frame => {
        const key = keyframeSignature(frame);
        const count = skipped.get(key) ?? 0;
        if (count === 0) return true;
        skipped.set(key, count - 1);
        return false;
    });
    const unmatched = new Map();
    for (const frame of visibleBundled) {
        const key = keyframeSignature(frame);
        if (!unmatched.has(key)) unmatched.set(key, []);
        unmatched.get(key).push(frame);
    }
    const usedBundled = new Set();
    const savedOrder = saved.map(frame => {
        const match = unmatched.get(keyframeSignature(frame))?.shift();
        if (!match) return frame;
        usedBundled.add(match);
        return match;
    });
    return {
        frames: [...savedOrder, ...visibleBundled.filter(frame => !usedBundled.has(frame))],
        bundled: new Set(visibleBundled)
    };
}

function tangent(before, after) {
    return before * after > 0 ? (2 * before * after) / (before + after) : 0;
}

// Match velocity at each keyframe, without overshooting captured extrema.
function interpolate(previous, from, to, next, t) {
    const delta = to - from;
    const startVelocity = tangent(from - previous, delta);
    const endVelocity = tangent(delta, next - to);
    if (startVelocity === 0 && endVelocity === 0) {
        const ease = t ** 3 * (t * (6 * t - 15) + 10);
        return from + delta * ease;
    }
    return from + delta * t * t * (3 - 2 * t)
        + startVelocity * t * (1 - t) ** 2
        - endVelocity * (1 - t) * t * t;
}

function wrapAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function interpolateAngle(previous, from, to, next, t) {
    const end = from + wrapAngle(to - from);
    return wrapAngle(interpolate(from + wrapAngle(previous - from), from, end, end + wrapAngle(next - to), t));
}

function interpolateVector(points, t) {
    const [previous, from, to, next] = points;
    return from.map((value, index) => interpolate(previous[index], value, to[index], next[index], t));
}

function orbitCoordinates(camera) {
    const [x, y, z] = camera.pos.map((value, index) => value - camera.target[index]);
    return [Math.hypot(x, y, z), Math.atan2(x, z), Math.atan2(y, Math.hypot(x, z))];
}

function interpolateCamera(cameras, t) {
    const target = interpolateVector(cameras.map(camera => camera.target), t);
    const coordinates = cameras.map(orbitCoordinates);
    const radius = interpolate(...coordinates.map(point => point[0]), t);
    const yaw = interpolateAngle(...coordinates.map(point => point[1]), t);
    const pitch = interpolate(...coordinates.map(point => point[2]), t);
    const horizontal = radius * Math.cos(pitch);
    return {
        ...cameras[t < 0.5 ? 1 : 2],
        target,
        pos: [target[0] + horizontal * Math.sin(yaw), target[1] + radius * Math.sin(pitch), target[2] + horizontal * Math.cos(yaw)],
        up: interpolateVector(cameras.map(camera => camera.up), t),
        orbitRadius: radius
    };
}

export class KeyframeLoop {
    constructor(parameterMetadata) {
        this.parameterMetadata = parameterMetadata;
        this.frames = [];
        this.playing = false;
        this.index = 0;
        this.elapsed = 0;
    }

    add(scene) {
        if (!this.playing) this.frames.push(scene);
    }

    start(entry = null, { shuffle = false, interludes = false, makeInterlude, resolve = frame => frame } = {}) {
        if (this.frames.length < 2 || this.playing) return false;
        this.previewing = false;
        this.order = this.frames.map((scene, index) => ({ ...resolve(scene), userIndex: index }));
        if (shuffle) {
            for (let index = this.order.length - 1; index > 0; index--) {
                const other = Math.floor(Math.random() * (index + 1));
                [this.order[index], this.order[other]] = [this.order[other], this.order[index]];
            }
        }
        this.makeInterlude = makeInterlude;
        this.useInterludes = interludes;
        this.sequence = this.buildSequence();
        this.entry = entry;
        this.nextSequence = null;
        this.previousAtWrap = null;
        this.index = entry ? -1 : 0;
        this.elapsed = 0;
        this.playing = true;
        return true;
    }

    preview(from, to) {
        this.previewing = true;
        this.playing = true;
        this.entry = from;
        this.sequence = [to];
        this.index = -1;
        this.elapsed = 0;
        this.previousAtWrap = null;
        this.nextSequence = null;
    }

    buildSequence() {
        if (!this.useInterludes || !this.makeInterlude) return this.order;
        return this.order.flatMap((scene, index) => {
            const next = this.order[(index + 1) % this.order.length];
            const camera = interpolateCamera([scene.camera, scene.camera, next.camera, next.camera], 0.5);
            return [scene, this.makeInterlude(scene, next, camera)];
        });
    }

    setInterludes(enabled) {
        this.useInterludes = enabled;
    }

    stop() {
        this.playing = false;
        this.previewing = false;
        this.entry = null;
    }

    step(dt) {
        if (!this.playing) return null;
        this.elapsed += dt;
        while (!this.previewing && this.elapsed >= SEGMENT_SECONDS) {
            this.elapsed -= SEGMENT_SECONDS;
            const last = this.index === this.sequence.length - 1;
            this.previousAtWrap = this.entry ? this.sequence[0] : last ? this.sequence.at(-1) : null;
            this.index = (this.index + 1) % this.sequence.length;
            if (last && this.nextSequence) this.sequence = this.nextSequence;
            this.nextSequence = null;
            if (this.index === this.sequence.length - 1 && (this.sequence !== this.order) !== this.useInterludes) {
                this.nextSequence = this.buildSequence();
            }
            this.entry = null;
        }

        const count = this.sequence.length;
        const frames = this.entry
            ? [this.entry, this.entry, this.sequence[0], this.sequence[0]]
            : [-1, 0, 1, 2].map(offset => this.sequence[(this.index + offset + count) % count]);
        if (this.previousAtWrap) frames[0] = this.previousAtWrap;
        if (this.nextSequence) frames[3] = this.nextSequence[1];
        const [previous, from, to, next] = frames;
        const progress = Math.min(1, this.elapsed / SEGMENT_SECONDS);
        const values = {};
        const discreteFrom = {};
        const discreteTo = {};
        for (const [id, value] of Object.entries(from.values)) {
            const end = to.values[id] ?? value;
            const parameter = this.parameterMetadata.get(id);
            if (parameter?.type === 'int') {
                values[id] = progress < 0.5 ? value : end;
                if (parameter.uniform && value !== end) {
                    discreteFrom[id] = value;
                    discreteTo[id] = end;
                }
            } else {
                const sample = id === 'sun_azimuth' ? interpolateAngle : interpolate;
                values[id] = sample(previous.values[id] ?? value, value, end, next.values[id] ?? end, progress);
            }
        }
        return {
            fromId: from.formulaId,
            toId: to.formulaId,
            progress,
            finished: this.previewing && progress === 1,
            values,
            discreteFrom,
            discreteTo,
            crossfade: from.formulaId !== to.formulaId || Object.keys(discreteFrom).length > 0,
            camera: interpolateCamera(frames.map(frame => frame.camera), progress)
        };
    }
}
