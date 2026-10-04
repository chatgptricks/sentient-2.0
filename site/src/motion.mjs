import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const toggle = document.querySelector('.motion-toggle');
let userPaused = false;
try { userPaused = localStorage.getItem('sentient-motion') === 'off'; } catch {}
let paused = reduced.matches || userPaused;
let context, media, heroVisual;
const cleanups = [];
const listen = (target,event,callback,options) => { target.addEventListener(event,callback,options);cleanups.push(()=>target.removeEventListener(event,callback,options)); };

function setupMotion() {
  if(paused) return;
  context=gsap.context(()=>{
    const lines=document.querySelectorAll('h1 .title-line > span');
    if(lines.length) gsap.from(lines,{y:18,opacity:.75,duration:.8,stagger:.065,ease:'power3.out',clearProps:'all'});
    const introBlocks=document.querySelectorAll('.hero-bottom, .hero-topline, .growth-intro, .about-intro');
    if(introBlocks.length) gsap.from(introBlocks,{y:16,opacity:.75,duration:.7,delay:.12,stagger:.07,ease:'power2.out',clearProps:'all'});
    gsap.to('.scroll-progress',{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.15}});
    gsap.utils.toArray('[data-reveal], .section-heading h2, .founder-bio, .network-types article, .faq-items, .feature-case-info').forEach(element=>{
      gsap.from(element,{y:20,opacity:.72,duration:.75,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 96%',once:true},clearProps:'all'});
    });
    gsap.utils.toArray('.process-grid li, .growth-steps > div').forEach((element,index)=>{
      gsap.from(element,{y:18,opacity:.75,duration:.7,delay:(index%4)*.055,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 96%',once:true},clearProps:'all'});
    });
    gsap.utils.toArray('.case-image').forEach(element=>{
      gsap.fromTo(element.querySelector('img'),{scale:1.04,yPercent:1.5},{scale:1.02,yPercent:-1,ease:'none',scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',scrub:1}});
    });
    if(document.querySelector('.growth-bars')) gsap.from('.growth-bars i',{scaleY:.15,duration:1.1,stagger:.045,ease:'power3.out',scrollTrigger:{trigger:'.growth-bars',start:'top 95%',once:true},clearProps:'transform'});
    gsap.utils.toArray('.signal-rings').forEach(element=>{
      gsap.to(element,{rotation:165,duration:32,ease:'none',repeat:-1,scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',toggleActions:'play pause resume pause'}});
    });
    gsap.utils.toArray('.founder-photo img').forEach(element=>{
      gsap.fromTo(element,{scale:1.03,yPercent:2},{scale:1,yPercent:0,ease:'none',scrollTrigger:{trigger:element.parentElement,start:'top bottom',end:'center center',scrub:.7}});
    });
    gsap.utils.toArray('.network-orrery').forEach(element=>{
      gsap.from(element.querySelectorAll('.orrery-world'),{opacity:.72,scale:.9,duration:.9,stagger:.07,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 90%',once:true},clearProps:'opacity,scale'});
      gsap.to(element.querySelectorAll('.orrery-world'),{y:'+=8',duration:2.7,stagger:.22,ease:'sine.inOut',repeat:-1,yoyo:true,scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',toggleActions:'play pause resume pause'}});
      gsap.fromTo(element.querySelector('.orrery-core'),{rotation:-15},{rotation:8,ease:'none',scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',scrub:1.3}});
    });
  });
  media=gsap.matchMedia();
  media.add('(min-width: 901px)',()=>{
    const hero=document.querySelector('.hero');
    if(hero){
      gsap.to('.hero-title',{y:-22,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.7}});
      gsap.to('.hero>.hero-scene',{y:36,rotation:3,scale:1.025,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1}});
      gsap.to('.hero-glow',{x:-36,scale:1.05,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1.2}});
    }
    const wall=document.querySelector('.campaign-wall');
    if(wall){
      const timeline=gsap.timeline({scrollTrigger:{trigger:wall,start:'top bottom',end:'bottom top',scrub:.8}});
      // Keep the fan together and let work flow naturally into the next section.
      timeline.to('.wall-stage',{y:-12,scale:.985,rotationX:1.5,ease:'none'},0)
        .from('.wall-statement',{y:16,opacity:.78,ease:'none'},0);
    }
    gsap.utils.toArray('.growth-showcase>a').forEach((element,i)=>{
      gsap.from(element,{rotation:i%2?7:-7,y:24,duration:1,ease:'none',scrollTrigger:{trigger:'.growth-showcase',start:'top bottom',end:'center center',scrub:1}});
    });
    gsap.utils.toArray('.feature-case-art').forEach((element,i)=>{
      gsap.fromTo(element.querySelector('img'),{y:24,rotation:i%2?7:-7,rotationY:i%2?-5:5},{y:-16,rotation:i%2?4:-4,rotationY:i%2?3:-3,ease:'none',scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',scrub:1.2}});
      gsap.fromTo(element.querySelector('.feature-art-halo'),{scale:.94},{scale:1.06,ease:'none',scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',scrub:1}});
    });
  });
  if(finePointer.matches) {
    const cursor=document.querySelector('.view-cursor');
    const cursorX=gsap.quickTo(cursor,'x',{duration:.18,ease:'power3'});
    const cursorY=gsap.quickTo(cursor,'y',{duration:.18,ease:'power3'});
    listen(window,'pointermove',e=>{cursorX(e.clientX);cursorY(e.clientY);},{passive:true});
    document.querySelectorAll('.case-image,.wall-card,.growth-showcase>a,.feature-case-art').forEach(element=>{
      listen(element,'pointerenter',()=>gsap.to(cursor,{opacity:1,scale:1,duration:.2}));
      listen(element,'pointerleave',()=>gsap.to(cursor,{opacity:0,scale:.5,duration:.2}));
    });
    document.querySelectorAll('.offer').forEach(element=>{
      listen(element,'pointermove',e=>{const rect=element.getBoundingClientRect();element.style.setProperty('--mx',`${e.clientX-rect.left}px`);element.style.setProperty('--my',`${e.clientY-rect.top}px`);},{passive:true});
    });
    document.querySelectorAll('.wall-card').forEach(element=>{
      listen(element,'pointermove',e=>{const rect=element.getBoundingClientRect();gsap.to(element,{rotationY:((e.clientX-rect.left)/rect.width-.5)*8,rotationX:-((e.clientY-rect.top)/rect.height-.5)*6,duration:.45,ease:'power2.out'});});
      listen(element,'pointerleave',()=>gsap.to(element,{rotationX:0,rotationY:0,duration:.7,ease:'power3.out'}));
    });
    document.querySelectorAll('.button:not(.form-submit)').forEach(element=>{
      listen(element,'pointermove',e=>{const rect=element.getBoundingClientRect();gsap.to(element,{x:(e.clientX-rect.left-rect.width/2)*.06,y:(e.clientY-rect.top-rect.height/2)*.08,duration:.4,ease:'power3.out'});});
      listen(element,'pointerleave',()=>gsap.to(element,{x:0,y:0,duration:.5,ease:'power3.out'}));
    });
  }
  document.fonts.ready.then(()=>ScrollTrigger.refresh());
}
function updateState() {
  document.documentElement.classList.toggle('motion-paused',paused);
  toggle.hidden=false;
  toggle.disabled=reduced.matches;
  toggle.setAttribute('aria-pressed',String(paused));
  toggle.setAttribute('aria-label',reduced.matches?'Reduced motion enabled':paused?'Enable animations':'Pause animations');
  toggle.querySelector('.motion-label').textContent=reduced.matches?'Reduced motion':paused?'Motion off':'Motion on';
  toggle.querySelector('.motion-icon').textContent=paused?'▷':'Ⅱ';
  if(paused){
    context?.revert();media?.revert();context=null;media=null;
    cleanups.splice(0).forEach(fn=>fn());
    gsap.killTweensOf('.view-cursor, .wall-card, .button');
    gsap.set('.view-cursor',{opacity:0});
    gsap.set('.wall-card, .button',{clearProps:'transform'});
  }else if(!context) setupMotion();
  heroVisual?.setPaused(paused);
  document.dispatchEvent(new CustomEvent('sentient:motion',{detail:{paused}}));
}
toggle?.addEventListener('click',()=>{
  userPaused=!userPaused;
  paused=reduced.matches||userPaused;
  try{localStorage.setItem('sentient-motion',userPaused?'off':'on');}catch{}
  updateState();
  if(!paused&&!heroVisual) loadScene();
});
reduced.addEventListener('change',()=>{paused=reduced.matches||userPaused;updateState();if(!paused&&!heroVisual)loadScene();});
let sceneLoading=false;
async function loadScene(){
  const host=document.querySelector('[data-service-field], [data-scene]');
  if(!host||reduced.matches||sceneLoading)return;
  sceneLoading=true;
  try {
    if(host.dataset.serviceField === 'growth') {
      const {createPointLogo}=await import('./point-logo.mjs');
      heroVisual=createPointLogo(host,paused);
    } else if(host.hasAttribute('data-service-field')) {
      const {createViralCrowd}=await import('./viral-crowd.mjs');
      heroVisual=createViralCrowd(host,paused);
    } else {
      const {createScene}=await import('./scene.mjs');
      heroVisual=createScene(host,paused);
    }
  } catch { host.classList.add(host.hasAttribute('data-service-field')?'field-unavailable':'scene-unavailable'); }
}
updateState();
if(!paused)loadScene();
window.addEventListener('pagehide',()=>heroVisual?.setPaused(true));
window.addEventListener('pageshow',()=>heroVisual?.setPaused(paused));
