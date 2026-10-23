// Capture the presentation's live screen layout. No print stylesheet or second renderer.
const activeExports = new WeakSet();
const excluded = '.deck-controls,.deck-edit-toolbar,.deck-picker,.deck-overview,.deck-access-dialog,.deck-announcement,.deck-title-measure,.studio-outline,[data-pdf-exclude]';

const nextFrame = view => new Promise(resolve => view.requestAnimationFrame(resolve));
const settle = async view => { await nextFrame(view); await nextFrame(view); };
const visibleSlide = root => root.querySelector('.deck-slide:not([hidden])');

async function waitForImage(image) {
  if (!image.currentSrc && !image.getAttribute('src')) return;
  const loading = image.getAttribute('loading');
  image.loading = 'eager';
  try {
    if (!image.complete) {
      await new Promise((resolve, reject) => {
        const finish = error => {
          clearTimeout(timer);
          image.removeEventListener('load', loaded);
          image.removeEventListener('error', failed);
          error ? reject(error) : resolve();
        };
        const loaded = () => finish();
        const failed = () => finish(new Error('An image could not be loaded for the PDF.'));
        const timer = setTimeout(() => finish(new Error('An image took too long to load for the PDF.')), 15000);
        image.addEventListener('load', loaded, { once:true });
        image.addEventListener('error', failed, { once:true });
      });
    }
    if (!image.naturalWidth) throw new Error('An image could not be loaded for the PDF.');
    // Some already-rendered SVGs reject decode despite having valid dimensions.
    await image.decode?.().catch(() => {});
  } finally {
    if (loading === null) image.removeAttribute('loading');
    else image.setAttribute('loading', loading);
  }
}

const waitForImages = root => Promise.all([...root.querySelectorAll('img')]
  .filter(image => !image.closest(excluded) && !image.closest('.deck-slide[hidden]'))
  .map(waitForImage));

const pdfName = (filename, deck) => {
  const name = String(filename || deck.slug || deck.title || 'Sentient deck')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'Sentient deck';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
};

/** Freeze a freshly rendered WebGL cover as an image for the DOM capture. */
export function snapshotCanvas(root, scene) {
  const canvas = root.querySelector('.deck-cover-emblem canvas');
  if (!canvas || typeof scene?.snapshot !== 'function') return () => {};
  const dataUrl = scene.snapshot();
  if (!dataUrl || dataUrl === 'data:,') throw new Error('The cover image could not be captured.');
  const image = root.ownerDocument.createElement('img');
  image.src = dataUrl;
  image.width = canvas.width;
  image.height = canvas.height;
  image.setAttribute('aria-hidden', 'true');
  const style = root.ownerDocument.defaultView.getComputedStyle(canvas);
  for (const property of Array.from(style)) image.style.setProperty(property, style.getPropertyValue(property), style.getPropertyPriority(property));
  canvas.replaceWith(image);
  return () => { if (image.parentNode) image.replaceWith(canvas); };
}

/**
 * onProgress receives {index,total,phase}; beforeCapture({root,slide,index}) may
 * return a cleanup function. showSlide(index) must keep the same root mounted.
 * Set download:false to return the generated Blob without starting a download.
 */
export async function exportDeckPdf({ root, deck, current=0, showSlide, onProgress, filename, beforeCapture, download=true, slideIndices }) {
  if (!root?.isConnected || !deck?.slides?.length || typeof showSlide !== 'function') throw new Error('The presentation is not ready for export.');
  if (activeExports.has(root)) throw new Error('This presentation is already being exported.');
  activeExports.add(root);
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const indices = slideIndices === undefined ? deck.slides.map((_, i) => i)
    : [...new Set(slideIndices)].filter(i => Number.isInteger(i) && i >= 0 && i < deck.slides.length).sort((a, b) => a - b);
  if (!indices.length) { activeExports.delete(root); throw new Error('Choose at least one slide.'); }
  const total = indices.length;
  const original = Math.max(0, Math.min(deck.slides.length - 1, Number.isInteger(current) ? current : 0));
  const report = (index, phase) => {
    try { onProgress?.({ index, total, phase }); } catch { /* Progress UI does not affect the document. */ }
  };
  const marker = `deck-pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const previousMarker = root.getAttribute('data-deck-pdf-capture');
  const captureStyle = doc.createElement('style');
  captureStyle.textContent = `[data-deck-pdf-capture="${marker}"] *,[data-deck-pdf-capture="${marker}"] *::before,[data-deck-pdf-capture="${marker}"] *::after{outline:none!important;caret-color:transparent!important}`;
  root.setAttribute('data-deck-pdf-capture', marker);
  doc.head.append(captureStyle);
  let failure;
  let blob;
  try {
    report(0, 'preparing');
    const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
    await doc.fonts?.ready;
    const fontEmbedCSS = await getFontEmbedCSS(root, { preferredFontFormat:'woff2' });
    let pdf;
    for (let position = 0; position < total; position++) {
      const index = indices[position];
      report(position, 'preparing');
      await showSlide(index);
      if (!root.isConnected) throw new Error('The presentation changed during export.');
      await doc.fonts?.ready;
      await waitForImages(root);
      await settle(view);
      const slide = visibleSlide(root);
      if (!slide) throw new Error('A slide could not be displayed for export.');
      let cleanup;
      let canvas;
      try {
        cleanup = await beforeCapture?.({ root, slide, index });
        await waitForImages(root);
        report(position, 'capturing');
        const bounds = root.getBoundingClientRect();
        const width = Math.round(bounds.width);
        const height = Math.round(bounds.height);
        if (width < 1 || height < 1) throw new Error('The presentation window is not visible.');
        // Keep text crisp without exceeding common browser canvas memory limits.
        const pixelRatio = Math.min(2, 6000 / Math.max(width, height), Math.sqrt(20000000 / (width * height)));
        canvas = await toCanvas(root, {
          width, height, canvasWidth:width, canvasHeight:height, pixelRatio,
          fontEmbedCSS, preferredFontFormat:'woff2',
          filter:node => node.nodeType !== 1 || (!node.matches(excluded) && !node.matches('.deck-slide[hidden]')),
          style:{ margin:'0', left:'0', top:'0', right:'auto', bottom:'auto', transform:'none', transformOrigin:'0 0' },
        });
        const pageSize = [width * .75, height * .75];
        const orientation = width >= height ? 'landscape' : 'portrait';
        if (!pdf) {
          pdf = new jsPDF({ unit:'pt', format:pageSize, orientation, compress:true, precision:12 });
          pdf.setProperties({ title:String(deck.title || 'Sentient deck'), creator:'Sentient' });
        } else pdf.addPage(pageSize, orientation);
        pdf.addImage(canvas.toDataURL('image/jpeg', .97), 'JPEG', 0, 0, pageSize[0], pageSize[1], `slide-${index}`, 'FAST');
      } finally {
        if (canvas) { canvas.width = 1; canvas.height = 1; }
        if (typeof cleanup === 'function') await cleanup();
      }
    }
    blob = pdf.output('blob');
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    report(original, 'restoring');
    try { await showSlide(original); }
    catch (error) { if (!failure) throw error; }
    finally {
      captureStyle.remove();
      if (previousMarker === null) root.removeAttribute('data-deck-pdf-capture');
      else root.setAttribute('data-deck-pdf-capture', previousMarker);
      activeExports.delete(root);
    }
  }
  if (download) {
    const url = view.URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = pdfName(filename, deck);
    link.hidden = true;
    doc.body.append(link);
    try { link.click(); }
    finally { link.remove(); view.setTimeout(() => view.URL.revokeObjectURL(url), 60000); }
  }
  report(total, 'done');
  return blob;
}
