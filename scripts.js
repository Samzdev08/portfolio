// ---------- Apparition des éléments au scroll ----------
const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(el => revealObserver.observe(el));
} else {
    revealItems.forEach(el => el.classList.add('is-visible'));
}

// ---------- Lien de navigation actif selon la section visible ----------
const navLinks = document.querySelectorAll('.navigation a');

if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
            });
        });
    }, { rootMargin: '-45% 0px -50% 0px' });

    document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
}

// ---------- Filtre des projets ----------
// Chaque projet a une ou plusieurs catégories dans data-cat (ex. "embedded ai")
const filterButtons = document.querySelectorAll('.filter-btn');
const projectItems = document.querySelectorAll('#projets [data-cat]');
const featured = document.querySelector('#projets .case');
const othersTitle = document.getElementById('autres-projets');

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        const filter = button.dataset.filter;

        filterButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));

        projectItems.forEach(item => {
            const cats = item.dataset.cat.split(' ');
            item.hidden = filter !== 'all' && !cats.includes(filter);
            // Les projets réaffichés doivent être visibles même s'ils n'étaient pas encore apparus
            if (!item.hidden) item.classList.add('is-visible');
        });

        // "Autres projets" n'a de sens que si le projet phare est affiché au-dessus
        if (othersTitle && featured) {
            othersTitle.hidden = featured.hidden;
            if (!othersTitle.hidden) othersTitle.classList.add('is-visible');
        }
    });
});

// ---------- Clic sur une carte projet = ouvre son premier lien ----------
document.querySelectorAll('.card').forEach(card => {
    const link = card.querySelector('a.lnk');
    if (!link) return;
    card.classList.add('has-link');

    card.addEventListener('click', (e) => {
        // Si le clic est déjà sur un lien, on laisse faire le comportement natif
        if (e.target.closest('a')) return;
        window.open(link.href, '_blank', 'noopener');
    });
});

// ---------- Thème clair / sombre ----------
const themeToggle = document.querySelector('.theme-toggle');

const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
    }
    // Barres du navigateur (Safari iOS…) de la même couleur que la page
    if (themeColorMeta) themeColorMeta.setAttribute('content', theme === 'dark' ? '#161616' : '#f6f4ef');
    // Prévient la sphère 3D (hero3d.js) pour qu'elle change ses couleurs
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

function savedTheme() {
    try {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' || saved === 'light' ? saved : null;
    } catch (e) {
        return null;
    }
}

applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('theme', next); } catch (e) { /* stockage indisponible : le choix vaut pour cette visite */ }
    });
}

// Tant que le visiteur n'a pas choisi lui-même, le site suit le réglage clair / sombre de l'appareil
if (window.matchMedia) {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => {
        if (!savedTheme()) applyTheme(systemDark.matches ? 'dark' : 'light');
    };
    if (systemDark.addEventListener) systemDark.addEventListener('change', followSystem);
    else if (systemDark.addListener) systemDark.addListener(followSystem); // anciens Safari
}

// ---------- Année du footer ----------
const annee = document.getElementById('annee');
if (annee) annee.textContent = new Date().getFullYear();

// ---------- En-tête : bordure dès qu'on a scrollé ----------
const header = document.querySelector('.header');

if (header) {
    const updateHeaderState = () => header.classList.toggle('scrolled', window.scrollY > 10);
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
}
