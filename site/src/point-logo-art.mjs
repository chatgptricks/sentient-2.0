// Deterministic 2D artwork shared by Canvas and the static SVG. The fixed
// affine view, circle pattern and shallow shadows preserve the approved
// fallback reference; no mesh, perspective camera or extrusion is involved.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const LOGO_MATRIX = { a: 1, b: -1.2 / 10.7, c: 1.55 / 10.7, d: 1 };
export const LOGO_SHADOWS = Array.from({ length: 7 }, (_, index) => ({
  x: 1.05 - index * 0.15, y: 1.68 - index * 0.24, alpha: 0.16 + index * 0.032,
}));

function parseContours(path) {
  const tokens = path.match(/[MLCZmlcz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
  if (!tokens?.length) throw new Error('Sentient symbol path is empty.');
  const contours = [];
  let cursor = 0, command = '', x = 0, y = 0, contour;
  const number = () => {
    const value = Number(tokens[cursor++]);
    if (!Number.isFinite(value)) throw new Error('Invalid Sentient path coordinate.');
    return value;
  };
  const append = (px, py) => { contour.push([px, py]); x = px; y = py; };
  const flatten = (ax, ay, bx, by, cx, cy, dx, dy, depth = 0) => {
    const lineX = dx - ax, lineY = dy - ay;
    const denominator = lineX * lineX + lineY * lineY;
    const errorB = (lineY * (bx - ax) - lineX * (by - ay)) ** 2;
    const errorC = (lineY * (cx - ax) - lineX * (cy - ay)) ** 2;
    if (depth >= 12 || Math.max(errorB, errorC) <= 0.000081 * Math.max(denominator, 0.000001)) {
      append(dx, dy);
      return;
    }
    const abx = (ax + bx) / 2, aby = (ay + by) / 2;
    const bcx = (bx + cx) / 2, bcy = (by + cy) / 2;
    const cdx = (cx + dx) / 2, cdy = (cy + dy) / 2;
    const abcx = (abx + bcx) / 2, abcy = (aby + bcy) / 2;
    const bcdx = (bcx + cdx) / 2, bcdy = (bcy + cdy) / 2;
    const middleX = (abcx + bcdx) / 2, middleY = (abcy + bcdy) / 2;
    flatten(ax, ay, abx, aby, abcx, abcy, middleX, middleY, depth + 1);
    flatten(middleX, middleY, bcdx, bcdy, cdx, cdy, dx, dy, depth + 1);
  };
  while (cursor < tokens.length) {
    if (/^[a-z]$/i.test(tokens[cursor])) command = tokens[cursor++];
    if (command === 'M') {
      contour = []; contours.push(contour); append(number(), number()); command = 'L';
    } else if (command === 'L' && contour) append(number(), number());
    else if (command === 'C' && contour) {
      const bx = number(), by = number(), cx = number(), cy = number(), dx = number(), dy = number();
      flatten(x, y, bx, by, cx, cy, dx, dy);
    } else if (command === 'Z' && contour) {
      const start = contour[0];
      if (x !== start[0] || y !== start[1]) append(start[0], start[1]);
      command = '';
    } else throw new Error(`Unsupported Sentient path command: ${command}`);
  }
  return contours;
}

export function createPointLogoArt(svg) {
  const path = svg.match(/\sd="([^"]+)"/)?.[1];
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!path || !viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite)) throw new Error('Invalid Sentient symbol.');
  const [minX, minY, width, height] = viewBox;
  const contours = parseContours(path);
  const segments = [];
  for (const contour of contours) for (let i = 1; i < contour.length; i++) {
    const a = contour[i - 1], b = contour[i];
    segments.push([a[0], a[1], b[0], b[1]]);
  }
  const contains = (x, y) => {
    let inside = false;
    for (const edge of segments) {
      if ((edge[1] > y) !== (edge[3] > y) && x < (edge[2] - edge[0]) * (y - edge[1]) / (edge[3] - edge[1]) + edge[0]) inside = !inside;
    }
    return inside;
  };
  const dots = [];
  // Identical grid origin, spacing, radius and color to the approved SVG.
  const spacing = 0.43, radius = 0.105;
  for (let row = 0, y = 0.215; y < minY + height; row++, y = (row + 0.5) * spacing) {
    for (let column = 0, x = 0.215; x < minX + width; column++, x = (column + 0.5) * spacing) {
      if (!contains(x, y)) continue;
      const gradient = clamp((0.25 * (x - minX) / width + (y - minY) / height) / 1.0625, 0, 1);
      const alpha = gradient < 0.55 ? 1 + (0.843137 - 1) * gradient / 0.55
        : 0.843137 + (0.447059 - 0.843137) * (gradient - 0.55) / 0.45;
      dots.push({ x, y, radius, alpha });
    }
  }
  const matrix = LOGO_MATRIX;
  const corners = [[minX, minY], [minX + width + 1.05, minY], [minX, minY + height + 1.68], [minX + width + 1.05, minY + height + 1.68]];
  const transformed = corners.map(([x, y]) => [matrix.a * x + matrix.c * y, matrix.b * x + matrix.d * y]);
  const bounds = {
    x: Math.min(...transformed.map(point => point[0])), y: Math.min(...transformed.map(point => point[1])),
    maxX: Math.max(...transformed.map(point => point[0])), maxY: Math.max(...transformed.map(point => point[1])),
  };
  bounds.width = bounds.maxX - bounds.x; bounds.height = bounds.maxY - bounds.y;
  const tones = Array.from({ length: 12 }, (_, index) => {
    const brightness = 0.96 + index * 0.02;
    return `#${[209, 252, 164].map(channel => Math.round(Math.min(255, channel * brightness)).toString(16).padStart(2, '0')).join('')}`;
  });
  return { path, width, height, minX, minY, contours, contains, dots, spacing, bounds, tones };
}

export function pointLogoLayout(art, width, height, mobile = false) {
  const iconHeight = Math.min(height * (mobile ? 0.74 : 0.9), mobile ? 238 : 430, width * 0.9 * art.bounds.height / art.bounds.width);
  const scale = iconHeight / art.bounds.height;
  return { scale, x: (width - art.bounds.width * scale) / 2 - art.bounds.x * scale,
    y: (height - art.bounds.height * scale) / 2 - art.bounds.y * scale };
}
