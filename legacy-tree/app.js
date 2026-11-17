import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// --- Application State ---
const state = {
    // Structure
    depth: 6,
    branches: 3,
    lengthDecay: 0.75,
    widthDecay: 0.70,
    angle: 35, // in degrees
    trunkHeight: 10,

    // Leaves & Color
    showLeaves: true,
    leafSize: 0.4,
    leafType: 'spheres',
    colorTrunk: '#8b5a2b',
    colorLeaves: '#4caf50',

    // Environment & Wind
    windStrength: 0.3,
    windSpeed: 1.0,
    theme: 'void'
};

// Preset Configurations
const presets = {
    oak: {
        depth: 6, branches: 3, lengthDecay: 0.75, widthDecay: 0.70, angle: 35, trunkHeight: 10,
        showLeaves: true, leafSize: 0.4, leafType: 'quads', colorTrunk: '#8b5a2b', colorLeaves: '#4caf50',
        windStrength: 0.3, windSpeed: 1.0, theme: 'void'
    },
    cherry: {
        depth: 7, branches: 3, lengthDecay: 0.76, widthDecay: 0.68, angle: 32, trunkHeight: 9,
        showLeaves: true, leafSize: 0.35, leafType: 'spheres', colorTrunk: '#a0785a', colorLeaves: '#ffc0cb',
        windStrength: 0.5, windSpeed: 1.5, theme: 'sunset'
    },
    preset_cherry: { // fallback mapping
        depth: 7, branches: 3, lengthDecay: 0.76, widthDecay: 0.68, angle: 32, trunkHeight: 9,
        showLeaves: true, leafSize: 0.35, leafType: 'spheres', colorTrunk: '#a0785a', colorLeaves: '#ffc0cb',
        windStrength: 0.5, windSpeed: 1.5, theme: 'sunset'
    },
    pine: {
        depth: 7, branches: 4, lengthDecay: 0.72, widthDecay: 0.75, angle: 45, trunkHeight: 11,
        showLeaves: true, leafSize: 0.5, leafType: 'quads', colorTrunk: '#5d4037', colorLeaves: '#2e7d32',
        windStrength: 0.1, windSpeed: 0.5, theme: 'void'
    },
    cyber: {
        depth: 6, branches: 3, lengthDecay: 0.78, widthDecay: 0.75, angle: 28, trunkHeight: 12,
        showLeaves: true, leafSize: 0.6, leafType: 'stars', colorTrunk: '#1a237e', colorLeaves: '#00e5ff',
        windStrength: 0.7, windSpeed: 2.0, theme: 'cyber'
    },
    golden: {
        depth: 8, branches: 2, lengthDecay: 0.82, widthDecay: 0.80, angle: 40, trunkHeight: 8,
        showLeaves: false, leafSize: 0.3, leafType: 'stars', colorTrunk: '#ffd700', colorLeaves: '#ffd700',
        windStrength: 0.2, windSpeed: 1.2, theme: 'void'
    }
};

// --- Three.js Globals ---
let scene, camera, renderer, controls;
let treeGroup;
let gridHelper;
let ambientLight, dirLight, pointLight;
let animFrameId;
let lastTime = 0;
let fpsInterval = 1000;
let frameCount = 0;
let lastFpsTime = 0;

// Shared Geometries for Performance
let branchGeometry;
let leafGeometrySphere;
let leafGeometryQuad;
let leafGeometryStar;

// Instanced Meshes
let branchInstancedMesh = null;
let leafInstancedMesh = null;

// CPU Structures for Procedural Tree
let branchesData = [];
let leavesData = [];

// Stats Counters
let branchCount = 0;
let leafCount = 0;

class BranchNode {
    constructor(parent, length, width, depth) {
        this.parent = parent;
        this.length = length;
        this.width = width;
        this.depth = depth;
        
        this.localFrameMatrix = new THREE.Matrix4();
        this.globalFrameMatrix = new THREE.Matrix4();
        
        this.baseRotationX = 0;
        this.baseRotationY = 0;
        this.baseRotationZ = 0;
        this.windPhase = Math.random() * Math.PI * 2;
    }
}

class LeafNode {
    constructor(branchNode, offsetPos, rotation, scale, color) {
        this.branchNode = branchNode;
        this.offsetPos = offsetPos; // Vector3
        this.rotation = rotation;     // Euler
        this.scale = scale;         // Vector3
        this.color = color;         // Color
    }
}

// Initialize Application
function init() {
    const container = document.getElementById('canvas-container');

    // Scene Setup
    scene = new THREE.Scene();

    // Camera Setup
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 15, 35);

    // Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    controls.target.set(0, 10, 0);

    // Lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    pointLight = new THREE.PointLight(0x00f2fe, 1, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // Shared Geometries Definition
    // A cylinder geometry centered at origin, shifted up so its base is at y = 0
    branchGeometry = new THREE.CylinderGeometry(0.5, 0.4, 1, 6, 1);
    branchGeometry.translate(0, 0.5, 0); 

    leafGeometrySphere = new THREE.SphereGeometry(0.5, 5, 5);
    
    leafGeometryQuad = new THREE.PlaneGeometry(1, 1);
    leafGeometryQuad.translate(0, 0.5, 0);

    // Star geometry using custom Shape
    const starShape = new THREE.Shape();
    const spikes = 5;
    const outerRadius = 0.5;
    const innerRadius = 0.2;
    let rot = Math.PI / 2 * 3;
    let cx = 0, cy = 0;
    const step = Math.PI / spikes;

    starShape.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        cx = Math.cos(rot) * outerRadius;
        cy = Math.sin(rot) * outerRadius;
        starShape.lineTo(cx, cy);
        rot += step;

        cx = Math.cos(rot) * innerRadius;
        cy = Math.sin(rot) * innerRadius;
        starShape.lineTo(cx, cy);
        rot += step;
    }
    starShape.lineTo(0, -outerRadius);
    leafGeometryStar = new THREE.ShapeGeometry(starShape);

    // Tree main group
    treeGroup = new THREE.Group();
    scene.add(treeGroup);

    // Grid helper (used in cyberpunk theme)
    gridHelper = new THREE.GridHelper(60, 60, 0x00f2fe, 0x1f2430);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Setup events & initial generation
    setupUIEvents();
    applyTheme(state.theme);
    generateTree();

    // Start loop
    animate(0);

    window.addEventListener('resize', onWindowResize);
}

// --- Recursive Tree Generation ---
function generateTree() {
    // Clear old tree Group objects
    while (treeGroup.children.length > 0) {
        treeGroup.remove(treeGroup.children[0]);
    }

    branchesData = [];
    leavesData = [];

    // 1. Procedurally collect tree nodes
    const initialWidth = state.trunkHeight * 0.08;
    buildBranchData(null, state.trunkHeight, initialWidth, 1);

    branchCount = branchesData.length;
    leafCount = leavesData.length;

    // 2. Setup Trunk Materials & InstancedMesh
    const trunkMat = new THREE.MeshStandardMaterial({
        roughness: 0.9,
        metalness: state.theme === 'cyber' ? 0.8 : 0.1,
    });

    branchInstancedMesh = new THREE.InstancedMesh(branchGeometry, trunkMat, branchCount);
    branchInstancedMesh.castShadow = true;
    branchInstancedMesh.receiveShadow = true;
    treeGroup.add(branchInstancedMesh);

    // Color trunk instances with a gradient
    const baseColor = new THREE.Color(state.colorTrunk);
    for (let i = 0; i < branchCount; i++) {
        const node = branchesData[i];
        // Blending base trunk color with a lighter/warmer color near branches
        const ratio = (node.depth - 1) / state.depth;
        const color = baseColor.clone().multiplyScalar(1.0 - ratio * 0.3);
        if (state.theme === 'cyber') {
            color.add(new THREE.Color(0x110022 * ratio));
        }
        branchInstancedMesh.setColorAt(i, color);
    }
    branchInstancedMesh.instanceColor.needsUpdate = true;

    // 3. Setup Leaf Materials & InstancedMesh
    if (state.showLeaves && leafCount > 0) {
        const leafGeom = state.leafType === 'spheres' ? leafGeometrySphere 
                       : state.leafType === 'quads' ? leafGeometryQuad 
                       : leafGeometryStar;

        let leafMat;
        if (state.theme === 'cyber') {
            leafMat = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
        } else {
            leafMat = new THREE.MeshStandardMaterial({
                roughness: 0.6,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        }

        leafInstancedMesh = new THREE.InstancedMesh(leafGeom, leafMat, leafCount);
        leafInstancedMesh.castShadow = true;
        treeGroup.add(leafInstancedMesh);

        for (let i = 0; i < leafCount; i++) {
            leafInstancedMesh.setColorAt(i, leavesData[i].color);
        }
        leafInstancedMesh.instanceColor.needsUpdate = true;
    } else {
        leafInstancedMesh = null;
    }

    // Trigger matrix update immediately
    updateTreeMatrices(0);

    // Update statistics display
    document.getElementById('stat-branches').innerText = branchCount;
    document.getElementById('stat-leaves').innerText = state.showLeaves ? leafCount : 0;
}

// Helper: Get minimum distance between two 3D line segments (p1-q1) and (p2-q2)
function getSegmentDistance(p1, q1, p2, q2) {
    const u = new THREE.Vector3().subVectors(q1, p1);
    const v = new THREE.Vector3().subVectors(q2, p2);
    const w = new THREE.Vector3().subVectors(p1, p2);
    const a = u.dot(u);
    const b = u.dot(v);
    const c = v.dot(v);
    const d = u.dot(w);
    const e = v.dot(w);
    const D = a * c - b * b;
    let sc, sN, sD = D;
    let tc, tN, tD = D;

    if (D < 0.000001) {
        sN = 0.0;
        sD = 1.0;
        tN = e;
        tD = c;
    } else {
        sN = (b * e - c * d);
        tN = (a * e - b * d);
        if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
        } else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
        }
    }

    if (tN < 0.0) {
        tN = 0.0;
        if (-d < 0.0) sN = 0.0;
        else if (-d > a) sN = sD;
        else {
            sN = -d;
            sD = a;
        }
    } else if (tN > tD) {
        tN = tD;
        if ((-d + b) < 0.0) sN = 0;
        else if ((-d + b) > a) sN = sD;
        else {
            sN = (-d + b);
            sD = a;
        }
    }

    sc = (Math.abs(sN) < 0.000001 ? 0.0 : sN / sD);
    tc = (Math.abs(tN) < 0.000001 ? 0.0 : tN / tD);

    const dP = new THREE.Vector3().addVectors(w, new THREE.Vector3().subVectors(u.clone().multiplyScalar(sc), v.clone().multiplyScalar(tc)));
    return dP.length();
}

function buildBranchData(parent, length, width, currentDepth) {
    const node = new BranchNode(parent, length, width, currentDepth);

    // Initial position & rotation settings
    const tempPosition = new THREE.Vector3(0, parent ? parent.length : 0, 0);
    const tempRotation = new THREE.Quaternion();
    
    // We compute relative rotations beforehand to test collisions
    node.baseRotationY = 0;
    node.baseRotationZ = 0;
    
    if (parent) {
        // Find sibling index or relative angle spacing from parent
        // Use a dummy assignment first, which will be updated when recursing
        node.baseRotationY = (branchesData.filter(b => b.parent === parent).length * 2 * Math.PI) / state.branches + (currentDepth * 0.5);
        node.baseRotationZ = THREE.MathUtils.degToRad(state.angle);
    }
    
    tempRotation.setFromEuler(new THREE.Euler(0, node.baseRotationY, node.baseRotationZ));
    node.localFrameMatrix.compose(tempPosition, tempRotation, new THREE.Vector3(1, 1, 1));
    
    if (parent) {
        node.globalFrameMatrix.multiplyMatrices(parent.globalFrameMatrix, node.localFrameMatrix);
    } else {
        node.globalFrameMatrix.copy(node.localFrameMatrix);
    }

    // --- Collision Avoidance / Shrink & Prune algorithm ---
    const basePos = new THREE.Vector3(0, 0, 0).applyMatrix4(node.globalFrameMatrix);
    let scaleFactor = 1.0;
    let resolved = false;

    // Don't collide check the trunk
    if (!parent) {
        resolved = true;
    } else {
        // Try up to 5 attempts of shrinking the branch if it intersects existing branches
        for (let attempt = 0; attempt < 5; attempt++) {
            const currentLength = length * scaleFactor;
            const currentWidth = width * scaleFactor;
            const tipPos = new THREE.Vector3(0, currentLength, 0).applyMatrix4(node.globalFrameMatrix);

            let collides = false;
            for (let j = 0; j < branchesData.length; j++) {
                const existing = branchesData[j];
                
                // Ignore self, parent, and direct grandparent/ancestors
                if (existing === node || existing === parent || existing === parent.parent) continue;

                // Ignore siblings (branches sharing the same parent) as they naturally diverge from the same joint
                if (existing.parent && parent && existing.parent === parent) continue;

                const extBase = new THREE.Vector3(0, 0, 0).applyMatrix4(existing.globalFrameMatrix);
                const extTip = new THREE.Vector3(0, existing.length, 0).applyMatrix4(existing.globalFrameMatrix);

                const dist = getSegmentDistance(basePos, tipPos, extBase, extTip);
                
                // Buffer clearance (threshold) is sum of radii
                const threshold = (currentWidth + existing.width) * 0.5 * 0.95; // 0.95 factor allows tight touching
                if (dist < threshold) {
                    collides = true;
                    break;
                }
            }

            if (!collides) {
                node.length = currentLength;
                node.width = currentWidth;
                resolved = true;
                break;
            }

            scaleFactor *= 0.65; // Back off/shrink branch
        }
    }

    if (!resolved || node.length < 0.5) {
        // Prune branch completely if too small or still colliding
        return null;
    }

    branchesData.push(node);

    if (currentDepth >= state.depth) {
        if (state.showLeaves) {
            collectLeavesData(node);
        }
        return node;
    }

    const numBranches = state.branches;

    for (let i = 0; i < numBranches; i++) {
        const nextLength = node.length * state.lengthDecay;
        const nextWidth = node.width * state.widthDecay;

        // Recurse to generate child data
        buildBranchData(node, nextLength, nextWidth, currentDepth + 1);
    }
    
    return node;
}

function collectLeavesData(branchNode) {
    const leafCountForBranch = 4;
    const baseLeafColor = new THREE.Color(state.colorLeaves);

    for (let i = 0; i < leafCountForBranch; i++) {
        // Random distribution near the tip
        const t = 0.7 + Math.random() * 0.3;
        const theta = Math.random() * Math.PI * 2;
        const radius = state.leafSize * 1.5;

        const offsetPos = new THREE.Vector3(
            Math.cos(theta) * radius * 0.5,
            branchNode.length * t,
            Math.sin(theta) * radius * 0.5
        );

        const rotation = new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        const s = state.leafSize * (0.8 + Math.random() * 0.4);
        const scale = new THREE.Vector3(s, s, s);

        // Subtly vary color for organic depth
        const finalColor = baseLeafColor.clone();
        finalColor.offsetHSL((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);

        leavesData.push(new LeafNode(branchNode, offsetPos, rotation, scale, finalColor));
    }
}

// --- Dynamic Hierarchical Matrix Calculation ---
function updateTreeMatrices(timeDelta) {
    if (!branchInstancedMesh) return;

    const tempPosition = new THREE.Vector3();
    const tempRotation = new THREE.Quaternion();
    const tempScale = new THREE.Vector3(1, 1, 1);

    const branchScaleMatrix = new THREE.Matrix4();
    const renderMatrix = new THREE.Matrix4();

    // 1. Sequentially compute Branch Global Matrices
    // Since parents are added to the list before their children, 
    // a single sequential loop guarantees parent global matrices are computed first!
    for (let i = 0; i < branchCount; i++) {
        const node = branchesData[i];
        
        // Calculate Wind Sway rotation
        const flexibility = Math.pow(node.depth, 1.5) * 0.015 * state.windStrength;
        const swayX = Math.sin(timeDelta * 2 + node.windPhase + node.depth) * flexibility;
        const swayZ = Math.cos(timeDelta * 1.8 + node.windPhase + node.depth) * flexibility;

        // Position relative to parent is at its tip (Y = parent.length)
        tempPosition.set(0, node.parent ? node.parent.length : 0, 0);

        // Apply rotation
        const euler = new THREE.Euler(
            node.baseRotationX + swayX, 
            node.baseRotationY || 0, 
            (node.baseRotationZ || 0) + swayZ
        );
        tempRotation.setFromEuler(euler);

        // Compose local matrix without branch visual scaling
        node.localFrameMatrix.compose(tempPosition, tempRotation, tempScale);

        if (node.parent) {
            node.globalFrameMatrix.multiplyMatrices(node.parent.globalFrameMatrix, node.localFrameMatrix);
        } else {
            node.globalFrameMatrix.copy(node.localFrameMatrix);
        }

        // Apply visual scale (width, length, width) to generate renderer transformation matrix
        branchScaleMatrix.makeScale(node.width, node.length, node.width);
        renderMatrix.multiplyMatrices(node.globalFrameMatrix, branchScaleMatrix);

        branchInstancedMesh.setMatrixAt(i, renderMatrix);
    }
    branchInstancedMesh.instanceMatrix.needsUpdate = true;

    // 2. Position Leaves based on Parent Branch Global Matrix
    if (leafInstancedMesh && state.showLeaves) {
        const leafLocalMatrix = new THREE.Matrix4();
        for (let i = 0; i < leafCount; i++) {
            const leaf = leavesData[i];
            
            tempRotation.setFromEuler(leaf.rotation);
            leafLocalMatrix.compose(leaf.offsetPos, tempRotation, leaf.scale);
            
            renderMatrix.multiplyMatrices(leaf.branchNode.globalFrameMatrix, leafLocalMatrix);
            leafInstancedMesh.setMatrixAt(i, renderMatrix);
        }
        leafInstancedMesh.instanceMatrix.needsUpdate = true;
    }
}

// --- Theme Application ---
function applyTheme(theme) {
    const container = document.getElementById('canvas-container');
    
    if (theme === 'void') {
        container.style.background = 'radial-gradient(circle at center, #ffffff 0%, #cfd8dc 100%)';
        gridHelper.visible = false;
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.65;
        dirLight.color.setHex(0xffffff);
        dirLight.intensity = 1.1;
        pointLight.visible = false;
    } else if (theme === 'sunset') {
        container.style.background = 'radial-gradient(circle at center, #fff5f7 0%, #ffc0cb 100%)';
        gridHelper.visible = false;
        ambientLight.color.setHex(0xffaa88);
        ambientLight.intensity = 0.75;
        dirLight.color.setHex(0xff7799);
        dirLight.intensity = 1.3;
        dirLight.position.set(-15, 30, -15);
        pointLight.color.setHex(0xffaa44);
        pointLight.intensity = 1.5;
        pointLight.visible = true;
    } else if (theme === 'cyber') {
        container.style.background = 'radial-gradient(circle at center, #f0f4f8 0%, #b0c4de 100%)';
        gridHelper.visible = true;
        gridHelper.material.color.setHex(0x4facfe);
        ambientLight.color.setHex(0x00f2fe);
        ambientLight.intensity = 0.8;
        dirLight.color.setHex(0x00f2fe);
        dirLight.intensity = 1.4;
        dirLight.position.set(10, 30, 10);
        pointLight.color.setHex(0xff00ff);
        pointLight.intensity = 1.8;
        pointLight.visible = true;
    }
}

// --- Animation Loop ---
function animate(time) {
    animFrameId = requestAnimationFrame(animate);

    const delta = time * 0.001 * state.windSpeed;

    // Calculate FPS
    frameCount++;
    if (time > lastFpsTime + fpsInterval) {
        const fps = Math.round((frameCount * 1000) / (time - lastFpsTime));
        document.getElementById('stat-fps').innerText = fps;
        frameCount = 0;
        lastFpsTime = time;
    }

    // CPU Matrix update
    updateTreeMatrices(delta);

    // Make cyberpunk point light float around
    if (state.theme === 'cyber' || state.theme === 'sunset') {
        pointLight.position.x = Math.sin(time * 0.001) * 8;
        pointLight.position.z = Math.cos(time * 0.001) * 8;
        pointLight.position.y = 8 + Math.sin(time * 0.002) * 3;
    }

    controls.update();
    renderer.render(scene, camera);
}

// --- UI Binding and Handlers ---
function setupUIEvents() {
    const bindSlider = (id, paramKey, scale = 1, isAngle = false) => {
        const input = document.getElementById(`param-${id}`);
        const display = document.getElementById(`val-${id}`);
        input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state[paramKey] = val;
            display.innerText = isAngle ? `${val}°` : val.toFixed(scale === 1 ? 0 : 2).replace(/\.00$/, '');
            generateTree();
        });
    };

    bindSlider('depth', 'depth');
    bindSlider('branches', 'branches');
    bindSlider('length-decay', 'lengthDecay', 2);
    bindSlider('width-decay', 'widthDecay', 2);
    bindSlider('angle', 'angle', 0, true);
    bindSlider('trunk-height', 'trunkHeight', 1);
    bindSlider('leaf-size', 'leafSize', 2);
    bindSlider('wind-strength', 'windStrength', 2);
    bindSlider('wind-speed', 'windSpeed', 1);

    const leavesCheck = document.getElementById('param-show-leaves');
    leavesCheck.addEventListener('change', (e) => {
        state.showLeaves = e.target.checked;
        generateTree();
    });

    const leafTypeSelect = document.getElementById('param-leaf-type');
    leafTypeSelect.addEventListener('change', (e) => {
        state.leafType = e.target.value;
        generateTree();
    });

    const themeSelect = document.getElementById('param-theme');
    themeSelect.addEventListener('change', (e) => {
        state.theme = e.target.value;
        applyTheme(state.theme);
        generateTree();
    });

    const trunkColor = document.getElementById('param-color-trunk');
    trunkColor.addEventListener('input', (e) => {
        state.colorTrunk = e.target.value;
        generateTree();
    });

    const leafColor = document.getElementById('param-color-leaves');
    leafColor.addEventListener('input', (e) => {
        state.colorLeaves = e.target.value;
        generateTree();
    });

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.preset);
        });
    });

    document.getElementById('btn-randomize').addEventListener('click', randomizeTree);
    document.getElementById('btn-export').addEventListener('click', exportGLTF);
}

function applyPreset(name) {
    const p = presets[name];
    Object.assign(state, p);

    document.getElementById('param-depth').value = p.depth;
    document.getElementById('val-depth').innerText = p.depth;
    document.getElementById('param-branches').value = p.branches;
    document.getElementById('val-branches').innerText = p.branches;
    document.getElementById('param-length-decay').value = p.lengthDecay;
    document.getElementById('val-length-decay').innerText = p.lengthDecay.toFixed(2);
    document.getElementById('param-width-decay').value = p.widthDecay;
    document.getElementById('val-width-decay').innerText = p.widthDecay.toFixed(2);
    document.getElementById('param-angle').value = p.angle;
    document.getElementById('val-angle').innerText = `${p.angle}°`;
    document.getElementById('param-trunk-height').value = p.trunkHeight;
    document.getElementById('val-trunk-height').innerText = p.trunkHeight;
    document.getElementById('param-show-leaves').checked = p.showLeaves;
    document.getElementById('param-leaf-size').value = p.leafSize;
    document.getElementById('val-leaf-size').innerText = p.leafSize.toFixed(2);
    document.getElementById('param-leaf-type').value = p.leafType;
    document.getElementById('param-color-trunk').value = p.colorTrunk;
    document.getElementById('param-color-leaves').value = p.colorLeaves;
    document.getElementById('param-wind-strength').value = p.windStrength;
    document.getElementById('val-wind-strength').innerText = p.windStrength.toFixed(2);
    document.getElementById('param-wind-speed').value = p.windSpeed;
    document.getElementById('val-wind-speed').innerText = p.windSpeed.toFixed(1);
    document.getElementById('param-theme').value = p.theme;

    applyTheme(p.theme);
    generateTree();
}

function randomizeTree() {
    state.branches = Math.floor(Math.random() * 3) + 2; // 2 to 4
    state.depth = Math.floor(Math.random() * 3) + 5; // 5 to 7
    state.lengthDecay = 0.65 + Math.random() * 0.18;
    state.widthDecay = 0.60 + Math.random() * 0.20;
    state.angle = Math.floor(Math.random() * 50) + 20;
    state.trunkHeight = Math.floor(Math.random() * 6) + 8;

    document.getElementById('param-depth').value = state.depth;
    document.getElementById('val-depth').innerText = state.depth;
    document.getElementById('param-branches').value = state.branches;
    document.getElementById('val-branches').innerText = state.branches;
    document.getElementById('param-length-decay').value = state.lengthDecay;
    document.getElementById('val-length-decay').innerText = state.lengthDecay.toFixed(2);
    document.getElementById('param-width-decay').value = state.widthDecay;
    document.getElementById('val-width-decay').innerText = state.widthDecay.toFixed(2);
    document.getElementById('param-angle').value = state.angle;
    document.getElementById('val-angle').innerText = `${state.angle}°`;
    document.getElementById('param-trunk-height').value = state.trunkHeight;
    document.getElementById('val-trunk-height').innerText = state.trunkHeight;

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    generateTree();
}

function exportGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(
        treeGroup,
        (gltf) => {
            const output = JSON.stringify(gltf, null, 2);
            downloadFile(output, 'fractal-tree.gltf', 'application/json');
        },
        (error) => {
            console.error('An error occurred during export:', error);
            alert('Export failed.');
        },
        { binary: false }
    );
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener('DOMContentLoaded', init);

