import { readFileSync } from 'node:fs';
import { createPointLogoArt } from './point-logo-art.mjs';
import { createWaveSurface, renderWaveSurfaceSvg } from './wave-surface-art.mjs';

const source = readFileSync(new URL('../public/assets/sentient-symbol.svg', import.meta.url), 'utf8');
const art = createPointLogoArt(source);
const desktop = renderWaveSurfaceSvg(createWaveSurface(art, 1440, 817), 'point-logo-surface-desktop');
const mobile = renderWaveSurfaceSvg(createWaveSurface(art, 390, 800, true), 'point-logo-surface-mobile');

export function pointLogoFallback() {
  return `<div class="field-fallback point-logo-fallback" aria-hidden="true">${desktop}${mobile}</div>`;
}
