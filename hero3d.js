import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Sphère 3D de l'accueil ----------
// Maillage géodésique vert + points sur les sommets + anneau incliné.
// Les compétences tournent à la surface du globe ; survoler une compétence ralentit la rotation.
// Sous le curseur, la sphère gonfle localement et s'allume, puis revient en douceur à la normale.
// Rotation lente et continue, rendu en pause quand la sphère n'est pas visible.

const container = document.querySelector('.image-display');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Couleurs de la sphère pour chaque thème (mêmes teintes que style.css)
const PALETTES = {
    light: {
        bg: 0xf6f4ef, accent: 0x0b7a68, lineMix: 0.1, glowLine: 0x00b894, point: 0x0b7a68, glowPoint: 0x00d1ad,
        ring: 0x16181d, ringOpacity: 0.3
    },
    dark: {
        bg: 0x161616, accent: 0x00a58a, lineMix: 0.4, glowLine: 0x9ffff0, point: 0x00c9a7, glowPoint: 0xe6fffa,
        ring: 0xffffff, ringOpacity: 0.35
    }
};
const currentTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

// Couleur réellement affichée derrière la sphère. On la lit sur la page plutôt que de la supposer :
// si un navigateur ou une app assombrit le site de force (mode sombre iOS…), la sphère suit quand même.
const pageBg = new THREE.Color();
function readPageBackground(theme) {
    const css = getComputedStyle(document.body).backgroundColor;
    const match = css && css.match(/rgba?\(([^)]+)\)/);
    if (match) {
        const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        if (a > 0) return pageBg.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    }
    return pageBg.set(PALETTES[theme].bg); // fond non lisible : couleur prévue par le thème
}

// Thème "visuel" : d'après la luminosité réelle du fond, pas seulement d'après le réglage du site
function visualTheme() {
    const theme = currentTheme();
    const bg = readPageBackground(theme);
    const hsl = bg.getHSL({}, THREE.SRGBColorSpace);
    return hsl.l < 0.45 ? 'dark' : 'light';
}

// Pas de fond dans la scène : le canvas est transparent et laisse voir la page
const scene = new THREE.Scene();

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

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;

// "tilt" flotte doucement ; "globe" tourne sur lui-même à l'intérieur
const tilt = new THREE.Group();
scene.add(tilt);

const globe = new THREE.Group();
tilt.add(globe);

// ---------- Couleurs par sommet pour la lueur sous le curseur ----------
// Base mélangée au fond (même rendu qu'avec 60 % d'opacité), lueur vert menthe vive.
// Valeurs fixées par applyPalette() selon le thème.
const BASE_LINE = new THREE.Color();
const GLOW_LINE = new THREE.Color();
const BASE_POINT = new THREE.Color();
const GLOW_POINT = new THREE.Color();

function addGlowColors(geometry, baseColor) {
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) baseColor.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.glow = new Float32Array(count); // intensité 0..1 de chaque sommet
    geometry.userData.base = geometry.attributes.position.array.slice(); // positions au repos
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
    new THREE.PointsMaterial({ vertexColors: true, size: 0.055 })
);
globe.add(points);

// 3. Noyau sombre : masque les lignes de l'arrière pour donner du relief
const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 48, 48),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 })
);
core.renderOrder = 1; // dessiné après les lignes : celles de l'arrière sont atténuées, pas effacées
globe.add(core);

// 4. Anneau fin incliné autour de la sphère
const ringCurve = new THREE.EllipseCurve(0, 0, 1.3, 1.3, 0, Math.PI * 2);
const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringCurve.getPoints(160)),
    new THREE.LineBasicMaterial({ transparent: true })
);
const ringPivot = new THREE.Group();
ringPivot.rotation.x = Math.PI / 2 - 0.35;
ringPivot.rotation.z = 0.25;
ringPivot.add(ring);
tilt.add(ringPivot);

// ---------- Thème clair / sombre ----------
function repaintVertices(object, baseColor, glowColor) {
    const color = object.geometry.attributes.color;
    const glow = object.geometry.userData.glow;
    for (let i = 0; i < color.count; i++) {
        tmpThemeColor.copy(baseColor).lerp(glowColor, glow[i]);
        color.setXYZ(i, tmpThemeColor.r, tmpThemeColor.g, tmpThemeColor.b);
    }
    color.needsUpdate = true;
}
const tmpThemeColor = new THREE.Color();

function applyPalette() {
    const theme = visualTheme();          // lit aussi le fond réel de la page dans pageBg
    const p = PALETTES[theme];
    BASE_LINE.set(p.accent).lerp(pageBg, p.lineMix);
    GLOW_LINE.set(p.glowLine);
    BASE_POINT.set(p.point);
    GLOW_POINT.set(p.glowPoint);
    core.material.color.copy(pageBg);     // le noyau a la couleur exacte du fond de la page
    ring.material.color.set(p.ring);
    ring.material.opacity = p.ringOpacity;
    repaintVertices(wireframe, BASE_LINE, GLOW_LINE);
    repaintVertices(points, BASE_POINT, GLOW_POINT);
}
function refreshPalette() {
    applyPalette();
    renderer.render(scene, camera); // mise à jour immédiate, même si l'animation est en pause
}
applyPalette();

window.addEventListener('themechange', refreshPalette);
// Le fond de la page change avec une transition : on relit sa couleur une fois la transition finie
document.body.addEventListener('transitionend', (e) => {
    if (e.target === document.body && e.propertyName === 'background-color') refreshPalette();
});
// Filet de sécurité : relecture après le chargement complet (styles injectés par le navigateur…)
window.addEventListener('load', () => setTimeout(refreshPalette, 300));

// ---------- Compétences à la surface du globe ----------
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
createSkillLabels();

const labelWorld = new THREE.Vector3();
const labelNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();

// ---------- Souris / doigt : position du curseur ----------
const pointer = {
    active: false,
    ndc: new THREE.Vector2(10, 10) // position dans le canvas (-1..1), loin par défaut
};

window.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.active = true;
    pointer.ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
}, { passive: true });

function releasePointer() {
    pointer.active = false;
    pointer.ndc.set(10, 10);
}

document.addEventListener('pointerleave', releasePointer);
window.addEventListener('blur', releasePointer);
// Au doigt : on relâche quand le doigt quitte l'écran
window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') releasePointer(); });
window.addEventListener('pointercancel', releasePointer);

// ---------- Bosse lumineuse sous le curseur ----------
// Les sommets proches du curseur s'allument et sont poussés vers l'extérieur :
// seule la zone survolée gonfle, puis elle se dégonfle en douceur une fois la souris partie.
const GLOW_RADIUS = 0.4;  // rayon de la zone touchée (en unités écran)
const GLOW_RISE = 10;     // vitesse de gonflement
const GLOW_FADE = 2.2;    // vitesse de retour à la normale (traînée)
const BULGE = 0.14;       // gonflement max : +14 % du rayon au centre de la zone

const tmp = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpColor = new THREE.Color();

function updateGlow(object, baseColor, glowColor, delta) {
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    const glow = geometry.userData.glow;
    const base = geometry.userData.base;
    const aspect = sizes.width / sizes.height;

    let changed = false;
    for (let i = 0; i < position.count; i++) {
        let target = 0;

        if (pointer.active) {
            // Distance calculée sur la position au repos : la bosse ne se "pousse" pas elle-même
            tmp.fromArray(base, i * 3).applyMatrix4(object.matrixWorld);
            // Seuls les sommets de la face visible réagissent
            tmpNormal.copy(tmp).sub(tilt.position).normalize();
            if (tmpNormal.dot(toCamera) > 0.15) {
                tmp.project(camera);
                const dx = (tmp.x - pointer.ndc.x) * aspect;
                const dy = tmp.y - pointer.ndc.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < GLOW_RADIUS) {
                    const k = 1 - dist / GLOW_RADIUS;
                    target = k * k * (3 - 2 * k); // courbe douce : bosse arrondie, sans arête
                }
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

        const s = 1 + BULGE * next;
        position.setXYZ(i, base[i * 3] * s, base[i * 3 + 1] * s, base[i * 3 + 2] * s);
        changed = true;
    }
    if (changed) {
        color.needsUpdate = true;
        position.needsUpdate = true;
    }
}

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

// ---------- Animation continue ----------
const clock = new THREE.Clock();
const speed = reduceMotion ? 0.25 : 1;

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    globe.rotation.y += 0.18 * speed * labelSlowdown * delta;
    globe.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.08 * speed;
    ring.rotation.z -= 0.1 * speed * delta;


    if (!reduceMotion) {
        // Léger flottement vertical
        tilt.position.y = Math.sin(t * 0.8) * 0.04;
    }

    updateLabels(delta); // met aussi à jour les matrices et la direction caméra
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
