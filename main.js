import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';

const form = document.getElementById('calc-form');
const rendererContainer = document.getElementById('renderer-container');
const resultFields = {
  gazon: document.getElementById('result-gazon'),
  hedge: document.getElementById('result-hedge'),
  total: document.getElementById('result-total'),
  price: document.getElementById('result-price')
};

const CONSTANTS = {
  M: 0.12,
  V: 2.0,
  K_clean: 0.3,
  T_prep: 15,
  W: 30,
  Cr_gazon: 4,
  Cr_izgorod: 5,
  Cf_tools: 2,
  Cf_car: 4,
  Cm: 1.5,
  Waste_disposal: 5,
  Waste_disposal_large: 10,
  T_doroga: 20,
  Min_price: 30,
  Rate_gazon_res: 0.30,
  Rate_gazon_com: 0.35,
  Small_gazon: 100,
  Tiny_gazon: 20,
  Tiny_price: 25,
  Mileage_rate: 0.75
};

function coeffSlObsl(L, H, alpha = 0.5, beta = 0.5) {
  return Math.max((Math.pow(L / 10, alpha)) * (Math.pow(H / 2, beta)), 1);
}

function calculateCost(values) {
  const {
    S_gazon,
    L_izgorod,
    H_izgorod,
    W_top = 0.5,
    waste_disposal = true,
    is_commercial = false,
    distance_km = 0
  } = values;

  const numbers = [S_gazon, L_izgorod, H_izgorod, W_top, distance_km];
  if (!numbers.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0)) {
    throw new Error('Все входные параметры должны быть неотрицательными числами');
  }

  const rateGazon = is_commercial ? CONSTANTS.Rate_gazon_com : CONSTANTS.Rate_gazon_res;

  const is_visit = S_gazon > 0 || (L_izgorod > 0 && H_izgorod > 0);
  const has_gazon = S_gazon > 0;
  const has_izgorod = L_izgorod > 0 && H_izgorod > 0;

  const waste_cost = has_gazon && !has_izgorod && S_gazon <= CONSTANTS.Small_gazon && waste_disposal
    ? 0
    : (S_gazon > 1000 && waste_disposal)
      ? CONSTANTS.Waste_disposal_large
      : waste_disposal
        ? CONSTANTS.Waste_disposal
        : 0;

  const T_gazon = has_gazon ? (0.3 * S_gazon + 5) / 60 : 0;

  let T_izgorod = 0;
  if (has_izgorod) {
    const area_izgorod = 2 * L_izgorod * H_izgorod + L_izgorod * W_top;
    T_izgorod = (area_izgorod / (60 * CONSTANTS.V)) * (1 + CONSTANTS.K_clean) *
      coeffSlObsl(L_izgorod, H_izgorod) + (CONSTANTS.T_prep / 60);
  }

  const T_doroga_ch = is_visit ? CONSTANTS.T_doroga / 60 : 0;
  const T_total = T_gazon + T_izgorod + T_doroga_ch;

  const T_doroga_payment = CONSTANTS.W * T_doroga_ch;
  const mileage_extra = is_visit ? Math.max(0, distance_km - 5) * CONSTANTS.Mileage_rate : 0;

  const P_gazon = has_gazon && S_gazon < CONSTANTS.Tiny_gazon
    ? CONSTANTS.Tiny_price
    : has_gazon
      ? rateGazon * S_gazon + CONSTANTS.Cr_gazon
      : 0;

  const P_izgorod = has_izgorod ? CONSTANTS.W * T_izgorod + CONSTANTS.Cr_izgorod : 0;

  const cf_tools_total = CONSTANTS.Cf_tools * ((has_gazon ? 1 : 0) + (has_izgorod ? 1 : 0));
  const general_expenses = is_visit
    ? CONSTANTS.Cf_car + CONSTANTS.Cm + waste_cost + cf_tools_total + mileage_extra
    : 0;

  const P_base = P_gazon + P_izgorod + T_doroga_payment + general_expenses;
  const P_fin = has_gazon && !has_izgorod && S_gazon < CONSTANTS.Tiny_gazon
    ? CONSTANTS.Tiny_price
    : is_visit
      ? Math.max(P_base * (1 + CONSTANTS.M), CONSTANTS.Min_price)
      : 0;

  return {
    T_gazon: Number(T_gazon.toFixed(2)),
    T_izgorod: Number(T_izgorod.toFixed(2)),
    T_total: Number(T_total.toFixed(2)),
    P_fin: Number(P_fin.toFixed(2))
  };
}

// THREE.js scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd0e7ff);

const camera = new THREE.PerspectiveCamera(45, rendererContainer.clientWidth / rendererContainer.clientHeight, 0.1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const initialWidth = rendererContainer.clientWidth || rendererContainer.offsetWidth || 600;
const initialHeight = rendererContainer.clientHeight || Math.max(initialWidth * 0.75, 300);
renderer.setSize(initialWidth, initialHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
rendererContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minPolarAngle = Math.PI / 6;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 5;
controls.maxDistance = 60;
controls.target.set(0, 0, 0);
controls.update();

const ambientLight = new THREE.AmbientLight(0xf5f7ff, 0.85);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(18, 40, 12);
sunLight.castShadow = true;
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 120;
sunLight.shadow.mapSize.set(1024, 1024);
scene.add(sunLight);

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4ca45d, roughness: 0.7, metalness: 0.05 });
const hedgeMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.55, metalness: 0.05 });
const hedgeTopMaterial = new THREE.MeshStandardMaterial({ color: 0x337755, roughness: 0.5, metalness: 0.08 });
const borderMaterial = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
const walkwayMaterial = new THREE.MeshStandardMaterial({ color: 0xc8c4b7, roughness: 0.95, metalness: 0.02 });

const lawnMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), groundMaterial);
lawnMesh.position.y = -0.15;
lawnMesh.receiveShadow = true;
scene.add(lawnMesh);

const soilBorder = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 1.1), borderMaterial);
soilBorder.position.y = -0.25;
soilBorder.receiveShadow = true;
scene.add(soilBorder);

const hedgeGroup = new THREE.Group();
scene.add(hedgeGroup);

const walkwayMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1), walkwayMaterial);
walkwayMesh.position.y = -0.22;
walkwayMesh.receiveShadow = true;
scene.add(walkwayMesh);

const helperGrid = new THREE.GridHelper(80, 20, 0x9fc5f8, 0x9fc5f8);
helperGrid.position.y = -0.35;
helperGrid.material.opacity = 0.35;
helperGrid.material.transparent = true;
scene.add(helperGrid);

const dimensionOverlay = document.createElement('div');
dimensionOverlay.className = 'dimension-overlay';
rendererContainer.appendChild(dimensionOverlay);

function seededNoise(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function updateVisualization({ S_gazon, L_izgorod, H_izgorod, W_top }) {
  const safeArea = Math.max(S_gazon, 1);
  let lawnWidth = Math.sqrt(safeArea);
  let lawnDepth = safeArea / lawnWidth;

  if (L_izgorod > 0) {
    const halfPerimeter = Math.max(L_izgorod / 2, 2);
    const discriminant = halfPerimeter * halfPerimeter - 4 * safeArea;
    if (discriminant >= 0) {
      const sqrtDisc = Math.sqrt(discriminant);
      const candidateWidth = (halfPerimeter + sqrtDisc) / 2;
      const candidateDepth = halfPerimeter - candidateWidth;
      if (candidateWidth > 0.1 && candidateDepth > 0.1) {
        lawnWidth = candidateWidth;
        lawnDepth = candidateDepth;
      }
    }
  }

  lawnMesh.scale.set(lawnWidth, 1, lawnDepth);
  soilBorder.scale.set(lawnWidth * 1.05, 1, lawnDepth * 1.05);

  const walkwayWidth = Math.min(Math.max(lawnWidth * 0.18, 0.6), 2.4);
  const walkwayLength = Math.min(Math.max(lawnDepth * 0.4, 1.2), lawnDepth);
  walkwayMesh.scale.set(walkwayWidth, 1, walkwayLength);
  walkwayMesh.position.set(0, -0.22, lawnDepth / 2 - walkwayLength / 2);

  const perimeter = 2 * (lawnWidth + lawnDepth);
  const desiredHedgeLength = Math.min(L_izgorod, perimeter);
  const hedgeThickness = Math.max(W_top || 0.5, 0.3);

  while (hedgeGroup.children.length) {
    const child = hedgeGroup.children.pop();
    if (child.geometry) {
      child.geometry.dispose();
    }
  }

  if (desiredHedgeLength > 0 && H_izgorod > 0) {
    const sides = [
      { length: lawnWidth, center: new THREE.Vector3(0, 0, lawnDepth / 2 + hedgeThickness / 2), axis: 'x' },
      { length: lawnWidth, center: new THREE.Vector3(0, 0, -lawnDepth / 2 - hedgeThickness / 2), axis: 'x' },
      { length: lawnDepth, center: new THREE.Vector3(lawnWidth / 2 + hedgeThickness / 2, 0, 0), axis: 'z' },
      { length: lawnDepth, center: new THREE.Vector3(-lawnWidth / 2 - hedgeThickness / 2, 0, 0), axis: 'z' }
    ];

    let remaining = desiredHedgeLength;

    sides.forEach(({ length, center, axis }) => {
      if (remaining <= 0) {
        return;
      }

      const segmentLength = Math.min(length, remaining);
      if (segmentLength <= 0) {
        return;
      }

      const instances = Math.max(Math.round(segmentLength / 1.2), 1);
      const elementLength = segmentLength / instances;
      const baseGeometry = new THREE.BoxGeometry(elementLength * 0.98, H_izgorod, hedgeThickness * 0.92);
      const instanced = new THREE.InstancedMesh(baseGeometry, hedgeMaterial, instances);
      instanced.castShadow = true;
      instanced.receiveShadow = true;

      const topGeometry = new THREE.BoxGeometry(elementLength * 1.02, Math.max(H_izgorod * 0.15, 0.1), hedgeThickness);
      const topInstanced = new THREE.InstancedMesh(topGeometry, hedgeTopMaterial, instances);
      topInstanced.castShadow = false;

      const rotationQuaternion = axis === 'x'
        ? new THREE.Quaternion()
        : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      for (let i = 0; i < instances; i += 1) {
        const offset = -segmentLength / 2 + elementLength * (i + 0.5);
        const basePosition = axis === 'x'
          ? new THREE.Vector3(center.x + offset, H_izgorod / 2, center.z)
          : new THREE.Vector3(center.x, H_izgorod / 2, center.z + offset);

        const topPosition = axis === 'x'
          ? new THREE.Vector3(center.x + offset, H_izgorod, center.z)
          : new THREE.Vector3(center.x, H_izgorod, center.z + offset);

        const variation = seededNoise(i + instances * 7.31) * 0.12 - 0.06;
        topPosition.y += topGeometry.parameters.height / 2 + variation;

        const scale = new THREE.Vector3(1, 1, 1);

        const matrix = new THREE.Matrix4().compose(basePosition, rotationQuaternion, scale);
        const topMatrix = new THREE.Matrix4().compose(topPosition, rotationQuaternion, scale);

        instanced.setMatrixAt(i, matrix);
        topInstanced.setMatrixAt(i, topMatrix);
      }

      hedgeGroup.add(instanced);
      hedgeGroup.add(topInstanced);

      remaining -= segmentLength;
    });
  }

  const overlayWidth = lawnWidth.toFixed(2);
  const overlayDepth = lawnDepth.toFixed(2);
  const coveragePercent = perimeter > 0 ? Math.round((desiredHedgeLength / perimeter) * 100) : 0;
  dimensionOverlay.innerHTML = `
    <div><strong>Размеры газона:</strong> ${overlayWidth} м × ${overlayDepth} м</div>
    <div><strong>Площадь:</strong> ${safeArea.toFixed(0)} м²</div>
    <div><strong>Изгородь:</strong> ${desiredHedgeLength.toFixed(1)} м (${coveragePercent}% периметра)</div>
  `;
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);

function readFormValues() {
  const formData = new FormData(form);
  const getNumber = (name) => {
    const value = formData.get(name);
    return value === null || value === '' ? 0 : Number(value);
  };

  return {
    S_gazon: getNumber('S_gazon'),
    L_izgorod: getNumber('L_izgorod'),
    H_izgorod: getNumber('H_izgorod'),
    W_top: getNumber('W_top') || 0.5,
    waste_disposal: formData.get('waste_disposal') !== null,
    is_commercial: formData.get('is_commercial') !== null,
    distance_km: getNumber('distance_km')
  };
}

function updateResults(values) {
  try {
    const result = calculateCost(values);
    resultFields.gazon.textContent = `${result.T_gazon} ч`;
    resultFields.hedge.textContent = `${result.T_izgorod} ч`;
    resultFields.total.textContent = `${result.T_total} ч`;
    resultFields.price.textContent = `£${result.P_fin}`;
  } catch (error) {
    resultFields.gazon.textContent = 'Ошибка входных данных';
    resultFields.hedge.textContent = '—';
    resultFields.total.textContent = '—';
    resultFields.price.textContent = '—';
    console.error(error);
  }
}

function resizeRenderer() {
  const width = rendererContainer.clientWidth || rendererContainer.offsetWidth || 600;
  const height = rendererContainer.clientHeight || Math.max(width * 0.75, 300);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  resizeRenderer();
});

form.addEventListener('input', () => {
  const values = readFormValues();
  updateVisualization(values);
  updateResults(values);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = readFormValues();
  updateVisualization(values);
  updateResults(values);
});

// initial
resizeRenderer();
const initialValues = readFormValues();
updateVisualization(initialValues);
updateResults(initialValues);
