const icons = {
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',
  launch: '<path d="m13 2-9 12h7l-1 8L21 9h-8Z"/>',
  growth: '<path d="m3 18 7-7 4 4 7-9M14 6h7v7"/>',
  about: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  call: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a13 13 0 0 1-7-7l2-2Z"/>',
};

const tabs = [
  ['home', 'Home', '/'],
  ['launch', 'Viral', '/viral-launch-campaigns'],
  ['growth', 'Growth', '/growth-campaigns'],
  ['about', 'About', '/about'],
  ['call', 'Call', '#contact'],
];

export function mobileNavigation(active) {
  return `<nav class="mobile-dock" aria-label="Mobile navigation">${tabs.map(([id, label, href]) =>
    `<a class="mobile-tab mobile-tab--${id}" data-mobile-tab="${id}" href="${active === 'universe' && id === 'call' ? '/#contact' : href}"${active === id ? ' aria-current="page"' : ''}><span class="mobile-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false">${icons[id]}</svg></span><span>${label}</span></a>`
  ).join('')}</nav>`;
}
