import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import sentientIcon from '../public/assets/sentient-symbol.svg';

// A small photographic studio gives the metal deliberate reflections. These cards
// are baked once; they are not extra lights or objects in the rendered composition.
function createReflectionStudio(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x111615);
  const cardGeometry = new THREE.PlaneGeometry(1, 1);
  const cardMaterials = [];
  const card = (position, size, color, intensity, rotation = 0) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    cardMaterials.push(material);
    const mesh = new THREE.Mesh(cardGeometry, material);
    mesh.position.set(...position);
    mesh.scale.set(size[0], size[1], 1);
    mesh.lookAt(0, 0, 0);
    mesh.rotateZ(rotation);
    studio.add(mesh);
  };
  // Soft studio strips leave graphite faces between silver highlights. Keeping
  // the key cards narrow prevents a full white wash as the mark turns toward us.
  card([-4.5, 3.5, 5], [2.6, 8.5], 0xffffff, 3.8, -0.22);
  card([1.5, 6, 1], [8, 1.8], 0xffffff, 3.4, 0.16);
  card([5, 0.2, 3.5], [1.1, 7.5], 0xeaffd5, 2.8, -0.18);
  card([4, -3, 1.5], [0.7, 6], 0xb6ff00, 5.2, 0.25);
  card([-3, -4, 2], [6, 1.2], 0xe7eeec, 1.8, 0.12);
  card([-3.5, 1, -5], [3, 6], 0xffffff, 4);
  card([0, -1.5, 7], [1.1, 2.4], 0xffffff, 0.8, 0.45);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.025, 0.1, 30);
  generator.dispose();
  cardGeometry.dispose();
  cardMaterials.forEach(material => material.dispose());
  studio.clear();
  return environment;
}

function createSculpture() {
  const vector = new SVGLoader().parse(sentientIcon);
  const shapes = vector.paths.flatMap(path => path.toShapes());
  // The SVG and its two counters remain the source of the mark. A generous
  // quarter-round bevel gives the original silhouette a machined, tactile body.
  const extrusion = new THREE.ExtrudeGeometry(shapes, {
    depth: 2.7,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 12,
    bevelSize: 1.35,
    bevelThickness: 1.65,
    bevelOffset: -0.5,
    curveSegments: 44,
  });
  const originalNormals = extrusion.getAttribute('normal');
  const geometry = toCreasedNormals(extrusion, Math.PI / 2.5);
  const normals = geometry.getAttribute('normal');
  // ExtrudeGeometry's cap groups have materialIndex 0. Keep their +/-Z
  // normals planar so long cap triangles reflect one continuous surface;
  // retain the smoothed normals on the curved bevel and sidewall groups.
  for (const faceGroup of geometry.groups) {
    if (faceGroup.materialIndex !== 0) continue;
    for (let vertex = faceGroup.start; vertex < faceGroup.start + faceGroup.count; vertex++) {
      normals.setXYZ(vertex, 0, 0, originalNormals.getZ(vertex) < 0 ? -1 : 1);
    }
  }
  normals.needsUpdate = true;
  if (geometry !== extrusion) extrusion.dispose();
  geometry.center();
  geometry.rotateX(Math.PI);
  geometry.scale(0.137, 0.137, 0.137);
  geometry.computeBoundingBox();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xc4cec8,
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.18,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.88,
  });
  const sculpture = new THREE.Mesh(geometry, material);
  return { sculpture, geometry, material };
}

function createDistributionField() {
  const field = new THREE.Group();
  const geometries = [];
  const materials = [];
  const orbits = [];
  // Two open trajectories echo the linked mark: attention moving between an
  // owned audience and its wider creator network, rather than decorative dust.
  for (let i = 0; i < 2; i++) {
    const points = [];
    const radius = 3.65 + i * 0.42;
    for (let step = 0; step <= 180; step++) {
      const angle = step / 180 * Math.PI * 1.77 + 0.35 + i * 0.42;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xcad5c3, transparent: true, opacity: i ? 0.095 : 0.14, depthWrite: false });
    const orbit = new THREE.Line(geometry, material);
    orbit.rotation.set(-0.14 + i * 0.08, -0.14, -0.38 + i * 0.2);
    orbit.position.z = -1.2 - i * 0.12;
    field.add(orbit);
    geometries.push(geometry);
    materials.push(material);
    orbits.push(orbit);
  }
  const signalGeometry = new THREE.SphereGeometry(0.022, 8, 6);
  const signalMaterial = new THREE.MeshBasicMaterial({ color: 0xd5ff5f, transparent: true, opacity: 0.85, toneMapped: false });
  const signals = orbits.map(orbit => {
    const signal = new THREE.Mesh(signalGeometry, signalMaterial);
    orbit.add(signal);
    return signal;
  });
  geometries.push(signalGeometry);
  materials.push(signalMaterial);
  return {
    field,
    update(time) {
      signals.forEach((signal, i) => {
        const angle = 0.65 + i * 2.7 + time * (i ? -0.065 : 0.085);
        const radius = 3.65 + i * 0.42;
        signal.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, 0);
      });
    },
    dispose() { geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); },
  };
}

export function createScene(host, paused = false) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    host.classList.add('scene-unavailable');
    return { setPaused() {}, dispose() {} };
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  let environment = createReflectionStudio(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1;
  scene.environmentRotation.set(0.04, -0.22, -0.05);
  const group = new THREE.Group();
  const { sculpture, geometry, material } = createSculpture();
  group.add(sculpture);
  scene.add(group);
  const field = createDistributionField();
  scene.add(field.field);

  const neutral = { x: -0.14, y: -0.42, z: -0.035 };
  group.rotation.set(neutral.x, neutral.y, neutral.z);
  // Fit the entire range of motion, including the bevel and thickness. In a
  // narrow mobile host, horizontal FOV determines distance instead of cropping.
  const motionBounds = new THREE.Box3();
  for (const x of [-0.32, neutral.x, 0.04]) {
    for (const y of [-0.78, neutral.y, -0.06]) {
      for (const z of [-0.08, neutral.z, 0.01]) {
        group.rotation.set(x, y, z);
        group.updateMatrixWorld(true);
        motionBounds.union(new THREE.Box3().setFromObject(group));
      }
    }
  }
  group.rotation.set(neutral.x, neutral.y, neutral.z);
  const boundsSize = motionBounds.getSize(new THREE.Vector3());
  const pointer = new THREE.Vector2();
  const eased = new THREE.Vector2();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, disposed = false, contextLost = false;
  let elapsed = 0, previous = 0, lastRendered = 0, frame = 0;
  let mobile = false;

  const render = () => { if (!disposed && !contextLost) renderer.render(scene, camera); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; lastRendered = 0; };
  const allowed = () => !disposed && !contextLost && !paused && !reduced.matches && visible && !document.hidden;
  const tick = now => {
    if (!allowed()) { stop(); return; }
    frame = requestAnimationFrame(tick);
    const interval = mobile ? 1000 / 30 : 1000 / 50;
    if (lastRendered && now - lastRendered < interval) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.06) : 0;
    elapsed += dt;
    previous = now;
    lastRendered = now;
    eased.lerp(pointer, 1 - Math.exp(-dt * 3.8));
    group.rotation.set(
      neutral.x + Math.sin(elapsed * 0.42) * 0.095 + eased.y * 0.085,
      neutral.y + Math.sin(elapsed * 0.34) * 0.25 + eased.x * 0.11,
      neutral.z + Math.sin(elapsed * 0.29) * 0.045,
    );
    group.position.y = Math.sin(elapsed * 0.7) * 0.115;
    field.update(elapsed);
    render();
  };
  const start = () => { if (!frame && allowed()) frame = requestAnimationFrame(tick); };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    mobile = width < 480;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalFit = boundsSize.x / (2 * Math.tan(halfFov) * camera.aspect);
    const verticalFit = (boundsSize.y + 0.23) / (2 * Math.tan(halfFov));
    camera.position.set(0, 0, Math.max(horizontalFit, verticalFit) * 1.14 + boundsSize.z / 2);
    camera.updateProjectionMatrix();
    field.update(elapsed);
    render();
  };
  const onPointer = event => {
    if (event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(
      THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1),
      THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1),
    );
  };
  const resetPointer = () => pointer.set(0, 0);
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  const onReducedMotion = () => { if (reduced.matches) stop(); else start(); };
  const onContextLost = event => {
    event.preventDefault();
    contextLost = true;
    stop();
    host.classList.remove('scene-ready');
    host.classList.add('scene-unavailable');
  };
  const onContextRestored = () => {
    environment.dispose();
    environment = createReflectionStudio(renderer);
    scene.environment = environment.texture;
    contextLost = false;
    host.classList.remove('scene-unavailable');
    host.classList.add('scene-ready');
    render();
    start();
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) start(); else stop();
  }, { rootMargin: '80px' });
  observer.observe(host);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('blur', resetPointer);
  document.documentElement.addEventListener('pointerleave', resetPointer);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onReducedMotion);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  resize();
  host.classList.remove('scene-unavailable');
  host.classList.add('scene-ready');
  start();

  return {
    setPaused(value) {
      paused = value;
      if (paused) { stop(); render(); } else start();
    },
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('blur', resetPointer);
      document.documentElement.removeEventListener('pointerleave', resetPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReducedMotion);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      geometry.dispose();
      material.dispose();
      field.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      host.classList.remove('scene-ready');
    },
  };
}
