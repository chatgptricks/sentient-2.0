// Legal pages carried over word for word from the old sentientagency.io
// (WordPress, backed up 2026-11-17 in ~/Sentient/sentientagency-io-backup-2026-11-17).
// Payment processors and ad platforms may link to these URLs, so they keep their paths.
const list = items => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;

export const legalPages = {
  privacy: {
    route: '/privacy-policy',
    title: 'Privacy Policy',
    description: 'How Sentient Agency collects, uses and protects your information.',
    updated: 'October 16, 2025',
    body: `<p>This Privacy Policy describes how Sentient Agency (“Sentient,” “we,” “our,” or “us”) collects, uses, and protects your information when you visit our website, interact with our content, book a strategy call, or purchase our services and products.</p>
<p>By using our website and services, you agree to the terms of this Privacy Policy.</p>
<h2>1. Information We Collect</h2>
<p>We collect information in the following ways:</p>
<h3>a. Information You Provide Directly</h3>
${list(['Name, email address, phone number, and business information when you fill out forms, book calls, or purchase services.', 'Payment information (processed securely through third-party payment processors; we do not store full credit card details).', 'Any information voluntarily shared during calls, emails, or surveys.'])}
<h3>b. Information We Collect Automatically</h3>
${list(['IP address, browser type, device information, and pages visited.', 'Data collected through cookies, pixels, and similar tracking technologies (e.g., Meta Pixel, Google Analytics).', 'Engagement data with our email campaigns, lead magnets, and ads.'])}
<h3>c. Information From Third Parties</h3>
${list(['Lead generation partners or affiliate referrals.', 'Publicly available social media data (e.g., if you engage with Sentient content on Instagram, TikTok, X, or LinkedIn).'])}
<h2>2. How We Use Your Information</h2>
<p>We use your information to:</p>
${list(['Provide, operate, and improve our services.', 'Book and manage strategy calls or promotional campaigns.', 'Communicate with you (email, SMS, or chat).', 'Personalize and improve your experience with targeted offers.', 'Send marketing and promotional messages you’ve opted into.', 'Comply with legal and financial obligations.'])}
<p>We will never sell your personal data.</p>
<h2>3. Cookies &amp; Tracking</h2>
<p>We use cookies and pixels to:</p>
${list(['Analyze traffic and user behavior.', 'Measure ad performance and conversions.', 'Personalize your experience and retarget relevant ads.'])}
<p>You can adjust your browser settings to disable cookies, but some parts of the site may not function properly.</p>`,
  },
  refunds: {
    route: '/refunds-fulfillment-policy',
    title: 'Refunds & Fulfillment Policy',
    description: 'Refunds, delivery, returns and cancellations at Sentient Media Group LLC.',
    body: `<p>At Sentient Media Group LLC, we provide digital marketing services and digital products, including social media content and strategy consultations.</p>
<h2>Refund Policy</h2>
<p>Due to the nature of digital goods and services, all sales are final. However, if you experience an issue with your purchase or service, please contact us within 7 days and we’ll assess the situation on a case-by-case basis.</p>
<h2>Delivery Policy</h2>
<p>Digital products (like e-books) are delivered instantly via email or through an on-screen download link upon successful payment. For service-based packages (e.g., social media management or ad campaigns), delivery timelines and milestones are discussed and confirmed during onboarding.</p>
<h2>Return Policy</h2>
<p>Returns are not applicable to digital goods. If there is an error or issue with your delivery, please contact us so we can resolve it promptly.</p>
<h2>Cancellation Policy</h2>
<p>You may cancel monthly subscriptions (where applicable) at any time before the next billing cycle. For one-time services, cancellations are only possible before work has commenced. Once services have begun, cancellations are not eligible for a refund.</p>
<h2>Support</h2>
<p>For support, please contact us at: <a href="mailto:contact@sentientagency.io">contact@sentientagency.io</a></p>`,
  },
  disclaimer: {
    route: '/disclaimer',
    title: 'Disclaimer',
    description: 'Results, client responsibilities and platform independence at Sentient Agency.',
    updated: 'October 16, 2025',
    body: `<p>This website and all related content, products, and services are owned and operated by Sentient Agency (“Sentient,” “we,” “our,” or “us”). By using this site, booking a call, or purchasing any of our services, you acknowledge and agree to the terms outlined in this Disclaimer.</p>
<h2>1. No Guaranteed Earnings or Results</h2>
<p>We make every effort to accurately represent our services and their potential. However, Sentient does not guarantee specific results, revenue, sales, or profits.</p>
<p>While we provide performance-based campaigns and offer guarantees in select packages, actual results depend on numerous factors outside our control, including but not limited to:</p>
${list(['The quality of the client’s product or service', 'Market demand and timing', 'Audience response', 'Conversion rates on client-owned landing pages or funnels'])}
<p>Any examples of results or case studies shown on this website or in our materials are illustrative only and should not be interpreted as a promise or guarantee of future results.</p>
<h2>2. Client Responsibility</h2>
<p>Clients are responsible for:</p>
${list(['Providing accurate information during onboarding.', 'Maintaining any websites, funnels, or automations required to support campaigns.', 'Complying with all applicable advertising and platform policies (e.g., Meta, TikTok, LinkedIn, X).'])}
<p>Sentient is not responsible for campaigns that underperform due to factors outside our scope of control.</p>
<h2>3. Platform Independence</h2>
<p>Sentient is not affiliated with or endorsed by Instagram, Meta, TikTok, X (Twitter), LinkedIn, YouTube, or any other social platform.</p>
<p>All trademarks and platform names belong to their respective owners. Our strategies are independent and comply with the terms of service of these platforms to the best of our knowledge.</p>`,
  },
};

export const renderLegalPage = page => `<section class="legal-page shell"><span class="eyebrow">LEGAL</span><h1>${page.title}</h1>${page.updated ? `<p class="legal-updated">Last updated: ${page.updated}</p>` : ''}<div class="legal-body">${page.body}</div></section>`;

export const legalLinks = () => `<nav class="footer-legal" aria-label="Legal">${Object.values(legalPages).map(page => `<a href="${page.route}">${page.title}</a>`).join('')}</nav>`;

// Old WordPress URLs that should land on their counterpart in the new site.
export const legacyRedirects = { '/what-we-do': '/about', '/viral-promotions': '/viral-launch-campaigns', '/other-services': '/growth-campaigns' };
