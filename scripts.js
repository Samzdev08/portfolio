import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.querySelector('.image-display');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161616);

const sizes = {
    width: container.clientWidth,
    height: container.clientHeight
}

const camera = new THREE.PerspectiveCamera(10, sizes.width / sizes.height, 0.1, 1000);
camera.position.z = 10.5;
camera.position.y = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enableDamping = true;

const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

let startTime = null;
const duration = 3000;

function animate(time) {
    if (startTime === null) startTime = time;

    const elapsedTime = time - startTime;

    if (elapsedTime < duration) {
        sphere.rotation.x += 0.02;
        sphere.rotation.y += 0.01;
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

const techContainer = document.querySelector('.technologies-container');
const skillsContainer = document.querySelector('.skills-container');


window.addEventListener('scroll', function () {

    if (window.scrollY > 500) {

        techContainer.classList.add('active-container');
        skillsContainer.classList.add('active-container');

        document.querySelectorAll('.technology-item').forEach(item => {
            item.classList.add('active-item');

        })
        document.querySelectorAll('.skill-item').forEach(item => {
            item.classList.add('active-item');
        });


    }
})

const cardProjet = document.querySelector('.card-projet');

window.addEventListener('scroll', function () {

    if (window.scrollY > 1000) {

        cardProjet.classList.add('active-card');

    }
})


window.addEventListener('resize', () => {
    sizes.width = container.clientWidth;
    sizes.height = container.clientHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Lien de navigation actif selon la section visible (style .navigation a.active)
const navLinks = document.querySelectorAll('.navigation a');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.target === entry.target.dataset.section);
        });
    });
}, { rootMargin: '-45% 0px -50% 0px' });

navLinks.forEach(link => {
    const id = link.getAttribute('href').slice(1);
    // #accueil englobe toute la page : on observe le hero à la place
    const section = id === 'accueil'
        ? document.querySelector('.main-content')
        : document.getElementById(id);
    if (!section) return;
    link.dataset.target = id;
    section.dataset.section = id;
    sectionObserver.observe(section);
});

// Année du footer
const annee = document.getElementById('annee');
if (annee) annee.textContent = new Date().getFullYear();

document.querySelectorAll('.card-projet').forEach(card => {
    const link = card.querySelector('.link a');

    if (!link) return;

    card.addEventListener('click', (e) => {
        // Si le clic est déjà sur le <a>, on laisse faire le comportement natif du lien
        if (e.target.closest('a')) return;

        window.open(link.href, '_blank');
    });
});
