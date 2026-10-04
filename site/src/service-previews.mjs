import { readFileSync } from 'node:fs';
import { createPointLogoArt } from './point-logo-art.mjs';
import { WAVE_SURFACE_MATRIX } from './wave-surface-art.mjs';

// Build-time miniatures of the destination heroes. Compound paths keep the
// artwork small and leave hover motion to CSS, without another live renderer.
const art = createPointLogoArt(readFileSync(new URL('../public/assets/sentient-symbol.svg', import.meta.url), 'utf8'));
const width = 600, height = 240;
const clamp = value => Math.max(0, Math.min(1, value));
const number = value => String(Math.round(value * 10) / 10);
const color = (dark, light, amount) => `#${dark.map((channel, index) => Math.round(channel + (light[index] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;

function pathGroup() {
  return { d: '', x: 0, y: 0 };
}
function move(group, x, y, segment = 'h0', endY = y) {
  x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10; endY = Math.round(endY * 10) / 10;
  const first = !group.d;
  group.d += `${first ? 'M' : 'm'}${number(x - (first ? 0 : group.x))},${number(y - (first ? 0 : group.y))}${segment}`;
  group.x = x; group.y = endY;
}
function frame(variant, content) {
  return `<svg class="offer-preview offer-preview--${variant}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><radialGradient id="preview-${variant}-light"><stop stop-color="#8fb267" stop-opacity=".12"/><stop offset="1" stop-color="#8fb267" stop-opacity="0"/></radialGradient><linearGradient id="preview-${variant}-fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".13" stop-color="white"/><stop offset=".84" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="preview-${variant}-mask"><rect width="600" height="240" fill="url(#preview-${variant}-fade)"/></mask></defs><ellipse cx="310" cy="135" rx="270" ry="128" fill="url(#preview-${variant}-light)"/><g class="offer-preview-field" mask="url(#preview-${variant}-mask)">${content}</g></svg>`;
}

function launchPreview() {
  const groups = Array.from({ length: 9 }, () => ({ heads: pathGroup(), bodies: pathGroup() }));
  for (let row = -4; row < 40; row++) {
    for (let column = -12; column < 45; column++) {
      const u = column * 16, v = row * 15;
      const x = u + v * 0.31, y = v * 0.78 - u * 0.15;
      if (x < -5 || x > width + 5 || y < -4 || y > height + 16) continue;
      // Smooth adjacent neighborhoods form one irregular spreading patch.
      const dx = (x - 302) / 172, dy = (y - 128) / 82;
      const warp = Math.sin(x * 0.023 + y * 0.029) * 0.16 + Math.cos(y * 0.054 - x * 0.013) * 0.12;
      const level = clamp((1.16 - Math.hypot(dx, dy) + warp) * 1.7);
      const tone = Math.round(level * (0.86 + 0.14 * Math.sin(column * 3 + row * 2) ** 2) * 8);
      const group = groups[tone];
      move(group.heads, x, y - 10.7);
      move(group.bodies, x, y - 5.8, 'v3.7', y - 2.1);
    }
  }
  const bodies = groups.map((group, tone) => `<path d="${group.bodies.d}" stroke="${color([33, 52, 40], [167, 204, 113], tone / 8)}"/>`).join('');
  const heads = groups.map((group, tone) => `<path d="${group.heads.d}" stroke="${color([50, 73, 55], [215, 245, 165], tone / 8)}"/>`).join('');
  return frame('launch', `<g fill="none" stroke-linecap="round"><g stroke-width="4.2">${bodies}</g><g stroke-width="3.8">${heads}</g></g>`);
}

function growthPreview() {
  const matrix = WAVE_SURFACE_MATRIX;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const inverse = (x, y) => ({ u: (matrix.d * x - matrix.c * y) / determinant, v: (-matrix.b * x + matrix.a * y) / determinant });
  const contour = art.contours.flat().map(([x, y]) => ({ x: matrix.a * x + matrix.c * y, y: matrix.b * x + matrix.d * y }));
  const left = Math.min(...contour.map(point => point.x)), right = Math.max(...contour.map(point => point.x));
  const top = Math.min(...contour.map(point => point.y)), bottom = Math.max(...contour.map(point => point.y));
  const scale = 164 / (bottom - top);
  const center = inverse(309, 141), sourceCenter = inverse((left + right) / 2, (top + bottom) / 2);
  const groups = Array.from({ length: 7 }, () => ({ caps: pathGroup(), stems: pathGroup() }));
  for (let row = -12; row < 51; row++) {
    for (let column = -17; column < 64; column++) {
      const u = column * 10.6, v = row * 10.6;
      const x = matrix.a * u + matrix.c * v, y = matrix.b * u + matrix.d * v;
      if (x < -3 || x > width + 3 || y < -3 || y > height + 19) continue;
      const sx = (u - center.u) / scale + sourceCenter.u, sy = (v - center.v) / scale + sourceCenter.v;
      const logo = art.contains(sx, sy);
      const shade = clamp(0.85 - sy / art.height * 0.2);
      const tone = logo ? 4 + Math.round(shade * 2) : Math.round(clamp(0.4 + Math.sin(u * 0.012 + v * 0.019) * 0.3) * 2);
      const raised = logo ? 15 : 1.5;
      const group = groups[tone];
      move(group.caps, x, (y - raised) / 0.65);
      if (logo) move(group.stems, x, y, `v-${raised}`, y - raised);
    }
  }
  const caps = groups.filter(group => group.caps.d).map(group => {
    const tone = groups.indexOf(group);
    return `<path d="${group.caps.d}" stroke="${color([32, 54, 40], [209, 247, 149], tone / 6)}"/>`;
  }).join('');
  const stems = groups.filter(group => group.stems.d).map(group => `<path d="${group.stems.d}"/>`).join('');
  return frame('growth', `<g fill="none" stroke="#68814d" stroke-opacity=".62" stroke-width=".85">${stems}</g><g fill="none" stroke-width="3.1" stroke-linecap="round" transform="scale(1 .65)">${caps}</g>`);
}

const previews = { launch: launchPreview(), growth: growthPreview() };
export function servicePreview(variant) {
  if (!Object.hasOwn(previews, variant)) throw new RangeError(`Unknown service preview: ${variant}`);
  return previews[variant];
}
