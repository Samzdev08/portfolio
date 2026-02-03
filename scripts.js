import * as THREE from './node_modules/three/build/three.module.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';

const container = document.querySelector('.image-display');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161616);

const sizes = {
    width: container.clientWidth,
    height: container.clientHeight
};

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

        document.querySelectorAll('.technology-item').forEach(item =>{
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
