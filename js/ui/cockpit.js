// js/ui/cockpit.js
// Pro Studio UI Controller:
// Floating top bar, retractable side drawers with tabbed workflows, floating transport island

import { FORMULAS, FORMULA_IDS } from '../formulas/registry.js';
import { GLOBAL_PARAMS } from '../state/parameters.js';
import { PALETTE_PRESETS } from '../state/palettes.js';
import { MOD_SOURCE, LFO_WAVE, AUDIO_BAND } from '../modulation/engine.js';

export class CockpitUI {
    constructor(state, modulation, audio, camera, raymarcher) {
        this.state = state;
        this.mod = modulation;
        this.audio = audio;
        this.camera = camera;
        this.raymarcher = raymarcher;

        this.activeModParamId = null;
        this.sliderEls = new Map();
        this.ghostPips = new Map();

        this.initDOMElements();
        this.setupEventListeners();
        this.renderFormulaParams();

        // Subscribe to state updates
        this.state.subscribe((id, val) => {
            this.syncSliderUI(id, val);
        });

        this.state.onFormulaChange((formula) => {
            this.renderFormulaParams();
            this.updateHeaderInfo();
            if (this.camera) this.camera.resetToDefaultZoom();
            this.raymarcher.resetAccumulation();
        });

        this.state.onFormulaMorph((morph) => {
            if (this.elFormulaSelect) this.elFormulaSelect.value = morph.toId;
            const targetFormula = FORMULAS[morph.toId];
            if (targetFormula) {
                const elFormulaDisplay = document.getElementById('formula-name-display');
                if (elFormulaDisplay) elFormulaDisplay.textContent = targetFormula.name;
                const elFormulaName = document.getElementById('hud-formula-name');
                if (elFormulaName) elFormulaName.textContent = targetFormula.name;
                const elFormulaSub = document.getElementById('hud-formula-sub');
                if (elFormulaSub) elFormulaSub.textContent = targetFormula.subtitle;
            }
            this.raymarcher.resetAccumulation();
        });
    }

    initDOMElements() {
        this.elSettingsDrawer = document.getElementById('settings-drawer');
        this.elFormulaSelect = document.getElementById('formula-select');
        this.elFormulaParamsContainer = document.getElementById('formula-params-container');
        this.elPresetsGrid = document.getElementById('presets-grid');
        this.elPaletteSelect = document.getElementById('palette-preset-select');
        this.elShadingParamsContainer = document.getElementById('shading-params-container');
        this.elLightSunContainer = document.getElementById('light-sun-container');
        this.elLightRimContainer = document.getElementById('light-rim-container');
        this.elLightEnvContainer = document.getElementById('light-env-container');
        this.elLightGlowContainer = document.getElementById('light-glow-container');
        this.elCamParamsContainer = document.getElementById('cam-params-container');
        this.elModPopover = document.getElementById('mod-popover');
        
        // Populate Formula Select with concise titles for top bar
        if (this.elFormulaSelect) {
            this.elFormulaSelect.innerHTML = '';
            for (const [id, f] of Object.entries(FORMULAS)) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = f.name;
                this.elFormulaSelect.appendChild(opt);
            }
            this.elFormulaSelect.value = this.state.activeFormulaId;
        }

        // Populate Palette Select with natural geological material presets
        if (this.elPaletteSelect) {
            this.elPaletteSelect.innerHTML = '';
            for (const p of PALETTE_PRESETS) {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                this.elPaletteSelect.appendChild(opt);
            }
            this.elPaletteSelect.value = PALETTE_PRESETS[0].id;
        }

        const elMatName = document.getElementById('material-name-display');
        if (elMatName) elMatName.textContent = PALETTE_PRESETS[0].name;

        // Render Global Controls
        this.renderGlobalParams();
        this.updateHeaderInfo();
    }

    updateHeaderInfo() {
        const formula = this.state.getActiveFormula();
        const elFormulaName = document.getElementById('hud-formula-name');
        if (elFormulaName) elFormulaName.textContent = formula.name;
        const elFormulaSub = document.getElementById('hud-formula-sub');
        if (elFormulaSub) elFormulaSub.textContent = formula.subtitle;
        const elFormulaDisplay = document.getElementById('formula-name-display');
        if (elFormulaDisplay) elFormulaDisplay.textContent = formula.name;
        if (this.elFormulaSelect) {
            this.elFormulaSelect.value = this.state.activeFormulaId;
        }
        this.renderPresets();
    }

    renderPresets() {
        const formula = this.state.getActiveFormula();
        this.elPresetsGrid.innerHTML = '';
        formula.presets.forEach((p, idx) => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            if (idx === 0) btn.classList.add('active');
            btn.textContent = p.name;
            btn.addEventListener('click', () => {
                // Visual feedback on selected preset button
                this.elPresetsGrid.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Smoothly morph parameters gradually over 1.3 seconds
                this.state.morphToValues(p.values, 1.3,
                    () => this.raymarcher.resetAccumulation(),
                    () => this.raymarcher.resetAccumulation()
                );
            });
            this.elPresetsGrid.appendChild(btn);
        });
    }

    createSliderRow(p) {
        const row = document.createElement('div');
        row.className = 'slider-row';
        row.dataset.paramId = p.id;

        const info = document.createElement('div');
        info.className = 'slider-info';

        const label = document.createElement('label');
        label.textContent = p.name;

        const rightInfo = document.createElement('div');
        rightInfo.className = 'slider-right-info';

        const valSpan = document.createElement('span');
        valSpan.className = 'val-badge';
        valSpan.textContent = (typeof p.default === 'number' && p.type !== 'int') ? p.default.toFixed(2) : p.default;

        // Modulation Badge Button [~]
        const modBtn = document.createElement('button');
        modBtn.className = 'mod-btn';
        modBtn.title = 'Attach LFO or Audio Modulation';
        modBtn.innerHTML = '<span>~</span>';
        if (this.mod.getBinding(p.id)) {
            modBtn.classList.add('active');
        }

        modBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModPopover(p, modBtn);
        });

        rightInfo.appendChild(valSpan);
        rightInfo.appendChild(modBtn);
        info.appendChild(label);
        info.appendChild(rightInfo);

        // Track container (for ghost pip and slider)
        const trackWrap = document.createElement('div');
        trackWrap.className = 'track-wrap';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = p.min;
        slider.max = p.max;
        slider.step = p.step;
        slider.value = this.state.get(p.id);

        const ghostPip = document.createElement('div');
        ghostPip.className = 'ghost-pip';
        ghostPip.style.display = this.mod.getBinding(p.id) ? 'block' : 'none';

        trackWrap.appendChild(slider);
        trackWrap.appendChild(ghostPip);

        slider.addEventListener('input', (e) => {
            const v = (p.type === 'int') ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
            this.state.set(p.id, v, false);
            valSpan.textContent = (p.type === 'int') ? v : v.toFixed(2);
            this.raymarcher.resetAccumulation();
        });

        slider.addEventListener('change', (e) => {
            const v = (p.type === 'int') ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
            this.state.set(p.id, v, true);
        });

        row.appendChild(info);
        row.appendChild(trackWrap);

        this.sliderEls.set(p.id, { slider, valSpan, modBtn, ghostPip, param: p });
        return row;
    }

    renderFormulaParams() {
        const formula = this.state.getActiveFormula();
        this.elFormulaParamsContainer.innerHTML = '';
        for (const p of formula.params) {
            this.elFormulaParamsContainer.appendChild(this.createSliderRow(p));
        }
    }

    renderGlobalParams() {
        this.elShadingParamsContainer.innerHTML = '';
        if (this.elLightSunContainer) this.elLightSunContainer.innerHTML = '';
        if (this.elLightRimContainer) this.elLightRimContainer.innerHTML = '';
        if (this.elLightEnvContainer) this.elLightEnvContainer.innerHTML = '';
        if (this.elLightGlowContainer) this.elLightGlowContainer.innerHTML = '';
        if (this.elCamParamsContainer) this.elCamParamsContainer.innerHTML = '';

        for (const p of GLOBAL_PARAMS) {
            const row = this.createSliderRow(p);
            if (p.group === 'shading' || p.group === 'render') {
                this.elShadingParamsContainer.appendChild(row);
            } else if (p.group === 'light_sun' && this.elLightSunContainer) {
                this.elLightSunContainer.appendChild(row);
            } else if (p.group === 'light_rim' && this.elLightRimContainer) {
                this.elLightRimContainer.appendChild(row);
            } else if (p.group === 'light_env' && this.elLightEnvContainer) {
                this.elLightEnvContainer.appendChild(row);
            } else if (p.group === 'light_glow' && this.elLightGlowContainer) {
                this.elLightGlowContainer.appendChild(row);
            } else if (p.group === 'camera' && this.elCamParamsContainer) {
                this.elCamParamsContainer.appendChild(row);
            }
        }
    }

    syncSliderUI(id, val) {
        const entry = this.sliderEls.get(id);
        if (entry) {
            entry.slider.value = val;
            entry.valSpan.textContent = (entry.param.type === 'int') ? Math.round(val) : val.toFixed(2);
        }
    }

    // Modulation Popover
    openModPopover(param, btnElement) {
        this.activeModParamId = param.id;
        const rect = btnElement.getBoundingClientRect();
        
        this.elModPopover.style.top = `${Math.min(window.innerHeight - 320, Math.max(20, rect.top - 60))}px`;
        this.elModPopover.style.left = `${Math.max(20, rect.right + 12)}px`;
        this.elModPopover.classList.remove('hidden');

        document.getElementById('mod-target-name').textContent = param.name;

        const currentBinding = this.mod.getBinding(param.id);
        const sourceSelect = document.getElementById('mod-source');
        const lfoPanel = document.getElementById('mod-lfo-panel');
        const audioPanel = document.getElementById('mod-audio-panel');

        if (currentBinding) {
            sourceSelect.value = currentBinding.source;
            if (currentBinding.source === MOD_SOURCE.LFO) {
                document.getElementById('lfo-wave').value = currentBinding.wave;
                document.getElementById('lfo-rate').value = currentBinding.rate;
                document.getElementById('lfo-depth').value = currentBinding.depth;
            } else if (currentBinding.source === MOD_SOURCE.AUDIO) {
                document.getElementById('audio-band').value = currentBinding.band;
                document.getElementById('audio-gain').value = currentBinding.gain;
            }
        } else {
            sourceSelect.value = MOD_SOURCE.NONE;
        }

        const updatePanels = () => {
            const val = sourceSelect.value;
            lfoPanel.style.display = (val === MOD_SOURCE.LFO) ? 'block' : 'none';
            audioPanel.style.display = (val === MOD_SOURCE.AUDIO) ? 'block' : 'none';
        };
        updatePanels();

        sourceSelect.onchange = () => {
            updatePanels();
            this.applyModulationFromUI();
        };

        ['lfo-wave', 'lfo-rate', 'lfo-depth', 'audio-band', 'audio-gain'].forEach(id => {
            const el = document.getElementById(id);
            el.oninput = () => this.applyModulationFromUI();
        });
    }

    applyModulationFromUI() {
        if (!this.activeModParamId) return;
        const paramId = this.activeModParamId;
        const source = document.getElementById('mod-source').value;
        const entry = this.sliderEls.get(paramId);

        if (source === MOD_SOURCE.NONE) {
            this.mod.clearBinding(paramId);
            if (entry) {
                entry.modBtn.classList.remove('active');
                entry.ghostPip.style.display = 'none';
            }
        } else if (source === MOD_SOURCE.LFO) {
            this.mod.bindLFO(paramId, {
                wave: document.getElementById('lfo-wave').value,
                rate: parseFloat(document.getElementById('lfo-rate').value),
                depth: parseFloat(document.getElementById('lfo-depth').value)
            });
            if (entry) {
                entry.modBtn.classList.add('active');
                entry.ghostPip.style.display = 'block';
            }
        } else if (source === MOD_SOURCE.AUDIO) {
            this.mod.bindAudio(paramId, {
                band: document.getElementById('audio-band').value,
                gain: parseFloat(document.getElementById('audio-gain').value)
            });
            if (entry) {
                entry.modBtn.classList.add('active');
                entry.ghostPip.style.display = 'block';
            }
        }
    }

    setupEventListeners() {
        // Manual Zoom Override Reset Camera Button
        const btnResetZoom = document.getElementById('btn-reset-zoom');
        if (btnResetZoom) {
            btnResetZoom.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.camera) {
                    this.camera.resetToDefaultZoom();
                }
                this.raymarcher.resetAccumulation();
            });
        }

        // Hook Camera Zoom Override State Callback to show/hide Camera Icon
        if (this.camera) {
            this.camera.onZoomOverrideChange = (isOverridden) => {
                if (btnResetZoom) {
                    if (isOverridden) {
                        btnResetZoom.classList.add('visible');
                    } else {
                        btnResetZoom.classList.remove('visible');
                    }
                }
            };
        }

        // Unified Settings Drawer Toggle (Top app bar Settings button)
        const btnToggleSettings = document.getElementById('btn-toggle-settings');
        if (btnToggleSettings && this.elSettingsDrawer) {
            btnToggleSettings.addEventListener('click', () => {
                const isClosed = this.elSettingsDrawer.classList.toggle('closed');
                btnToggleSettings.classList.toggle('active', !isClosed);
            });
        }

        // Tab Switching inside Drawers
        document.querySelectorAll('.drawer-tabs').forEach(tabBar => {
            tabBar.querySelectorAll('.d-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const drawer = btn.closest('.side-drawer');
                    drawer.querySelectorAll('.d-tab-btn').forEach(b => b.classList.remove('active'));
                    drawer.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    btn.classList.add('active');
                    const targetPane = document.getElementById(btn.dataset.tab);
                    if (targetPane) targetPane.classList.add('active');
                });
            });
        });

        // Formula Switcher
        if (this.elFormulaSelect) {
            this.elFormulaSelect.addEventListener('change', (e) => {
                this.deformCount = 0;
                this.state.startFormulaMorph(e.target.value, 1.6);
            });
        }

        // 1. Fractal Formula Stepper & Cycler
        const formulaIds = Object.keys(FORMULAS);
        const switchFormulaByIndex = (direction) => {
            this.deformCount = 0;
            const currentActive = this.state.formulaMorph ? this.state.formulaMorph.toId : this.state.activeFormulaId;
            const currentIdx = formulaIds.indexOf(currentActive);
            let nextIdx = (currentIdx + direction + formulaIds.length) % formulaIds.length;
            const nextId = formulaIds[nextIdx];
            this.state.startFormulaMorph(nextId, 1.6);
            if (this.elFormulaSelect) this.elFormulaSelect.value = nextId;
            this.raymarcher.resetAccumulation();
        };
        this.switchFormulaByIndex = switchFormulaByIndex;

        const fPrev = document.getElementById('formula-prev-btn');
        const fNext = document.getElementById('formula-next-btn');
        const fCycle = document.getElementById('formula-cycle-btn');
        if (fPrev) fPrev.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(-1); });
        if (fNext) fNext.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(1); });
        if (fCycle) fCycle.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(1); });

        // 2. Natural Material Stepper & Cycler
        // Strict whitelist: material preset changes ONLY affect surface optics & reflectance, NEVER lighting
        const ALLOWED_MATERIAL_KEYS = [
            'trap_mode', 'color_cycle', 'color_phase',
            'pal_a_r', 'pal_a_g', 'pal_a_b',
            'pal_b_r', 'pal_b_g', 'pal_b_b',
            'pal_c_r', 'pal_c_g', 'pal_c_b',
            'pal_d_r', 'pal_d_g', 'pal_d_b',
            'metallic', 'roughness'
        ];
        const applyPureMaterialValues = (preset) => {
            if (!preset || !preset.values) return;
            const cleanValues = {};
            for (const k of ALLOWED_MATERIAL_KEYS) {
                if (preset.values[k] !== undefined) {
                    cleanValues[k] = preset.values[k];
                }
            }
            this.state.setMany(cleanValues, true);
        };

        this.activeMaterialIndex = 0;
        const switchMaterialByIndex = (direction) => {
            this.activeMaterialIndex = (this.activeMaterialIndex + direction + PALETTE_PRESETS.length) % PALETTE_PRESETS.length;
            const preset = PALETTE_PRESETS[this.activeMaterialIndex];
            if (preset) {
                applyPureMaterialValues(preset);
                if (this.elPaletteSelect) this.elPaletteSelect.value = preset.id;
                const elMat = document.getElementById('material-name-display');
                if (elMat) elMat.textContent = preset.name;
                this.raymarcher.resetAccumulation();
            }
        };

        const mPrev = document.getElementById('material-prev-btn');
        const mNext = document.getElementById('material-next-btn');
        const mCycle = document.getElementById('material-cycle-btn');
        if (mPrev) mPrev.addEventListener('click', (e) => { e.stopPropagation(); switchMaterialByIndex(-1); });
        if (mNext) mNext.addEventListener('click', (e) => { e.stopPropagation(); switchMaterialByIndex(1); });
        if (mCycle) mCycle.addEventListener('click', (e) => { e.stopPropagation(); switchMaterialByIndex(1); });

        // Palette Switcher
        if (this.elPaletteSelect) {
            this.elPaletteSelect.addEventListener('change', (e) => {
                const preset = PALETTE_PRESETS.find(p => p.id === e.target.value);
                if (preset) {
                    applyPureMaterialValues(preset);
                    const elMat = document.getElementById('material-name-display');
                    if (elMat) elMat.textContent = preset.name;
                    this.raymarcher.resetAccumulation();
                }
            });
        }

        this.applyMaterialPreset = (id) => {
            const idx = PALETTE_PRESETS.findIndex(p => p.id === id);
            if (idx >= 0) {
                this.activeMaterialIndex = idx;
                const preset = PALETTE_PRESETS[idx];
                applyPureMaterialValues(preset);
                if (this.elPaletteSelect) this.elPaletteSelect.value = preset.id;
                const elMat = document.getElementById('material-name-display');
                if (elMat) elMat.textContent = preset.name;
                this.raymarcher.resetAccumulation();
            }
        };

        // Light 1 (Sun) ON/OFF Toggle Pill
        const btnToggleSun = document.getElementById('btn-toggle-light-sun');
        if (btnToggleSun) {
            let savedSunIntensity = this.state.get('sun_intensity') || 1.6;
            btnToggleSun.addEventListener('click', () => {
                const current = this.state.get('sun_intensity');
                if (current > 0.01) {
                    savedSunIntensity = current;
                    this.state.setWithInertia('sun_intensity', 0.0);
                } else {
                    this.state.setWithInertia('sun_intensity', savedSunIntensity || 1.6);
                }
            });
            this.state.subscribe('sun_intensity', (val) => {
                const isOn = val > 0.01;
                btnToggleSun.classList.toggle('active', isOn);
                btnToggleSun.textContent = isOn ? 'ON' : 'OFF';
            });
        }

        // Light 2 (Rim) ON/OFF Toggle Pill
        const btnToggleRim = document.getElementById('btn-toggle-light-rim');
        if (btnToggleRim) {
            let savedRimIntensity = this.state.get('backlight_intensity') || 1.5;
            btnToggleRim.addEventListener('click', () => {
                const current = this.state.get('backlight_intensity');
                if (current > 0.01) {
                    savedRimIntensity = current;
                    this.state.setWithInertia('backlight_intensity', 0.0);
                } else {
                    this.state.setWithInertia('backlight_intensity', savedRimIntensity || 1.5);
                }
            });
            this.state.subscribe('backlight_intensity', (val) => {
                const isOn = val > 0.01;
                btnToggleRim.classList.toggle('active', isOn);
                btnToggleRim.textContent = isOn ? 'ON' : 'OFF';
            });
        }

        // Light 4 (Core Glow) ON/OFF Toggle Pill
        const btnToggleGlow = document.getElementById('btn-toggle-light-glow');
        if (btnToggleGlow) {
            let savedGlowIntensity = this.state.get('glow_intensity') || 0.1;
            btnToggleGlow.addEventListener('click', () => {
                const current = this.state.get('glow_intensity');
                if (current > 0.01) {
                    savedGlowIntensity = current;
                    this.state.setWithInertia('glow_intensity', 0.0);
                } else {
                    this.state.setWithInertia('glow_intensity', savedGlowIntensity || 0.1);
                }
            });
            this.state.subscribe('glow_intensity', (val) => {
                const isOn = val > 0.01;
                btnToggleGlow.classList.toggle('active', isOn);
                btnToggleGlow.textContent = isOn ? 'ON' : 'OFF';
            });
        }

        // Close Popover when clicking outside
        if (this.elModPopover) {
            document.addEventListener('click', (e) => {
                if (!this.elModPopover.contains(e.target) && !e.target.closest('.mod-btn')) {
                    this.elModPopover.classList.add('hidden');
                    this.activeModParamId = null;
                }
            });
        }

        const modCloseBtn = document.getElementById('mod-close-btn');
        if (modCloseBtn && this.elModPopover) {
            modCloseBtn.addEventListener('click', () => {
                this.elModPopover.classList.add('hidden');
                this.activeModParamId = null;
            });
        }

        // Camera Presets Grid (Action Cam, Fly-By Cam, Follow Cam, Dynamic Cam, etc.)
        const camPresetBtns = document.querySelectorAll('#camera-presets-grid .cam-preset-btn');
        camPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                camPresetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const preset = btn.dataset.preset;
                this.camera.setCameraPreset(preset);
                this.raymarcher.resetAccumulation();
            });
        });

        // Auto-Rotate Button
        const btnAutoRotate = document.getElementById('auto-rotate-btn');
        if (btnAutoRotate) {
            btnAutoRotate.addEventListener('click', () => {
                this.camera.autoRotate = !this.camera.autoRotate;
                btnAutoRotate.classList.toggle('active', this.camera.autoRotate);
            });
        }

        // Camera Reset
        const btnCamReset = document.getElementById('cam-reset-btn');
        if (btnCamReset) {
            btnCamReset.addEventListener('click', () => {
                const defCam = this.state.getActiveFormula().defaultCam;
                this.camera.resetView(defCam.pos, defCam.target);
                this.camera.setCameraPreset('follow');
                camPresetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === 'follow'));
                this.raymarcher.resetAccumulation();
            });
        }

        // A/B Morph Bar
        const btnSnapA = document.getElementById('snap-a-btn');
        if (btnSnapA) {
            btnSnapA.addEventListener('click', () => {
                this.state.snapA();
                btnSnapA.classList.add('snapped');
            });
        }

        const btnSnapB = document.getElementById('snap-b-btn');
        if (btnSnapB) {
            btnSnapB.addEventListener('click', () => {
                this.state.snapB();
                btnSnapB.classList.add('snapped');
            });
        }

        const morphSlider = document.getElementById('morph-slider');
        if (morphSlider) {
            morphSlider.addEventListener('input', (e) => {
                const t = parseFloat(e.target.value);
                this.state.setMorphProgress(t);
                this.raymarcher.resetAccumulation();
            });
        }

        // Continuous Auto-Deform Toggle State & Timer (ON BY DEFAULT)
        this.isAutoDeforming = true;
        this.autoDeformTimer = null;
        this.deformCount = 0; // count random shapes generated on the current formula

        // Deform Randomizer Toggle (ON/OFF with 5s rest interval)
        const deformBtn = document.getElementById('deform-dice-btn');
        if (deformBtn) {
            const runAutoDeformCycle = () => {
                if (!this.isAutoDeforming) return;

                deformBtn.classList.add('active');
                deformBtn.title = 'Deforming... (Click to Stop)';

                // Smooth 10-second organic liquid morph
                this.state.smoothDeformRandom(10.0, 
                    (progress) => {
                        this.raymarcher.resetAccumulation();
                    },
                    () => {
                        // Morph completed!
                        if (!this.isAutoDeforming) {
                            deformBtn.classList.remove('active');
                            deformBtn.title = 'Auto-Deform: OFF (Click to Start)';
                            return;
                        }

                        this.deformCount++;

                        // After every three random shapes, change the formula as well!
                        if (this.deformCount >= 3) {
                            this.deformCount = 0;
                            switchFormulaByIndex(1);
                        }

                        // Wait 5 seconds before triggering the next organic shape
                        deformBtn.title = 'Resting (5s)...';

                        this.autoDeformTimer = setTimeout(() => {
                            if (this.isAutoDeforming) {
                                runAutoDeformCycle();
                            }
                        }, 5000);
                    }
                );
            };

            deformBtn.addEventListener('click', () => {
                this.isAutoDeforming = !this.isAutoDeforming;

                if (this.isAutoDeforming) {
                    this.deformCount = 0;
                    deformBtn.classList.add('active');
                    deformBtn.title = 'Deforming... (Click to Stop)';
                    runAutoDeformCycle();
                } else {
                    deformBtn.classList.remove('active');
                    deformBtn.title = 'Auto-Deform: OFF (Click to Start)';
                    if (this.autoDeformTimer) {
                        clearTimeout(this.autoDeformTimer);
                        this.autoDeformTimer = null;
                    }
                    if (this.state.morphAnim) {
                        cancelAnimationFrame(this.state.morphAnim);
                        this.state.morphAnim = null;
                    }
                }
            });

            // Trigger immediately on load as requested!
            deformBtn.classList.add('active');
            deformBtn.title = 'Deforming... (Click to Stop)';
            setTimeout(() => {
                if (this.isAutoDeforming) {
                    runAutoDeformCycle();
                }
            }, 600);
        }

        const btnUndo = document.getElementById('undo-btn');
        if (btnUndo) {
            btnUndo.addEventListener('click', () => {
                this.state.undo();
                this.raymarcher.resetAccumulation();
            });
        }

        const btnRedo = document.getElementById('redo-btn');
        if (btnRedo) {
            btnRedo.addEventListener('click', () => {
                this.state.redo();
                this.raymarcher.resetAccumulation();
            });
        }

        // Audio Reactivity Transport
        const synthBtn = document.getElementById('audio-synth-btn');
        const micBtn = document.getElementById('audio-mic-btn');
        const fileInput = document.getElementById('audio-file-input');

        if (synthBtn) {
            synthBtn.addEventListener('click', () => {
                if (this.audio.sourceType === 'synth' && this.audio.isPlaying) {
                    this.audio.stopCurrentSource();
                    synthBtn.classList.remove('active');
                } else {
                    this.audio.startSynthBeat();
                    synthBtn.classList.add('active');
                    micBtn?.classList.remove('active');
                }
            });
        }

        if (micBtn) {
            micBtn.addEventListener('click', async () => {
                if (this.audio.sourceType === 'mic' && this.audio.isPlaying) {
                    this.audio.stopCurrentSource();
                    micBtn.classList.remove('active');
                } else {
                    const ok = await this.audio.startMicrophone();
                    if (ok) {
                        micBtn.classList.add('active');
                        synthBtn?.classList.remove('active');
                    }
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const ok = await this.audio.loadAudioFile(e.target.files[0]);
                    if (ok) {
                        synthBtn?.classList.remove('active');
                        micBtn?.classList.remove('active');
                    }
                }
            });
        }

        // Zen Mode Toggle (H)
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.code === 'KeyH') {
                document.body.classList.toggle('zen-mode');
            }
        });

        const zenBtn = document.getElementById('zen-btn');
        if (zenBtn) {
            zenBtn.addEventListener('click', () => {
                document.body.classList.toggle('zen-mode');
            });
        }

        const snapshotBtn = document.getElementById('snapshot-btn');
        if (snapshotBtn) {
            snapshotBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.download = `fractal-${this.state.activeFormulaId}-${Date.now()}.png`;
                link.href = this.raymarcher.canvas.toDataURL('image/png');
                link.click();
            });
        }
    }

    updateFrame(modulatedValues, audioBands, fps, de, flightSpeed) {
        // Ghost pips on sliders
        for (const [paramId, val] of Object.entries(modulatedValues)) {
            const entry = this.sliderEls.get(paramId);
            if (entry && this.mod.getBinding(paramId)) {
                const p = entry.param;
                const pct = Math.max(0, Math.min(100, ((val - p.min) / (p.max - p.min)) * 100));
                entry.ghostPip.style.left = `${pct}%`;
            }
        }

        // Mini Audio EQ
        if (audioBands) {
            const setMeter = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.style.height = `${Math.min(100, Math.max(10, val * 100))}%`;
            };
            setMeter('eq-bar-bass', audioBands.bass);
            setMeter('eq-bar-lowmid', audioBands.lowMid);
            setMeter('eq-bar-highmid', audioBands.highMid);
            setMeter('eq-bar-treble', audioBands.treble);
        }

        // Bottom-left FPS HUD
        const hudFps = document.getElementById('hud-fps');
        if (hudFps) {
            const roundedFps = Math.round(fps);
            hudFps.textContent = roundedFps;
            const dot = document.querySelector('.fps-dot');
            if (dot) {
                if (roundedFps >= 50) {
                    dot.style.background = '#10b981';
                    dot.style.boxShadow = '0 0 8px #10b981';
                } else if (roundedFps >= 30) {
                    dot.style.background = '#f59e0b';
                    dot.style.boxShadow = '0 0 8px #f59e0b';
                } else {
                    dot.style.background = '#ef4444';
                    dot.style.boxShadow = '0 0 8px #ef4444';
                }
            }
        }
        const hudScale = document.getElementById('hud-scale');
        if (hudScale) hudScale.textContent = `${this.raymarcher.activeScale.toFixed(2)}x`;
    }
}
