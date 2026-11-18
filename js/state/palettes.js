// js/state/palettes.js
// 100% natural, geological, mineral, and organic materials
// Earthy, grounded, realistic textures (rocks, sands, soils, woods, clays, slates)
// Pure surface optics: contains ONLY palette & material reflectance (no lighting parameters)

export const PALETTE_PRESETS = [
    {
        id: 'dark_loam',
        name: 'Dark Loam',
        description: 'Rich fertile organic black loam, dark umber soil, decayed leaf mold',
        values: {
            trap_mode: 0,
            color_cycle: 0.45,
            color_phase: 0.05,
            pal_a_r: 0.24, pal_a_g: 0.18, pal_a_b: 0.13,
            pal_b_r: 0.14, pal_b_g: 0.10, pal_b_b: 0.07,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.05, pal_d_g: 0.10, pal_d_b: 0.15,
            metallic: 0.02,
            roughness: 0.85
        }
    },
    {
        id: 'desert_sandstone',
        name: 'Desert Sandstone',
        description: 'Warm terracotta, layered golden ochre, sun-baked clay, red sandstone cliffs',
        values: {
            trap_mode: 0,
            color_cycle: 0.55,
            color_phase: 0.0,
            pal_a_r: 0.45, pal_a_g: 0.30, pal_a_b: 0.18,
            pal_b_r: 0.18, pal_b_g: 0.12, pal_b_b: 0.08,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.10, pal_d_b: 0.20,
            metallic: 0.03,
            roughness: 0.78
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
            pal_a_r: 0.46, pal_a_g: 0.44, pal_a_b: 0.38,
            pal_b_r: 0.14, pal_b_g: 0.12, pal_b_b: 0.10,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.08, pal_d_b: 0.15,
            metallic: 0.02,
            roughness: 0.82
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
            pal_a_r: 0.18, pal_a_g: 0.19, pal_a_b: 0.21,
            pal_b_r: 0.10, pal_b_g: 0.10, pal_b_b: 0.11,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.05, pal_d_b: 0.10,
            metallic: 0.08,
            roughness: 0.65
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
            pal_a_r: 0.26, pal_a_g: 0.32, pal_a_b: 0.20,
            pal_b_r: 0.14, pal_b_g: 0.16, pal_b_b: 0.10,
            pal_c_r: 1.00, pal_c_g: 1.20, pal_c_b: 1.00,
            pal_d_r: 0.10, pal_d_g: 0.25, pal_d_b: 0.40,
            metallic: 0.04,
            roughness: 0.75
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
            pal_a_r: 0.44, pal_a_g: 0.24, pal_a_b: 0.15,
            pal_b_r: 0.18, pal_b_g: 0.11, pal_b_b: 0.07,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.08, pal_d_b: 0.16,
            metallic: 0.02,
            roughness: 0.72
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
            pal_a_r: 0.34, pal_a_g: 0.34, pal_a_b: 0.36,
            pal_b_r: 0.12, pal_b_g: 0.12, pal_b_b: 0.14,
            pal_c_r: 1.20, pal_c_g: 1.20, pal_c_b: 1.00,
            pal_d_r: 0.00, pal_d_g: 0.05, pal_d_b: 0.10,
            metallic: 0.12,
            roughness: 0.52
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
            pal_a_r: 0.40, pal_a_g: 0.36, pal_a_b: 0.32,
            pal_b_r: 0.12, pal_b_g: 0.11, pal_b_b: 0.10,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.00,
            pal_d_r: 0.05, pal_d_g: 0.10, pal_d_b: 0.15,
            metallic: 0.03,
            roughness: 0.76
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
            pal_a_r: 0.22, pal_a_g: 0.26, pal_a_b: 0.32,
            pal_b_r: 0.10, pal_b_g: 0.12, pal_b_b: 0.15,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.20,
            pal_d_r: 0.20, pal_d_g: 0.25, pal_d_b: 0.35,
            metallic: 0.10,
            roughness: 0.58
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
            pal_a_r: 0.44, pal_a_g: 0.50, pal_a_b: 0.54,
            pal_b_r: 0.12, pal_b_g: 0.13, pal_b_b: 0.15,
            pal_c_r: 1.00, pal_c_g: 1.00, pal_c_b: 1.20,
            pal_d_r: 0.10, pal_d_g: 0.15, pal_d_b: 0.25,
            metallic: 0.06,
            roughness: 0.50
        }
    }
];
