# Portfolio Samzdev

Portfolio de Sam (Samzdev) : développement web full-stack et systèmes embarqués (ESP32, STM32), robotique et impression 3D.

**Site :** https://samzdev08.github.io/portfolio/

## Contenu

- **À propos** : formation au CFPT (Genève), passage du web à l'embarqué
- **Compétences** : langages, systèmes embarqués, web, outils
- **Projets** : filtrables (Embarqué & robotique / Web), avec liens GitHub et démos
- **Parcours** et **Contact**

## Technologies

- HTML, CSS et JavaScript natifs (aucun framework, aucun build)
- [Three.js](https://threejs.org/) chargé via CDN (importmap) pour la sphère 3D de l'accueil
- `IntersectionObserver` pour les animations au scroll et le lien de navigation actif

## Lancer en local

Les modules ES ne se chargent pas en `file://`, il faut un petit serveur :

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Structure

```
index.html     page unique
style.css      styles (responsive 1024 / 768 / 480 / 360 px)
hero3d.js      sphère 3D Three.js de l'accueil
scripts.js     animations au scroll, navigation active, filtre des projets
img/icons/     logos des technologies
img/projects/  images des projets
```
