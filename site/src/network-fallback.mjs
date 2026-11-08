import { universeAccounts } from './universe-data.mjs';

// Rounded figures and display names supplied for the website review.
// Canonical handles keep the original Instagram links and account identities.
const reference = [
  ['mindset.therapy', '11.5M', 11500000],
  ['chatgptricks', '3M', 3000000],
  ['artificialntellligence', '1.5M', 1500000, 'artificialintelligence'],
  ['passionateincome', '1.2M', 1200000],
  ['stoicreflections', '1.2M', 1200000],
  ['evolving', '1M', 1000000],
  ['chatgptips', '750K', 750000],
  ['planet.ai_', '500K', 500000, 'planet.ai'],
  ['trends', '250K', 250000],
  ['ainterestingupdate', '200K', 200000],
];
const additions = [
  { handle: 'passionateincome', name: 'Passionate Income', relationship: 'owned', topic: 'Business & growth', avatar: '/assets/universe/avatar-passionateincome.jpg' },
  { handle: 'evolving', name: 'Evolving', relationship: 'owned', topic: 'AI & technology', avatar: '/assets/universe/avatar-evolving.jpg' },
];
const accountByHandle = new Map([...universeAccounts, ...additions].map(account => [account.handle, account]));

export const fallbackAccounts = reference.map(([handle, followerLabel, followerCount, displayHandle]) => ({
  ...accountByHandle.get(handle),
  handle,
  ...(displayHandle ? { displayHandle } : {}),
  profileUrl: `https://www.instagram.com/${handle}/`,
  followerCount,
  followerLabel,
  followersAsOf: null,
  followerSource: 'provided-reference',
  referenceReceivedOn: '2026-11-08',
}));
