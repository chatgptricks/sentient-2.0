export const CROWD_COLUMNS = 112;
export const CROWD_ROWS = 112;
export const CROWD_SPACING_X = 0.74;
export const CROWD_SPACING_Z = 0.86;
export const CROWD_FADE_SECONDS = 0.85;

export function crowdPosition(index, columns = CROWD_COLUMNS, rows = CROWD_ROWS) {
  return { x: (index % columns - (columns - 1) / 2) * CROWD_SPACING_X,
    z: (Math.floor(index / columns) - (rows - 1) / 2) * CROWD_SPACING_Z };
}

function hash(x, z, salt) {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(z + 1, 668265263) ^ Math.imul(salt, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise creates neighborhoods that share a response speed. This
// is fixed once, rather than adding fresh random flicker on each animation frame.
function neighborhoodNoise(x, z, scale, salt) {
  x /= scale; z /= scale;
  const left = Math.floor(x), top = Math.floor(z);
  const fx = x - left, fz = z - top;
  const tx = fx * fx * (3 - 2 * fx), tz = fz * fz * (3 - 2 * fz);
  const a = hash(left, top, salt), b = hash(left + 1, top, salt);
  const c = hash(left, top + 1, salt), d = hash(left + 1, top + 1, salt);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

// Eight adjacent contacts remove the diamond contour. Every person has two
// preferred contacts, slower secondary handoffs, and a stable individual pace.
// Correlated neighborhoods and bending preferred directions form local branches
// and lagging pockets. All connections remain immediate neighbors, so every
// activation still has a local predecessor and the complete graph is connected.
export function createContagionModel(columns = CROWD_COLUMNS, rows = CROWD_ROWS) {
  const count = columns * rows;
  const starts = new Float64Array(count).fill(Infinity);
  const response = new Float32Array(count);
  const fadeDuration = new Float32Array(count);
  const contacts = new Int32Array(count * 8).fill(-1);
  const costs = new Float32Array(count * 8);
  const distances = new Float64Array(count);
  // Reuse all routing buffers across hover seeds; no per-frame or per-seed
  // graph allocation. The directed graph has at most eight edges per person.
  const heapNodes = new Int32Array(count * 8 + 1);
  const heapCosts = new Float64Array(count * 8 + 1);
  const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let i = 0; i < count; i++) {
    const x = i % columns, z = Math.floor(i / columns);
    const cluster = neighborhoodNoise(x, z, 12, 41) * 0.61
      + neighborhoodNoise(x, z, 5, 83) * 0.28 + neighborhoodNoise(x, z, 2.4, 167) * 0.11;
    const individual = 0.72 + hash(x, z, 101) * 0.76;
    const laggard = hash(x, z, 307) > 0.91 ? 1.5 + hash(x, z, 311) * 1.6 : 1;
    response[i] = (0.34 + 2.75 * cluster * cluster) * individual * laggard;
    fadeDuration[i] = CROWD_FADE_SECONDS * (0.60 + hash(x, z, 211) * 0.88 + cluster * 0.33);
  }
  for (let i = 0; i < count; i++) {
    const x = i % columns, z = Math.floor(i / columns);
    const angle = (neighborhoodNoise(x, z, 15, 397) * 0.72 + neighborhoodNoise(x, z, 6, 419) * 0.28) * Math.PI * 4
      + (hash(x, z, 431) - 0.5) * 0.85;
    const flowX = Math.cos(angle), flowZ = Math.sin(angle);
    const neighbors = [];
    for (let direction = 0; direction < 8; direction++) {
      const [dx, dz] = directions[direction], nx = x + dx, nz = z + dz;
      if (nx < 0 || nx >= columns || nz < 0 || nz >= rows) continue;
      const length = dx && dz ? Math.SQRT2 : 1;
      const affinity = (dx * flowX + dz * flowZ) / length + (hash(x, z, 457 + direction) - 0.5) * 0.54;
      neighbors.push({ index: nz * columns + nx, direction, length, affinity });
    }
    neighbors.sort((a, b) => b.affinity - a.affinity);
    neighbors.forEach((neighbor, rank) => {
      const random = hash(x, z, 503 + neighbor.direction);
      const handoff = rank < 2 ? 0.30 + random * 0.24 : 1.4 + random * 2.1;
      contacts[i * 8 + rank] = neighbor.index;
      costs[i * 8 + rank] = neighbor.length * (response[i] * 0.35 + response[neighbor.index] * 0.65) * handoff;
    });
  }

  let completionTime = 0;
  const reset = () => { starts.fill(Infinity); completionTime = 0; };
  const complete = (time = 0) => {
    for (let i = 0; i < count; i++) starts[i] = time - fadeDuration[i] - 0.001;
    completionTime = time;
  };
  function ignite(index, time = 0) {
    if (!Number.isInteger(index) || index < 0 || index >= count) return false;
    if (starts[index] <= time) return false;
    distances.fill(Infinity);
    let heapSize = 0, longest = 0;
    const push = (node, cost) => {
      let at = heapSize++;
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (heapCosts[parent] <= cost) break;
        heapNodes[at] = heapNodes[parent]; heapCosts[at] = heapCosts[parent]; at = parent;
      }
      heapNodes[at] = node; heapCosts[at] = cost;
    };
    const initialHandoff = 0.7 + response[index] * 0.6;
    distances[index] = 0;
    push(index, 0);
    while (heapSize) {
      const next = heapNodes[0], best = heapCosts[0];
      heapSize--;
      if (heapSize) {
        const tailNode = heapNodes[heapSize], tailCost = heapCosts[heapSize];
        let at = 0;
        while (at * 2 + 1 < heapSize) {
          let child = at * 2 + 1;
          if (child + 1 < heapSize && heapCosts[child + 1] < heapCosts[child]) child++;
          if (heapCosts[child] >= tailCost) break;
          heapNodes[at] = heapNodes[child]; heapCosts[at] = heapCosts[child]; at = child;
        }
        heapNodes[at] = tailNode; heapCosts[at] = tailCost;
      }
      if (best !== distances[next]) continue;
      longest = Math.max(longest, best);
      for (let rank = 0; rank < 8; rank++) {
        const offset = next * 8 + rank, neighbor = contacts[offset];
        if (neighbor < 0) break;
        // The initiating person first reaches exactly two immediate contacts.
        // After that, their different neighborhood affinities shape the spread.
        const cost = next === index
          ? rank < 2 ? initialHandoff : Math.max(costs[offset], initialHandoff * (2.4 + rank * 0.12))
          : costs[offset];
        if (best + cost < distances[neighbor]) {
          distances[neighbor] = best + cost;
          push(neighbor, best + cost);
        }
      }
    }
    const firstPause = 0.36;
    const scale = (18.6 - firstPause) / Math.max(longest, 1);
    completionTime = 0;
    for (let i = 0; i < count; i++) {
      const arrival = i === index ? 0 : firstPause + distances[i] * scale;
      starts[i] = Math.min(starts[i], time + arrival);
      completionTime = Math.max(completionTime, starts[i] + fadeDuration[i]);
    }
    return true;
  }
  function level(index, time) {
    const t = Math.max(0, Math.min(1, (time - starts[index]) / fadeDuration[index]));
    return t * t * (3 - 2 * t);
  }
  return { count, columns, rows, starts, ignite, reset, complete, level,
    pending: time => completionTime > time,
    get completionTime() { return completionTime; },
  };
}
