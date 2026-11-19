import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Sphère 3D de l'accueil ----------
// Maillage géodésique vert + points sur les sommets + anneau incliné.
// Rotation lente et continue, rendu en pause quand la sphère n'est pas visible.
// Interaction : le globe s'incline vers le curseur et les sommets proches s'allument.

const container = document.querySelector('.image-display');

const ACCENT = 0x00a58a;
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

// "tilt" s'incline vers la souris ; "globe" tourne sur lui-même à l'intérieur
const tilt = new THREE.Group();
scene.add(tilt);

const globe = new THREE.Group();
tilt.add(globe);

// ---------- Couleurs par sommet pour l'effet de lueur ----------
// Base assombrie (même rendu qu'avant avec 60 % d'opacité), lueur vert menthe vive
const BASE_LINE = new THREE.Color(ACCENT).lerp(new THREE.Color(0x161616), 0.4);
const GLOW_LINE = new THREE.Color(0x9ffff0);
const BASE_POINT = new THREE.Color(0x00c9a7);
const GLOW_POINT = new THREE.Color(0xe6fffa);

function addGlowColors(geometry, baseColor) {
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) baseColor.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.glow = new Float32Array(count); // intensité 0..1 de chaque sommet
}

// 1. Maillage géodésique (icosaèdre subdivisé) en fil de fer
const geodesic = new THREE.IcosahedronGeometry(1, 3);
const wireGeometry = new THREE.WireframeGeometry(geodesic);
addGlowColors(wireGeometry, BASE_LINE);
const wireframe = new THREE.LineSegments(
    wireGeometry,
    new THREE.LineBasicMaterial({ vertexColors: true })
);
globe.add(wireframe);

// 2. Points lumineux sur les sommets
const pointGeometry = geodesic.clone();
addGlowColors(pointGeometry, BASE_POINT);
const points = new THREE.Points(
    pointGeometry,
    new THREE.PointsMaterial({ vertexColors: true, size: 0.055, transparent: true, opacity: 1 })
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
tilt.add(ringPivot);

// ---------- Suivi de la souris / du doigt ----------
const pointer = {
    active: false,
    ndc: new THREE.Vector2(10, 10), // position dans le canvas (-1..1), loin par défaut
    tiltX: 0,                        // inclinaison visée
    tiltY: 0
};

const MAX_TILT_X = 0.35; // radians
const MAX_TILT_Y = 0.5;

window.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.active = true;

    // Position dans le canvas, pour la lueur
    pointer.ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Position par rapport au centre du globe, pour l'inclinaison (bornée à -1..1)
    const nx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
    const ny = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
    pointer.tiltY = THREE.MathUtils.clamp(nx, -1, 1) * MAX_TILT_Y;
    pointer.tiltX = THREE.MathUtils.clamp(ny, -1, 1) * MAX_TILT_X;
}, { passive: true });

function releasePointer() {
    pointer.active = false;
    pointer.ndc.set(10, 10);
    pointer.tiltX = 0;
    pointer.tiltY = 0;
}

document.addEventListener('pointerleave', releasePointer);
window.addEventListener('blur', releasePointer);
// Au doigt : on relâche quand le doigt quitte l'écran
window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') releasePointer(); });
window.addEventListener('pointercancel', releasePointer);

// ---------- Lueur des sommets proches du curseur ----------
const GLOW_RADIUS = 0.4;    // rayon de la zone allumée (en unités écran)
const GLOW_RISE = 10;       // vitesse d'allumage
const GLOW_FADE = 2.2;      // vitesse d'extinction (traînée)

const tmp = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();
const tmpColor = new THREE.Color();

function updateGlow(object, baseColor, glowColor, delta) {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    const glow = geometry.userData.glow;
    const aspect = sizes.width / sizes.height;

    toCamera.copy(camera.position).normalize();

    let changed = false;
    for (let i = 0; i < position.count; i++) {
        let target = 0;

        if (pointer.active) {
            tmp.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
            // Seuls les sommets de la face visible s'allument
            tmpNormal.copy(tmp).sub(tilt.position).normalize();
            if (tmpNormal.dot(toCamera) > 0.15) {
                tmp.project(camera);
                const dx = (tmp.x - pointer.ndc.x) * aspect;
                const dy = tmp.y - pointer.ndc.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < GLOW_RADIUS) target = 1 - dist / GLOW_RADIUS;
            }
        }

        const current = glow[i];
        if (current === target) continue;
        const rate = target > current ? GLOW_RISE : GLOW_FADE;
        let next = current + (target - current) * Math.min(1, rate * delta);
        if (Math.abs(next - target) < 0.002) next = target;
        glow[i] = next;

        tmpColor.copy(baseColor).lerp(glowColor, next);
        color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
        changed = true;
    }
    if (changed) color.needsUpdate = true;
}

// ---------- Animation continue ----------
const clock = new THREE.Clock();
const speed = reduceMotion ? 0.25 : 1;

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    globe.rotation.y += 0.18 * speed * delta;
    globe.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.08 * speed;
    ring.rotation.z -= 0.1 * speed * delta;

    // Inclinaison amortie vers le curseur
    const ease = Math.min(1, delta * 3);
    tilt.rotation.x += (pointer.tiltX - tilt.rotation.x) * ease;
    tilt.rotation.y += (pointer.tiltY - tilt.rotation.y) * ease;

    if (!reduceMotion) {
        // Léger flottement vertical
        tilt.position.y = Math.sin(t * 0.8) * 0.04;
    }

    scene.updateMatrixWorld();
    updateGlow(wireframe, BASE_LINE, GLOW_LINE, delta);
    updateGlow(points, BASE_POINT, GLOW_POINT, delta);

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
