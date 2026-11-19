// ---------- Apparition des éléments au scroll ----------
// (remplace les anciens seuils fixes scrollY > 500 / > 1000)
const revealTargets = [
    ['.technologies-container', 'active-container'],
    ['.technology-item', 'active-item'],
    ['.card-projet', 'active-card'],
    ['.reveal', 'is-visible'],
];

if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add(entry.target.dataset.revealClass);
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(([selector, className]) => {
        document.querySelectorAll(selector).forEach(el => {
            el.dataset.revealClass = className;
            revealObserver.observe(el);
        });
    });
} else {
    revealTargets.forEach(([selector, className]) => {
        document.querySelectorAll(selector).forEach(el => el.classList.add(className));
    });
}

// ---------- Lien de navigation actif selon la section visible ----------
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

// ---------- Filtre des projets ----------
const filterButtons = document.querySelectorAll('.filter-btn');

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        const filter = button.dataset.filter;

        filterButtons.forEach(b => {
            const isActive = b === button;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });

        document.querySelectorAll('.card-projet').forEach(card => {
            card.hidden = filter !== 'all' && card.dataset.category !== filter;
            // Les cartes réaffichées doivent être visibles même si elles n'étaient pas encore apparues
            if (!card.hidden) card.classList.add('active-card');
        });
    });
});

// ---------- Clic sur une carte = ouvre son premier lien ----------
document.querySelectorAll('.card-projet').forEach(card => {
    const link = card.querySelector('a.link');
    if (!link) return;

    card.addEventListener('click', (e) => {
        // Si le clic est déjà sur un lien, on laisse faire le comportement natif
        if (e.target.closest('a')) return;
        window.open(link.href, '_blank', 'noopener');
    });
});

// ---------- Année du footer ----------
const annee = document.getElementById('annee');
if (annee) annee.textContent = new Date().getFullYear();
