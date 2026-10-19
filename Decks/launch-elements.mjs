import './launch-elements.css';
import './launch-deck.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const field = (key, label, type='text') => ({ key, label, type });
const text = (path, value) => `<span data-edit-field="${path}">${escape(value)}</span>`;

const defaults = () => ({
  investmentLabel:'Investment',
  distributionLabel:'Distribution',
  viewsLabel:'Minimum guaranteed views',
  coordinationLabel:'Account selection and coordination',
  copyLabel:'Creator copy guidance',
  reportingLabel:'Campaign reporting',
  includedLabel:'Included',
  plans:[
    { name:'Launch', investment:'$10,000', distribution:'Focused account selection', views:'No fixed guarantee' },
    { name:'Launch Plus', investment:'$40,000', distribution:'Expanded account selection', views:'1 million' },
    { name:'Launch Scale', investment:'$75,000', distribution:'Broadest account selection', views:'2 million' },
  ],
});

export const launchBlockTypes = {
  'launch-packages': {
    label:'Paquetes de lanzamiento',
    group:'Cifras',
    hint:'Compara tres paquetes con su inversión, distribución y servicios incluidos.',
    fields:[
      field('investmentLabel', 'Etiqueta de inversión'),
      field('distributionLabel', 'Etiqueta de distribución'),
      field('viewsLabel', 'Etiqueta de vistas garantizadas'),
      field('coordinationLabel', 'Etiqueta de selección y coordinación'),
      field('copyLabel', 'Etiqueta de copy para creadores'),
      field('reportingLabel', 'Etiqueta de reporting'),
      field('includedLabel', 'Texto de servicios incluidos'),
    ],
    lists:[{
      key:'plans', label:'Paquetes', min:3, max:3,
      fields:[
        field('name', 'Nombre'),
        field('investment', 'Inversión'),
        field('distribution', 'Distribución', 'textarea'),
        field('views', 'Vistas garantizadas'),
      ],
    }],
    blank:defaults,
    render:(block, at) => {
      const fallback = defaults();
      const value = key => block[key] ?? fallback[key];
      const plans = fallback.plans.map((plan, index) => ({ ...plan, ...(block.plans?.[index] ?? {}) }));
      const row = (label, key, className='') => `<tr${className ? ` class="${className}"` : ''}><th scope="row">${text(at(label), value(label))}</th>${plans.map((plan, index) => `<td>${text(at('plans', index, key), plan[key])}</td>`).join('')}</tr>`;
      const included = label => `<tr><th scope="row">${text(at(label), value(label))}</th>${plans.map(() => `<td>${text(at('includedLabel'), value('includedLabel'))}</td>`).join('')}</tr>`;
      return `<table class="deck-launch-packages"><caption>Launch campaign packages</caption><colgroup><col class="deck-launch-feature-column"><col span="3" class="deck-launch-plan-column"></colgroup><thead><tr><td aria-hidden="true"></td>${plans.map((plan, index) => `<th scope="col">${text(at('plans', index, 'name'), plan.name)}</th>`).join('')}</tr></thead><tbody>${row('investmentLabel', 'investment', 'deck-launch-investment')}${row('distributionLabel', 'distribution')}${row('viewsLabel', 'views', 'deck-launch-views')}${included('coordinationLabel')}${included('copyLabel')}${included('reportingLabel')}</tbody></table>`;
    },
  },
};
