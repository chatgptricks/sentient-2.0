// The deck's compositions as reusable elements. A studio slide is a master
// surface (section, title, note) plus a stack of these blocks; templates are
// the campaign deck's slides converted to blocks. Every editable text node
// declares its path in the slide (`blocks.0.items.2.title`), so the studio can
// write inline edits straight back into the slide's data.
import './blocks.css';
import { campaignDeck } from './campaign-deck.mjs';
import { launchBlockTypes } from './launch-elements.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const pad = i => String(i+1).padStart(2,'0');
const arrow = '<span class="deck-arrow" aria-hidden="true"></span>';
const copy = value => structuredClone(value);
// Links open the post; anything other than a web address is dropped.
const safeUrl = url => /^https?:\/\//i.test(String(url ?? '').trim()) ? String(url).trim() : '#';
// Site assets are written as root paths; uploads and links are used as they are.
export const assetUrl = (path, base) => /^(data:|blob:|https?:)/.test(path ?? '') ? path : new URL(`..${path}`, base).href;

export const surfaces = [
  { id:'dark', label:'Oscuro' },
  { id:'light', label:'Papel' },
  { id:'accent', label:'Lima' },
];
// Each original layout's surface; the cover and closing slide are always dark.
export const layoutSurfaces = { opening:'dark', network:'accent', accounts:'light', founders:'dark', approach:'light', selection:'dark', relevance:'accent', audience:'light', promos:'dark', process:'dark', commitment:'accent', analysis:'light', paid:'dark', optimisation:'light', closing:'accent', end:'dark' };
export const fixedSurface = layout => layout === 'opening' || layout === 'end';
export const surfaceOf = slide => fixedSurface(slide.layout) ? 'dark' : slide.surface ?? layoutSurfaces[slide.layout] ?? 'dark';

const text = (tag, path, value, className='') => `<${tag}${className ? ` class="${className}"` : ''} data-edit-field="${path}">${escape(value)}</${tag}>`;
const field = (key, label, type='text') => ({ key, label, type });
const items = (block, key='items') => block[key] ?? [];

// `fields` are the block's own values, `lists` its repeatable items. Both drive
// the studio inspector; `render(block, at, src)` returns the block's markup,
// where `at(...keys)` names a text path and `src(path)` resolves an image.
export const blockTypes = {
  ...launchBlockTypes,
  'metric-tags': {
    label:'Cifra + etiquetas', group:'Cifras', hint:'Un número monumental con temas y plataformas.',
    fields:[field('metric', 'Cifra'), field('label', 'Descripción', 'textarea')],
    lists:[
      { key:'tags', label:'Etiquetas', min:0, max:6, fields:[field('text', 'Etiqueta')], blank:() => ({ text:'Topic' }) },
      { key:'platforms', label:'Plataformas', min:0, max:6, fields:[field('text', 'Plataforma')], blank:() => ({ text:'Platform' }) },
    ],
    blank:() => ({ metric:'25M', label:'followers across the network', tags:[{ text:'AI' }, { text:'Technology' }], platforms:[{ text:'Instagram' }, { text:'X' }] }),
    render:(b, at) => `<div class="deck-network-body"><div class="deck-metric">${text('strong', at('metric'), b.metric)}${text('span', at('label'), b.label)}</div><div class="deck-network-side"><ul class="deck-tags">${items(b, 'tags').map((tag,i) => `<li>${text('span', at('tags', i, 'text'), tag.text)}</li>`).join('')}</ul><ul class="deck-platforms">${items(b, 'platforms').map((platform,i) => `<li>${text('span', at('platforms', i, 'text'), platform.text)}</li>`).join('')}</ul></div></div>`,
  },
  metric: {
    label:'Cifra grande', group:'Cifras', hint:'Una cifra con su descripción.',
    fields:[field('metric', 'Cifra'), field('label', 'Descripción', 'textarea')],
    blank:() => ({ metric:'3.2M', label:'impressions delivered' }),
    render:(b, at) => `<div class="deck-metric studio-metric">${text('strong', at('metric'), b.metric)}${text('span', at('label'), b.label)}</div>`,
  },
  cpm: {
    label:'Compromiso', group:'Cifras', hint:'Cifra garantizada con condición al lado.',
    fields:[field('label', 'Etiqueta'), field('value', 'Cifra'), field('line', 'Texto', 'textarea'), field('compLabel', 'Título de la condición'), field('compensation', 'Condición', 'textarea')],
    blank:() => ({ label:'Guaranteed maximum CPM', value:'$X', line:'Budget and minimum impressions agreed before launch.', compLabel:'If delivery falls short', compensation:'[insert agreed commitment]' }),
    render:(b, at) => `<div class="deck-commitment-body"><div class="deck-commitment-main">${text('p', at('label'), b.label, 'deck-cpm-label')}${text('div', at('value'), b.value, 'deck-cpm')}</div><div class="deck-commitment-side">${text('p', at('line'), b.line, 'deck-commitment-line')}<div class="deck-compensation">${text('span', at('compLabel'), b.compLabel)}${text('p', at('compensation'), b.compensation)}</div></div></div>`,
  },
  statement: {
    label:'Frase destacada', group:'Texto', hint:'Una línea en negrita que cierra la idea.',
    fields:[field('text', 'Frase', 'textarea')],
    blank:() => ({ text:'One clear line that lands the idea.' }),
    render:(b, at) => text('p', at('text'), b.text, 'deck-statement'),
  },
  paragraph: {
    label:'Párrafo', group:'Texto', hint:'Texto de apoyo.',
    fields:[field('text', 'Texto', 'textarea')],
    blank:() => ({ text:'Supporting copy that explains the idea in a sentence or two.' }),
    render:(b, at) => text('p', at('text'), b.text, 'studio-paragraph'),
  },
  tags: {
    label:'Etiquetas', group:'Texto', hint:'Píldoras de temas.',
    lists:[{ key:'items', label:'Etiquetas', min:1, max:10, fields:[field('text', 'Etiqueta')], blank:() => ({ text:'Topic' }) }],
    blank:() => ({ items:[{ text:'AI' }, { text:'Technology' }, { text:'Business' }] }),
    render:(b, at) => `<ul class="deck-tags studio-tags">${items(b).map((tag,i) => `<li>${text('span', at('items', i, 'text'), tag.text)}</li>`).join('')}</ul>`,
  },
  chips: {
    label:'Lista de puntos', group:'Texto', hint:'Un título corto y puntos con viñeta.',
    fields:[field('label', 'Título')],
    lists:[{ key:'items', label:'Puntos', min:1, max:8, fields:[field('title', 'Punto')], blank:() => ({ title:'New point' }) }],
    blank:() => ({ label:'Your proposal includes', items:[{ title:'Target customer' }, { title:'Shortlist' }, { title:'Reporting' }] }),
    render:(b, at) => `<div class="deck-closing-body">${text('p', at('label'), b.label, 'deck-closing-label')}<ul class="deck-chips">${items(b).map((item,i) => `<li>${text('span', at('items', i, 'title'), item.title)}</li>`).join('')}</ul></div>`,
  },
  flow: {
    label:'Pasos con flechas', group:'Diagramas', hint:'Etapas de izquierda a derecha.',
    lists:[{ key:'items', label:'Pasos', min:2, max:5, fields:[field('kicker', 'Antetítulo'), field('title', 'Título'), field('description', 'Descripción', 'textarea')], blank:() => ({ kicker:'Next', title:'New step', description:'What happens here.' }) }],
    blank:() => ({ items:[{ kicker:'Start', title:'First step', description:'What happens first.' }, { kicker:'Then', title:'Second step', description:'What it leads to.' }, { kicker:'Finally', title:'Result', description:'Where it ends.' }] }),
    render:(b, at) => `<ol class="deck-flow">${items(b).map((step,i) => `<li>${text('span', at('items', i, 'kicker'), step.kicker, 'deck-flow-kicker')}<span class="deck-flow-number" aria-hidden="true">${pad(i)}</span>${text('h3', at('items', i, 'title'), step.title)}${text('p', at('items', i, 'description'), step.description)}</li>`).join(arrow)}</ol>`,
  },
  funnel: {
    label:'Embudo', group:'Diagramas', hint:'De muchos a pocos, con los filtros en medio.',
    fields:[field('from', 'Inicio'), field('to', 'Resultado')],
    lists:[{ key:'items', label:'Filtros', min:1, max:6, fields:[field('title', 'Filtro'), field('description', 'Descripción')], blank:() => ({ title:'New filter', description:'Why it matters' }) }],
    blank:() => ({ from:'Everything', to:'The shortlist', items:[{ title:'Fit', description:'Right audience' }, { title:'Value', description:'Right price' }] }),
    render:(b, at) => `<div class="deck-funnel"><div class="deck-funnel-pool">${text('h3', at('from'), b.from)}<div class="deck-dots" aria-hidden="true"></div></div>${arrow}<ol class="deck-filters">${items(b).map((item,i) => `<li><span class="deck-filter-number" aria-hidden="true">${pad(i)}</span><div>${text('h3', at('items', i, 'title'), item.title)}${text('p', at('items', i, 'description'), item.description)}</div></li>`).join('')}</ol>${arrow}<div class="deck-funnel-result">${text('h3', at('to'), b.to)}<div class="deck-picks" aria-hidden="true">${'<span></span>'.repeat(6)}</div></div></div>`,
  },
  versus: {
    label:'Comparación', group:'Diagramas', hint:'Lo grande contra lo correcto.',
    fields:[field('sign', 'Signo')],
    lists:[{ key:'items', label:'Lados', min:2, max:2, fields:[field('title', 'Título'), field('description', 'Descripción')] }],
    blank:() => ({ sign:'<', items:[{ title:'More', description:'Without intent' }, { title:'Better', description:'With intent' }] }),
    render:(b, at) => `<div class="deck-versus">${items(b).slice(0, 2).map((side,i) => `<section class="deck-versus-${i ? 'right' : 'big'}"><div class="deck-versus-shape" aria-hidden="true"></div>${text('h3', at('items', i, 'title'), side.title)}${text('p', at('items', i, 'description'), side.description)}</section>`).join(text('span', at('sign'), b.sign, 'deck-versus-sign'))}</div>`,
  },
  words: {
    label:'Palabras grandes', group:'Diagramas', hint:'Una palabra monumental por fila.',
    lists:[{ key:'items', label:'Filas', min:1, max:4, fields:[field('title', 'Palabra'), field('description', 'Descripción')], blank:() => ({ title:'Word', description:'What it means.' }) }],
    blank:() => ({ items:[{ title:'Fast', description:'Live in days.' }, { title:'Clear', description:'One report.' }, { title:'Proven', description:'Measured results.' }] }),
    render:(b, at) => `<ol class="deck-words">${items(b).map((item,i) => `<li>${text('h3', at('items', i, 'title'), item.title)}${text('p', at('items', i, 'description'), item.description)}</li>`).join('')}</ol>`,
  },
  timeline: {
    label:'Línea de tiempo', group:'Diagramas', hint:'Etapas numeradas en una línea.',
    lists:[{ key:'items', label:'Etapas', min:2, max:7, fields:[field('title', 'Etapa'), field('description', 'Descripción')], blank:() => ({ title:'Step', description:'What happens' }) }],
    blank:() => ({ items:[{ title:'Plan', description:'Goal and audience' }, { title:'Create', description:'Content you approve' }, { title:'Report', description:'Results' }] }),
    render:(b, at) => `<ol class="deck-timeline" style="--n:${items(b).length}">${items(b).map((item,i) => `<li><span class="deck-timeline-dot" aria-hidden="true">${i+1}</span>${text('h3', at('items', i, 'title'), item.title)}${text('p', at('items', i, 'description'), item.description)}</li>`).join('')}</ol>`,
  },
  questions: {
    label:'Tarjetas numeradas', group:'Diagramas', hint:'Preguntas o puntos en tarjetas; la última resalta.',
    lists:[{ key:'items', label:'Tarjetas', min:2, max:6, fields:[field('title', 'Título'), field('description', 'Descripción')], blank:() => ({ title:'Question?', description:'what it answers' }) }],
    blank:() => ({ items:[{ title:'Who?', description:'responded best' }, { title:'What?', description:'worked' }, { title:'Next?', description:'deserves more' }] }),
    render:(b, at) => `<ol class="deck-questions" style="--n:${items(b).length}">${items(b).map((item,i) => `<li><span aria-hidden="true">${pad(i)}</span>${text('h3', at('items', i, 'title'), item.title)}${text('p', at('items', i, 'description'), item.description)}</li>`).join('')}</ol>`,
  },
  equation: {
    label:'Ecuación', group:'Diagramas', hint:'A + B = resultado.',
    lists:[{ key:'items', label:'Términos', min:2, max:4, fields:[field('title', 'Título'), field('description', 'Descripción')], blank:() => ({ title:'Term', description:'what it adds' }) }],
    blank:() => ({ items:[{ title:'Best posts', description:'become ads' }, { title:'Engaged audiences', description:'by country' }, { title:'Growth', description:'proven creative' }] }),
    render:(b, at) => {
      const terms = items(b);
      return `<ol class="deck-equation">${terms.map((item,i) => `${i ? `<span class="deck-operator" aria-hidden="true">${i === terms.length-1 ? '=' : '+'}</span>` : ''}<li${i === terms.length-1 ? ' class="deck-equation-result"' : ''}>${text('h3', at('items', i, 'title'), item.title)}${text('p', at('items', i, 'description'), item.description)}</li>`).join('')}</ol>`;
    },
  },
  loop: {
    label:'Ciclo', group:'Diagramas', hint:'Un ciclo que se repite, con una frase al lado.',
    fields:[field('text', 'Frase', 'textarea')],
    lists:[{ key:'items', label:'Etapas', min:3, max:6, fields:[field('title', 'Etapa')], blank:() => ({ title:'Step' }) }],
    blank:() => ({ text:'Start small. Grow into a programme.', items:[{ title:'Test' }, { title:'Learn' }, { title:'Refine' }, { title:'Scale' }] }),
    render:(b, at) => `<div class="deck-loop-body"><ol class="deck-loop" style="--n:${items(b).length}">${items(b).map((item,i) => `<li style="--i:${i}">${text('span', at('items', i, 'title'), item.title)}</li>`).join('')}</ol>${text('p', at('text'), b.text, 'deck-statement')}</div>`,
  },
  accounts: {
    label:'Cuentas', group:'Prueba social', hint:'Avatares con seguidores.',
    lists:[{ key:'items', label:'Cuentas', min:1, max:8, account:true, fields:[field('handle', 'Usuario'), field('followers', 'Seguidores'), field('label', 'Etiqueta'), field('image', 'Avatar', 'image')], blank:() => ({ handle:'@account', followers:'100,000', label:'Followers', image:'/assets/decks/campaign-deck/avatar-evolving.jpg' }) }],
    blank:() => copy(templateBlocks().accounts[0]),
    render:(b, at, src) => `<ol class="deck-account-grid" style="--rows:${Math.ceil(items(b).length / 2)}">${items(b).map((account,i) => `<li class="deck-account"><div class="deck-account-media"><img class="deck-account-avatar" src="${escape(src(account.image))}" alt="${escape(account.handle)}" width="320" height="320" decoding="async"></div><div class="deck-account-copy">${text('h3', at('items', i, 'handle'), account.handle, 'deck-account-handle')}${text('strong', at('items', i, 'followers'), account.followers, 'deck-account-followers')}${text('span', at('items', i, 'label'), account.label, 'deck-account-label')}</div></li>`).join('')}</ol>`,
  },
  promos: {
    label:'Posts promocionales', group:'Prueba social', hint:'Portadas de posts con likes y comentarios.',
    fields:[field('likesLabel', 'Etiqueta de likes'), field('commentsLabel', 'Etiqueta de comentarios'), field('linkLabel', 'Texto del enlace')],
    lists:[{ key:'items', label:'Posts', min:1, max:3, fields:[field('image', 'Portada', 'image'), field('url', 'Enlace', 'url'), field('account', 'Cuenta'), field('title', 'Título'), field('likes', 'Likes'), field('comments', 'Comentarios'), field('date', 'Fecha')], blank:() => ({ account:'@account', title:'Campaign post', image:'/assets/decks/campaign-deck/promo-1x-neo.webp', url:'https://www.instagram.com/', date:'1 January 2026', likes:'1,000', comments:'100' }) }],
    blank:() => copy(templateBlocks().promos[0]),
    render:(b, at, src) => `<div class="deck-promo-grid" style="--n:${items(b).length}">${items(b).map((post,i) => `<article class="deck-promo"><div class="deck-promo-media"><a class="deck-promo-image-link" href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`View ${post.title} on Instagram`)}"><img class="deck-promo-image" src="${escape(src(post.image))}" alt="${escape(`${post.title} from ${post.account}`)}" width="1080" height="1350" decoding="async"></a></div><div class="deck-promo-copy">${text('p', at('items', i, 'account'), post.account, 'deck-promo-account')}${text('h3', at('items', i, 'title'), post.title, 'deck-promo-title')}<dl class="deck-promo-metrics"><div>${text('dt', at('likesLabel'), b.likesLabel)}${text('dd', at('items', i, 'likes'), post.likes)}</div><div>${text('dt', at('commentsLabel'), b.commentsLabel)}${text('dd', at('items', i, 'comments'), post.comments)}</div></dl>${text('p', at('items', i, 'date'), post.date, 'deck-promo-date')}<a class="deck-promo-source" href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer">${text('span', at('linkLabel'), b.linkLabel)}</a></div></article>`).join('')}</div>`,
  },
  people: {
    label:'Personas', group:'Personas', hint:'Retratos recortados sobre un círculo lima.',
    lists:[{ key:'items', label:'Personas', min:1, max:3, fields:[field('image', 'Retrato (PNG sin fondo)', 'image'), field('role', 'Cargo'), field('name', 'Nombre'), field('description', 'Descripción', 'textarea')], blank:() => ({ name:'Name', role:'Role', description:'What they lead.', image:'/assets/founders/louis-cutout.webp' }) }],
    blank:() => copy(templateBlocks().founders[0]),
    render:(b, at, src) => `<div class="deck-founder-pair" style="--n:${items(b).length}">${items(b).map((person,i) => `<section class="deck-founder"><div class="deck-founder-photo"><div class="deck-founder-frame"><div class="deck-founder-clip"><img src="${escape(src(person.image))}" alt="${escape(person.name)}" width="925" height="927" decoding="async"></div></div></div><div class="deck-founder-copy">${text('span', at('items', i, 'role'), person.role, 'deck-founder-role')}${text('h3', at('items', i, 'name'), person.name)}${text('p', at('items', i, 'description'), person.description)}</div></section>`).join('')}</div>`,
  },
  image: {
    label:'Imagen', group:'Medios', hint:'Una imagen o captura con pie opcional.',
    fields:[field('image', 'Imagen', 'image'), field('caption', 'Pie de foto'), { key:'size', label:'Tamaño', type:'choice', options:[['small', 'Pequeña'], ['medium', 'Mediana'], ['large', 'Grande']] }, { key:'fit', label:'Encaje', type:'choice', options:[['cover', 'Llenar'], ['contain', 'Completa']] }],
    blank:() => ({ image:'/assets/decks/campaign-deck/promo-higgsfield-minecraft.webp', caption:'', size:'medium', fit:'cover' }),
    render:(b, at, src) => `<figure class="studio-image" data-size="${escape(b.size || 'medium')}" data-fit="${escape(b.fit || 'cover')}"><img src="${escape(src(b.image))}" alt="${escape(b.caption)}" decoding="async">${b.caption ? text('figcaption', at('caption'), b.caption) : ''}</figure>`,
  },
  // The cover and the closing logo belong to their own full-slide templates.
  cover: {
    label:'Portada', group:'Marca', templateOnly:true,
    lists:[{ key:'lines', label:'Líneas', min:1, max:4, fields:[field('text', 'Línea')], blank:() => ({ text:'New line.' }) }],
    render:(b, at) => `<div class="deck-cover-mark"></div><div class="deck-cover-lines">${items(b, 'lines').map((line,i) => text('p', at('lines', i, 'text'), line.text, 'deck-cover-line')).join('')}</div><div class="deck-cover-emblem" aria-hidden="true"></div>`,
  },
  'end-logo': {
    label:'Logo de cierre', group:'Marca', templateOnly:true,
    render:() => `<div class="deck-end-glow" role="img" aria-label="Sentient"><div class="deck-end-logo"></div></div>`,
  },
};

export const blockGroups = ['Texto', 'Cifras', 'Diagramas', 'Prueba social', 'Personas', 'Medios'];

export function renderBlocks(slide, src) {
  return (slide.blocks ?? []).map((block, bi) => {
    const type = blockTypes[block.type];
    if (!type) return '';
    const at = (...keys) => ['blocks', bi, ...keys].join('.');
    return `<div class="deck-block" data-block="${bi}">${type.render(block, at, src)}</div>`;
  }).join('');
}

// The campaign deck's slides as block slides, keyed by their original layout.
function fromCampaign(slide) {
  const statement = slide.emphasis ? [{ type:'statement', text:slide.emphasis }] : [];
  const listOf = values => values.map(value => ({ text:value }));
  switch (slide.layout) {
    case 'opening': return [{ type:'cover', lines:listOf(slide.lines) }];
    case 'network': return [{ type:'metric-tags', metric:slide.metric, label:slide.label, tags:listOf(slide.tags), platforms:listOf(slide.platforms) }, ...statement];
    case 'accounts': return [{ type:'accounts', items:slide.accounts.map(({ handle, followers, image }) => ({ handle, followers, label:'Followers', image })) }];
    case 'founders': return [{ type:'people', items:slide.founders.map(({ name, role, description, image }) => ({ name, role, description, image })) }];
    case 'approach': return [{ type:'flow', items:copy(slide.steps) }];
    case 'selection': return [{ type:'funnel', from:slide.from, to:slide.to, items:copy(slide.items) }, ...statement];
    case 'relevance': return [{ type:'versus', sign:'<', items:copy(slide.versus) }, ...statement];
    case 'audience': return [{ type:'words', items:copy(slide.items) }, ...statement];
    case 'promos': return [{ type:'promos', likesLabel:'Likes', commentsLabel:'Comments', linkLabel:'View post ↗', items:slide.posts.map(({ account, title, image, url, date, likes, comments }) => ({ account, title, image, url, date, likes, comments })) }];
    case 'process': return [{ type:'timeline', items:copy(slide.items) }];
    case 'commitment': return [{ type:'cpm', label:slide.label, value:slide.cpm, line:slide.paragraphs[0], compLabel:'If delivery falls short', compensation:slide.compensation }];
    case 'analysis': return [{ type:'questions', items:copy(slide.items) }];
    case 'paid': return [{ type:'equation', items:copy(slide.items) }];
    case 'optimisation': return [{ type:'loop', text:slide.emphasis, items:copy(slide.items) }];
    case 'closing': return [{ type:'chips', label:slide.paragraphs[0], items:copy(slide.items) }, ...statement];
    case 'end': return [{ type:'end-logo' }];
    default: return statement;
  }
}

const templateNames = { opening:'Portada', network:'Cifra de alcance', accounts:'Cuentas', founders:'Equipo', approach:'Enfoque en 3 pasos', selection:'Embudo de selección', relevance:'Comparación', audience:'Palabras grandes', promos:'Posts promocionales', process:'Proceso', commitment:'Compromiso CPM', analysis:'Preguntas', paid:'Ecuación', optimisation:'Ciclo', closing:'Cierre con propuesta', end:'Logo final' };

let cachedTemplates;
function templateBlocks() {
  cachedTemplates ??= Object.fromEntries(campaignDeck.slides.map(slide => [slide.layout, fromCampaign(slide)]));
  return cachedTemplates;
}

// Every campaign slide is a template, plus a blank surface to build from elements.
export function templates() {
  const blank = { id:'blank', name:'En blanco', slide:{ layout:'blank', surface:'dark', section:'Section', title:'A short, clear headline', blocks:[] } };
  return [blank, ...campaignDeck.slides.map(slide => ({
    id:slide.layout,
    name:templateNames[slide.layout] ?? slide.layout,
    slide:{ layout:slide.layout, surface:layoutSurfaces[slide.layout], section:slide.section, title:slide.title, blocks:copy(templateBlocks()[slide.layout]), ...(slide.note ? { note:slide.note } : {}) },
  }))];
}

export const newId = () => Math.random().toString(36).slice(2, 10);
export const slideFromTemplate = template => ({ id:newId(), ...copy(template.slide) });
export const newBlock = type => ({ type, ...blockTypes[type].blank() });

// The whole campaign deck as an editable studio deck.
export function campaignAsStudioDeck() {
  return { title:campaignDeck.title, slides:templates().slice(1).map(slideFromTemplate) };
}
