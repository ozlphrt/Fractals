import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioEngine } from '../js/audio/analyzer.js';
import { CameraController } from '../js/camera/controller.js';
import { CURATED_COMMUNITY_CREATIONS, GalleryManager, normalizeScene } from '../js/gallery/community.js';
import { FORMULA_CYCLE_ORDER, FORMULAS, getFormulaLabel } from '../js/formulas/registry.js';
import { StateManager } from '../js/state/parameters.js';
import { RenderQuality } from '../js/renderer/quality.js';
import { KeyframeLoop, keyframeSignature, keyframesForTrack, mergeKeyframeSources, playableKeyframeTab, resolveKeyframe, serializeKeyframes } from '../js/state/keyframes.js';

const bundledFixture = [0.05, 0.1, 0.15].map(glow_intensity => ({
    formulaId: 'apollonian',
    tabId: 'tab-settings-geo',
    values: { glow_intensity }
}));

test('dice playback prefers the open track then Geometry without borrowing another formula', () => {
    const formulaId = 'apollonian';
    const geometry = { formulaId, tabId: 'tab-settings-geo' };
    const camera = { formulaId, tabId: 'tab-settings-cam' };
    const lighting = { formulaId, tabId: 'tab-settings-light' };
    const foreign = { formulaId: 'jerusalem', tabId: 'tab-settings-quick' };
    const frames = [geometry, camera, foreign, foreign, geometry, camera, lighting];
    assert.equal(playableKeyframeTab(frames, formulaId, camera.tabId), camera.tabId);
    assert.equal(playableKeyframeTab(frames, formulaId, foreign.tabId), geometry.tabId);
    assert.equal(playableKeyframeTab(frames, formulaId, lighting.tabId), geometry.tabId);
    assert.equal(playableKeyframeTab(frames, 'menger', geometry.tabId), undefined);
});

test('removed slider and position fields inherit the starting view without changing the saved frame', () => {
    const frame = {
        values: { glow: 0.5, fov: 50 },
        camera: { pos: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0] },
        omitted: [['glow'], ['pos', 0], ['pos', 2]]
    };
    const baseline = { values: { glow: 0.2, fov: 65 }, camera: { pos: [4, 5, 6] } };
    const resolved = resolveKeyframe(frame, baseline);
    assert.deepEqual(resolved.values, { glow: 0.2, fov: 50 });
    assert.deepEqual(resolved.camera.pos, [4, 2, 6]);
    assert.deepEqual(frame.camera.pos, [1, 2, 3]);
    assert.equal(frame.values.glow, 0.5);
});

test('one JS export preserves every capture across many formulas and tabs', async () => {
    const captured = Array.from({ length: 1000 }, (_, index) => ({
        formulaId: index % 2 === 0 ? 'apollonian' : 'jerusalem',
        tabId: index % 3 === 0 ? 'tab-settings-geo' : 'tab-settings-light',
        values: { glow_intensity: index / 2000 }
    }));
    const frames = [...bundledFixture, ...captured];
    const url = `data:text/javascript;base64,${Buffer.from(serializeKeyframes(frames)).toString('base64')}`;
    const exported = await import(url);
    assert.deepEqual(exported.USER_KEYFRAMES, frames);
});

test('bundled Gasket frames appear alongside browser captures without duplication', () => {
    const bundled = structuredClone(bundledFixture);
    const localOnly = { ...bundled[0], tabId: 'tab-settings-light' };
    const saved = [...structuredClone(bundled), localOnly];
    const merged = mergeKeyframeSources(bundled, saved);
    assert.deepEqual(merged.frames, [...bundled, localOnly]);
    const removed = bundled.at(-1);
    const remaining = merged.frames.filter(frame => frame !== removed);
    const reloaded = mergeKeyframeSources(bundled, remaining, new Map([[keyframeSignature(removed), 1]]));
    assert.deepEqual(reloaded.frames, remaining);
});

test('an overwritten bundled keyframe retains its slot on reload', () => {
    const original = structuredClone(bundledFixture);
    const replacement = { ...original[1], values: { ...original[1].values, glow_intensity: 0.47 } };
    const saved = [original[0], replacement, original[2]];
    const dismissed = new Map([[keyframeSignature(original[1]), 1]]);
    const reloaded = mergeKeyframeSources(original, structuredClone(saved), dismissed);
    assert.deepEqual(reloaded.frames, saved);
    assert.equal(reloaded.bundled.has(reloaded.frames[1]), false);
    assert.equal(reloaded.bundled.has(reloaded.frames[2]), true);
    assert.deepEqual(mergeKeyframeSources(original, [original[0], original[2]], dismissed).frames, [original[0], original[2]]);
});

test('keyframe tracks are isolated by both formula and tab', () => {
    const quick = { formulaId: 'mandelbulb', tabId: 'tab-settings-quick' };
    const lighting = { ...quick, tabId: 'tab-settings-light' };
    const cube = { ...quick, formulaId: 'jerusalem' };
    assert.deepEqual(keyframesForTrack([quick, lighting, cube], quick.formulaId, quick.tabId), [quick]);
    assert.deepEqual(keyframesForTrack([quick, lighting, cube], cube.formulaId, lighting.tabId), []);
});

test('shuffled playback keeps all user captures and inserts dice frames between them', t => {
    t.mock.method(Math, 'random', () => 0);
    const loop = new KeyframeLoop(new Map());
    const camera = { mode: 'orbit', target: [0, 0, 0], pos: [0, 0, 3], up: [0, 1, 0] };
    for (const glow of [0.1, 0.3, 0.5]) loop.add({ formulaId: 'mandelbulb', values: { glow }, camera });
    loop.start(null, {
        shuffle: true,
        interludes: true,
        makeInterlude: (from, to, pose) => ({
            formulaId: from.formulaId,
            values: { glow: (from.values.glow + to.values.glow) / 2 },
            camera: pose
        })
    });
    assert.deepEqual(loop.sequence.map(frame => frame.userIndex), [1, undefined, 2, undefined, 0, undefined]);
    assert.equal(loop.sequence.at(-1).values.glow, 0.2);
    assert.equal(loop.frames.length, 3);
    loop.setInterludes(false);
    loop.step(36);
    assert.deepEqual(loop.sequence.map(frame => frame.userIndex), [1, 2, 0]);
});

test('motion keeps its velocity through a keyframe and discrete settings crossfade', () => {
    const loop = new KeyframeLoop(new Map([['iterations', { type: 'int', uniform: 'u_iterations' }]]));
    const camera = { mode: 'orbit', target: [0, 0, 0], pos: [0, 0, 3], up: [0, 1, 0] };
    for (const [glow, iterations] of [[0.1, 4], [0.3, 8], [0.5, 8]]) {
        loop.add({ formulaId: 'mandelbulb', values: { glow, iterations }, camera });
    }
    loop.start();
    const before = loop.step(5.999);
    const after = loop.step(0.002);
    assert.equal(before.crossfade, true);
    assert.equal(before.discreteFrom.iterations, 4);
    assert.equal(before.discreteTo.iterations, 8);
    assert.ok(Math.abs((0.3 - before.values.glow) - (after.values.glow - 0.3)) < 1e-7);
    assert.ok(after.values.glow > 0.3);
    assert.equal(after.crossfade, false);
});

test('keyframes interpolate captured settings in order and wrap to the first frame', () => {
    const loop = new KeyframeLoop(new Map([['iterations', { type: 'int' }]]));
    const camera = { mode: 'orbit', target: [0, 0, 0], pos: [0, 0, 3], up: [0, 1, 0] };
    loop.add({ formulaId: 'mandelbulb', values: { glow_intensity: 0.1, iterations: 4 }, camera });
    assert.equal(loop.start(), false);
    loop.add({
        formulaId: 'jerusalem',
        values: { glow_intensity: 0.3, iterations: 8 },
        camera: { ...camera, pos: [0, 0, -3] }
    });
    assert.equal(loop.start(), true);
    assert.equal(loop.step(1.5).progress, 0.25);
    const middle = loop.step(1.5);
    assert.equal(middle.fromId, 'mandelbulb');
    assert.equal(middle.toId, 'jerusalem');
    assert.equal(middle.progress, 0.5);
    assert.equal(middle.values.glow_intensity, 0.2);
    assert.equal(middle.values.iterations, 8);
    assert.equal(Math.hypot(...middle.camera.pos), 3);
    const returning = loop.step(3);
    assert.equal(returning.fromId, 'jerusalem');
    assert.equal(returning.toId, 'mandelbulb');
    assert.equal(loop.step(6).fromId, 'mandelbulb');
    loop.stop();
    assert.equal(loop.step(1), null);
});

test('a selected keyframe glides in once and can be retargeted from its current view', () => {
    const loop = new KeyframeLoop(new Map());
    const pose = { mode: 'orbit', target: [0, 0, 0], pos: [0, 0, 3], up: [0, 1, 0] };
    const from = { formulaId: 'apollonian', values: { glow: 0.1 }, camera: pose };
    const to = { formulaId: 'apollonian', values: { glow: 0.3 }, camera: { ...pose, pos: [0, 0, 5] } };
    loop.preview(from, to);
    const sample = loop.step(1.5);
    assert.equal(sample.finished, false);
    assert.ok(sample.camera.pos[2] > 3 && sample.camera.pos[2] < 3.5);
    loop.preview({ ...from, camera: sample.camera, values: sample.values }, from);
    assert.deepEqual(loop.step(0).camera.pos, sample.camera.pos);
    const end = loop.step(6);
    assert.equal(end.finished, true);
    assert.deepEqual(end.camera.pos, from.camera.pos);
    assert.deepEqual(end.values, from.values);
});

test('wheel zoom keeps its target while a cinematic camera preset runs', () => {
    const camera = Object.assign(Object.create(CameraController.prototype), {
        pos: [0, 0, 2], target: [0, 0, 0], orbitRadius: 2, targetOrbitRadius: 5,
        idealDistance: 3, zoomSensitivity: 0.00042, activeCameraPreset: 'flyby',
        presetTime: 2, presetBlendProgress: 1, isZoomOverridden: false
    });
    camera.zoomFromWheel(-3, 1);
    const zoomedIn = camera.targetOrbitRadius;
    assert.ok(zoomedIn < 2);
    camera.applyCameraPreset(1 / 60);
    assert.equal(camera.targetOrbitRadius, zoomedIn);
    assert.ok(Math.abs(Math.hypot(...camera.pos) - 2) < 1e-10);
    camera.zoomFromWheel(3, 1);
    assert.ok(camera.targetOrbitRadius > zoomedIn);
});

test('the rated lineup removes low-rated formulas and gives each variant its own geometry', () => {
    assert.equal(FORMULAS.mandelbox, undefined);
    assert.equal(normalizeScene({ formula: 'mandelbox' }), null);
    assert.equal(FORMULAS.coral_bulb, undefined);
    assert.equal(FORMULA_CYCLE_ORDER.length, 20);
    assert.deepEqual(new Set(FORMULA_CYCLE_ORDER), new Set(Object.keys(FORMULAS)));

    for (const [index, id] of FORMULA_CYCLE_ORDER.entries()) {
        assert.ok(getFormulaLabel(id).startsWith(`${index + 1}. `));
        if (index < 9) continue;
        const formula = FORMULAS[id];
        const defaults = Object.fromEntries(formula.params.map(param => [param.id, param.default]));
        assert.ok(formula.params.every(param => param.id.startsWith(`${id}_`)));
        for (const preset of formula.presets) {
            assert.ok(Object.keys(preset.values).every(key => Object.hasOwn(defaults, key)));
        }
        if (!Object.hasOwn(defaults, `${id}_twist`)) continue;
        const position = [0.53, -0.72, 0.91];
        const warped = formula.cpuEvalDE(position, defaults);
        const straight = formula.cpuEvalDE(position, { ...defaults, [`${id}_twist`]: 0, [`${id}_wave`]: 0 });
        assert.ok(Number.isFinite(warped) && Number.isFinite(straight), id);
        assert.notEqual(warped, straight, id);
    }
});

test('Menger and Tetra distinguish solid tips from the central void', () => {
    const menger = FORMULAS.menger;
    assert.ok(menger.cpuEvalDE([0, 0, 0], {}) > 0);
    assert.ok(menger.cpuEvalDE([0.85, 0.85, 0.85], { menger_iterations: 1 }) < 0);
    assert.ok(menger.cpuEvalDE([2, 0, 0], {}) >= 1);

    const tetra = FORMULAS.tetra;
    assert.ok(tetra.cpuEvalDE([0, 0, 0], {}) > 0);
    assert.ok(tetra.cpuEvalDE([0.8, 0.8, 0.8], { tetra_iterations: 1 }) < 0);
    assert.ok(tetra.cpuEvalDE([2, 2, 2], {}) > 0);
});

test('adaptive resolution reduces sustained load and recovers with GPU headroom', () => {
    const quality = new RenderQuality();
    assert.equal(quality.update(16.7, 10, true), 0.9);
    let scale;
    for (let frame = 0; frame < 100; frame++) scale = quality.update(25, 20, false);
    assert.equal(scale, 0.6);
    for (let frame = 0; frame < 100; frame++) scale = quality.update(16.7, 15, false);
    assert.equal(scale, 0.6);
    for (let frame = 0; frame < 400; frame++) scale = quality.update(16.7, 5, false);
    assert.equal(scale, 1);
});

test('Undo and Redo restore committed targets and cancel in-flight morphs', () => {
    const state = new StateManager();
    const key = 'glow_intensity';
    const before = state.get(key);
    state.set(key, 0.6, true);
    state.morphToValues({ [key]: 0.9 });
    assert.equal(state.undo(), true);
    assert.equal(state.updateParamMorph(1), false);
    for (let frame = 0; frame < 180; frame++) state.updateInertia(1 / 60);
    assert.equal(state.get(key), before);
    assert.equal(state.redo(), true);
    assert.equal(state.get(key), 0.6);
    assert.equal(state.getTarget(key), 0.6);
});

test('editing effective values does not alter base state or history', () => {
    const state = new StateManager();
    const before = state.get('glow_intensity');
    const effectiveValues = state.getValues();
    effectiveValues.glow_intensity += 0.1;
    assert.equal(state.get('glow_intensity'), before);
    assert.equal(state.getTarget('glow_intensity'), before);
});

test('versioned scenes preserve custom lighting, palette and camera through share encoding', () => {
    const state = new StateManager();
    const overrides = { sun_follow_camera: 0, sun_azimuth: -1.1, sky_detail: 0.3, pal_a_r: 0.8 };
    state.setMany(overrides);
    const gallery = Object.create(GalleryManager.prototype);
    const camera = { mode: 'orbit', pos: [0, 0, 2], target: [0, 0, 0], up: [0, 1, 0], zoomOverridden: true };
    gallery.app = {
        params: state,
        formulaRegistry: { activeFormula: state.getActiveFormula() },
        materials: { currentPresetId: 'dark_loam' },
        camera: { getState: () => camera }
    };
    const saved = gallery.getCurrentSceneData('Sculpture – test');
    const loaded = normalizeScene(gallery.decodeScene(gallery.encodeScene(saved)));
    assert.equal(saved.version, 2);
    assert.equal(loaded.title, saved.title);
    for (const [id, value] of Object.entries(overrides)) assert.equal(loaded.params[id], value);
    assert.deepEqual(loaded.camera, camera);
});

test('legacy curated scenes use known parameters and invalid scene data is filtered', () => {
    for (const scene of CURATED_COMMUNITY_CREATIONS) {
        const normalized = normalizeScene(scene);
        assert.ok(normalized, scene.title);
        assert.ok(normalized.material, scene.title);
        assert.deepEqual(Object.keys(normalized.params).sort(), Object.keys(scene.params).sort(), scene.title);
    }
    const formula = Object.keys(FORMULAS)[0];
    assert.equal(normalizeScene({ formula: 'missing' }), null);
    const normalized = normalizeScene({ formula, params: { glow_intensity: 100, color_cycle: 'bad' }, camera: { pos: [0, 0] } });
    assert.equal(normalized.params.glow_intensity, 0.5);
    assert.equal(normalized.params.color_cycle, undefined);
    assert.equal(normalized.camera, null);
});

test('microphone teardown stops tracks and disconnects the source node', () => {
    const audio = new AudioEngine();
    let stopped = 0;
    let disconnected = 0;
    audio.microphoneStream = { getTracks: () => [{ stop: () => stopped++ }] };
    audio.sourceNode = { disconnect: () => disconnected++ };
    audio.stopCurrentSource();
    assert.equal(stopped, 1);
    assert.equal(disconnected, 1);
    assert.equal(audio.microphoneStream, null);
});

test('a late microphone result is released when the request is superseded', async t => {
    const audio = new AudioEngine();
    audio.initContext = () => {};
    let resolveStream;
    let stopped = 0;
    const previous = Reflect.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveStream = resolve; }) } }
    });
    t.after(() => previous ? Object.defineProperty(globalThis, 'navigator', previous) : Reflect.deleteProperty(globalThis, 'navigator'));
    const pending = audio.startMicrophone();
    audio.stopCurrentSource();
    resolveStream({ getTracks: () => [{ stop: () => stopped++ }] });
    assert.equal(await pending, false);
    assert.equal(stopped, 1);
    assert.equal(audio.sourceType, 'none');
});
