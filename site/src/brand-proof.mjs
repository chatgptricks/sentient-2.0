import { universeAccounts } from './universe-data.mjs';
import { features } from './site-config.mjs';

// Original marks from the client carousel on sentientagency.io.
// Source URLs and identity checks are preserved in client-provenance.json.
const brands = [
  ['OpenAI', 'openai'], ['Meta', 'meta'], ['Adobe', 'adobe'],
  ['Higgsfield', 'higgsfield'], ['InVideo', 'invideo'], ['Freepik', 'freepik'],
  ['Polymarket', 'polymarket'], ['Wegic', 'wegic'], ['Stake', 'stake'], ['ChatGPT', 'chatgpt'],
];
export const clientStrip = () => `<section class="client-proof" aria-label="Selected clients"><div class="client-proof-heading shell"><span class="eyebrow">IN GOOD COMPANY.</span><p>Ambitious brands. Shared ambition.</p><a class="text-link" href="#work">Selected work <span aria-hidden="true">↗</span></a></div><div class="client-marquee" tabindex="0" aria-label="Client logos — scroll to explore when motion is paused"><div class="client-track">${[false,true].map(duplicate=>`<ul class="client-logos" ${duplicate?'aria-hidden="true"':''}>${brands.map(([name,slug])=>`<li class="client-mark client-${slug}"><img src="/assets/clients/client-${slug}.png" alt="${duplicate?'':name}" width="180" height="60" loading="lazy"></li>`).join('')}</ul>`).join('')}</div></div></section>`;

const owned = ['chatgptricks','traselveloreal','artificialntellligence','chatgptips','planet.ai_'].map(handle=>universeAccounts.find(a=>a.handle===handle)).filter(Boolean);
const compactCount = n => n>=1e6?`${(n/1e6).toFixed(2)}M`:`${Math.round(n/1e3)}K`;
export const ownedRail = () => `<aside class="owned-proof shell" aria-label="Our owned media accounts"><div class="owned-proof-intro"><span class="eyebrow">OUR OWN MEDIA. YOUR ADVANTAGE.</span><p>The communities behind the campaigns.</p>${features.universe ? '<a href="/universe" class="text-link">Explore the network <span aria-hidden="true">↗</span></a>' : ''}</div><div class="owned-proof-accounts">${owned.map(a=>`<a href="${a.profileUrl}" target="_blank" rel="noopener noreferrer" title="${a.followerCount.toLocaleString('en-US')} followers · ${a.followersAsOf}"><img src="${a.avatar}" alt="" width="38" height="38" loading="lazy"><span><strong>@${a.handle}</strong><small>${compactCount(a.followerCount)} followers</small></span></a>`).join('')}</div><p class="owned-proof-note">Owned Instagram accounts · follower snapshots, April–May 2026.</p></aside>`;

export const networkInvitation = () => features.universe ? `<a class="network-invitation shell" href="/universe"><span class="network-invitation-art" aria-hidden="true"><img src="/assets/sentient-symbol.svg" width="56" height="56" alt=""></span><span><small class="eyebrow">A DIFFERENT WAY TO EXPLORE</small><strong>Meet the network.</strong><span>Discover our Instagram accounts and creator partners in the Sentient universe.</span></span><b aria-hidden="true">↗</b></a>` : '';
