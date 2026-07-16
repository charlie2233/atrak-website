const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');

if (menuButton && nav) {
  const closeMenu = () => {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const nextOpen = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', nextOpen);
    menuButton.setAttribute('aria-expanded', String(nextOpen));
  });

  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) closeMenu();
  });
}
