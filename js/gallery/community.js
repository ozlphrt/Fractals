/**
 * Community Gallery & Creation Sharing System
 * Supports URL-safe encoded scene links, community showcase catalog,
 * and persistent local creations storage.
 */

import { FORMULA_IDS } from '../formulas/registry.js';

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
        id: 'curated-05',
        title: 'Dark Loam Brutalist Citadel',
        author: '@architect_m',
        formula: FORMULA_IDS.MANDELBOX,
        material: 'dark_loam',
        params: {
            mbox_scale: 2.25,
            mbox_iterations: 10,
            mbox_fold_limit: 1.0,
            mbox_min_radius: 0.5,
            mbox_fixed_radius: 1.0,
            mbox_rot_x: 0.0,
            mbox_rot_y: 0.0,
            mbox_rot_z: 0.0,
            mbox_offset_x: 0.0,
            mbox_offset_y: 0.0,
            mbox_offset_z: 0.0,
            glow_intensity: 0.1
        },
        camera: {
            pos: [3.8, 2.6, 4.2],
            target: [0.0, 0.0, 0.0],
            preset: 'flyby',
            orbitRadius: 6.2
        },
        tags: ['Mandelbox', 'Brutalist', 'Loam']
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
        title: 'Weathered Timber Seahorse',
        author: '@quaternion_god',
        formula: FORMULA_IDS.QUAT_MANDELBROT,
        material: 'driftwood_bone',
        params: {
            qm_slice_w: -0.15,
            qm_rot_xw: -0.65,
            qm_rot_yw: 0.50,
            qm_iterations: 14,
            glow_intensity: 0.1
        },
        camera: {
            pos: [0.0, 0.0, 1.55],
            target: [0.0, 0.0, 0.0],
            preset: 'turntable',
            orbitRadius: 1.55
        },
        tags: ['4D', 'Mandelbrot', 'Timber']
    }
];

const LOCAL_STORAGE_KEY = 'fractals_community_saved_v1';

export class GalleryManager {
    constructor(app) {
        this.app = app;
        this.drawer = document.getElementById('gallery-drawer');
        this.toggleBtn = document.getElementById('btn-toggle-gallery');
        this.closeBtn = document.getElementById('btn-close-gallery');
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

        // Check for shared URL hash on initial load
        this.checkSharedUrl();

        // Render drawer contents
        this.render();
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
        this.drawer.classList.remove('closed');
        if (this.toggleBtn) this.toggleBtn.classList.add('active');
        this.render();
    }

    close() {
        if (!this.drawer) return;
        this.drawer.classList.add('closed');
        if (this.toggleBtn) this.toggleBtn.classList.remove('active');
    }

    // Serializes current app state to a compact JSON object
    getCurrentSceneData(name = 'My Fractal Creation') {
        const formulaId = this.app.formulaRegistry?.activeFormula?.id || FORMULA_IDS.MANDELBULB;
        const currentVals = this.app.params?.getValues() || {};
        const activeFormulaParams = this.app.formulaRegistry?.activeFormula?.params || [];
        
        // Pick only parameters relevant to this formula
        const formulaParams = {};
        for (const p of activeFormulaParams) {
            if (currentVals[p.id] !== undefined) {
                formulaParams[p.id] = currentVals[p.id];
            }
        }
        formulaParams['glow_intensity'] = currentVals['glow_intensity'] ?? 0.05;

        const currentMaterial = this.app.materials?.currentPresetId || 'iridescent_pearl';
        const cameraState = this.app.camera?.getState ? this.app.camera.getState() : null;

        return {
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        this.showToast(`Saved "${scene.title}" to My Creations!`);
        this.activeTab = 'saved';
        this.render();
    }

    getSavedScenes() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    deleteSavedScene(id) {
        const list = this.getSavedScenes().filter(s => s.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        this.showToast('Creation removed.');
        this.render();
    }

    // Loads a scene smoothly into the engine
    loadScene(scene, showToastMessage = true) {
        if (!scene || !scene.formula) return;

        // 1. Switch formula if different (immediate load to cleanly activate required DE shader)
        if (this.app.setFormula && scene.formula !== this.app.formulaRegistry?.activeFormula?.id) {
            this.app.setFormula(scene.formula, true);
        }

        // 2. Apply parameters smoothly (preserving 0.05 glow baseline)
        if (scene.params) {
            const paramsToApply = { glow_intensity: 0.05, ...scene.params };
            if (this.app.params?.morphToValues) {
                this.app.params.morphToValues(paramsToApply, 1.2);
            } else if (this.app.params?.setMany) {
                this.app.params.setMany(paramsToApply, true);
            }
        }

        // 3. Apply material preset
        if (scene.material && this.app.materials?.applyPreset) {
            this.app.materials.applyPreset(scene.material);
        }

        // 4. Set camera state smoothly
        if (scene.camera && this.app.camera?.setState) {
            this.app.camera.setState(scene.camera, true);
        }

        if (showToastMessage) {
            this.showToast(`Loaded: ${scene.title || 'Scene'}`);
        }
    }

    checkSharedUrl() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#c=')) {
            const b64 = hash.slice(3);
            const scene = this.decodeScene(b64);
            if (scene) {
                // Wait for engine initialization
                setTimeout(() => {
                    this.loadScene(scene, false);
                    this.showToast(`🚀 Loaded shared creation: "${scene.title || 'Fractal'}" by ${scene.author || 'User'}`);
                }, 400);
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

        const savedScenes = this.getSavedScenes();
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
                const formulaName = this.app.formulaRegistry?.getFormula(item.formula)?.name || item.formula;
                const matName = (item.material || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

                html += `
                    <div class="gallery-row" data-id="${item.id}">
                        <div class="gallery-row-main btn-load" data-id="${item.id}" title="Click to load: ${item.title}">
                            <span class="gallery-row-badge">${formulaName}</span>
                            <span class="gallery-row-title">${item.title}</span>
                            <span class="gallery-row-sub">· ${matName}</span>
                        </div>
                        <div class="gallery-row-actions">
                            <button class="btn-row-action btn-load" data-id="${item.id}" title="Load creation">
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                <span>Load</span>
                            </button>
                            <button class="btn-row-icon btn-share" data-id="${item.id}" title="Copy Share Link">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            </button>
                            ${this.activeTab === 'saved' ? `
                                <button class="btn-row-icon btn-delete" data-id="${item.id}" title="Delete Creation">
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
