import { pointLogoFallback } from './point-logo-fallback.mjs';
import { viralCrowdFallback } from './viral-crowd-fallback.mjs';

// Static artwork preserves the composition before its interactive canvas loads,
// during paused startup, and when rendering is unavailable.
export const serviceVisual = variant => {
  const launch = variant === 'launch';
  const description = launch
    ? 'An isometric crowd of small figures. Move over or touch a figure to start a chain reaction of light through its neighbors.'
    : 'A physical pin display forms the Sentient icon. Move over or touch the field: the first gentle wave lights only the logo pins, which stay lit until reload.';
  return `<figure class="service-visual service-visual--${variant}${launch ? ' service-visual--crowd' : ''}" aria-label="${description}"><div class="service-field" data-service-field="${variant}" aria-hidden="true">${launch ? viralCrowdFallback() : pointLogoFallback()}</div></figure>`;
};
