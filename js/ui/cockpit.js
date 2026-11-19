// js/ui/cockpit.js
// Pro Studio UI Controller:
// Floating top bar, retractable side drawers with tabbed workflows, floating transport island

import { FORMULAS, FORMULA_CYCLE_ORDER, getFormulaLabel } from '../formulas/registry.js';
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
        this.keyframeSliders = new Map();
        this.cameraPoseSliders = [];
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
            // Never hard-reset camera on formula change!
            // updateAutoZoom already glides the camera distance smoothly without jumps or resetting presets
        });

        this.state.onFormulaMorph((morph) => {
            if (this.elFormulaSelect) this.elFormulaSelect.value = morph.toId;
            const targetFormula = FORMULAS[morph.toId];
            if (targetFormula) {
                const elFormulaDisplay = document.getElementById('formula-name-display');
                if (elFormulaDisplay) elFormulaDisplay.textContent = getFormulaLabel(morph.toId);
                const elFormulaName = document.getElementById('hud-formula-name');
                if (elFormulaName) elFormulaName.textContent = getFormulaLabel(morph.toId);
                const elFormulaSub = document.getElementById('hud-formula-sub');
                if (elFormulaSub) elFormulaSub.textContent = targetFormula.subtitle;
            }
        });
    }

    initDOMElements() {
        this.eqMeters = [
            ['bass', document.getElementById('eq-bar-bass')],
            ['lowMid', document.getElementById('eq-bar-lowmid')],
            ['highMid', document.getElementById('eq-bar-highmid')],
            ['treble', document.getElementById('eq-bar-treble')]
        ];
        this.elHudScale = document.getElementById('hud-scale');
        this.nextTelemetryUpdate = 0;
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
        this.elHudFps = document.getElementById('hud-fps');
        this.elFpsDot = document.querySelector('.fps-dot');
        this.lastReportedFps = -1;
        
        // Populate Formula Select with concise titles for top bar
        if (this.elFormulaSelect) {
            this.elFormulaSelect.innerHTML = '';
            for (const id of FORMULA_CYCLE_ORDER) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = getFormulaLabel(id);
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
        if (elFormulaName) elFormulaName.textContent = getFormulaLabel(formula.id);
        const elFormulaSub = document.getElementById('hud-formula-sub');
        if (elFormulaSub) elFormulaSub.textContent = formula.subtitle;
        const elFormulaDisplay = document.getElementById('formula-name-display');
        if (elFormulaDisplay) elFormulaDisplay.textContent = getFormulaLabel(formula.id);
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
                this.state.morphToValues(p.values, 1.3);
            });
            this.elPresetsGrid.appendChild(btn);
        });
    }

    createSliderRow(p, isEmphasized = false) {
        const row = document.createElement('div');
        row.className = isEmphasized ? 'slider-row slider-emphasized' : 'slider-row';
        row.dataset.paramId = p.id;

        const info = document.createElement('div');
        info.className = 'slider-info';

        const label = document.createElement('label');
        if (isEmphasized) {
            label.innerHTML = `<span class="emphasized-dot">★</span> ${p.name}`;
        } else {
            label.textContent = p.name;
        }

        const rightInfo = document.createElement('div');
        rightInfo.className = 'slider-right-info';

        const formatValue = (v) => {
            if (p.enumNames) {
                const idx = Math.round(v);
                return p.enumNames[idx] ?? idx;
            }
            return (p.type === 'int') ? Math.round(v) : (typeof v === 'number' ? v.toFixed(2) : v);
        };

        const valSpan = document.createElement('span');
        valSpan.className = isEmphasized ? 'val-badge val-badge-emphasized' : 'val-badge';
        valSpan.textContent = formatValue(this.state.get(p.id) ?? p.default);

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
            if (p.id === 'sun_azimuth' || p.id === 'sun_elevation') {
                this.state.setMany({ sun_follow_camera: 0 });
            }
            this.state.set(p.id, v, false);
            valSpan.textContent = formatValue(v);
        });

        slider.addEventListener('change', (e) => {
            const v = (p.type === 'int') ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
            this.state.set(p.id, v, true);
        });
        this.attachKeyframeSlider([p.id], p.name, slider, trackWrap, rightInfo);

        row.appendChild(info);
        row.appendChild(trackWrap);

        // Editable Min and Max limits row
        const boundsRow = document.createElement('div');
        boundsRow.className = 'slider-bounds-row';

        const minWrap = document.createElement('div');
        minWrap.className = 'bound-field';
        const minLabel = document.createElement('span');
        minLabel.className = 'bound-tag';
        minLabel.textContent = 'min';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'bound-input';
        minInput.step = p.step || 'any';
        minInput.value = (p.type === 'int') ? p.min : parseFloat(p.min.toFixed(3));
        minInput.title = `Edit Min Bound for ${p.name}`;
        minWrap.appendChild(minLabel);
        minWrap.appendChild(minInput);

        const maxWrap = document.createElement('div');
        maxWrap.className = 'bound-field';
        const maxLabel = document.createElement('span');
        maxLabel.className = 'bound-tag';
        maxLabel.textContent = 'max';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'bound-input';
        maxInput.step = p.step || 'any';
        maxInput.value = (p.type === 'int') ? p.max : parseFloat(p.max.toFixed(3));
        maxInput.title = `Edit Max Bound for ${p.name}`;
        maxWrap.appendChild(maxLabel);
        maxWrap.appendChild(maxInput);

        boundsRow.appendChild(minWrap);
        boundsRow.appendChild(maxWrap);

        const applyBounds = () => {
            let nMin = parseFloat(minInput.value);
            let nMax = parseFloat(maxInput.value);
            if (isNaN(nMin)) nMin = p.min;
            if (isNaN(nMax)) nMax = p.max;
            if (nMin >= nMax) nMax = nMin + (p.type === 'int' ? 1 : 0.1);

            p.min = (p.type === 'int') ? Math.round(nMin) : nMin;
            p.max = (p.type === 'int') ? Math.round(nMax) : nMax;
            slider.min = p.min;
            slider.max = p.max;

            let curVal = this.state.get(p.id);
            if (curVal < p.min) {
                this.state.set(p.id, p.min, true);
                slider.value = p.min;
                valSpan.textContent = (p.type === 'int') ? p.min : p.min.toFixed(2);
            } else if (curVal > p.max) {
                this.state.set(p.id, p.max, true);
                slider.value = p.max;
                valSpan.textContent = (p.type === 'int') ? p.max : p.max.toFixed(2);
            }
        };

        minInput.addEventListener('change', applyBounds);
        maxInput.addEventListener('change', applyBounds);
        minInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { applyBounds(); minInput.blur(); } });
        maxInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { applyBounds(); maxInput.blur(); } });

        row.appendChild(boundsRow);

        this.sliderEls.set(p.id, { slider, valSpan, modBtn, ghostPip, param: p, minInput, maxInput });
        return row;
    }

    createRgbColorCluster(title, rId, gId, bId) {
        const paramR = GLOBAL_PARAMS.find(p => p.id === rId);
        const paramG = GLOBAL_PARAMS.find(p => p.id === gId);
        const paramB = GLOBAL_PARAMS.find(p => p.id === bId);
        if (!paramR || !paramG || !paramB) return null;

        const container = document.createElement('div');
        container.className = 'rgb-color-cluster';

        // Header row with Swatch & Hex preview
        const header = document.createElement('div');
        header.className = 'rgb-cluster-header';

        const titleLabel = document.createElement('span');
        titleLabel.className = 'rgb-cluster-title';
        titleLabel.textContent = title;

        const previewWrap = document.createElement('div');
        previewWrap.className = 'rgb-preview-wrap';

        const swatch = document.createElement('div');
        swatch.className = 'rgb-cluster-swatch';

        const hexLabel = document.createElement('span');
        hexLabel.className = 'rgb-hex-label';

        previewWrap.appendChild(swatch);
        previewWrap.appendChild(hexLabel);
        header.appendChild(titleLabel);
        header.appendChild(previewWrap);
        container.appendChild(header);

        const updateSwatch = () => {
            const r = Math.min(1.0, Math.max(0.0, this.state.get(rId) ?? paramR.default));
            const g = Math.min(1.0, Math.max(0.0, this.state.get(gId) ?? paramG.default));
            const b = Math.min(1.0, Math.max(0.0, this.state.get(bId) ?? paramB.default));
            const ir = Math.round(r * 255);
            const ig = Math.round(g * 255);
            const ib = Math.round(b * 255);
            swatch.style.background = `rgb(${ir}, ${ig}, ${ib})`;
            swatch.style.boxShadow = `0 0 10px rgba(${ir}, ${ig}, ${ib}, 0.55)`;
            const toHex = (n) => n.toString(16).padStart(2, '0');
            hexLabel.textContent = `#${toHex(ir)}${toHex(ig)}${toHex(ib)}`.toUpperCase();
        };

        const channels = [
            { param: paramR, tag: 'R', colorClass: 'channel-r', cssVar: '#ef4444' },
            { param: paramG, tag: 'G', colorClass: 'channel-g', cssVar: '#10b981' },
            { param: paramB, tag: 'B', colorClass: 'channel-b', cssVar: '#3b82f6' }
        ];

        const channelsGrid = document.createElement('div');
        channelsGrid.className = 'rgb-channels-grid';

        channels.forEach(({ param, tag, colorClass, cssVar }) => {
            const chRow = document.createElement('div');
            chRow.className = `rgb-channel-row ${colorClass}`;

            const badge = document.createElement('span');
            badge.className = `rgb-badge ${colorClass}`;
            badge.textContent = tag;

            const trackWrap = document.createElement('div');
            trackWrap.className = 'track-wrap rgb-track-wrap';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = this.state.get(param.id) ?? param.default;
            slider.style.setProperty('--accent-color', cssVar);

            const ghostPip = document.createElement('div');
            ghostPip.className = 'ghost-pip';
            ghostPip.style.display = this.mod.getBinding(param.id) ? 'block' : 'none';

            trackWrap.appendChild(slider);
            trackWrap.appendChild(ghostPip);

            const valSpan = document.createElement('span');
            valSpan.className = 'val-badge rgb-val-badge';
            valSpan.textContent = parseFloat(slider.value).toFixed(2);

            slider.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                this.state.set(param.id, v, false);
                valSpan.textContent = v.toFixed(2);
                updateSwatch();
            });

            slider.addEventListener('change', (e) => {
                const v = parseFloat(e.target.value);
                this.state.set(param.id, v, true);
                updateSwatch();
            });

            this.state.subscribe(param.id, (v) => {
                slider.value = v;
                valSpan.textContent = Number(v).toFixed(2);
                updateSwatch();
            });

            chRow.appendChild(badge);
            chRow.appendChild(trackWrap);
            chRow.appendChild(valSpan);
            this.attachKeyframeSlider([param.id], param.name, slider, trackWrap, chRow);
            channelsGrid.appendChild(chRow);

            this.sliderEls.set(param.id, { slider, valSpan, modBtn: null, ghostPip, param });
        });

        container.appendChild(channelsGrid);
        updateSwatch();
        return container;
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

        // 1. Shading & Camera general params
        for (const p of GLOBAL_PARAMS) {
            if (p.group === 'shading' || p.group === 'render') {
                this.elShadingParamsContainer.appendChild(this.createSliderRow(p));
            } else if (p.group === 'camera' && this.elCamParamsContainer) {
                this.elCamParamsContainer.appendChild(this.createSliderRow(p));
            }
        }
        this.renderCameraPoseSliders();

        // 2. Structured Light 1: Key Directional Sun
        if (this.elLightSunContainer) {
            const followCamera = document.createElement('button');
            followCamera.type = 'button';
            followCamera.className = 'toggle-action-btn';
            followCamera.textContent = 'Follow camera';
            const syncFollowCamera = value => {
                followCamera.classList.toggle('active', Boolean(value));
                followCamera.setAttribute('aria-pressed', String(Boolean(value)));
            };
            syncFollowCamera(this.state.get('sun_follow_camera'));
            this.state.subscribe('sun_follow_camera', syncFollowCamera);
            followCamera.addEventListener('click', () => {
                this.state.setMany({ sun_follow_camera: this.state.get('sun_follow_camera') ? 0 : 1 }, true);
            });
            this.elLightSunContainer.appendChild(followCamera);
            const pSunInt = GLOBAL_PARAMS.find(p => p.id === 'sun_intensity');
            if (pSunInt) this.elLightSunContainer.appendChild(this.createSliderRow(pSunInt, true));
            
            const pSunAz = GLOBAL_PARAMS.find(p => p.id === 'sun_azimuth');
            if (pSunAz) this.elLightSunContainer.appendChild(this.createSliderRow(pSunAz));
            const pSunEl = GLOBAL_PARAMS.find(p => p.id === 'sun_elevation');
            if (pSunEl) this.elLightSunContainer.appendChild(this.createSliderRow(pSunEl));

            const sunCluster = this.createRgbColorCluster('Sun Color Spectrum', 'sun_color_r', 'sun_color_g', 'sun_color_b');
            if (sunCluster) this.elLightSunContainer.appendChild(sunCluster);

            const pShadow = GLOBAL_PARAMS.find(p => p.id === 'shadow_softness');
            if (pShadow) this.elLightSunContainer.appendChild(this.createSliderRow(pShadow));
        }

        // 3. Structured Light 2: Rim / Backlight
        if (this.elLightRimContainer) {
            const pRimInt = GLOBAL_PARAMS.find(p => p.id === 'backlight_intensity');
            if (pRimInt) this.elLightRimContainer.appendChild(this.createSliderRow(pRimInt, true));

            const pRimEl = GLOBAL_PARAMS.find(p => p.id === 'backlight_elevation');
            if (pRimEl) this.elLightRimContainer.appendChild(this.createSliderRow(pRimEl));

            const rimCluster = this.createRgbColorCluster('Rim Color Tint', 'rim_color_r', 'rim_color_g', 'rim_color_b');
            if (rimCluster) this.elLightRimContainer.appendChild(rimCluster);
        }

        // 4. Structured Light 3: Environment & Ambient Occlusion
        if (this.elLightEnvContainer) {
            const pAo = GLOBAL_PARAMS.find(p => p.id === 'ao_strength');
            if (pAo) this.elLightEnvContainer.appendChild(this.createSliderRow(pAo));
            const pFog = GLOBAL_PARAMS.find(p => p.id === 'fog_density');
            if (pFog) this.elLightEnvContainer.appendChild(this.createSliderRow(pFog));
        }

        // 5. Structured Light 4: Volumetric Core Glow
        if (this.elLightGlowContainer) {
            const pGlowInt = GLOBAL_PARAMS.find(p => p.id === 'glow_intensity');
            if (pGlowInt) this.elLightGlowContainer.appendChild(this.createSliderRow(pGlowInt, true));

            const glowCluster = this.createRgbColorCluster('Glow Color Tint', 'glow_color_r', 'glow_color_g', 'glow_color_b');
            if (glowCluster) this.elLightGlowContainer.appendChild(glowCluster);
        }
    }

    syncSliderUI(id, val) {
        const entry = this.sliderEls.get(id);
        if (entry) {
            entry.slider.value = val;
            if (entry.param.enumNames) {
                const idx = Math.round(val);
                entry.valSpan.textContent = entry.param.enumNames[idx] ?? idx;
            } else {
                entry.valSpan.textContent = (entry.param.type === 'int') ? Math.round(val) : val.toFixed(2);
            }
        }
    }

    syncActiveCameraPreset(presetName) {
        const camPresetBtns = document.querySelectorAll('#camera-presets-grid .cam-preset-btn');
        camPresetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });
        const nameDisp = document.getElementById('camera-name-display');
        if (nameDisp) {
            const labels = {
                turntable: 'Turntable',
                action: 'Action',
                flyby: 'Flyby',
                follow: 'Follow',
                dynamic: 'Dynamic',
                hero: 'Hero Orbit'
            };
            nameDisp.textContent = labels[presetName] || (presetName ? (presetName.charAt(0).toUpperCase() + presetName.slice(1)) : 'Turntable');
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

    attachKeyframeSlider(field, label, slider, track, controls) {
        const key = field.join(':');
        const group = document.createElement('span');
        group.className = 'keyframe-slider-actions';
        group.hidden = true;
        const entry = { field, label, slider, group, marks: [] };
        for (const [letter, direction] of [['P', 'Previous'], ['N', 'Next']]) {
            const button = document.createElement('button');
            const dot = document.createElement('button');
            button.type = dot.type = 'button';
            button.className = 'keyframe-slider-button';
            dot.className = `keyframe-dot keyframe-dot-${letter.toLowerCase()}`;
            dot.hidden = true;
            button.textContent = letter;
            const mark = { button, dot, direction };
            const apply = () => {
                if (!Number.isFinite(mark.value)) return;
                const value = mark.value;
                this.stopKeyframePlayback?.();
                const step = slider.step;
                slider.step = 'any';
                slider.value = value;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                if (field.length === 1) this.state.setMany({ [field[0]]: value }, true);
                slider.step = step;
            };
            button.addEventListener('click', apply);
            dot.addEventListener('click', apply);
            group.append(button);
            track.append(dot);
            entry.marks.push(mark);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'keyframe-slider-button';
        remove.addEventListener('click', () => this.toggleKeyframeField?.(field));
        group.append(remove);
        controls.append(group);
        entry.remove = remove;
        this.keyframeSliders.set(key, entry);
        slider.addEventListener('input', () => this.recordKeyframeField?.(field, slider.valueAsNumber));
    }

    renderCameraPoseSliders() {
        this.cameraPosePanel = document.getElementById('camera-pose-panel');
        const container = document.getElementById('camera-pose-sliders');
        if (!container) return;
        for (const [key, title] of [['pos', 'Position'], ['target', 'Target'], ['up', 'Up direction']]) {
            for (const [axis, dimension] of ['X', 'Y', 'Z'].entries()) {
                const row = document.createElement('div');
                row.className = 'slider-row';
                const info = document.createElement('div');
                info.className = 'slider-info';
                const label = document.createElement('label');
                const name = `${title} ${dimension}`;
                label.textContent = name;
                const controls = document.createElement('div');
                controls.className = 'slider-right-info';
                const valueLabel = document.createElement('span');
                valueLabel.className = 'val-badge';
                controls.append(valueLabel);
                info.append(label, controls);
                const track = document.createElement('div');
                track.className = 'track-wrap';
                const slider = document.createElement('input');
                slider.id = `camera-pose-${key}-${axis}`;
                label.htmlFor = slider.id;
                slider.type = 'range';
                const limit = key === 'up' ? 1 : 12;
                slider.min = -limit;
                slider.max = limit;
                slider.step = '0.0001';
                track.append(slider);
                slider.addEventListener('input', () => {
                    const current = key === 'up' ? this.camera.getUpVector() : this.camera[key];
                    const vector = [...current];
                    vector[axis] = slider.valueAsNumber;
                    this.camera.setState({ up: [...this.camera.getUpVector()], [key]: vector, mode: 'orbit', autoRotate: false, zoomOverridden: true });
                    this.syncAutoRotate?.();
                    this.syncCameraPoseSliders();
                });
                this.attachKeyframeSlider([key, axis], name, slider, track, controls);
                this.cameraPoseSliders.push({ key, axis, slider, valueLabel });
                row.append(info, track);
                container.append(row);
            }
        }
        this.syncCameraPoseSliders();
    }

    syncCameraPoseSliders() {
        const up = this.camera.getUpVector();
        for (const { key, axis, slider, valueLabel } of this.cameraPoseSliders) {
            const value = (key === 'up' ? up : this.camera[key])[axis];
            if (value < Number(slider.min)) slider.min = Math.floor(value);
            if (value > Number(slider.max)) slider.max = Math.ceil(value);
            slider.value = value;
            valueLabel.textContent = value.toFixed(3);
        }
    }

    setupKeyframes(actions) {
        const play = document.getElementById('keyframe-play');
        const remove = document.getElementById('keyframe-remove');
        const edit = document.getElementById('keyframe-edit');
        const save = document.getElementById('keyframe-save');
        const select = document.getElementById('keyframe-select');
        const exportButton = document.getElementById('keyframe-export');
        const shuffle = document.getElementById('keyframe-shuffle');
        const status = document.getElementById('keyframe-status');
        const poseActions = document.getElementById('camera-pose-actions');
        const previousPose = document.getElementById('camera-pose-previous');
        const nextPose = document.getElementById('camera-pose-next');
        const deletePose = document.getElementById('camera-pose-delete');
        const poseFields = this.cameraPoseSliders.map(({ key, axis }) => [key, axis]);
        let selectedFrame;
        let fieldDraft;
        let activeFrames;
        let canEditFields;
        const omittedIndex = (frame, [key, axis]) => frame?.omitted?.findIndex(field => field[0] === key && field[1] === axis) ?? -1;
        const readField = (frame, field) => {
            if (!frame || omittedIndex(frame, field) >= 0) return undefined;
            const [key, axis] = field;
            return axis === undefined ? frame.values[key] : frame.camera[key]?.[axis];
        };
        const getNeighbor = offset => {
            const count = activeFrames?.length ?? 0;
            return count > 1 ? activeFrames[(select.selectedIndex + count + offset) % count] : null;
        };
        this.refreshKeyframeSliderMarks = () => {
            const previous = getNeighbor(-1);
            const next = getNeighbor(1);
            const allPoseOmitted = poseFields.every(field => omittedIndex(fieldDraft ?? selectedFrame, field) >= 0);
            poseActions.hidden = !selectedFrame;
            previousPose.disabled = !canEditFields || !poseFields.some(field => Number.isFinite(readField(previous, field)));
            nextPose.disabled = !canEditFields || !poseFields.some(field => Number.isFinite(readField(next, field)));
            deletePose.disabled = !canEditFields || !selectedFrame;
            deletePose.textContent = allPoseOmitted ? 'Restore' : 'Delete';
            deletePose.setAttribute('aria-label', `${deletePose.textContent} all camera pose values`);
            for (const [key, entry] of this.keyframeSliders) {
                if (!entry.slider.isConnected) {
                    this.keyframeSliders.delete(key);
                    continue;
                }
                const { field, label, slider, group, marks, remove } = entry;
                group.hidden = !selectedFrame;
                const omitted = omittedIndex(fieldDraft ?? selectedFrame, field) >= 0;
                remove.textContent = omitted ? 'Restore' : 'Delete';
                remove.setAttribute('aria-label', `${remove.textContent} ${label} in this keyframe`);
                remove.disabled = !canEditFields;
                const neighbors = [readField(previous, field), readField(next, field)];
                if (field.length > 1) {
                    for (const value of neighbors) {
                        if (value < Number(slider.min)) slider.min = Math.floor(value);
                        if (value > Number(slider.max)) slider.max = Math.ceil(value);
                    }
                }
                for (const [slot, mark] of marks.entries()) {
                    const value = neighbors[slot];
                    const visible = Number.isFinite(value);
                    mark.value = visible ? Math.max(Number(slider.min), Math.min(Number(slider.max), value)) : undefined;
                    mark.dot.hidden = !visible;
                    mark.button.disabled = mark.dot.disabled = !visible || !canEditFields;
                    const description = `${mark.direction} keyframe ${label}${visible ? `: ${Number(value.toFixed(4))}` : ' (no saved value)'}`;
                    for (const control of [mark.dot, mark.button]) {
                        control.title = description;
                        control.setAttribute('aria-label', description);
                    }
                    if (visible) {
                        const fraction = (mark.value - Number(slider.min)) / (Number(slider.max) - Number(slider.min));
                        mark.dot.style.left = `calc(${100 * fraction}% + ${6 - 12 * fraction}px)`;
                    }
                }
            }
        };
        const updateSelection = () => {
            const frame = activeFrames?.[select.selectedIndex];
            if (frame !== selectedFrame) {
                selectedFrame = frame;
                fieldDraft = null;
            }
            this.refreshKeyframeSliderMarks();
        };
        const getDraft = () => {
            fieldDraft ??= structuredClone(selectedFrame);
            fieldDraft.omitted ??= [];
            save.disabled = false;
            return fieldDraft;
        };
        const copyPose = offset => {
            const neighbor = getNeighbor(offset);
            if (!canEditFields || !selectedFrame || !neighbor) return;
            const draft = getDraft();
            const camera = {
                pos: [...this.camera.pos],
                target: [...this.camera.target],
                up: [...this.camera.getUpVector()]
            };
            for (const field of poseFields) {
                const value = readField(neighbor, field);
                if (!Number.isFinite(value)) continue;
                const [key, axis] = field;
                camera[key][axis] = draft.camera[key][axis] = value;
                const omitted = omittedIndex(draft, field);
                if (omitted >= 0) draft.omitted.splice(omitted, 1);
            }
            draft.camera.orbitRadius = Math.hypot(...draft.camera.pos.map((value, axis) => value - draft.camera.target[axis]));
            this.camera.setState({ ...camera, mode: 'orbit', autoRotate: false, zoomOverridden: true });
            this.syncAutoRotate?.();
            this.syncCameraPoseSliders();
            this.refreshKeyframeSliderMarks();
        };
        previousPose.addEventListener('click', () => copyPose(-1));
        nextPose.addEventListener('click', () => copyPose(1));
        deletePose.addEventListener('click', () => {
            if (!canEditFields || !selectedFrame) return;
            const draft = getDraft();
            const restore = poseFields.every(field => omittedIndex(draft, field) >= 0);
            draft.omitted = draft.omitted.filter(field => !poseFields.some(([key, axis]) => key === field[0] && axis === field[1]));
            if (!restore) draft.omitted.push(...poseFields);
            this.refreshKeyframeSliderMarks();
        });
        this.recordKeyframeField = (field, value) => {
            if (!canEditFields || !selectedFrame || !Number.isFinite(value)) return;
            const [key, axis] = field;
            const draft = getDraft();
            const omitted = omittedIndex(draft, field);
            if (axis === undefined) draft.values[key] = value;
            else draft.camera[key][axis] = value;
            if (omitted >= 0) {
                draft.omitted.splice(omitted, 1);
                this.refreshKeyframeSliderMarks();
            }
        };
        this.toggleKeyframeField = field => {
            if (!canEditFields || !selectedFrame) return;
            const draft = getDraft();
            const omitted = omittedIndex(draft, field);
            if (omitted >= 0) draft.omitted.splice(omitted, 1);
            else draft.omitted.push(field);
            this.refreshKeyframeSliderMarks();
        };
        let selectedTrack;
        let optionCount;
        const addButton = document.getElementById('keyframe-add');
        addButton.addEventListener('click', actions.add);
        window.addEventListener('keydown', event => {
            if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
                event.key.toLowerCase() !== 'k' || event.target.closest?.('input, select, textarea, [contenteditable]')) return;
            if (addButton.disabled) return;
            event.preventDefault();
            actions.add();
        });
        this.getKeyframeTab = () => this.elSettingsDrawer.querySelector('.tab-pane.active')?.id;
        this.selectKeyframeTab = tabId => {
            Array.from(this.elSettingsDrawer.querySelectorAll('.d-tab-btn'))
                .find(button => button.dataset.tab === tabId)?.click();
        };
        this.shouldShuffleKeyframes = () => shuffle.checked;
        this.elSettingsDrawer.querySelector('.drawer-tabs').addEventListener('click', event => {
            if (event.target.closest('.d-tab-btn')) actions.tabChange();
        });
        play.addEventListener('click', () => actions.toggle(shuffle.checked));
        this.stopKeyframePlayback = actions.stop;
        select.addEventListener('change', () => {
            updateSelection();
            actions.edit(Number(select.value), false);
        });
        edit.addEventListener('click', () => actions.edit(Number(select.value)));
        save.addEventListener('click', () => actions.save(Number(select.value), fieldDraft));
        remove.addEventListener('click', () => actions.remove(Number(select.value)));
        exportButton.addEventListener('click', actions.export);
        const dice = document.getElementById('deform-dice-btn');
        dice.addEventListener('click', actions.dice);
        this.syncKeyframeDice = enabled => {
            dice.classList.toggle('active', enabled);
            dice.setAttribute('aria-pressed', String(enabled));
            dice.title = enabled ? 'Stop keyframe dice playback' : 'Play this formula’s keyframes with dice variations';
        };
        for (const event of ['click', 'input']) {
            this.elSettingsDrawer.querySelector('.drawer-body').addEventListener(event, e => {
                if (!e.target.closest('button, input, select')) return;
                const value = e.target.value;
                actions.stop();
                if (e.type === 'input') e.target.value = value;
            }, true);
        }
        this.syncKeyframes = ({ frames, playing, previewing, index, sequence }, total, track) => {
            const count = frames.length;
            activeFrames = frames;
            if (selectedTrack !== track || optionCount !== count) {
                const selected = selectedTrack === track ? select.selectedIndex : 0;
                const options = count
                    ? Array.from({ length: count }, (_, index) => new Option(`Keyframe ${index + 1}`, String(index)))
                    : [new Option('No keyframes', '')];
                select.replaceChildren(...options);
                select.selectedIndex = Math.max(0, Math.min(selected, options.length - 1));
                selectedTrack = track;
                optionCount = count;
            }
            canEditFields = !playing || previewing;
            updateSelection();
            const current = sequence?.[index];
            const text = previewing ? 'Moving to keyframe…' : playing
                ? (index < 0 ? 'Starting loop…' : current?.userIndex === undefined ? 'Random keyframe' : `Keyframe ${current.userIndex + 1} of ${count}`)
                : `${count} keyframe${count === 1 ? '' : 's'}`;
            if (status.textContent !== text) status.textContent = text;
            play.disabled = !playing && count < 2;
            select.disabled = (playing && !previewing) || count === 0;
            for (const control of [edit, remove]) control.disabled = playing || count === 0;
            save.disabled = count === 0 || (playing && (!previewing || !fieldDraft));
            exportButton.disabled = total === 0;
            shuffle.disabled = playing;
            const label = previewing ? 'Stop Preview' : playing ? 'Stop Loop' : 'Play Loop';
            if (play.textContent !== label) play.textContent = label;
            addButton.disabled = playing;
        };
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
                this.elSettingsDrawer.inert = isClosed;
                btnToggleSettings.setAttribute('aria-expanded', String(!isClosed));
                btnToggleSettings.classList.toggle('active', !isClosed);
            });
            this.elSettingsDrawer.addEventListener('keydown', event => {
                if (event.key !== 'Escape' || event.defaultPrevented) return;
                btnToggleSettings.click();
                btnToggleSettings.focus();
            });
        }

        // Tab Switching inside Drawers
        document.querySelectorAll('.drawer-tabs').forEach(tabBar => {
            tabBar.querySelectorAll('.d-tab-btn').forEach(btn => {
                btn.setAttribute('aria-controls', btn.dataset.tab);
                btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
                btn.addEventListener('click', () => {
                    const drawer = btn.closest('.side-drawer');
                    drawer.querySelectorAll('.d-tab-btn').forEach(button => {
                        button.classList.toggle('active', button === btn);
                        button.setAttribute('aria-pressed', String(button === btn));
                    });
                    drawer.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    const targetPane = document.getElementById(btn.dataset.tab);
                    if (targetPane) targetPane.classList.add('active');
                });
            });
        });

        // Formula Switcher
        if (this.elFormulaSelect) {
            this.elFormulaSelect.addEventListener('change', (e) => {
                this.state.startFormulaMorph(e.target.value, 1.6);
            });
        }

        const switchFormulaByIndex = (direction) => {
            const currentActive = this.state.formulaMorph ? this.state.formulaMorph.toId : this.state.activeFormulaId;
            const currentIdx = FORMULA_CYCLE_ORDER.indexOf(currentActive);
            const baseIdx = currentIdx >= 0 ? currentIdx : 0;
            let nextIdx = (baseIdx + direction + FORMULA_CYCLE_ORDER.length) % FORMULA_CYCLE_ORDER.length;
            const nextId = FORMULA_CYCLE_ORDER[nextIdx];
            this.state.startFormulaMorph(nextId, 1.6);
            if (this.elFormulaSelect) this.elFormulaSelect.value = nextId;
        };
        this.switchFormulaByIndex = switchFormulaByIndex;

        const fPrev = document.getElementById('formula-prev-btn');
        const fNext = document.getElementById('formula-next-btn');
        const fCycle = document.getElementById('formula-cycle-btn');
        if (fPrev) fPrev.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(-1); });
        if (fNext) fNext.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(1); });
        if (fCycle) fCycle.addEventListener('click', (e) => { e.stopPropagation(); switchFormulaByIndex(1); });

        // 2. Camera Preset Stepper & Cycler (Top Navigation Pill)
        const CAMERA_PRESETS = ['turntable', 'action', 'flyby', 'follow', 'dynamic', 'hero'];
        const switchCameraPresetByIndex = (direction) => {
            const curPreset = this.camera.activeCameraPreset || 'turntable';
            let curIdx = CAMERA_PRESETS.indexOf(curPreset);
            if (curIdx < 0) curIdx = 0;
            const nextIdx = (curIdx + direction + CAMERA_PRESETS.length) % CAMERA_PRESETS.length;
            const nextPreset = CAMERA_PRESETS[nextIdx];
            this.camera.setCameraPreset(nextPreset);
            this.syncActiveCameraPreset(nextPreset);
        };

        const cPrev = document.getElementById('camera-prev-btn');
        const cNext = document.getElementById('camera-next-btn');
        const cCycle = document.getElementById('camera-cycle-btn');
        if (cPrev) cPrev.addEventListener('click', (e) => { e.stopPropagation(); switchCameraPresetByIndex(-1); });
        if (cNext) cNext.addEventListener('click', (e) => { e.stopPropagation(); switchCameraPresetByIndex(1); });
        if (cCycle) cCycle.addEventListener('click', (e) => { e.stopPropagation(); switchCameraPresetByIndex(1); });

        // 3. Natural Material Stepper & Cycler
        // Strict whitelist: material preset changes ONLY affect surface optics & reflectance, NEVER lighting
        const ALLOWED_MATERIAL_KEYS = [
            'trap_mode', 'color_cycle', 'color_phase',
            'pal_a_r', 'pal_a_g', 'pal_a_b',
            'pal_b_r', 'pal_b_g', 'pal_b_b',
            'pal_c_r', 'pal_c_g', 'pal_c_b',
            'pal_d_r', 'pal_d_g', 'pal_d_b',
            'metallic', 'roughness'
        ];
        const applyPureMaterialValues = (preset, recordHistory = true) => {
            if (!preset || !preset.values) return;
            const cleanValues = {};
            for (const k of ALLOWED_MATERIAL_KEYS) {
                if (preset.values[k] !== undefined) {
                    cleanValues[k] = preset.values[k];
                }
            }
            this.state.setMany(cleanValues, recordHistory);
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
                }
            });
        }

        this.applyMaterialPreset = (id, recordHistory = true) => {
            const idx = PALETTE_PRESETS.findIndex(p => p.id === id);
            if (idx >= 0) {
                this.activeMaterialIndex = idx;
                const preset = PALETTE_PRESETS[idx];
                applyPureMaterialValues(preset, recordHistory);
                if (this.elPaletteSelect) this.elPaletteSelect.value = preset.id;
                const elMat = document.getElementById('material-name-display');
                if (elMat) elMat.textContent = preset.name;
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
            let savedGlowIntensity = this.state.get('glow_intensity') || 0.05;
            btnToggleGlow.addEventListener('click', () => {
                const current = this.state.get('glow_intensity');
                if (current > 0.005) {
                    savedGlowIntensity = current;
                    this.state.setWithInertia('glow_intensity', 0.0);
                } else {
                    this.state.setWithInertia('glow_intensity', savedGlowIntensity || 0.05);
                }
            });
            this.state.subscribe('glow_intensity', (val) => {
                const isOn = val > 0.005;
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
                this.syncActiveCameraPreset(preset);
            });
        });

        // Auto-Rotate Button
        const btnAutoRotate = document.getElementById('auto-rotate-btn');
        if (btnAutoRotate) {
            this.syncAutoRotate = () => {
                btnAutoRotate.classList.toggle('active', this.camera.autoRotate);
                btnAutoRotate.setAttribute('aria-pressed', String(this.camera.autoRotate));
            };
            this.syncAutoRotate();
            btnAutoRotate.addEventListener('click', () => {
                this.camera.autoRotate = !this.camera.autoRotate;
                this.syncAutoRotate();
            });
        }

        // Camera Reset
        const btnCamReset = document.getElementById('cam-reset-btn');
        if (btnCamReset) {
            btnCamReset.addEventListener('click', () => {
                const defCam = this.state.getActiveFormula().defaultCam;
                this.camera.resetView(defCam.pos, defCam.target);
                this.camera.setCameraPreset('turntable');
                camPresetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === 'turntable'));
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
            });
        }

        // Continuous Auto-Deform Toggle State & Timer (ON BY DEFAULT)
        const btnUndo = document.getElementById('undo-btn');
        if (btnUndo) {
            btnUndo.addEventListener('click', () => {
                this.state.undo();
            });
        }

        const btnRedo = document.getElementById('redo-btn');
        if (btnRedo) {
            btnRedo.addEventListener('click', () => {
                this.state.redo();
            });
        }

        // Audio Reactivity Transport
        const synthBtn = document.getElementById('audio-synth-btn');
        const micBtn = document.getElementById('audio-mic-btn');
        const fileInput = document.getElementById('audio-file-input');
        const syncAudioButtons = () => {
            synthBtn?.classList.toggle('active', this.audio.sourceType === 'synth');
            micBtn?.classList.toggle('active', this.audio.sourceType === 'mic');
        };

        if (synthBtn) {
            synthBtn.addEventListener('click', () => {
                if (this.audio.sourceType === 'synth' && this.audio.isPlaying) {
                    this.audio.stopCurrentSource();
                } else {
                    this.audio.startSynthBeat();
                }
                syncAudioButtons();
            });
        }

        if (micBtn) {
            micBtn.addEventListener('click', async () => {
                if (this.audio.sourceType === 'mic' && this.audio.isPlaying) {
                    this.audio.stopCurrentSource();
                } else {
                    const started = this.audio.startMicrophone();
                    syncAudioButtons();
                    await started;
                }
                syncAudioButtons();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const started = this.audio.loadAudioFile(e.target.files[0]);
                    syncAudioButtons();
                    await started;
                    syncAudioButtons();
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

        // Capture Active Formula Parameter Values Button
        const btnCapture = document.getElementById('btn-capture-formula-values');
        if (btnCapture) {
            btnCapture.addEventListener('click', () => {
                const formula = this.state.getActiveFormula();
                if (!formula) return;
                const vals = {};
                for (const p of formula.params) {
                    const raw = this.state.get(p.id) ?? p.default;
                    vals[p.id] = (p.type === 'int') ? Math.round(raw) : parseFloat(raw.toFixed(4));
                }
                const formatted = JSON.stringify(vals, null, 2);
                navigator.clipboard.writeText(formatted).then(() => {
                    this.showToast(`✨ Captured ${formula.name} values to clipboard!`);
                }).catch(() => {
                    prompt(`Captured ${formula.name} values:`, formatted);
                });
            });
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

    updateFrame(modulatedValues, audioBands, fps, now, keyframeValues) {
        // Ghost pips on sliders
        for (const [paramId, val] of Object.entries(modulatedValues)) {
            const entry = this.sliderEls.get(paramId);
            if (entry && this.mod.getBinding(paramId)) {
                const p = entry.param;
                const pct = Math.max(0, Math.min(100, ((val - p.min) / (p.max - p.min)) * 100));
                entry.ghostPip.style.left = `${pct}%`;
            }
        }

        if (now < this.nextTelemetryUpdate) return;
        this.nextTelemetryUpdate = now + 100;

        if (!this.elSettingsDrawer.classList.contains('closed')) {
            if (this.cameraPosePanel?.open && this.cameraPosePanel.closest('.tab-pane.active')) {
                this.syncCameraPoseSliders();
            }
            if (keyframeValues) {
                for (const [id, entry] of this.sliderEls) {
                    if (entry.slider.closest('.tab-pane.active') && Number.isFinite(keyframeValues[id])) {
                        this.syncSliderUI(id, keyframeValues[id]);
                    }
                }
            }
        }

        // Mini Audio EQ
        if (audioBands) {
            for (const [band, element] of this.eqMeters) {
                if (element) element.style.height = `${Math.min(100, Math.max(10, audioBands[band] * 100))}%`;
            }
        }

        // Bottom-left FPS HUD (throttled to avoid layout thrashing)
        if (this.elHudFps) {
            const roundedFps = Math.round(fps);
            if (roundedFps !== this.lastReportedFps) {
                this.lastReportedFps = roundedFps;
                this.elHudFps.textContent = roundedFps;
                if (this.elFpsDot) {
                    if (roundedFps >= 50) {
                        this.elFpsDot.style.background = '#10b981';
                        this.elFpsDot.style.boxShadow = '0 0 8px #10b981';
                    } else if (roundedFps >= 30) {
                        this.elFpsDot.style.background = '#f59e0b';
                        this.elFpsDot.style.boxShadow = '0 0 8px #f59e0b';
                    } else {
                        this.elFpsDot.style.background = '#ef4444';
                        this.elFpsDot.style.boxShadow = '0 0 8px #ef4444';
                    }
                }
            }
        }
        
        if (this.elHudScale) this.elHudScale.textContent = `${this.raymarcher.activeScale.toFixed(2)}x`;
    }
}
