const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const phoneMenu = window.matchMedia('(max-width: 650px)');
const setMenuMode = open => {
  const modal = open && phoneMenu.matches;
  document.documentElement.classList.toggle('mobile-menu-open', modal);
  for (const element of document.querySelectorAll('main, .footer')) element.inert = modal;
};
const closeMenu = () => {
  menu?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('open');
  setMenuMode(false);
};
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
  setMenuMode(open);
  if (open && phoneMenu.matches) navigation.querySelector('a')?.focus();
});
document.addEventListener('click', e => {
  if (menu?.getAttribute('aria-expanded') !== 'true') return;
  if (e.target.closest('a') || !e.target.closest('.header')) closeMenu();
});
window.matchMedia('(min-width: 851px)').addEventListener('change', e => {
  if (e.matches) closeMenu();
});
phoneMenu.addEventListener('change', () => closeMenu());
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && document.documentElement.classList.contains('mobile-menu-open')) {
    const items = [...document.querySelectorAll('.header a, .header button')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});
for (const form of document.querySelectorAll('.inquiry-form')) {
  if (document.body.dataset.hosting === 'static') {
    const submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    submit.textContent = 'Contact form coming soon';
    form.addEventListener('submit', e => e.preventDefault());
    continue;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]');
    const status = form.querySelector('.form-status');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving your brief…';
    status.textContent = '';
    status.classList.remove('error');
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not save your request.');
      status.textContent = result.message;
      form.reset();
      status.focus();
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message === 'Failed to fetch' ? 'Connection lost. We could not confirm whether your request was saved. Please try again.' : error.message;
    } finally { button.disabled = false; button.textContent = label; }
  });
}
