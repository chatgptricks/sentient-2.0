// Shared deterministic 2D pin surface; positive heights rise above the floor.
export const WAVE_SURFACE_MATRIX = Object.freeze({ a: 1, b: -0.16, c: 0.28, d: 0.83 });
const MAX_PINS = 22000, OVERSCAN = 80;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dormant = [62, 85, 70], active = [209, 239, 167];
const paletteRGB = Array.from({ length: 12 }, (_, tone) => dormant.map((channel, index) => Math.round(channel + (active[index] - channel) * tone / 11)));
const alpha = tone => tone <= 2 ? 0.76 : 0.98;
export const surfacePalette = Object.freeze(paletteRGB.map((rgb, tone) => `rgba(${rgb.join(',')},${alpha(tone)})`));
export const surfaceStemPalette = Object.freeze(paletteRGB.map((rgb, tone) => `rgba(${rgb.map(channel => Math.round(channel * 0.45)).join(',')},${alpha(tone)})`));
export const surfaceHighlightPalette = Object.freeze(paletteRGB.map((rgb, tone) => `rgba(${rgb.map(channel => Math.round(channel + (255 - channel) * .34)).join(',')},${alpha(tone) * .72})`));
// Movement changes the lighting slightly; rigid pins do not flash or inflate.
export const pinTone = (pin, energy = 0) => Math.round(clamp(((pin.logo ? 0.78 : 0.13) + energy * 0.08) * (0.86 + 0.14 * pin.shade), 0, 1) * 11);

export function createWaveSurface(art, width, height, mobile = false) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError('A pin surface requires positive finite dimensions.');
  const radius = mobile ? 1.25 : 1.65, maxWave = mobile ? 14 : 20, raisedHeight = mobile ? 30 : 44;
  const matrix = WAVE_SURFACE_MATRIX, determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const inverse = (x, y) => ({ u: (matrix.d * x - matrix.c * y) / determinant, v: (-matrix.b * x + matrix.a * y) / determinant });
  const left = -OVERSCAN, right = width + OVERSCAN, top = -OVERSCAN, bottom = height + OVERSCAN + raisedHeight + maxWave;
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => inverse(x, y));
  const minU = Math.min(...corners.map(point => point.u)), maxU = Math.max(...corners.map(point => point.u));
  const minV = Math.min(...corners.map(point => point.v)), maxV = Math.max(...corners.map(point => point.v));
  let pitch = Math.max(mobile ? 6 : 7.7, Math.sqrt((right - left) * (bottom - top) / (MAX_PINS * determinant)) * 1.003);
  let floor;
  // Clip the projected grid before running the more expensive SVG mask test.
  for (let attempt = 0; attempt < 5; attempt++) {
    floor = [];
    for (let row = Math.floor(minV / pitch); row <= Math.ceil(maxV / pitch); row++) {
      const v = row * pitch;
      for (let column = Math.floor(minU / pitch); column <= Math.ceil(maxU / pitch); column++) {
        const u = column * pitch, x = matrix.a * u + matrix.c * v, y = matrix.b * u + matrix.d * v;
        if (x < left || x > right || y < top || y > bottom) continue;
        floor.push({ x, y, u, v });
      }
    }
    if (floor.length <= MAX_PINS) break;
    pitch *= Math.sqrt(floor.length / MAX_PINS) * 1.01;
  }
  let minLogoX = Infinity, maxLogoX = -Infinity, minLogoY = Infinity, maxLogoY = -Infinity;
  for (const contour of art.contours) for (const [x, y] of contour) {
    const px = matrix.a * x + matrix.c * y, py = matrix.b * x + matrix.d * y;
    minLogoX = Math.min(minLogoX, px); maxLogoX = Math.max(maxLogoX, px);
    minLogoY = Math.min(minLogoY, py); maxLogoY = Math.max(maxLogoY, py);
  }
  const projectedHeight = maxLogoY - minLogoY, projectedWidth = maxLogoX - minLogoX;
  const desiredHeight = mobile ? Math.min(294, height * .43) : clamp(height * 0.65, 500, 570);
  const logoHeight = Math.min(desiredHeight, width * (mobile ? 0.9 : 0.49) * projectedHeight / projectedWidth);
  const logoScale = logoHeight / projectedHeight;
  const logoCenter = inverse(width * (mobile ? 0.51 : 0.73), height * (mobile ? (height < 680 ? .62 : .68) : 0.51) + raisedHeight);
  const svgCenter = inverse((minLogoX + maxLogoX) / 2, (minLogoY + maxLogoY) / 2);
  const pins = floor.map(point => {
    const svgX = (point.u - logoCenter.u) / logoScale + svgCenter.u, svgY = (point.v - logoCenter.v) / logoScale + svgCenter.v;
    const inBox = svgX >= art.minX && svgX <= art.minX + art.width && svgY >= art.minY && svgY <= art.minY + art.height;
    const logo = inBox && art.contains(svgX, svgY);
    const shade = logo ? clamp(0.78 - (svgY - art.minY) / art.height * 0.28 + (svgX - art.minX) / art.width * 0.08, 0, 1)
      : clamp(0.5 + Math.sin(point.u * 0.008 + point.v * 0.005) * 0.13 + Math.cos(point.v * 0.012) * 0.09, 0, 1);
    return { x: point.x, y: point.y, height: logo ? raisedHeight * (0.94 + shade * 0.12) : (mobile ? 5 : 7), logo, shade, displacement: 0, velocity: 0 };
  });
  return { pins, pitch, radius, maxWave, width, height, mobile, overscan: OVERSCAN };
}

// Relative compound paths keep both fallback sizes compact. Round-capped
// zero-length strokes are filled disks, with the same .65 ellipse ratio.
export function renderWaveSurfaceSvg(surface, className = '') {
  const groups = new Map(), n = value => String(Math.round(value * 10) / 10), q = value => Math.round(value * 10) / 10;
  const safeClass = className.replace(/[^a-zA-Z0-9_ -]/g, '');
  const prefix = `pin-${safeClass.replace(/ /g, '-') || 'surface'}`;
  for (const pin of surface.pins) {
    if (pin.x < -surface.radius || pin.x > surface.width + surface.radius || pin.y < -surface.radius || pin.y - pin.height > surface.height + surface.radius) continue;
    const tone = pinTone(pin);
    let group = groups.get(tone);
    if (!group) { group = { tone, stems: '', caps: '', bases: '', sx: 0, sy: 0, cx: 0, cy: 0, bx: 0, by: 0 }; groups.set(tone, group); }
    const x = q(pin.x), y = q(pin.y), capY = q((pin.y - pin.height) / 0.65), baseY = q(pin.y / .65), stemHeight = q(pin.height);
    const firstCap = !group.caps, firstBase = !group.bases;
    group.caps += `${firstCap ? 'M' : 'm'}${n(x - (firstCap ? 0 : group.cx))},${n(capY - (firstCap ? 0 : group.cy))}h0`;
    group.bases += `${firstBase ? 'M' : 'm'}${n(x - (firstBase ? 0 : group.bx))},${n(baseY - (firstBase ? 0 : group.by))}h0`;
    group.cx = x; group.cy = capY; group.bx = x; group.by = baseY;
    const firstStem = !group.stems;
    group.stems += `${firstStem ? 'M' : 'm'}${n(x - (firstStem ? 0 : group.sx))},${n(y - (firstStem ? 0 : group.sy))}v${n(-stemHeight)}`;
    group.sx = x; group.sy = y - stemHeight;
  }
  // Reuse geometry for rims and highlights rather than duplicating thousands
  // of paths. The static and moving versions share size, stroke and material.
  const values = [...groups.values()];
  const defs = values.map(g => `<path id="${prefix}-stems-${g.tone}" d="${g.stems}"/><path id="${prefix}-caps-${g.tone}" d="${g.caps}"/>`).join('');
  const bases = values.map(g => `<path d="${g.bases}"/>`).join('');
  const use = (kind, colors) => values.map(g => `<use href="#${prefix}-${kind}-${g.tone}" stroke="${colors[g.tone]}"/>`).join('');
  return `<svg class="${safeClass}" viewBox="0 0 ${surface.width} ${surface.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs}</defs><g fill="none" stroke-linecap="round"><g transform="scale(1 .65)" stroke="#020604a6" stroke-width="${surface.radius * 2.7}">${bases}</g><g stroke-width="${surface.radius * 1.55}">${use('stems', surfaceStemPalette)}</g><g transform="translate(${-surface.radius * .3} 0)" stroke-width="${surface.radius * .36}">${use('stems', surfacePalette)}</g><g transform="scale(1 .65)"><g stroke-width="${surface.radius * 2 + .65}">${use('caps', surfacePalette.map(() => '#09130be0'))}</g><g stroke-width="${surface.radius * 2}">${use('caps', surfacePalette)}</g></g><g transform="translate(${-surface.radius * .28} ${-surface.radius * .3}) scale(1 .65)" stroke-width="${surface.radius * .65}">${use('caps', surfaceHighlightPalette)}</g></g></svg>`;
}
