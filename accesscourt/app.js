const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');
const menuLabel = document.querySelector('[data-menu-label]');

if (menuButton && nav) {
  const setMenuState = open => {
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Close navigation' : 'Open navigation';
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuState(false);
    if (restoreFocus) menuButton.focus();
  };

  menuButton.addEventListener('click', () => {
    const nextOpen = !nav.classList.contains('is-open');
    setMenuState(nextOpen);
  });

  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });
}
