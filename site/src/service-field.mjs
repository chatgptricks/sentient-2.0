import * as THREE from 'three';

// All deformation stays on the GPU. Points and the sparse wire lattice share
// the same surface function, so they remain joined when the pointer moves.
const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uLaunch;
  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform float uCameraDistance;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform float uInteraction;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEnergy;

  vec4 surface(vec2 origin) {
    vec2 p = origin;
    float height;
    float energy;
    if (uLaunch > 0.5) {
      float radius = length(p * vec2(0.91, 1.04));
      float phase = radius * 1.8 - uTime * 1.05;
      float source = exp(-radius * radius * 0.65);
      height = sin(phase) * exp(-radius * 0.14) * 0.9;
      height += source * 1.4 + cos(p.x * 0.4 + p.y * 0.3) * 0.12;
      energy = pow(0.5 + 0.5 * sin(phase), 7.0) * 0.85 + source * 0.75;
      p += sin(radius * 0.8 - uTime * 0.24) * 0.055 * p;
    } else {
      float phase = p.x * 0.68 + p.y * 0.72 - uTime * 0.8;
      float crossWave = p.x * 0.31 - p.y * 1.16 + uTime * 0.32;
      height = sin(phase) * 1.22 + sin(crossWave) * 0.43;
      height += sin(p.x * 0.37 + uTime * 0.2) * 0.2 + p.x * 0.09;
      energy = pow(0.5 + 0.5 * sin(phase), 4.0);
      p.y += sin(p.x * 0.45 - uTime * 0.3) * 0.32;
    }

    vec2 delta = origin - uPointer;
    float distanceFromPointer = length(delta);
    float influence = exp(-dot(delta, delta) * 0.32);
    float wake = dot(delta, uVelocity) * influence * 0.2;
    float ripple = sin(distanceFromPointer * 3.7 - uTime * 3.2);
    height += uInteraction * (influence * 0.7 + ripple * exp(-distanceFromPointer * 0.7) * 0.34 + wake);
    p += uInteraction * (-delta * influence * 0.1 + uVelocity * influence * 0.055);
    energy = clamp(energy + influence * uInteraction * 0.43, 0.0, 1.35);
    return vec4(p.x, height, p.y, energy);
  }

  void main() {
    vec2 origin = position.xz;
    vec4 field = surface(origin);
    float seed = fract(sin(dot(origin, vec2(127.1, 311.7))) * 43758.5453);
    float edge = (1.0 - smoothstep(5.8, 7.35, abs(origin.x)))
               * (1.0 - smoothstep(3.9, 5.45, abs(origin.y)));
    vec4 viewPosition = modelViewMatrix * vec4(field.xyz, 1.0);
    float perspective = clamp(uCameraDistance / max(0.1, -viewPosition.z), 0.65, 1.65);
    float depthFade = smoothstep(0.55, 1.2, perspective);
    float chroma = clamp(0.44 + field.y * 0.21 + field.w * 0.18, 0.0, 1.0);
    vec3 teal = vec3(0.035, 0.28, 0.235);
    vec3 chartreuse = vec3(0.66, 1.0, 0.008);
    vec3 pearl = vec3(0.89, 0.97, 0.75);
    vColor = mix(teal, chartreuse, smoothstep(0.08, 0.84, chroma));
    vColor = mix(vColor, pearl, smoothstep(0.68, 1.3, field.w) * 0.68);
    vAlpha = edge * (0.26 + field.w * 0.49 + seed * 0.2) * mix(0.46, 1.0, depthFade);
    vEnergy = field.w;
    gl_Position = projectionMatrix * viewPosition;
    #ifdef FIELD_POINTS
      gl_PointSize = (2.0 + field.w * 2.15 + seed * 0.5) * uPixelRatio * uPointScale * perspective;
    #endif
    #ifdef FIELD_NODE
      gl_PointSize = (38.0 + sin(uTime * 1.05) * 2.0) * uPixelRatio * uPointScale * perspective;
      vAlpha = 1.0;
      vColor = pearl;
    #endif
  }
`;

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEnergy;
  void main() {
    #ifdef FIELD_POINTS
      float radius = length(gl_PointCoord - 0.5) * 2.0;
      if (radius > 1.0) discard;
      float core = 1.0 - smoothstep(0.12, 0.6, radius);
      float halo = pow(max(0.0, 1.0 - radius), 2.0);
      float alpha = (core * 0.85 + halo * 0.28) * vAlpha;
      gl_FragColor = vec4(vColor, alpha);
    #elif defined(FIELD_NODE)
      float radius = length(gl_PointCoord - 0.5) * 2.0;
      if (radius > 1.0) discard;
      float core = 1.0 - smoothstep(0.035, 0.15, radius);
      float halo = pow(max(0.0, 1.0 - radius), 4.0);
      vec3 glow = mix(vec3(0.55, 1.0, 0.015), vec3(1.0, 1.0, 0.91), core);
      gl_FragColor = vec4(glow, core + halo * 0.56);
    #else
      gl_FragColor = vec4(vColor, vAlpha * (0.12 + vEnergy * 0.055));
    #endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createLattice() {
  const columns = 149;
  const rows = 109;
  const width = 14.7;
  const depth = 10.9;
  const positions = new Float32Array(columns * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const offset = (row * columns + column) * 3;
      positions[offset] = column / (columns - 1) * width - width / 2;
      positions[offset + 2] = row / (rows - 1) * depth - depth / 2;
    }
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // One fine structural line for every fourth row and column. Vertices still
  // follow every lattice intersection, preserving smooth bends at the crests.
  const segments = [];
  const connect = (a, b) => {
    segments.push(positions[a * 3], 0, positions[a * 3 + 2]);
    segments.push(positions[b * 3], 0, positions[b * 3 + 2]);
  };
  for (let row = 0; row < rows; row += 4) {
    for (let column = 0; column < columns - 1; column++) connect(row * columns + column, row * columns + column + 1);
  }
  for (let column = 0; column < columns; column += 4) {
    for (let row = 0; row < rows - 1; row++) connect(row * columns + column, (row + 1) * columns + column);
  }
  const wires = new THREE.BufferGeometry();
  wires.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  // CPU bounds cannot see the shader displacement. This sphere includes both
  // the standing wave and the maximum pointer lift.
  points.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 11);
  wires.boundingSphere = points.boundingSphere.clone();
  return { points, wires };
}

export function createServiceField(host, paused = false) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    host.classList.remove('field-ready');
    host.classList.add('field-unavailable');
    return { setPaused() {}, dispose() {} };
  }

  const resources = [];
  const listeners = [];
  let observer;
  let resizeObserver;
  let disposed = false;
  let contextLost = false;
  let failed = false;
  let suspended = false;
  let visible = false;
  let hasSize = false;
  let needsRender = true;
  let mobile = false;
  let frame = 0;
  let previous = 0;
  let lastRendered = 0;
  let pointerInside = false;
  let lastPointerTime = 0;
  let elapsed = host.dataset.serviceField === 'launch' ? 4.1 : 2.7;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  const cameraTarget = new THREE.Vector3(0, 0.2, 0);
  const cameraDirection = new THREE.Vector3(0.12, 0.53, 0.84).normalize();
  const cameraRight = new THREE.Vector3(cameraDirection.z, 0, -cameraDirection.x).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(cameraDirection, cameraRight);
  const corner = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  const intersection = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const lastPointer = new THREE.Vector2();
  const velocityTarget = new THREE.Vector2();
  const uniforms = {
    uTime: { value: elapsed },
    uLaunch: { value: host.dataset.serviceField === 'launch' ? 1 : 0 },
    uPixelRatio: { value: 1 },
    uPointScale: { value: 1 },
    uCameraDistance: { value: 24 },
    uPointer: { value: new THREE.Vector2() },
    uVelocity: { value: new THREE.Vector2() },
    uInteraction: { value: 0 },
  };

  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };
  const canRender = () => !disposed && !contextLost && !failed && !suspended && visible && hasSize && !document.hidden;
  const motionEnabled = () => !paused && !reduced.matches;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    lastRendered = 0;
  };
  const showFallback = () => {
    stop();
    host.classList.remove('field-ready');
    host.classList.add('field-unavailable');
  };
  const render = () => {
    if (!canRender()) return;
    try {
      renderer.render(scene, camera);
      if (failed || contextLost) return;
      needsRender = false;
      host.classList.remove('field-unavailable');
      host.classList.add('field-ready');
    } catch {
      failed = true;
      showFallback();
    }
  };
  const schedule = () => {
    if (!frame && canRender() && (needsRender || motionEnabled())) frame = requestAnimationFrame(tick);
  };
  const tick = now => {
    frame = 0;
    if (!canRender()) { stop(); return; }
    if (motionEnabled()) {
      const interval = mobile ? 1000 / 30 : 1000 / 60;
      const sinceRender = now - lastRendered;
      if (lastRendered && sinceRender < interval - 0.5) { schedule(); return; }
      const dt = previous ? Math.min((now - previous) / 1000, 0.065) : 1 / 60;
      previous = now;
      // Keep the leftover frame time. Dropping it would turn a nominal 50 FPS
      // limit into 30 FPS on a typical 60 Hz display and make pointer input lag.
      lastRendered = now - (lastRendered ? Math.max(0, sinceRender) % interval : 0);
      elapsed += dt;
      uniforms.uTime.value = elapsed;
      const easing = 1 - Math.exp(-dt * 7);
      uniforms.uPointer.value.lerp(pointerTarget, easing);
      uniforms.uVelocity.value.lerp(velocityTarget, easing);
      velocityTarget.multiplyScalar(Math.exp(-dt * 5));
      const strength = pointerInside ? 0.8 + Math.min(0.65, velocityTarget.length() * 0.2) : 0;
      uniforms.uInteraction.value += (strength - uniforms.uInteraction.value) * (1 - Math.exp(-dt * 4.2));
      needsRender = true;
    }
    if (needsRender) render();
    schedule();
  };
  const resetPointer = () => {
    pointerInside = false;
    lastPointerTime = 0;
    velocityTarget.set(0, 0);
  };
  const clearInteraction = () => {
    resetPointer();
    uniforms.uVelocity.value.set(0, 0);
    uniforms.uInteraction.value = 0;
  };
  const resize = () => {
    if (disposed || contextLost || failed) return;
    const rect = host.getBoundingClientRect();
    hasSize = rect.width > 0 && rect.height > 0;
    if (!hasSize) { stop(); return; }
    // Initial visibility is also checked before the observer's first callback.
    visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    mobile = rect.width <= 520 || window.innerWidth <= 650;
    const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(rect.width, rect.height, false);
    uniforms.uPixelRatio.value = ratio;
    uniforms.uPointScale.value = THREE.MathUtils.clamp(rect.height / 580, 0.73, 1.2);
    camera.aspect = rect.width / rect.height;
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHorizontal = tanVertical * camera.aspect;
    let distance = 0;
    // Fit an oriented box instead of a sphere so the lattice fills narrow
    // mobile hosts without clipping its near edge or wasting the desktop area.
    for (const x of [-7.5, 7.5]) {
      for (const y of [-2.1, 2.5]) {
        for (const z of [-5.5, 5.5]) {
          corner.set(x, y, z).sub(cameraTarget);
          const depth = corner.dot(cameraDirection);
          distance = Math.max(distance, Math.abs(corner.dot(cameraRight)) / tanHorizontal + depth,
            Math.abs(corner.dot(cameraUp)) / tanVertical + depth);
        }
      }
    }
    distance *= 1.035;
    uniforms.uCameraDistance.value = distance;
    camera.position.copy(cameraDirection).multiplyScalar(distance).add(cameraTarget);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    needsRender = true;
    if (!visible) stop();
    schedule();
  };
  const onPointer = event => {
    if (!canRender() || !motionEnabled()) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom) { resetPointer(); return; }
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(interactionPlane, intersection)) return;
    const x = THREE.MathUtils.clamp(intersection.x, -8, 8);
    const z = THREE.MathUtils.clamp(intersection.z, -6, 6);
    const now = event.timeStamp / 1000;
    if (pointerInside && lastPointerTime) {
      const dt = THREE.MathUtils.clamp(now - lastPointerTime, 0.008, 0.15);
      velocityTarget.set((x - lastPointer.x) / dt * 0.055, (z - lastPointer.y) / dt * 0.055);
      velocityTarget.clampLength(0, 3.5);
    } else {
      uniforms.uPointer.value.set(x, z);
      velocityTarget.set(0, 0);
    }
    pointerTarget.set(x, z);
    lastPointer.set(x, z);
    lastPointerTime = now;
    pointerInside = true;
  };
  const syncMotion = () => {
    stop();
    if (!motionEnabled()) clearInteraction();
    needsRender = true;
    schedule();
  };
  const onVisibility = () => {
    resetPointer();
    if (document.hidden) stop();
    else { needsRender = true; schedule(); }
  };
  const onContextLost = event => {
    event.preventDefault();
    contextLost = true;
    clearInteraction();
    showFallback();
  };
  const onContextRestored = () => {
    if (disposed) return;
    contextLost = false;
    failed = false;
    needsRender = true;
    resize();
  };
  const onPageHide = event => {
    suspended = true;
    stop();
    if (!event.persisted) dispose();
  };
  const onPageShow = () => {
    if (disposed || !suspended) return;
    suspended = false;
    resetPointer();
    resize();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    observer?.disconnect();
    resizeObserver?.disconnect();
    listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    resources.forEach(resource => resource.dispose());
    scene.clear();
    renderer.dispose();
    renderer.domElement.remove();
    host.classList.remove('field-ready');
  };

  try {
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.debug.onShaderError = () => { failed = true; showFallback(); };
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    const lattice = createLattice();
    resources.push(lattice.points, lattice.wires);
    const makeMaterial = defines => {
      const material = new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader, defines,
        transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      resources.push(material);
      return material;
    };
    const wires = new THREE.LineSegments(lattice.wires, makeMaterial({}));
    wires.renderOrder = 0;
    const points = new THREE.Points(lattice.points, makeMaterial({ FIELD_POINTS: 1 }));
    points.renderOrder = 1;
    scene.add(wires, points);
    if (uniforms.uLaunch.value) {
      const nodeGeometry = new THREE.BufferGeometry();
      nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      nodeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
      resources.push(nodeGeometry);
      const node = new THREE.Points(nodeGeometry, makeMaterial({ FIELD_NODE: 1 }));
      node.renderOrder = 2;
      scene.add(node);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (disposed) return;
        visible = entries[0].isIntersecting;
        if (visible) { needsRender = true; schedule(); }
        else { resetPointer(); stop(); }
      });
      observer.observe(host);
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
    }
    // Passive window listeners work even when the decorative host has
    // pointer-events:none, and never capture touch or interfere with scrolling.
    listen(window, 'pointermove', onPointer, { passive: true });
    listen(window, 'pointerdown', onPointer, { passive: true });
    listen(window, 'pointerup', event => { if (event.pointerType === 'touch') resetPointer(); }, { passive: true });
    listen(window, 'pointercancel', resetPointer, { passive: true });
    listen(window, 'blur', resetPointer);
    listen(document.documentElement, 'pointerleave', resetPointer);
    listen(window, 'resize', resize, { passive: true });
    listen(document, 'visibilitychange', onVisibility);
    listen(reduced, 'change', syncMotion);
    listen(canvas, 'webglcontextlost', onContextLost);
    listen(canvas, 'webglcontextrestored', onContextRestored);
    listen(window, 'pagehide', onPageHide);
    listen(window, 'pageshow', onPageShow);
    resize();
  } catch {
    dispose();
    host.classList.add('field-unavailable');
  }

  return {
    setPaused(value) {
      if (disposed) return;
      paused = Boolean(value);
      syncMotion();
    },
    dispose,
  };
}
