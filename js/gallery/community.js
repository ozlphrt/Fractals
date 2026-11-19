/**
 * Community Gallery & Creation Sharing System
 * Supports URL-safe encoded scene links, community showcase catalog,
 * and persistent local creations storage.
 */

import { FORMULAS, FORMULA_IDS, getFormulaLabel } from '../formulas/registry.js';
import { GLOBAL_PARAMS } from '../state/parameters.js';
import { PALETTE_PRESETS } from '../state/palettes.js';

export const CURATED_COMMUNITY_CREATIONS = [
    {
        id: 'curated-01',
        title: 'Prismatic Crystal Spire',
        author: '@lumina_core',
        formula: FORMULA_IDS.KIFS,
        material: 'riverbed_granite',
        params: {
            kifs_symmetry: 2,
            kifs_scale: 2.25,
            kifs_iterations: 12,
            kifs_offset_x: 1.25,
            kifs_offset_y: 0.85,
            kifs_offset_z: 1.05,
            kifs_pre_rot_x: 0.06,
            kifs_pre_rot_y: 0.14,
            kifs_pre_rot_z: 0.0,
            kifs_post_rot_x: 0.08,
            kifs_post_rot_y: -0.06,
            kifs_post_rot_z: 0.1,
            glow_intensity: 0.1
        },
        camera: {
            pos: [1.8, 1.4, 2.2],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 3.2
        },
        tags: ['IFS', 'Granite', 'Crystalline']
    },
    {
        id: 'curated-02',
        title: 'Volcanic 4D Tendril',
        author: '@hyper_zenith',
        formula: FORMULA_IDS.QUAT_JULIA,
        material: 'volcanic_basalt',
        params: {
            qj_cx: -0.22,
            qj_cy: 0.65,
            qj_cz: 0.38,
            qj_cw: 0.12,
            qj_slice_w: 0.15,
            qj_rot_xw: 0.35,
            qj_rot_yw: -0.25,
            qj_iterations: 12,
            glow_intensity: 0.1
        },
        camera: {
            pos: [0.0, 0.1, 1.55],
            target: [0.0, 0.0, 0.0],
            preset: 'hero',
            orbitRadius: 1.55
        },
        tags: ['4D', 'Basalt', 'Liquid']
    },
    {
        id: 'curated-03',
        title: 'Terracotta Buffalo Fleet',
        author: '@abyss_sculptor',
        formula: FORMULA_IDS.BURNING_SHIP,
        material: 'terracotta_adobe',
        params: {
            bs_power: 3.0,
            bs_iterations: 13,
            bs_asym: 0.0,
            glow_intensity: 0.1
        },
        camera: {
            pos: [0.0, 0.28, 1.65],
            target: [0.0, 0.0, 0.0],
            preset: 'action',
            orbitRadius: 1.68
        },
        tags: ['Clay', 'Terracotta', 'Burning Ship']
    },
    {
        id: 'curated-04',
        title: 'Sacred Limestone Sanctuary',
        author: '@sacred_geo',
        formula: FORMULA_IDS.JERUSALEM,
        material: 'ancient_limestone',
        params: {
            jerus_scale: 3.2,
            jerus_cut: 0.85,
            jerus_offset: 1.0,
            jerus_rot_x: 0.04,
            jerus_rot_y: 0.06,
            jerus_iterations: 8,
            glow_intensity: 0.1
        },
        camera: {
            pos: [1.8, 1.4, 2.3],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 2.35
        },
        tags: ['Sacred Geometry', 'Limestone', 'Jerusalem']
    },
    {
        id: 'curated-06',
        title: 'Glacial Calcite Geode',
        author: '@kleinian_sphere',
        formula: FORMULA_IDS.APOLLONIAN,
        material: 'glacial_permafrost',
        params: {
            apol_scale: 1.18,
            apol_core: 0.18,
            apol_radius: 1.55,
            apol_rot_x: 0.04,
            apol_rot_y: 0.08,
            apol_iterations: 8,
            glow_intensity: 0.1
        },
        camera: {
            pos: [2.1, 1.5, 2.4],
            target: [0.0, 0.0, 0.0],
            preset: 'dynamic',
            orbitRadius: 3.5
        },
        tags: ['Spheres', 'Calcite', 'Inversion']
    },
    {
        id: 'curated-07',
        title: 'Nordic Slate Microprocessor',
        author: '@borg_operative',
        formula: FORMULA_IDS.JERUSALEM,
        material: 'nordic_slate',
        params: {
            jerus_scale: 2.9,
            jerus_cut: 0.65,
            jerus_offset: 0.9,
            jerus_rot_x: 0.04,
            jerus_rot_y: 0.06,
            jerus_iterations: 9,
            glow_intensity: 0.1
        },
        camera: {
            pos: [0.0, 0.0, 1.6],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 1.6
        },
        tags: ['Megastructure', 'Slate', 'Cross-Cut']
    },
    {
        id: 'curated-08',
        title: 'Forest Moss Botanical Core',
        author: '@mandel_flora',
        formula: FORMULA_IDS.MANDELBULB,
        material: 'forest_moss',
        params: {
            mb_power: 8.0,
            mb_iterations: 14,
            mb_julia_mix: 0.0,
            mb_julia_cx: 0.0,
            mb_julia_cy: 0.0,
            mb_julia_cz: 0.0,
            glow_intensity: 0.1
        },
        camera: {
            pos: [1.6, 1.2, 2.0],
            target: [0.0, 0.0, 0.0],
            preset: 'hero',
            orbitRadius: 2.8
        },
        tags: ['Mandelbulb', 'Organic', 'Moss']
    },
    {
        id: 'curated-09',
        title: 'Celestial Gasket Spheres',
        author: '@sphere_weaver',
        formula: FORMULA_IDS.APOLLONIAN,
        material: 'dark_loam',
        params: {
            apol_radius: 1.55,
            apol_scale: 1.45,
            apol_core: 0.22,
            apol_rot_x: 0.10,
            apol_iterations: 12,
            glow_intensity: 0.15
        },
        camera: {
            pos: [0.0, 0.0, 2.2],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 2.2
        },
        tags: ['Apollonian', 'Gasket', 'Gold']
    },
    {
        id: 'curated-10',
        title: 'Bioluminescent Anemone',
        author: '@ocean_depths',
        formula: FORMULA_IDS.JULIABULB,
        material: 'glacial_permafrost',
        params: {
            jb_power: 6.0,
            jb_cx: -0.45,
            jb_cy: 0.35,
            jb_cz: 0.25,
            jb_phase: 0.0,
            jb_iterations: 10,
            glow_intensity: 0.22
        },
        camera: {
            pos: [1.2, 0.8, 2.0],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 2.0
        },
        tags: ['Juliabulb', 'Coral', 'Bioluminescent']
    },
    {
        id: 'curated-11',
        title: 'Obsidian Nebula Reliquary',
        author: '@kali_sculptor',
        formula: FORMULA_IDS.KALISET,
        material: 'dark_loam',
        params: {
            kb_scale: -2.05,
            kb_fold: 1.0,
            kb_min_radius: 0.50,
            kb_rot: 0.12,
            kb_cx: 0.0,
            kb_cy: 0.0,
            kb_cz: 0.0,
            kb_iterations: 11,
            glow_intensity: 0.16
        },
        camera: {
            pos: [2.2, 1.8, 2.6],
            target: [0.0, 0.0, 0.0],
            preset: 'action',
            orbitRadius: 3.84
        },
        tags: ['Kaliset', 'Crystal', 'Obsidian']
    },
    {
        id: 'curated-12',
        title: 'Infinite Gothic Nave',
        author: '@cathedral_architect',
        formula: FORMULA_IDS.PSEUDO_KLEINIAN,
        material: 'ancient_limestone',
        params: {
            pk_csize_x: 0.92,
            pk_csize_y: 0.92,
            pk_csize_z: 1.0,
            pk_size: 1.02,
            pk_offset_x: 0.0,
            pk_offset_y: 0.0,
            pk_offset_z: 0.0,
            pk_thickness: 0.02,
            pk_iterations: 10,
            glow_intensity: 0.08
        },
        camera: {
            pos: [0.0, 0.45, 2.6],
            target: [0.0, 0.0, 0.0],
            preset: 'hero',
            orbitRadius: 2.6
        },
        tags: ['Kleinian', 'Gothic', 'Cathedral']
    }
];

const LOCAL_STORAGE_KEY = 'fractals_community_saved_v1';

const CAMERA_PRESETS = ['turntable', 'action', 'flyby', 'follow', 'dynamic', 'hero'];
const MATERIAL_IDS = new Set(PALETTE_PRESETS.map(preset => preset.id));

function sceneParameters(formula) {
    return [...formula.params, ...GLOBAL_PARAMS];
}

export function normalizeScene(scene) {
    if (!scene || (scene.version !== undefined && scene.version !== 2)) return null;
    if (!Object.hasOwn(FORMULAS, scene.formula)) return null;
    const params = {};
    for (const param of sceneParameters(FORMULAS[scene.formula])) {
        const value = scene.params?.[param.id];
        if (!Number.isFinite(value)) continue;
        const bounded = Math.max(param.min, Math.min(param.max, value));
        params[param.id] = param.type === 'int' ? Math.round(bounded) : bounded;
    }
    const camera = {};
    const source = scene.camera;
    for (const key of ['pos', 'target', 'up']) {
        const vector = source?.[key];
        if (Array.isArray(vector) && vector.length === 3 && vector.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)) {
            camera[key] = vector.slice();
        }
    }
    if (source?.mode === 'orbit' || source?.mode === 'flight') camera.mode = source.mode;
    if (CAMERA_PRESETS.includes(source?.preset)) camera.preset = source.preset;
    if (typeof source?.autoRotate === 'boolean') camera.autoRotate = source.autoRotate;
    if (typeof source?.zoomOverridden === 'boolean') camera.zoomOverridden = source.zoomOverridden;
    if (Number.isFinite(source?.orbitRadius) && source.orbitRadius > 0 && source.orbitRadius <= 10000) camera.orbitRadius = source.orbitRadius;
    return {
        title: typeof scene.title === 'string' ? scene.title : 'Fractal',
        author: typeof scene.author === 'string' ? scene.author : 'User',
        formula: scene.formula,
        material: MATERIAL_IDS.has(scene.material) ? scene.material : null,
        params,
        camera: Object.keys(camera).length ? camera : null
    };
}

function escapeHtml(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}

export class GalleryManager {
    constructor(app) {
        this.app = app;
        this.drawer = document.getElementById('gallery-drawer');
        this.toggleBtn = document.getElementById('btn-toggle-gallery');
        this.closeBtn = document.getElementById('btn-close-gallery');
        this.settingsToggle = document.getElementById('btn-toggle-settings');
        this.activeTab = 'showcase'; // 'showcase' | 'saved'

        this.init();
    }

    init() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        this.drawer?.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !event.defaultPrevented) this.close();
        });

    }

    toggle() {
        if (!this.drawer) return;
        const isOpen = !this.drawer.classList.contains('closed');
        if (isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (!this.drawer) return;
        this.reopenSettings = this.settingsToggle?.getAttribute('aria-expanded') === 'true';
        if (this.reopenSettings) this.settingsToggle.click();
        this.drawer.inert = false;
        this.drawer.classList.remove('closed');
        this.toggleBtn?.setAttribute('aria-expanded', 'true');
        if (this.toggleBtn) this.toggleBtn.classList.add('active');
        this.render();
        this.closeBtn?.focus();
    }

    close() {
        if (!this.drawer) return;
        if (this.reopenSettings && this.settingsToggle?.getAttribute('aria-expanded') === 'false') {
            this.settingsToggle.click();
        }
        this.reopenSettings = false;
        if (this.drawer.contains(document.activeElement)) this.toggleBtn?.focus();
        this.drawer.inert = true;
        this.drawer.classList.add('closed');
        this.toggleBtn?.setAttribute('aria-expanded', 'false');
        if (this.toggleBtn) this.toggleBtn.classList.remove('active');
    }

    // Serializes current app state to a compact JSON object
    getCurrentSceneData(name = 'My Fractal Creation') {
        const formulaId = this.app.formulaRegistry?.activeFormula?.id || FORMULA_IDS.MANDELBULB;
        const currentVals = this.app.params?.getValues() || {};
        const definitions = sceneParameters(FORMULAS[formulaId]);
        
        // Pick only parameters relevant to this formula
        const formulaParams = {};
        for (const p of definitions) {
            if (currentVals[p.id] !== undefined) {
                formulaParams[p.id] = currentVals[p.id];
            }
        }
        formulaParams['glow_intensity'] = currentVals['glow_intensity'] ?? 0.05;

        const currentMaterial = this.app.materials?.currentPresetId || 'iridescent_pearl';
        const cameraState = this.app.camera?.getState ? this.app.camera.getState() : null;

        return {
            version: 2,
            title: name,
            author: 'You',
            formula: formulaId,
            material: currentMaterial,
            params: formulaParams,
            camera: cameraState,
            createdAt: Date.now()
        };
    }

    // Encodes a scene object into a URL-safe Base64 string
    encodeScene(scene) {
        const jsonStr = JSON.stringify(scene);
        const encoded = encodeURIComponent(jsonStr);
        return btoa(encoded);
    }

    // Decodes a scene object from Base64
    decodeScene(b64) {
        try {
            const decoded = atob(b64);
            const jsonStr = decodeURIComponent(decoded);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to decode scene URL:', e);
            return null;
        }
    }

    // Generates shareable URL with hash
    getShareUrl(scene) {
        const hash = this.encodeScene(scene);
        const url = new URL(window.location.href);
        url.hash = `c=${hash}`;
        return url.toString();
    }

    // Copies share URL to clipboard and surfaces toast
    copyShareLink(scene = null) {
        const data = scene || this.getCurrentSceneData();
        const url = this.getShareUrl(data);
        navigator.clipboard.writeText(url).then(() => {
            this.showToast(`✨ Link copied to clipboard! Share your creation anywhere.`);
        }).catch(() => {
            prompt('Copy this link to share:', url);
        });
    }

    // Saves current scene to localStorage
    saveCurrentScene() {
        const name = prompt('Name your fractal creation:', 'Cosmic Sculpture ' + (this.getSavedScenes().length + 1));
        if (!name || !name.trim()) return;

        const scene = this.getCurrentSceneData(name.trim());
        scene.id = 'saved-' + Date.now();
        
        const list = this.getSavedScenes();
        list.unshift(scene);
        if (!this.writeSavedScenes(list)) return;

        this.showToast(`Saved "${scene.title}" to My Creations!`);
        this.activeTab = 'saved';
        this.render();
    }

    getSavedScenes() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            const saved = raw ? JSON.parse(raw) : [];
            return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    deleteSavedScene(id) {
        const list = this.getSavedScenes().filter(s => s.id !== id);
        if (!this.writeSavedScenes(list)) return;
        this.showToast('Creation removed.');
        this.render();
    }

    writeSavedScenes(scenes) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scenes));
            return true;
        } catch {
            this.showToast('Could not update saved creations. Browser storage may be unavailable or full.');
            return false;
        }
    }

    // Loads a scene smoothly into the engine
    loadScene(scene, showToastMessage = true) {
        scene = normalizeScene(scene);
        if (!scene) return false;
        this.app.prepareSceneLoad?.();

        // 1. Switch formula if different (immediate load to cleanly activate required DE shader)
        if (this.app.setFormula && scene.formula !== this.app.formulaRegistry?.activeFormula?.id) {
            this.app.setFormula(scene.formula, true);
        }

        // Apply the preset first so authored scene values take precedence.
        if (scene.material && this.app.materials?.applyPreset) {
            this.app.materials.applyPreset(scene.material);
        }

        if (scene.params) {
            const paramsToApply = { glow_intensity: 0.05, ...scene.params };
            this.app.params?.setMany(paramsToApply, true);
        }

        // 4. Set camera state smoothly
        if (scene.camera && this.app.camera?.setState) {
            this.app.camera.setState(scene.camera);
            this.app.syncCamera?.();
        }

        if (showToastMessage) {
            this.showToast(`Loaded: ${scene.title || 'Scene'}`);
        }
        return true;
    }

    checkSharedUrl() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#c=')) {
            const b64 = hash.slice(3);
            const scene = this.decodeScene(b64);
            if (this.loadScene(scene, false)) {
                this.showToast(`Loaded shared creation: "${scene.title || 'Fractal'}"`);
            } else {
                this.showToast('This creation link could not be loaded.');
            }
        }
    }

    showToast(message) {
        let toast = document.getElementById('studio-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'studio-toast';
            toast.className = 'studio-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.remove('visible');
        }, 3200);
    }

    render() {
        if (!this.drawer) return;

        const bodyContainer = this.drawer.querySelector('.gallery-drawer-body');
        if (!bodyContainer) return;

        const savedScenes = this.getSavedScenes().filter(scene => normalizeScene(scene));
        const displayList = this.activeTab === 'showcase' ? CURATED_COMMUNITY_CREATIONS : savedScenes;

        let html = `
            <div class="gallery-hero-actions">
                <button class="gallery-action-btn primary" id="btn-share-current">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span>Share Current</span>
                </button>
                <button class="gallery-action-btn secondary" id="btn-save-current">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>Save to Folder</span>
                </button>
            </div>

            <div class="gallery-tabs-row">
                <button class="gallery-tab-btn ${this.activeTab === 'showcase' ? 'active' : ''}" data-tab="showcase">
                    Community Showcase (${CURATED_COMMUNITY_CREATIONS.length})
                </button>
                <button class="gallery-tab-btn ${this.activeTab === 'saved' ? 'active' : ''}" data-tab="saved">
                    My Saved (${savedScenes.length})
                </button>
            </div>

            <div class="gallery-cards-list">
        `;

        if (displayList.length === 0) {
            html += `
                <div class="gallery-empty-state">
                    <p>No saved creations yet.</p>
                    <p class="empty-hint">Customize a fractal and click <strong>"Save to Folder"</strong> above to store your presets here!</p>
                </div>
            `;
        } else {
            for (const item of displayList) {
                const formulaName = getFormulaLabel(item.formula);
                const matName = PALETTE_PRESETS.find(preset => preset.id === item.material)?.name || '';
                const id = escapeHtml(item.id);
                const title = escapeHtml(item.title);

                html += `
                    <div class="gallery-row" data-id="${id}">
                        <div class="gallery-row-main btn-load" data-id="${id}" title="Click to load: ${title}">
                            <span class="gallery-row-badge">${escapeHtml(formulaName)}</span>
                            <span class="gallery-row-title">${title}</span>
                            <span class="gallery-row-sub">· ${escapeHtml(matName)}</span>
                        </div>
                        <div class="gallery-row-actions">
                            <button class="btn-row-action btn-load" data-id="${id}" title="Load creation">
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                <span>Load</span>
                            </button>
                            <button class="btn-row-icon btn-share" data-id="${id}" title="Copy Share Link">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            </button>
                            ${this.activeTab === 'saved' ? `
                                <button class="btn-row-icon btn-delete" data-id="${id}" title="Delete Creation">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
        }

        html += `</div>`;
        bodyContainer.innerHTML = html;

        // Attach event listeners
        bodyContainer.querySelector('#btn-share-current')?.addEventListener('click', () => {
            this.copyShareLink();
        });

        bodyContainer.querySelector('#btn-save-current')?.addEventListener('click', () => {
            this.saveCurrentScene();
        });

        bodyContainer.querySelectorAll('.gallery-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeTab = e.currentTarget.dataset.tab;
                this.render();
            });
        });

        bodyContainer.querySelectorAll('.btn-load, .btn-card-load, .btn-card-load-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const found = displayList.find(x => x.id === id);
                if (found) {
                    this.loadScene(found);
                }
            });
        });

        bodyContainer.querySelectorAll('.btn-share, .btn-card-share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const found = displayList.find(x => x.id === id);
                if (found) {
                    this.copyShareLink(found);
                }
            });
        });

        bodyContainer.querySelectorAll('.btn-delete, .btn-card-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('Delete this creation from your folder?')) {
                    this.deleteSavedScene(id);
                }
            });
        });

        bodyContainer.querySelectorAll('.btn-card-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('Delete this creation from your folder?')) {
                    this.deleteSavedScene(id);
                }
            });
        });
    }
}
