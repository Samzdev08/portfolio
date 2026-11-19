import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Sphère 3D de l'accueil ----------
// Maillage géodésique vert + points sur les sommets + anneau incliné.
// Rotation lente et continue, rendu en pause quand la sphère n'est pas visible.
//
// Effets interactifs (à comparer, on n'en gardera qu'un) — choix par l'URL :
//   ?effet=1  Suit la souris : le globe s'incline vers le curseur, les sommets proches s'allument
//   ?effet=2  Déformation : le maillage s'étire autour du curseur et revient comme un ressort
//   ?effet=3  Onde au clic : un clic envoie une onde lumineuse + accélère la rotation
//   ?effet=4  Compétences : les technos tournent à la surface du globe (défaut)
const EFFECT = new URLSearchParams(location.search).get('effet') || '4';

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

// "tilt" peut s'incliner vers la souris ; "globe" tourne sur lui-même à l'intérieur
const tilt = new THREE.Group();
scene.add(tilt);

const globe = new THREE.Group();
tilt.add(globe);

// ---------- Couleurs et données par sommet ----------
// Base assombrie (même rendu qu'avec 60 % d'opacité), lueur vert menthe vive
const BASE_LINE = new THREE.Color(ACCENT).lerp(new THREE.Color(0x161616), 0.4);
const GLOW_LINE = new THREE.Color(0x9ffff0);
const BASE_POINT = new THREE.Color(0x00c9a7);
const GLOW_POINT = new THREE.Color(0xe6fffa);

function prepareGeometry(geometry, baseColor) {
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) baseColor.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.glow = new Float32Array(count);      // intensité 0..1 (effet 1)
    geometry.userData.rest = geometry.attributes.position.array.slice(); // forme au repos
    geometry.userData.offset = new Float32Array(count);    // déplacement radial (effet 2)
    geometry.userData.velocity = new Float32Array(count);  // vitesse du ressort (effet 2)
}

const tmpColor = new THREE.Color();
function setVertexGlow(color, i, baseColor, glowColor, intensity) {
    tmpColor.copy(baseColor).lerp(glowColor, intensity);
    color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
}

// 1. Maillage géodésique (icosaèdre subdivisé) en fil de fer
const geodesic = new THREE.IcosahedronGeometry(1, 3);
const wireGeometry = new THREE.WireframeGeometry(geodesic);
prepareGeometry(wireGeometry, BASE_LINE);
const wireframe = new THREE.LineSegments(
    wireGeometry,
    new THREE.LineBasicMaterial({ vertexColors: true })
);
globe.add(wireframe);

// 2. Points lumineux sur les sommets
const pointGeometry = geodesic.clone();
prepareGeometry(pointGeometry, BASE_POINT);
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

// ---------- Suivi de la souris / du doigt (commun aux effets) ----------
const pointer = {
    active: false,
    ndc: new THREE.Vector2(10, 10), // position dans le canvas (-1..1), loin par défaut
    tiltX: 0,                        // inclinaison visée (effet 1)
    tiltY: 0
};

const MAX_TILT_X = 0.35; // radians
const MAX_TILT_Y = 0.5;

window.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.active = true;

    pointer.ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

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

// =========================================================
// Effet 1 : suit la souris (inclinaison + lueur des sommets proches)
// =========================================================
const GLOW_RADIUS = 0.4;  // rayon de la zone allumée (en unités écran)
const GLOW_RISE = 10;     // vitesse d'allumage
const GLOW_FADE = 2.2;    // vitesse d'extinction (traînée)

const tmp = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();

function followGlow(object, baseColor, glowColor, delta) {
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

        setVertexGlow(color, i, baseColor, glowColor, next);
        changed = true;
    }
    if (changed) color.needsUpdate = true;
}

function updateFollow(delta) {
    const ease = Math.min(1, delta * 3);
    tilt.rotation.x += (pointer.tiltX - tilt.rotation.x) * ease;
    tilt.rotation.y += (pointer.tiltY - tilt.rotation.y) * ease;

    scene.updateMatrixWorld();
    followGlow(wireframe, BASE_LINE, GLOW_LINE, delta);
    followGlow(points, BASE_POINT, GLOW_POINT, delta);
}

// =========================================================
// Effet 2 : déformation élastique vers le curseur
// =========================================================
const REPEL_ANGLE = 0.3;                  // écartement max des sommets autour du curseur (radians)
const BULGE_AMPLITUDE = 0.08;             // léger gonflement en plus (rayon du globe = 1)
const BULGE_SPREAD = Math.cos(0.7);       // taille de la zone déformée (angle ~40°)
const SPRING_STIFFNESS = 90;              // raideur du ressort
const SPRING_DAMPING = 9;                 // amortissement (plus bas = plus de rebond)

const raycaster = new THREE.Raycaster();
const localRay = new THREE.Ray();
const inverseMatrix = new THREE.Matrix4();
const unitSphere = new THREE.Sphere(new THREE.Vector3(), 1);
const hitPoint = new THREE.Vector3();
const hitDir = new THREE.Vector3();

function getHitDirection() {
    if (!pointer.active) return null;
    raycaster.setFromCamera(pointer.ndc, camera);
    // Rayon exprimé dans le repère du globe (qui tourne) : la bosse reste sous le curseur
    inverseMatrix.copy(globe.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix);
    if (!localRay.intersectSphere(unitSphere, hitPoint)) return null;
    return hitDir.copy(hitPoint).normalize();
}

function deform(object, baseColor, glowColor, hit, delta) {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    const { rest, offset, velocity } = geometry.userData;

    let changed = false;
    for (let i = 0; i < position.count; i++) {
        const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2];

        // Force de la déformation visée pour ce sommet (1 sous le curseur, 0 au bord de la zone)
        let target = 0;
        let dot = 0;
        if (hit) {
            dot = rx * hit.x + ry * hit.y + rz * hit.z; // sommets sur une sphère de rayon 1
            if (dot > BULGE_SPREAD) {
                let w = (dot - BULGE_SPREAD) / (1 - BULGE_SPREAD);
                target = w * w * (3 - 2 * w); // smoothstep : bord adouci
            }
        }

        // Ressort amorti : la surface rattrape la cible puis rebondit légèrement
        let s = offset[i];
        let v = velocity[i];
        if (target === 0 && Math.abs(s) < 1e-4 && Math.abs(v) < 1e-4) {
            if (s === 0) continue;
            s = 0; v = 0;
        } else {
            v += (SPRING_STIFFNESS * (target - s) - SPRING_DAMPING * v) * delta;
            s += v * delta;
        }
        offset[i] = s;
        velocity[i] = v;

        // 1. Écarte le sommet du curseur le long de la surface (effet loupe / membrane étirée)
        let px = rx, py = ry, pz = rz;
        if (hit && s !== 0) {
            let tx = rx - hit.x * dot, ty = ry - hit.y * dot, tz = rz - hit.z * dot;
            const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (len > 1e-5) {
                const a = REPEL_ANGLE * s;
                const c = Math.cos(a), sn = Math.sin(a) / len;
                px = rx * c + tx * sn;
                py = ry * c + ty * sn;
                pz = rz * c + tz * sn;
            }
        }
        // 2. Léger gonflement vers l'extérieur
        const scale = 1 + BULGE_AMPLITUDE * s;
        position.setXYZ(i, px * scale, py * scale, pz * scale);
        setVertexGlow(color, i, baseColor, glowColor, THREE.MathUtils.clamp(s, 0, 1) * 0.7);
        changed = true;
    }
    if (changed) {
        position.needsUpdate = true;
        color.needsUpdate = true;
    }
}

function updateDeform(delta) {
    scene.updateMatrixWorld();
    const hit = getHitDirection();
    deform(wireframe, BASE_LINE, GLOW_LINE, hit, delta);
    deform(points, BASE_POINT, GLOW_POINT, hit, delta);
}

// =========================================================
// Effet 3 : onde lumineuse au clic + accélération de la rotation
// =========================================================
const WAVE_SPEED = 2.2;        // vitesse de l'onde (radians de sphère par seconde)
const WAVE_WIDTH = 0.28;       // épaisseur du front d'onde (radians)
const WAVE_LIFETIME = Math.PI / WAVE_SPEED + 0.3; // le temps de faire le tour
const WAVE_LIFT = 0.05;        // soulèvement des sommets au passage de l'onde
const MAX_WAVES = 4;
const SPIN_BOOST = 3;          // accélération max de la rotation (x4 au clic)

const waves = [];              // { dir: Vector3 (repère du globe), age: secondes }
let spinBoost = 0;

function launchWave(ndc) {
    pointer.ndc.copy(ndc);
    pointer.active = true;
    scene.updateMatrixWorld();
    const dir = getHitDirection();
    if (!dir) return;
    waves.push({ dir: dir.clone(), age: 0 });
    if (waves.length > MAX_WAVES) waves.shift();
    if (!reduceMotion) spinBoost = SPIN_BOOST;
}

function waveIntensity(rx, ry, rz) {
    let intensity = 0;
    for (const wave of waves) {
        const dot = THREE.MathUtils.clamp(rx * wave.dir.x + ry * wave.dir.y + rz * wave.dir.z, -1, 1);
        const angle = Math.acos(dot);                 // distance au point cliqué, sur la sphère
        const front = wave.age * WAVE_SPEED;          // position actuelle du front d'onde
        const k = (angle - front) / WAVE_WIDTH;
        const fade = 1 - wave.age / WAVE_LIFETIME;    // l'onde s'éteint en faisant le tour
        intensity = Math.max(intensity, Math.exp(-k * k) * fade);
    }
    return intensity;
}

function ripple(object, baseColor, glowColor) {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    const { rest, glow } = geometry.userData;

    let changed = false;
    for (let i = 0; i < position.count; i++) {
        const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2];
        const intensity = waves.length ? waveIntensity(rx, ry, rz) : 0;
        if (intensity === 0 && glow[i] === 0) continue;
        glow[i] = intensity < 0.003 ? 0 : intensity;

        const scale = 1 + WAVE_LIFT * glow[i];
        position.setXYZ(i, rx * scale, ry * scale, rz * scale);
        setVertexGlow(color, i, baseColor, glowColor, glow[i]);
        changed = true;
    }
    if (changed) {
        position.needsUpdate = true;
        color.needsUpdate = true;
    }
}

function updateWave(delta) {
    for (const wave of waves) wave.age += delta;
    while (waves.length && waves[0].age > WAVE_LIFETIME) waves.shift();
    spinBoost *= Math.exp(-1.8 * delta); // la rotation ralentit en douceur

    scene.updateMatrixWorld();
    ripple(wireframe, BASE_LINE, GLOW_LINE);
    ripple(points, BASE_POINT, GLOW_POINT);
}

if (EFFECT === '3') {
    // Un vrai clic (pas un glisser pour faire tourner le globe) déclenche l'onde
    const canvas = renderer.domElement;
    const down = { x: 0, y: 0, time: 0 };
    const clickNdc = new THREE.Vector2();
    canvas.style.cursor = 'pointer';

    canvas.addEventListener('pointerdown', (e) => {
        down.x = e.clientX; down.y = e.clientY; down.time = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (moved > 6 || performance.now() - down.time > 400) return;
        const rect = canvas.getBoundingClientRect();
        clickNdc.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        launchWave(clickNdc);
    });
}

// =========================================================
// Effet 4 : compétences à la surface du globe
// =========================================================
const SKILLS = [
    'ESP32', 'STM32', 'Arduino', 'C', 'C++', 'Python', 'JavaScript', 'TypeScript',
    'React', 'Node.js', 'Three.js', 'PHP', 'SQL', 'Docker', 'Git', 'Linux'
];
const LABEL_RADIUS = 1.12;     // juste au-dessus de la surface
const HOVER_SLOWDOWN = 0.15;   // vitesse de rotation quand une compétence est survolée

const labels = [];             // { el, local: Vector3 }
let hoveredLabels = 0;
let labelSlowdown = 1;         // 1 = vitesse normale

function createSkillLabels() {
    const layer = document.createElement('div');
    layer.className = 'globe-labels';
    container.appendChild(layer);

    // Répartition uniforme sur la sphère (spirale de Fibonacci)
    const golden = Math.PI * (3 - Math.sqrt(5));
    SKILLS.forEach((name, i) => {
        const y = 1 - (i / (SKILLS.length - 1)) * 2 * 0.85; // évite les pôles exacts
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const local = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r)
            .multiplyScalar(LABEL_RADIUS);

        const el = document.createElement('span');
        el.className = 'globe-label';
        el.textContent = name;
        el.addEventListener('pointerenter', () => { hoveredLabels++; });
        el.addEventListener('pointerleave', () => { hoveredLabels = Math.max(0, hoveredLabels - 1); });
        layer.appendChild(el);

        labels.push({ el, local });
    });
}

const labelWorld = new THREE.Vector3();
const labelNormal = new THREE.Vector3();

function updateLabels(delta) {
    // Ralentit en douceur quand une compétence est survolée
    const targetSlowdown = hoveredLabels > 0 ? HOVER_SLOWDOWN : 1;
    labelSlowdown += (targetSlowdown - labelSlowdown) * Math.min(1, delta * 4);

    scene.updateMatrixWorld();
    toCamera.copy(camera.position).normalize();

    for (const label of labels) {
        labelWorld.copy(label.local).applyMatrix4(globe.matrixWorld);
        labelNormal.copy(labelWorld).sub(tilt.position).normalize();
        const facing = labelNormal.dot(toCamera); // 1 = face à nous, -1 = derrière

        labelWorld.project(camera);
        const x = (labelWorld.x + 1) / 2 * sizes.width;
        const y = (1 - labelWorld.y) / 2 * sizes.height;

        const front = facing > 0.05;
        const opacity = front ? 0.45 + 0.55 * facing : Math.max(0.08, 0.2 + facing * 0.2);
        label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        label.el.style.opacity = opacity.toFixed(2);
        label.el.style.zIndex = String(Math.round((facing + 1) * 100));
        label.el.classList.toggle('is-back', !front);
    }
}

if (EFFECT === '4') createSkillLabels();

const updateEffect = { '1': updateFollow, '2': updateDeform, '3': updateWave, '4': updateLabels }[EFFECT] || updateLabels;

// ---------- Animation continue ----------
const clock = new THREE.Clock();
const speed = reduceMotion ? 0.25 : 1;

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    globe.rotation.y += 0.18 * speed * (1 + spinBoost) * labelSlowdown * delta;
    globe.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.08 * speed;
    ring.rotation.z -= 0.1 * speed * delta;

    if (!reduceMotion) {
        // Léger flottement vertical
        tilt.position.y = Math.sin(t * 0.8) * 0.04;
    }

    updateEffect(delta);

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
