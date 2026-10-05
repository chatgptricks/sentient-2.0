const script = document.querySelector('script[src$="/comments.js"]');
const base = new URL('.', script.src);
const page = document.body.dataset.page;
const ui = document.createElement('div');
ui.className = 'review-ui';
ui.innerHTML = `<div class="review-toolbar"><span class="review-hint">Proposal · Right-click to leave a note</span><button type="button" data-review="place">＋ Add note</button><button type="button" data-review="list" aria-expanded="false">Notes <span class="review-count">0</span></button><button type="button" data-review="hide" aria-pressed="false" aria-label="Hide note pins">◉</button></div><p class="review-toast" role="status" hidden></p><div class="review-pins"></div><dialog class="review-compose" aria-labelledby="review-title"><form><div class="review-heading"><span>PROPOSAL FEEDBACK</span><button type="button" data-review="close" aria-label="Close note">×</button></div><h2 id="review-title">Leave a little note.</h2><p class="review-context"></p><label>Your name<input name="author" required maxlength="80" autocomplete="name" placeholder="Who’s proposing this?"></label><label>Suggestion or change<textarea name="message" required maxlength="2000" rows="4" placeholder="What would you change here?"></textarea></label><p class="review-disclosure">Your name and note will be visible to everyone who opens this proposal.</p><p class="review-error" role="alert"></p><button class="review-save" type="submit">Post note</button></form></dialog><dialog class="review-detail" aria-labelledby="review-detail-title"><div class="review-heading"><span id="review-detail-title">PROPOSAL NOTE</span><button type="button" data-review="close" aria-label="Close note">×</button></div><p class="review-note-message"></p><strong class="review-note-author"></strong><time class="review-note-date"></time><p class="review-note-context"></p></dialog><dialog class="review-list" aria-labelledby="review-list-title"><div class="review-heading"><h2 id="review-list-title">Notes on this page</h2><button type="button" data-review="close" aria-label="Close notes">×</button></div><p class="review-list-status" role="status">Loading shared notes…</p><div class="review-list-items"></div></dialog>`;
document.body.append(ui);
const $ = selector => ui.querySelector(selector);
const compose = $('.review-compose');
const detail = $('.review-detail');
const list = $('.review-list');
const form = compose.querySelector('form');
let notes = [], endpoint, pending, placing = false, hidden = false, loading = false, previousFocus;
const memory = { get(key) { try {return localStorage.getItem(key);} catch {return null;} }, set(key,value) {try {localStorage.setItem(key,value);} catch { /* Names are optional browser memory. */ }} };
function toast(message) { $('.review-toast').textContent = message; $('.review-toast').hidden = false; }
function open(dialog) { previousFocus = document.activeElement; dialog.showModal(); }
function close(dialog) { dialog.close(); previousFocus?.focus?.(); }
ui.querySelectorAll('[data-review="close"]').forEach(button => button.addEventListener('click', () => close(button.closest('dialog'))));
for (const dialog of [compose, detail, list]) {
  dialog.addEventListener('click', event => { if (event.target === dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) close(dialog);} });
  dialog.addEventListener('close', () => {if(dialog===list) $('[data-review="list"]').setAttribute('aria-expanded','false');});
}
function selectorFor(element) {
  const parts = [];
  while (element && element !== document.body) {
    if (element.id) { parts.unshift(`#${CSS.escape(element.id)}`); break; }
    const siblings = [...element.parentElement.children].filter(e=>e.tagName===element.tagName);
    parts.unshift(`${element.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(element)+1})`);
    element=element.parentElement;
  }
  return parts.join(' > ') || 'body';
}
function anchorAt(target, x, y) {
  // Use content elements rather than moving canvas/animation descendants.
  let element = target.closest('h1,h2,h3,p,li,a,button,label,img,section,header,footer,main') || document.body;
  if (element.matches('section,header,footer,main,body')) {
    const candidates = [...element.querySelectorAll('h1,h2,h3,p,li,a,button,label,img')].filter(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && x>=r.left && x<=r.right && y>=r.top && y<=r.bottom; });
    candidates.sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height;});
    element=candidates[0] || element;
  }
  const rect = element.getBoundingClientRect();
  const clamp = value => Math.max(0,Math.min(1,value));
  return {selector:selectorFor(element),quote:(element.innerText || element.getAttribute('alt') || '').replace(/\s+/g,' ').trim().slice(0,200),x:clamp((x-rect.left)/Math.max(1,rect.width)),y:clamp((y-rect.top)/Math.max(1,rect.height)),pageY:clamp((y+scrollY)/document.documentElement.scrollHeight)};
}
function startNote(target,x,y) {
  placing = false; document.body.classList.remove('review-placing'); $('.review-toast').hidden = true;
  pending = {id:crypto.randomUUID(),page,anchor:anchorAt(target,x,y)};
  $('.review-context').textContent = pending.anchor.quote ? `On “${pending.anchor.quote.slice(0,100)}”` : 'At this spot on the page';
  form.reset(); form.elements.author.value = memory.get('sentient-review-author') || '';
  $('.review-error').textContent = '';
  open(compose); (form.elements.author.value ? form.elements.message : form.elements.author).focus();
}
document.addEventListener('contextmenu', event => {
  if (event.shiftKey || event.target.closest('.review-ui') || document.querySelector('dialog[open]')) return;
  event.preventDefault(); startNote(event.target,event.clientX,event.clientY);
});
$('[data-review="place"]').addEventListener('click', () => {
  placing = !placing; document.body.classList.toggle('review-placing',placing);
  if(placing) toast('Click or tap anywhere to place a note. Escape to cancel.'); else $('.review-toast').hidden=true;
});
document.addEventListener('click', event => {
  if(!placing || event.target.closest('.review-ui')) return;
  event.preventDefault(); event.stopImmediatePropagation(); startNote(event.target,event.clientX,event.clientY);
},true);
document.addEventListener('keydown', event => {
  if(event.key==='Escape') {placing=false;document.body.classList.remove('review-placing');$('.review-toast').hidden=true;}
});
$('[data-review="hide"]').addEventListener('click', () => {
  hidden=!hidden; $('.review-pins').hidden=hidden;
  $('[data-review="hide"]').setAttribute('aria-pressed',String(hidden));
  $('[data-review="hide"]').setAttribute('aria-label',hidden?'Show note pins':'Hide note pins');
});
function position(note) {
  let element;
  try {element=document.querySelector(note.anchor.selector);} catch { /* Old selector: page position fallback. */ }
  if(element && note.anchor.quote && !(element.innerText || element.getAttribute('alt') || '').replace(/\s+/g,' ').trim().startsWith(note.anchor.quote)) element=null;
  if(!element && note.anchor.quote) element=[...document.querySelectorAll('h1,h2,h3,p,li,a,label')].find(el=>(el.innerText||'').replace(/\s+/g,' ').trim().startsWith(note.anchor.quote));
  const r=element?.getBoundingClientRect();
  if (r && (r.width===0 || r.height===0)) return null;
  return r ? {x:r.left+r.width*note.anchor.x,y:r.top+scrollY+r.height*note.anchor.y} : {x:innerWidth/2,y:document.documentElement.scrollHeight*note.anchor.pageY};
}
function showNote(note) {
  $('.review-note-message').textContent=note.message;
  $('.review-note-author').textContent=note.author;
  $('.review-note-date').textContent=new Date(note.createdAt).toLocaleString();
  $('.review-note-date').dateTime=note.createdAt;
  $('.review-note-context').textContent=note.anchor.quote ? `On “${note.anchor.quote.slice(0,120)}”` : '';
  open(detail);
}
function render() {
  $('.review-count').textContent=notes.length;
  $('.review-pins').replaceChildren(); $('.review-list-items').replaceChildren();
  notes.forEach((note,index)=>{
    const pin=document.createElement('button');pin.type='button';pin.className='review-pin';pin.textContent=index+1;pin.dataset.noteId=note.id;pin.setAttribute('aria-label',`Note ${index+1} by ${note.author}: ${note.message.slice(0,80)}`);pin.addEventListener('click',()=>showNote(note));$('.review-pins').append(pin);
    const item=document.createElement('button');item.type='button';item.className='review-list-item';
    const author=document.createElement('strong');author.textContent=`${index+1}. ${note.author}`;
    const message=document.createElement('span');message.textContent=note.message;
    item.append(author,message);item.addEventListener('click',()=>{close(list);const p=position(note);if(p)window.scrollTo({top:Math.max(0,p.y-innerHeight/3),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});showNote(note);});$('.review-list-items').append(item);
  });
  $('.review-list-status').textContent=notes.length?'Shared with everyone · Updates automatically':'No notes yet. Right-click anywhere or use Add note.';
  layoutPins();
}
function layoutPins() {
  const occupied=[];
  ui.querySelectorAll('.review-pin').forEach((pin,index)=>{
    const p=position(notes[index]);pin.hidden=!p;if(!p)return;
    let x=Math.max(18,Math.min(innerWidth-22,p.x)),y=Math.max(18,p.y);
    while(occupied.some(q=>Math.abs(q.x-x)<30&&Math.abs(q.y-y)<30)) {x+=32;if(x>innerWidth-22){x=18;y+=34;}}
    occupied.push({x,y});pin.style.left=`${x}px`;pin.style.top=`${y}px`;
  });
}
let frame;
const scheduleLayout=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(layoutPins);};
window.addEventListener('resize',scheduleLayout);window.addEventListener('scroll',scheduleLayout,{passive:true});
new ResizeObserver(scheduleLayout).observe(document.querySelector('main'));
document.addEventListener('load',scheduleLayout,true);document.fonts.ready.then(scheduleLayout);
async function request(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error || 'Unable to connect. Please try again.');return data;
}
async function refresh() {
  if(!endpoint || loading || document.hidden) return;
  loading=true;
  try {const data=await request(`${endpoint}/comments?page=${encodeURIComponent(page)}`);notes=data.comments;render();}
  catch { $('.review-list-status').textContent='Unable to load shared notes. We’ll retry automatically.'; }
  finally {loading=false;}
}
$('[data-review="list"]').addEventListener('click',()=>{open(list);$('[data-review="list"]').setAttribute('aria-expanded','true');refresh();});
form.addEventListener('submit', async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const save=$('.review-save');save.disabled=true;save.textContent='Posting…';$('.review-error').textContent='';
  try {
    if(!endpoint)throw new Error('Shared comments are not connected yet. Please try again shortly.');
    const author=form.elements.author.value.trim(),message=form.elements.message.value.trim();
    if(!author||!message)throw new Error('Please enter your name and suggestion.');
    const data=await request(`${endpoint}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...pending,author,message})});
    memory.set('sentient-review-author',author);
    if(!notes.some(note=>note.id===data.comment.id))notes.push(data.comment);render();close(compose);toast('Note posted. Everyone viewing this proposal can see it.');setTimeout(()=>{$('.review-toast').hidden=true;},5000);
  } catch(error) {$('.review-error').textContent=error.name==='TimeoutError'?'Connection timed out. Your draft is still here; try posting again.':error.message;}
  finally {save.disabled=false;save.textContent='Post note';}
});
try {
  const config=await request(new URL('comments-config.json',base));
  endpoint=['localhost','127.0.0.1'].includes(location.hostname)?'http://localhost:8787':config.apiUrl;
  if(!endpoint)throw new Error('No comments API configured.');
  await refresh();setInterval(refresh,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
} catch {$('.review-list-status').textContent='Shared comments are not connected yet.';}
