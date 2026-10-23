import './pdf-dialog.css';

let sequence = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

// Opening this dialog is an editor action; importing it adds no public UI.
export function choosePdfSlides(deck) {
  return new Promise(resolve => {
    const slides = deck?.slides ?? [];
    const id = `deck-pdf-selection-${++sequence}`;
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'deck-pdf-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-count`);
    dialog.innerHTML = `<form class="deck-pdf-form">
      <header class="deck-pdf-head"><h2 id="${id}-title">Download PDF</h2><button class="deck-pdf-close" type="button" data-cancel aria-label="Cancel download">×</button></header>
      <div class="deck-pdf-selection-tools"><div><button type="button" data-select="all">Select all</button><button type="button" data-select="none">Deselect all</button></div><p id="${id}-count" class="deck-pdf-count" role="status" aria-live="polite" aria-atomic="true"></p></div>
      <fieldset class="deck-pdf-slide-list"><legend class="deck-pdf-sr-only">Slides to include</legend>${slides.map((slide, index) => `<label class="deck-pdf-slide"><input type="checkbox" name="slide" value="${index}" checked><span class="deck-pdf-number">${String(index + 1).padStart(2, '0')}</span><span class="deck-pdf-slide-copy"><span class="deck-pdf-section">${escape(slide.section)}</span><span class="deck-pdf-slide-title">${escape(slide.title)}</span></span></label>`).join('')}</fieldset>
      <footer class="deck-pdf-footer"><button type="button" data-cancel>Cancel</button><button class="deck-pdf-confirm" type="submit">Download PDF</button></footer>
    </form>`;
    const form = dialog.querySelector('form');
    const checkboxes = [...dialog.querySelectorAll('input[name="slide"]')];
    const count = dialog.querySelector('.deck-pdf-count');
    const confirm = dialog.querySelector('.deck-pdf-confirm');
    let settled = false;
    let backdropPointer = false;
    const selected = () => checkboxes.flatMap((checkbox, index) => checkbox.checked ? [index] : []);
    const update = () => {
      const length = selected().length;
      count.textContent = `${length} of ${slides.length} selected`;
      confirm.disabled = length === 0;
    };
    const finish = value => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll:true });
      resolve(value);
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    dialog.addEventListener('change', update);
    dialog.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => finish(null)));
    dialog.querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => {
      checkboxes.forEach(checkbox => { checkbox.checked = button.dataset.select === 'all'; });
      update();
    }));
    const outside = event => {
      const bounds = dialog.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    dialog.addEventListener('pointerdown', event => { backdropPointer = event.target === dialog && outside(event); });
    dialog.addEventListener('click', event => {
      if (backdropPointer && event.target === dialog && outside(event)) finish(null);
      backdropPointer = false;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const indexes = selected();
      if (indexes.length) finish(indexes);
    });
    update();
    document.body.append(dialog);
    try {
      dialog.showModal();
      confirm.focus({ preventScroll:true });
    } catch {
      dialog.remove();
      resolve(null);
    }
  });
}
