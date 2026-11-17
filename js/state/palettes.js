// js/state/palettes.js
// 100% natural, geological, mineral, and organic materials
// Earthy, grounded, realistic textures (rocks, sands, soils, woods, clays, slates)
// Strictly avoiding synthetic neon, high-chroma artificial saturation, or fantasy gemstone colors.

export const PALETTE_PRESETS = [
    {
        id: 'desert_sandstone',
        name: 'Desert Sandstone',
        description: 'Warm terracotta, layered golden ochre, sun-baked clay, red sandstone cliffs',
        values: {
            trap_mode: 0,
            color_cycle: 0.55,
            color_phase: 0.0,
            pal_a_r: 0.68, pal_a_g: 0.46, pal_a_b: 0.32,
            pal_b_r: 0.30, pal_b_g: 0.22, pal_b_b: 0.14,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.10, pal_d_b: 0.20,
            metallic: 0.03,
            roughness: 0.78,
            ao_strength: 1.15,
            sun_intensity: 1.45,
            sun_color_r: 1.0, sun_color_g: 0.94, sun_color_b: 0.82,
            backlight_intensity: 1.0,
            rim_color_r: 0.50, rim_color_g: 0.65, rim_color_b: 0.85,
            glow_intensity: 0.0
        }
    },
    {
        id: 'ancient_limestone',
        name: 'Ancient Limestone',
        description: 'Chalky fossil stone, dry grey-green lichen, ivory calcium carbonate',
        values: {
            trap_mode: 0,
            color_cycle: 0.40,
            color_phase: 0.05,
            pal_a_r: 0.72, pal_a_g: 0.70, pal_a_b: 0.62,
            pal_b_r: 0.18, pal_b_g: 0.16, pal_b_b: 0.14,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.08, pal_d_b: 0.15,
            metallic: 0.02,
            roughness: 0.82,
            ao_strength: 1.25,
            sun_intensity: 1.35,
            sun_color_r: 1.0, sun_color_g: 0.98, sun_color_b: 0.94,
            backlight_intensity: 0.85,
            rim_color_r: 0.70, rim_color_g: 0.75, rim_color_b: 0.82,
            glow_intensity: 0.0
        }
    },
    {
        id: 'volcanic_basalt',
        name: 'Volcanic Basalt',
        description: 'Dark charcoal volcanic stone, matte black solidified lava, cool grey pumice',
        values: {
            trap_mode: 1,
            color_cycle: 0.45,
            color_phase: 0.0,
            pal_a_r: 0.24, pal_a_g: 0.25, pal_a_b: 0.27,
            pal_b_r: 0.15, pal_b_g: 0.15, pal_b_b: 0.16,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.05, pal_d_b: 0.10,
            metallic: 0.08,
            roughness: 0.65,
            ao_strength: 1.35,
            sun_intensity: 1.25,
            sun_color_r: 0.92, sun_color_g: 0.94, sun_color_b: 0.96,
            backlight_intensity: 1.15,
            rim_color_r: 0.42, rim_color_g: 0.48, rim_color_b: 0.58,
            glow_intensity: 0.0
        }
    },
    {
        id: 'forest_moss',
        name: 'Forest Moss',
        description: 'Rich woodland earthy moss, damp dark cedar bark, olive green humus',
        values: {
            trap_mode: 0,
            color_cycle: 0.50,
            color_phase: 0.15,
            pal_a_r: 0.38, pal_a_g: 0.44, pal_a_b: 0.30,
            pal_b_r: 0.22, pal_b_g: 0.24, pal_b_b: 0.16,
            pal_c_r: 1.00, pal_c_g: 1.20, pal_c_b: 1.00,
            pal_d_r: 0.10, pal_d_g: 0.25, pal_d_b: 0.40,
            metallic: 0.04,
            roughness: 0.75,
            ao_strength: 1.20,
            sun_intensity: 1.35,
            sun_color_r: 0.96, sun_color_g: 0.98, sun_color_b: 0.88,
            backlight_intensity: 1.1,
            rim_color_r: 0.45, rim_color_g: 0.60, rim_color_b: 0.48,
            glow_intensity: 0.0
        }
    },
    {
        id: 'terracotta_adobe',
        name: 'Terracotta Clay',
        description: 'Warm Mediterranean red earth, fired terracotta pottery, orange-brown silt clay',
        values: {
            trap_mode: 0,
            color_cycle: 0.48,
            color_phase: 0.05,
            pal_a_r: 0.65, pal_a_g: 0.38, pal_a_b: 0.25,
            pal_b_r: 0.28, pal_b_g: 0.18, pal_b_b: 0.12,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.08, pal_d_b: 0.16,
            metallic: 0.02,
            roughness: 0.72,
            ao_strength: 1.20,
            sun_intensity: 1.5,
            sun_color_r: 1.0, sun_color_g: 0.92, sun_color_b: 0.82,
            backlight_intensity: 0.95,
            rim_color_r: 0.80, rim_color_g: 0.68, rim_color_b: 0.58,
            glow_intensity: 0.0
        }
    },
    {
        id: 'riverbed_granite',
        name: 'Riverbed Granite',
        description: 'Speckled grey feldspar, cool river stone, flint rock, dark mineral grain',
        values: {
            trap_mode: 1,
            color_cycle: 0.45,
            color_phase: 0.0,
            pal_a_r: 0.52, pal_a_g: 0.52, pal_a_b: 0.54,
            pal_b_r: 0.20, pal_b_g: 0.20, pal_b_b: 0.22,
            pal_c_r: 1.20, pal_c_g: 1.20, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.05, pal_d_b: 0.10,
            metallic: 0.12,
            roughness: 0.52,
            ao_strength: 1.25,
            sun_intensity: 1.4,
            sun_color_r: 0.98, sun_color_g: 0.98, sun_color_b: 1.0,
            backlight_intensity: 1.1,
            rim_color_r: 0.55, rim_color_g: 0.65, rim_color_b: 0.75,
            glow_intensity: 0.0
        }
    },
    {
        id: 'driftwood_bone',
        name: 'Weathered Timber',
        description: 'Sun-bleached coastal silver timber, dry ivory bone marrow, weathered wood grey',
        values: {
            trap_mode: 0,
            color_cycle: 0.42,
            color_phase: 0.08,
            pal_a_r: 0.62, pal_a_g: 0.58, pal_a_b: 0.52,
            pal_b_r: 0.20, pal_b_g: 0.18, pal_b_b: 0.16,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.05, pal_d_g: 0.10, pal_d_b: 0.15,
            metallic: 0.03,
            roughness: 0.76,
            ao_strength: 1.20,
            sun_intensity: 1.4,
            sun_color_r: 1.0, sun_color_g: 0.95, sun_color_b: 0.88,
            backlight_intensity: 0.9,
            rim_color_r: 0.62, rim_color_g: 0.70, rim_color_b: 0.80,
            glow_intensity: 0.0
        }
    },
    {
        id: 'nordic_slate',
        name: 'Nordic Slate',
        description: 'Blue-grey layered metamorphic shale, wet coastal sea rock, dark tidal flint',
        values: {
            trap_mode: 1,
            color_cycle: 0.50,
            color_phase: 0.12,
            pal_a_r: 0.32, pal_a_g: 0.36, pal_a_b: 0.42,
            pal_b_r: 0.16, pal_b_g: 0.18, pal_b_b: 0.22,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.20,
            pal_d_r: 0.20, pal_d_g: 0.25, pal_d_b: 0.35,
            metallic: 0.10,
            roughness: 0.58,
            ao_strength: 1.30,
            sun_intensity: 1.3,
            sun_color_r: 0.90, sun_color_g: 0.94, sun_color_b: 0.98,
            backlight_intensity: 1.2,
            rim_color_r: 0.52, rim_color_g: 0.62, rim_color_b: 0.74,
            glow_intensity: 0.0
        }
    },
    {
        id: 'peat_bog_loam',
        name: 'Dark Loam',
        description: 'Rich fertile organic black loam, dark umber soil, decayed leaf mold',
        values: {
            trap_mode: 0,
            color_cycle: 0.45,
            color_phase: 0.05,
            pal_a_r: 0.30, pal_a_g: 0.24, pal_a_b: 0.18,
            pal_b_r: 0.18, pal_b_g: 0.14, pal_b_b: 0.10,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.05, pal_d_g: 0.10, pal_d_b: 0.15,
            metallic: 0.02,
            roughness: 0.85,
            ao_strength: 1.40,
            sun_intensity: 1.35,
            sun_color_r: 0.96, sun_color_g: 0.90, sun_color_b: 0.80,
            backlight_intensity: 0.85,
            rim_color_r: 0.52, rim_color_g: 0.46, rim_color_b: 0.40,
            glow_intensity: 0.0
        }
    },
    {
        id: 'glacial_permafrost',
        name: 'Glacial Calcite',
        description: 'Pale frosted mineral stone, compacted glacial silt, cold ivory calcite',
        values: {
            trap_mode: 2,
            color_cycle: 0.52,
            color_phase: 0.10,
            pal_a_r: 0.68, pal_a_g: 0.74, pal_a_b: 0.78,
            pal_b_r: 0.18, pal_b_g: 0.18, pal_b_b: 0.20,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.20,
            pal_d_r: 0.10, pal_d_g: 0.15, pal_d_b: 0.25,
            metallic: 0.06,
            roughness: 0.50,
            ao_strength: 1.20,
            sun_intensity: 1.45,
            sun_color_r: 0.98, sun_color_g: 0.98, sun_color_b: 1.0,
            backlight_intensity: 1.15,
            rim_color_r: 0.60, rim_color_g: 0.74, rim_color_b: 0.88,
            glow_intensity: 0.0
        }
    }
];
