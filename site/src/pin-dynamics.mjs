// Motion is expressed in the pin bed's coordinates, so the same crossing time
// feels equally deliberate on a phone and on a wide desktop surface.
export function createRippleTiming(diameter, mobile = false) {
  if (!Number.isFinite(diameter) || diameter <= 0) {
    throw new RangeError('Ripple timing requires a positive finite diameter.');
  }
  const crossingTime = 8.4;
  const speed = diameter / crossingTime;
  const band = speed * 0.58;
  // Keep the trailing edge alive after the leading edge reaches the far corner.
  const lifetime = crossingTime + band * 2.8 / speed + 0.6;
  return { speed, band, lifetime, crossingTime };
}

// Latch the first interaction in the official artwork's coordinates. Resizing
// the pin bed can then rebuild its grid without moving or erasing the reveal.
export function startLogoReveal(current, frame, u, v, speed, instant = false) {
  if (current) return current;
  return {
    x: (u - frame.u) / frame.scale,
    y: (v - frame.v) / frame.scale,
    radius: 0,
    speed: speed / frame.scale,
    complete: instant,
  };
}

export function revealLogoPin(pin, reveal) {
  if (!pin.logo) return false;
  if (!pin.lit && reveal) {
    const dx = pin.logoX - reveal.x, dy = pin.logoY - reveal.y;
    if (reveal.complete || dx * dx + dy * dy <= reveal.radius * reveal.radius) pin.lit = true;
  }
  return Boolean(pin.lit);
}

// Exact critically damped integration with a target held fixed for one frame.
// These four coefficients are shared by every pin; there is no per-pin exp().
export function springCoefficients(dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError('Spring integration requires a finite nonnegative step.');
  }
  const omega = 9;
  const decay = Math.exp(-omega * dt);
  return {
    position: (1 + omega * dt) * decay,
    positionVelocity: dt * decay,
    velocityPosition: -omega * omega * dt * decay,
    velocity: (1 - omega * dt) * decay,
  };
}

// Displacement is measured from the pin's resting height. Caps never scale;
// a rigid stroke moves vertically and cannot pass through the physical bed.
export function stepPin(pin, target, coefficients, maxWave) {
  const minimum = 2 - pin.height;
  const desired = Math.max(minimum, Math.min(maxWave, target));
  const displacement = pin.displacement ?? 0;
  const velocity = pin.velocity ?? 0;
  const error = displacement - desired;
  const next = desired + error * coefficients.position + velocity * coefficients.positionVelocity;
  pin.displacement = Math.max(minimum, Math.min(maxWave, next));
  pin.velocity = error * coefficients.velocityPosition + velocity * coefficients.velocity;

  // A mechanical stop absorbs outward momentum instead of accumulating it.
  if ((pin.displacement <= minimum && pin.velocity < 0) ||
      (pin.displacement >= maxWave && pin.velocity > 0)) pin.velocity = 0;

  if (desired === 0 && Math.abs(pin.displacement) < 0.015 && Math.abs(pin.velocity) < 0.03) {
    pin.displacement = 0;
    pin.velocity = 0;
  }
  return pin.displacement !== 0 || pin.velocity !== 0;
}
