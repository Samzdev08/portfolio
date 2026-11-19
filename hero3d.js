import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Sphère 3D de l'accueil ----------
// Maillage géodésique vert + points sur les sommets + anneau incliné.
// Rotation lente et continue, rendu en pause quand la sphère n'est pas visible.

const container = document.querySelector('.image-display');

const ACCENT = 0x00a58a;
const ACCENT_LIGHT = 0x00c9a7;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161616);

const sizes = {
    width: container.clientWidth,
    height: container.clientHeight
};

const camera = new THREE.PerspectiveCamera(10, sizes.width / sizes.height, 0.1, 1000);
const CAMERA_DIR = new THREE.Vector3(0, 10, 10.5).normalize();
const BASE_DISTANCE = Math.hypot(10, 10.5);
const SCENE_WIDTH = 2.9; // largeur de l'anneau + marge, en unités 3D

// Sur écran étroit (mobile), la caméra recule pour que l'anneau ne soit pas coupé
function fitCamera() {
    camera.aspect = sizes.width / sizes.height;
    const visibleHeight = 2 * BASE_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visibleWidth = visibleHeight * camera.aspect;
    const distance = BASE_DISTANCE * Math.max(1, SCENE_WIDTH / visibleWidth);
    camera.position.copy(CAMERA_DIR).multiplyScalar(distance);
    camera.updateProjectionMatrix();
}
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;

// Tout tourne ensemble dans un groupe
const globe = new THREE.Group();
scene.add(globe);

// 1. Maillage géodésique (icosaèdre subdivisé) en fil de fer
const geodesic = new THREE.IcosahedronGeometry(1, 3);
const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(geodesic),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 })
);
globe.add(wireframe);

// 2. Points lumineux sur les sommets
const points = new THREE.Points(
    geodesic,
    new THREE.PointsMaterial({ color: ACCENT_LIGHT, size: 0.055, transparent: true, opacity: 1 })
);
globe.add(points);

// 3. Noyau sombre : masque les lignes de l'arrière pour donner du relief
const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x161616, transparent: true, opacity: 0.6 })
);
core.renderOrder = 1; // dessiné après les lignes : celles de l'arrière sont atténuées, pas effacées
globe.add(core);

// 4. Anneau fin incliné autour de la sphère
const ringCurve = new THREE.EllipseCurve(0, 0, 1.3, 1.3, 0, Math.PI * 2);
const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringCurve.getPoints(160)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
);
const ringPivot = new THREE.Group();
ringPivot.rotation.x = Math.PI / 2 - 0.35;
ringPivot.rotation.z = 0.25;
ringPivot.add(ring);
scene.add(ringPivot);

// ---------- Animation continue ----------
const clock = new THREE.Clock();
const speed = reduceMotion ? 0.25 : 1;

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    globe.rotation.y += 0.18 * speed * delta;
    globe.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.08 * speed;
    ring.rotation.z -= 0.1 * speed * delta;

    if (!reduceMotion) {
        // Léger flottement vertical
        globe.position.y = Math.sin(t * 0.8) * 0.04;
        ringPivot.position.y = globe.position.y;
    }

    controls.update();
    renderer.render(scene, camera);
}

// Rendu uniquement quand la sphère est visible (économise batterie / CPU)
let running = false;

function start() {
    if (running) return;
    running = true;
    clock.getDelta(); // évite un saut après une pause
    renderer.setAnimationLoop(animate);
}

function stop() {
    running = false;
    renderer.setAnimationLoop(null);
}

if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
        entry.isIntersecting ? start() : stop();
    }).observe(container);
} else {
    start();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (container.getBoundingClientRect().bottom > 0) start();
});

window.addEventListener('resize', () => {
    sizes.width = container.clientWidth;
    sizes.height = container.clientHeight;

    fitCamera();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
