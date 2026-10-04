import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROWD_COLUMNS, CROWD_ROWS, CROWD_SPACING_X, CROWD_SPACING_Z, crowdPosition, createContagionModel } from './viral-crowd-model.mjs';

export function createViralCrowd(host, paused = false) {
  let renderer;
  const empty = { setPaused() {}, dispose() {} };
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { host.classList.remove('field-ready'); host.classList.add('field-unavailable'); return empty; }
  const model = createContagionModel();
  const count = model.count;
  // Enlarge each figure in place without changing the grid or camera framing.
  const figureSize = 2;
  const resources = [], listeners = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 350);
  // Keep the isometric elevation, with a slight turn that separates the two
  // diagonal row directions instead of stacking the crowd into vertical lines.
  const cameraAzimuth = Math.PI / 6;
  const cameraGroundDistance = Math.hypot(80, 80);
  camera.position.set(Math.sin(cameraAzimuth) * cameraGroundDistance, 80.25, Math.cos(cameraAzimuth) * cameraGroundDistance);
  camera.lookAt(0, 0.25, 0);
  camera.updateMatrixWorld();
  // Project the camera's screen axes onto the ground. These coefficients give
  // the actual visible ground footprint for any aspect ratio or camera yaw.
  const basis = camera.matrixWorld.elements;
  const groundFootprint = {
    centerX: camera.position.x - camera.position.y * basis[8] / basis[9],
    centerZ: camera.position.z - camera.position.y * basis[10] / basis[9],
    rightX: basis[0], rightZ: basis[2],
    upX: basis[4] - basis[5] * basis[8] / basis[9],
    upZ: basis[6] - basis[5] * basis[10] / basis[9],
  };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let peopleMesh, pickingProxy, shadows;
  let appliedFigureScale = 1;
  const resizeMatrix = new THREE.Matrix4();
  const resizeScale = new THREE.Vector3();
  let figureScreenHeight = 0.42;
  const pickingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.24);
  const groundHit = new THREE.Vector3();
  const projectedPick = new THREE.Vector3();
  const levelValues = new Float32Array(count);
  const levels = new THREE.InstancedBufferAttribute(levelValues, 1).setUsage(THREE.DynamicDrawUsage);
  const shadeValues = Float32Array.from({ length: count }, (_, i) => 0.91 + ((i * 137 + 71) % 101) / 101 * 0.16);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, failed = false, contextLost = false, suspended = false;
  let visible = false, hasSize = false, mobile = false, dirty = true;
  let frame = 0, elapsed = 0, previous = 0, lastRendered = 0, lastHover = 0, lastHoverIndex = -1;
  let observer, resizeObserver;
  const canvas = renderer.domElement;
  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push([target, type, fn, options]); };
  const track = resource => { resources.push(resource); return resource; };
  const canRender = () => !disposed && !failed && !contextLost && !suspended && visible && hasSize && !document.hidden;
  const motionEnabled = () => !paused && !reduced.matches;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; lastRendered = 0; };
  const showFallback = () => { stop(); host.classList.remove('field-ready'); host.classList.add('field-unavailable'); };
  const material = track(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.04, roughness: 0.57 }));
  material.onBeforeCompile = shader => {
    shader.uniforms.uCrowdDormant = { value: new THREE.Color(0x304438) };
    shader.uniforms.uCrowdActive = { value: new THREE.Color(0xa4df36) };
    shader.vertexShader = 'attribute float aActivation; attribute float aVariation; varying float vActivation; varying float vVariation;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvActivation = aActivation; vVariation = aVariation;');
    shader.fragmentShader = 'uniform vec3 uCrowdDormant; uniform vec3 uCrowdActive; varying float vActivation; varying float vVariation;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uCrowdDormant, uCrowdActive, vActivation) * vVariation;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.045, 0.10, 0.008) * pow(vActivation, 1.5);');
  };
  material.customProgramCacheKey = () => 'sentient-clay-crowd-dense-v2';

  const render = () => {
    if (!canRender()) return;
    try {
      renderer.render(scene, camera);
      if (failed || contextLost) return;
      dirty = false;
      host.classList.remove('field-unavailable');
      host.classList.add('field-ready');
    } catch { failed = true; showFallback(); }
  };
  const updateLevels = () => {
    let changed = false;
    for (let i = 0; i < count; i++) {
      const value = model.level(i, elapsed);
      if (Math.abs(levelValues[i] - value) > 0.0001) {
        levelValues[i] = value;
        changed = true;
      }
    }
    if (changed) { levels.needsUpdate = true; dirty = true; }
  };
  const schedule = () => {
    if (!frame && canRender() && (dirty || (motionEnabled() && model.pending(elapsed)))) frame = requestAnimationFrame(tick);
  };
  const tick = now => {
    frame = 0;
    if (!canRender()) { stop(); return; }
    if (motionEnabled() && model.pending(elapsed)) {
      const interval = mobile ? 1000 / 30 : 1000 / 45;
      const sinceRender = now - lastRendered;
      if (lastRendered && sinceRender < interval - 0.5) { schedule(); return; }
      const dt = previous ? Math.min((now - previous) / 1000, 0.075) : 0;
      previous = now;
      lastRendered = now - (lastRendered ? Math.max(0, sinceRender) % interval : 0);
      elapsed += dt;
      updateLevels();
    }
    if (dirty) render();
    if (!model.pending(elapsed)) { previous = 0; lastRendered = 0; }
    schedule();
  };
  const ignite = index => {
    if (disposed || failed || contextLost) return false;
    if (!model.ignite(index, elapsed)) return false;
    // Reduced motion uses a user-triggered static state, never an animated wave.
    if (reduced.matches) model.complete(elapsed);
    updateLevels(); dirty = true; schedule();
    return true;
  };
  const resize = () => {
    if (disposed || failed || contextLost) return;
    const rect = host.getBoundingClientRect();
    hasSize = rect.width > 0 && rect.height > 0;
    if (!hasSize) { stop(); return; }
    visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    mobile = rect.width < 550 || window.innerWidth < 650;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.65));
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height;
    const halfFieldX = (CROWD_COLUMNS - 1) * CROWD_SPACING_X / 2 - 2;
    const halfFieldZ = (CROWD_ROWS - 1) * CROWD_SPACING_Z / 2 - 2;
    const targetPixelHeight = mobile ? 8.5 : 11.5;
    const desiredHeight = rect.height * figureScreenHeight / targetPixelHeight;
    // The ground rectangle, including every viewport corner, stays inside the
    // larger finite regiment. Its physical boundary never appears as a diamond.
    const coverageLimit = Math.min(
      2 * (halfFieldX - Math.abs(groundFootprint.centerX)) / (aspect * Math.abs(groundFootprint.rightX) + Math.abs(groundFootprint.upX)),
      2 * (halfFieldZ - Math.abs(groundFootprint.centerZ)) / (aspect * Math.abs(groundFootprint.rightZ) + Math.abs(groundFootprint.upZ)),
    );
    const viewHeight = Math.min(desiredHeight, coverageLimit);
    const figureScale = Math.min(1, viewHeight / desiredHeight);
    if (peopleMesh && shadows && Math.abs(figureScale - appliedFigureScale) > 0.00001) {
      // At very wide aspect ratios the camera must move closer to preserve
      // coverage. Shrink only each person's body and contact shadow; the grid
      // translations remain fixed, and exact picking reads these same matrices.
      resizeScale.setScalar(figureScale / appliedFigureScale);
      for (let i = 0; i < count; i++) {
        peopleMesh.getMatrixAt(i, resizeMatrix); resizeMatrix.scale(resizeScale); peopleMesh.setMatrixAt(i, resizeMatrix);
        shadows.getMatrixAt(i, resizeMatrix); resizeMatrix.scale(resizeScale); shadows.setMatrixAt(i, resizeMatrix);
      }
      peopleMesh.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      appliedFigureScale = figureScale;
    }
    camera.left = -viewHeight * aspect / 2; camera.right = -camera.left;
    camera.top = viewHeight / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    dirty = true; schedule();
  };
  const pick = event => {
    if (!canRender() || event.target?.closest?.('button, a, input, select, textarea, [role=button]')) return -1;
    const rect = host.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return -1;
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!pickingProxy || !raycaster.ray.intersectPlane(pickingPlane, groundHit)) return -1;
    const column = Math.round(groundHit.x / CROWD_SPACING_X + (CROWD_COLUMNS - 1) / 2);
    const row = Math.round(groundHit.z / CROWD_SPACING_Z + (CROWD_ROWS - 1) / 2);
    let closest = Infinity, selected = -1, nearestMark = -1;
    let nearestDistance = (mobile ? 10 : 6) ** 2;
    // Exact triangle picking on at most 25 nearby instances, rather than a
    // full crowd raycast on every pointer move. The proxy shares the
    // visible figure geometry and the exact instance's world matrix.
    for (let z = Math.max(0, row - 2); z <= Math.min(CROWD_ROWS - 1, row + 2); z++) {
      for (let x = Math.max(0, column - 2); x <= Math.min(CROWD_COLUMNS - 1, column + 2); x++) {
        const index = z * CROWD_COLUMNS + x;
        peopleMesh.getMatrixAt(index, pickingProxy.matrixWorld);
        const hit = raycaster.intersectObject(pickingProxy, false)[0];
        if (hit && hit.distance < closest) { closest = hit.distance; selected = index; }
        // Tiny marks keep a small, forgiving screen-space hit area. Their
        // visible geometry stays miniature, including on high-density screens.
        projectedPick.set(0, 0.24, 0).applyMatrix4(pickingProxy.matrixWorld).project(camera);
        const dx = (projectedPick.x * 0.5 + 0.5) * rect.width + rect.left - event.clientX;
        const dy = (0.5 - projectedPick.y * 0.5) * rect.height + rect.top - event.clientY;
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) { nearestDistance = distance; nearestMark = index; }
      }
    }
    return selected >= 0 ? selected : nearestMark;
  };
  const onPointerMove = event => {
    if (!motionEnabled() || event.timeStamp - lastHover < 100) return;
    lastHover = event.timeStamp;
    const index = pick(event);
    if (index >= 0 && index !== lastHoverIndex) ignite(index);
    lastHoverIndex = index;
  };
  const onPointerDown = event => {
    if (!motionEnabled()) return;
    // Touch responds on contact; native scrolling remains available because all
    // pointer listeners are passive and no pointer capture is requested.
    const index = pick(event);
    if (index >= 0) { ignite(index); lastHoverIndex = index; }
  };
  const clearPointer = () => { lastHoverIndex = -1; };
  // Suspending motion only freezes the simulation clock. The lit crowd and
  // pending propagation survive until this page is reloaded.
  const syncMotion = () => { stop(); clearPointer(); dirty = true; schedule(); };
  const onVisibility = () => { clearPointer(); if (document.hidden) stop(); else { dirty = true; schedule(); } };
  const dispose = () => {
    if (disposed) return;
    disposed = true; stop(); observer?.disconnect(); resizeObserver?.disconnect();
    listeners.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
    resources.forEach(resource => resource.dispose());
    scene.clear(); renderer.dispose(); canvas.remove(); host.classList.remove('field-ready');
  };

  try {
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.debug.onShaderError = () => { failed = true; showFallback(); };
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    scene.add(new THREE.HemisphereLight(0xc9e5c9, 0x13251c, 1.85));
    const key = new THREE.DirectionalLight(0xe2f5d4, 3.0); key.position.set(-10, 18, 9); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa3c9ba, 1.55); rim.position.set(8, 9, -12); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xb7d08f, 0.42); fill.position.set(3, 4, 15); scene.add(fill);

    // Small anonymous people: only a soft body and a head, merged into one
    // low-polygon instance. No clothing, limbs, faces or neck details.
    const body = new THREE.CapsuleGeometry(0.14, 0.27, 2, 6);
    const bodyPositions = body.getAttribute('position');
    for (let i = 0; i < bodyPositions.count; i++) {
      const y = bodyPositions.getY(i);
      const taper = 0.80 + 0.20 * THREE.MathUtils.smoothstep(y, -0.23, 0.20);
      bodyPositions.setXYZ(i, bodyPositions.getX(i) * taper, y, bodyPositions.getZ(i) * 0.72);
    }
    body.computeVertexNormals(); body.translate(0, 0.285, 0);
    const head = new THREE.SphereGeometry(0.115, 6, 4); head.scale(0.96, 1.04, 0.96); head.translate(0, 0.706, 0);
    const figureGeometry = track(mergeGeometries([body, head])); body.dispose(); head.dispose();
    figureGeometry.scale(0.58, 0.58, 0.58);
    figureGeometry.setAttribute('aActivation', levels);
    figureGeometry.setAttribute('aVariation', new THREE.InstancedBufferAttribute(shadeValues, 1));
    figureGeometry.computeBoundingBox(); figureGeometry.computeBoundingSphere();
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const vertex = new THREE.Vector3();
    const positions = figureGeometry.getAttribute('position');
    let lower = Infinity, upper = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const projected = vertex.dot(cameraUp); lower = Math.min(lower, projected); upper = Math.max(upper, projected);
    }
    figureScreenHeight = upper - lower;
    peopleMesh = new THREE.InstancedMesh(figureGeometry, material, count);
    peopleMesh.userData.instancesPerPerson = 1;
    pickingProxy = new THREE.Mesh(figureGeometry, material);
    pickingProxy.matrixAutoUpdate = false;
    const transform = new THREE.Matrix4();
    const position = new THREE.Vector3(), scale = new THREE.Vector3();
    const turn = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -0.07);
    for (let i = 0; i < count; i++) {
      const point = crowdPosition(i);
      position.set(point.x, 0, point.z); scale.set(1, 0.97 + (shadeValues[i] - 0.91) * 0.375, 1).multiplyScalar(figureSize);
      transform.compose(position, turn, scale); peopleMesh.setMatrixAt(i, transform);
    }
    peopleMesh.instanceMatrix.needsUpdate = true; peopleMesh.computeBoundingSphere();
    scene.add(peopleMesh); track(peopleMesh);
    const shadowGeometry = track(new THREE.PlaneGeometry(0.40, 0.46)); shadowGeometry.rotateX(-Math.PI / 2);
    shadowGeometry.setAttribute('aActivation', levels);
    const shadowMaterial = track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float aActivation; varying vec2 vUv; varying float vActivation; void main(){vUv=uv;vActivation=aActivation;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; varying float vActivation; void main(){float radius=length((vUv-.5)*vec2(1.0,1.15));float contact=1.0-smoothstep(.08,.47,radius);float pool=1.0-smoothstep(.02,.52,radius);vec3 color=mix(vec3(0.0),vec3(.39,.65,.075),vActivation*.42);gl_FragColor=vec4(color,contact*.35+pool*vActivation*.12);}',
    }));
    shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, count);
    for (let i = 0; i < count; i++) { const point = crowdPosition(i); transform.makeTranslation(point.x + 0.01, 0.002, point.z + 0.03).scale(scale.setScalar(figureSize)); shadows.setMatrixAt(i, transform); }
    shadows.instanceMatrix.needsUpdate = true; shadows.computeBoundingSphere(); scene.add(shadows); track(shadows);
    scene.updateMatrixWorld(true);

    if (typeof IntersectionObserver !== 'undefined') { observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; if (visible) { dirty = true; schedule(); } else { clearPointer(); stop(); }
    }); observer.observe(host); }
    if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    listen(window, 'pointermove', onPointerMove, { passive: true });
    listen(window, 'pointerdown', onPointerDown, { passive: true });
    listen(window, 'pointercancel', clearPointer, { passive: true });
    listen(window, 'scroll', clearPointer, { passive: true });
    listen(window, 'blur', clearPointer);
    listen(document.documentElement, 'pointerleave', clearPointer);
    listen(window, 'resize', resize, { passive: true });
    listen(document, 'visibilitychange', onVisibility);
    listen(reduced, 'change', syncMotion);
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); contextLost = true; clearPointer(); showFallback(); });
    listen(canvas, 'webglcontextrestored', () => { if (disposed) return; contextLost = false; failed = false; dirty = true; resize(); });
    listen(window, 'pagehide', event => { suspended = true; stop(); if (!event.persisted) dispose(); });
    listen(window, 'pageshow', () => { if (disposed || !suspended) return; suspended = false; clearPointer(); resize(); });
    resize();
  } catch { dispose(); host.classList.add('field-unavailable'); }
  return { setPaused(value) { if (disposed) return; paused = Boolean(value); syncMotion(); }, dispose };
}
