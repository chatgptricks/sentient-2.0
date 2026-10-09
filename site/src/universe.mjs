import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import sentientIcon from '../public/assets/sentient-symbol.svg';
gsap.registerPlugin(Flip);
const dataElement=document.getElementById('universe-data');
if(dataElement) initUniverse(JSON.parse(dataElement.textContent));

function initUniverse(accounts){
 const $=selector=>document.querySelector(selector);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const host=$('#universe-canvas'),nodeLayer=$('#universe-nodes'),panel=$('.account-panel'),directory=$('#universe-directory'),listToggle=$('.universe-list-toggle');
 let lastOpener=null,requestRender=()=>{},homeDistance=30;
 let filter='all',query='',selected=null,renderer,scene,camera,controls,frame=0,elapsed=0,last=0,disposed=false;
 const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=document.documentElement.classList.contains('motion-paused')||motionPreference.matches;
 let panelOpen=!panel.hidden,directoryOpen=!directory.hidden,panelTween,directoryTween,filterFlip,filterHeightTween,cameraTimeline;
 const directoryItems=[...directory.querySelectorAll('.directory-account')],directoryResults=directory.querySelector('.directory-results');
 let visited=new Set();try{visited=new Set(JSON.parse(localStorage.getItem('sentient-universe-explored')||'[]').filter(h=>accounts.some(a=>a.handle===h)));}catch{}
 const accountMap=new Map(accounts.map(a=>[a.handle,a]));
 const nodes=[];const resources=[];
 const isMatch=a=>(filter==='all'||a.relationship===filter)&&`${a.handle} ${a.name||''} ${a.topic||''}`.toLowerCase().includes(query);
 const finishFilterMotion=()=>{
  Flip.killFlipsOf(directoryItems,true);filterFlip=null;
  gsap.killTweensOf(directoryItems);
  filterHeightTween?.kill();filterHeightTween=null;
  gsap.set(directoryItems,{clearProps:'transform,opacity'});
  gsap.set(directoryResults,{clearProps:'height,overflow'});
 };
 const finishUiMotion=()=>{
  panelTween?.progress(1).kill();directoryTween?.progress(1).kill();panelTween=directoryTween=null;
  finishFilterMotion();
  gsap.set([panel,directory],{clearProps:'opacity,transform'});
  panel.hidden=!panelOpen;panel.inert=!panelOpen;directory.hidden=!directoryOpen;directory.inert=!directoryOpen;
 };
 const showSurface=(element,open,tween,animate=true)=>{
  tween?.kill();
  element.inert=!open;open?element.removeAttribute('aria-hidden'):element.setAttribute('aria-hidden','true');
  if(paused||!animate){element.hidden=!open;gsap.set(element,{clearProps:'opacity,transform'});return null;}
  if(open){
   element.hidden=false;
   return gsap.fromTo(element,{opacity:0,y:10},{opacity:1,y:0,duration:.24,ease:'power2.out',clearProps:'opacity,transform'});
  }
  if(element.hidden)return null;
  return gsap.to(element,{opacity:0,y:6,duration:.2,ease:'power2.in',onComplete:()=>{element.hidden=true;gsap.set(element,{clearProps:'opacity,transform'});}});
 };
 const setDirectory=(open,animate=true)=>{
  const changed=directoryOpen!==open;directoryOpen=open;
  listToggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('universe-directory-open',open);
  if(changed||!animate)directoryTween=showSurface(directory,open,directoryTween,animate);
 };
 const stopCameraMotion=()=>{cameraTimeline?.kill();cameraTimeline=null;if(camera&&controls)gsap.killTweensOf([camera.position,controls.target]);};
 const moveCamera=(target,position,duration,ease='power3.inOut')=>{
  if(!camera||!controls)return;
  stopCameraMotion();
  if(paused){controls.target.copy(target);camera.position.copy(position);requestRender();return;}
  cameraTimeline=gsap.timeline({defaults:{duration,ease},onUpdate:()=>requestRender()})
   .to(controls.target,{x:target.x,y:target.y,z:target.z},0)
   .to(camera.position,{x:position.x,y:position.y,z:position.z},0);
 };
 const reflectSelection=()=>{
  document.body.classList.toggle('universe-focused',Boolean(selected));
  nodes.forEach(node=>{const active=node.account.handle===selected;node.element.classList.toggle('is-selected',active);node.element.setAttribute('aria-pressed',String(active));});
  requestRender();
 };
 const clearSelection=()=>{if(panelOpen){panelOpen=false;panelTween=showSurface(panel,false,panelTween);}selected=null;reflectSelection();};
 const updateProgress=()=>{
  $('#explored-count').textContent=`${visited.size} / ${accounts.length}`;
  $('#explored-bar').style.width=`${visited.size/accounts.length*100}%`;
  $('#explored-caption').textContent=visited.size===accounts.length?'Universe explored. Let’s make something move.':'Every account is a new perspective.';
  document.querySelectorAll('[data-account]').forEach(el=>{const seen=visited.has(el.dataset.account);el.classList.toggle('is-explored',seen);const check=el.querySelector('.explored-check');if(check)check.hidden=!seen;});
 };
 const selectAccount=(handle,opener)=>{
  const account=accountMap.get(handle);if(!account)return;
  if(opener&&!panel.contains(opener))lastOpener=opener;
  else if(!panel.contains(document.activeElement))lastOpener=document.activeElement?.matches('button, a[href], input, [tabindex]')?document.activeElement:listToggle;
  selected=handle;visited.add(handle);try{localStorage.setItem('sentient-universe-explored',JSON.stringify([...visited]));}catch{}
  updateProgress();
  const date=account.followersAsOf;
  const followers=Number.isFinite(account.followerCount)&&date?`<div class="account-audience"><strong>${Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(account.followerCount)}</strong><span>followers<small>Snapshot · ${escape(date)}</small></span></div>`:'';
  $('#account-details').innerHTML=`<img class="account-portrait" src="${escape(account.avatar)}" alt="" width="74" height="74"><span class="account-relationship ${account.relationship}">${account.relationship==='owned'?'SENTIENT OWNED':'CREATOR PARTNER'}</span><h2 tabindex="-1">@${escape(account.handle)}</h2><p class="account-name">${escape(account.name||'')}</p>${account.topic?`<p class="account-topic">${escape(account.topic)}</p>`:''}${followers}<a class="button" href="${escape(account.profileUrl)}" target="_blank" rel="noopener noreferrer">Visit Instagram</a>`;
  panelOpen=true;panelTween=showSurface(panel,true,panelTween);
  setDirectory(false);
  reflectSelection();
  const node=nodes.find(n=>n.account.handle===handle);
  if(controls&&node){
   controls.autoRotate=false;
   const point=node.position;
   moveCamera(point,point.clone().add(new THREE.Vector3(.7,.4,13.5)),1.25);
  }
  requestRender();
  $('#account-details h2').focus({preventScroll:true});
 };
 const updateFilter=()=>{
  finishFilterMotion();
  const animate=!paused&&directoryOpen&&!directory.hidden;
  const beforeHeight=animate?directoryResults.getBoundingClientRect().height:0;
  const state=animate?Flip.getState(directoryItems):null;
  let count=0;directoryItems.forEach(el=>{el.hidden=!isMatch(accountMap.get(el.dataset.account));if(!el.hidden)count++;});
  $('#directory-count').textContent=`${count} account${count===1?'':'s'}`;
  $('.directory-empty').hidden=count!==0;
  if(state){
   const afterHeight=directoryResults.getBoundingClientRect().height;
   // Flip only the list rows; the canvas renderer owns every 3D node transform.
   filterFlip=Flip.from(state,{duration:.28,ease:'power2.out',simple:true,prune:true,
    onEnter:elements=>gsap.fromTo(elements,{opacity:0,y:6},{opacity:1,y:0,duration:.22,clearProps:'opacity,transform'})});
   if(beforeHeight!==afterHeight)filterHeightTween=gsap.fromTo(directoryResults,{height:beforeHeight,overflow:'hidden'},{height:afterHeight,duration:.28,ease:'power2.out',clearProps:'height,overflow'});
  }
  $('#surprise-account').disabled=count===0;$('.next-account').disabled=count===0;
  nodes.forEach(node=>{node.match=isMatch(node.account);node.line.visible=node.match;node.element.hidden=!node.match;});
  if(selected&&!isMatch(accountMap.get(selected)))clearSelection();
 };
 const discoverNext=event=>{const matches=accounts.filter(isMatch);const unseen=matches.filter(a=>!visited.has(a.handle));const pool=unseen.length?unseen:matches;if(pool.length)selectAccount(pool[Math.floor(Math.random()*pool.length)].handle,event?.currentTarget);};
 const resetView=()=>{
  clearSelection();
  if(!controls)return;
  moveCamera(new THREE.Vector3(),new THREE.Vector3(0,1.5,homeDistance),1.1);
  controls.autoRotate=!paused;requestRender();
 };
 const closeDetails=()=>{clearSelection();if(controls){controls.autoRotate=false;stopCameraMotion();}if(lastOpener?.classList.contains('directory-account'))setDirectory(true);if(lastOpener?.isConnected&&!lastOpener.closest('[hidden], [inert]')&&!panel.contains(lastOpener))lastOpener.focus({preventScroll:true});else listToggle.focus();};
 document.querySelectorAll('.directory-account').forEach(button=>button.addEventListener('click',()=>selectAccount(button.dataset.account,button)));
 $('.panel-close').addEventListener('click',closeDetails);
 listToggle.addEventListener('click',()=>{clearSelection();setDirectory(!directoryOpen);});
 $('#account-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();clearSelection();updateFilter();setDirectory(true);requestRender();});
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateFilter();resetView();}));
 $('#surprise-account').addEventListener('click',discoverNext);$('.next-account').addEventListener('click',discoverNext);$('#reset-universe').addEventListener('click',resetView);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(panelOpen)closeDetails();else if(directoryOpen){setDirectory(false);listToggle.focus();}}});
 const syncMotion=()=>{
  paused=document.documentElement.classList.contains('motion-paused')||motionPreference.matches;
  if(paused){finishUiMotion();cameraTimeline?.progress(1);stopCameraMotion();}
  if(controls){controls.autoRotate=!paused&&!selected;controls.enableDamping=!paused;}
  requestRender();
 };
 document.addEventListener('sentient:motion',syncMotion);motionPreference.addEventListener('change',syncMotion);
 window.addEventListener('pagehide',event=>{finishUiMotion();stopCameraMotion();if(!event.persisted){document.removeEventListener('sentient:motion',syncMotion);motionPreference.removeEventListener('change',syncMotion);}});
 updateProgress();
 try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x070b10,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x070b10,.014);
  camera=new THREE.PerspectiveCamera(49,1,.1,150);camera.position.set(0,1.5,30);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=6;controls.maxDistance=55;controls.autoRotate=!paused;controls.autoRotateSpeed=.2;controls.rotateSpeed=.45;controls.zoomSpeed=.6;controls.maxPolarAngle=Math.PI*.8;controls.minPolarAngle=Math.PI*.16;
  controls.addEventListener('start',()=>{controls.autoRotate=false;stopCameraMotion();});
  const starCanvas=document.createElement('canvas');starCanvas.width=32;starCanvas.height=32;
  const starContext=starCanvas.getContext('2d');
  const starGradient=starContext.createRadialGradient(16,16,0,16,16,16);starGradient.addColorStop(0,'#ffffff');starGradient.addColorStop(.18,'#ffffffcc');starGradient.addColorStop(1,'#ffffff00');starContext.fillStyle=starGradient;starContext.fillRect(0,0,32,32);
  const starTexture=new THREE.CanvasTexture(starCanvas);resources.push(starTexture);
  const starPositions=[];for(let i=0;i<900;i++){const t=i*2.39996,r=22+(i*7.31)%49;starPositions.push(Math.cos(t)*r,Math.sin(t*1.73)*r,Math.sin(t)*r-19);}
  const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const starsMaterial=new THREE.PointsMaterial({color:0xc8ded9,size:.13,map:starTexture,transparent:true,opacity:.68,depthWrite:false,sizeAttenuation:true});const stars=new THREE.Points(starsGeometry,starsMaterial);scene.add(stars);resources.push(starsGeometry,starsMaterial);
  const central=new THREE.Group();
  const shapes=new SVGLoader().parse(sentientIcon).paths.flatMap(p=>p.toShapes());
  const brandGeometry=new THREE.ExtrudeGeometry(shapes,{depth:3.4,bevelEnabled:true,bevelSize:.35,bevelThickness:.5,bevelSegments:4,curveSegments:18});brandGeometry.center();brandGeometry.rotateX(Math.PI);brandGeometry.scale(.075,.075,.075);
  const brandMaterial=new THREE.MeshStandardMaterial({color:0xcfff04,metalness:.55,roughness:.27,emissive:0x3c5800,emissiveIntensity:.4});const brand=new THREE.Mesh(brandGeometry,brandMaterial);central.add(brand);scene.add(central);resources.push(brandGeometry,brandMaterial);
  scene.add(new THREE.AmbientLight(0xc5e7dd,2));const light=new THREE.DirectionalLight(0xffffff,5);light.position.set(-3,7,10);scene.add(light);
  const orbitalTracks=new THREE.Group();scene.add(orbitalTracks);
  for(const [index,radius] of [6.3,10.4,14.2].entries()){
   const curve=new THREE.EllipseCurve(0,0,radius,radius*.72,.18+index*.45,Math.PI*1.83+index*.45,false,0);
   const ringGeometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(150));const ringMaterial=new THREE.LineBasicMaterial({color:index===2?0x7abcc7:0x91a752,transparent:true,opacity:index===2?.14:.11,depthWrite:false});const ring=new THREE.Line(ringGeometry,ringMaterial);ring.rotation.x=.39;ring.rotation.z=-.12;orbitalTracks.add(ring);resources.push(ringGeometry,ringMaterial);
  }
  // Explicit owned/partner clusters; positions have no follower-count meaning.
  accounts.forEach((account,index)=>{
   const owned=account.relationship==='owned';const ordinal=accounts.slice(0,index).filter(a=>a.relationship===account.relationship).length;
   const clusterCount=accounts.filter(a=>a.relationship===account.relationship).length;
   const angle=ordinal*2.39996+(owned?0:1.2);const radius=owned?5.2+Math.sqrt(ordinal/Math.max(1,clusterCount-1))*7.6:14.1;
   // Owned accounts form the inner constellation; partners occupy its outer orbit.
   // Perspective depth is compositional, never a measure of audience or importance.
   const position=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius*.63,Math.sin(angle)*radius*.32+Math.cos(ordinal*1.7)*2.4);
   const midpoint=position.clone().multiplyScalar(.52).add(new THREE.Vector3(0,1.3,2.6));
   const connection=new THREE.QuadraticBezierCurve3(new THREE.Vector3(),midpoint,position);
   const lineGeometry=new THREE.BufferGeometry().setFromPoints(connection.getPoints(40));const lineMaterial=new THREE.LineBasicMaterial({color:owned?0xb0cf59:0x81d8e4,transparent:true,opacity:owned?.065:.11,depthWrite:false});const line=new THREE.Line(lineGeometry,lineMaterial);scene.add(line);resources.push(lineGeometry,lineMaterial);
   const element=document.createElement('button');element.type='button';element.className=`universe-node ${owned?'owned':'partner'}`;element.dataset.account=account.handle;element.setAttribute('aria-label',`Explore @${account.handle}, ${owned?'Sentient owned':'creator partner'}`);element.setAttribute('aria-pressed','false');element.innerHTML=`<span class="node-orbit"><img src="${escape(account.avatar)}" alt="" width="58" height="58"><i class="node-discovered" aria-hidden="true">✓</i></span><span class="node-handle">@${escape(account.handle)}</span>`;element.addEventListener('pointerenter',()=>{controls.autoRotate=false;});element.addEventListener('focus',()=>{controls.autoRotate=false;});element.addEventListener('click',()=>selectAccount(account.handle,element));nodeLayer.appendChild(element);
   nodes.push({account,position,basePosition:position.clone(),clusterIndex:ordinal,clusterCount,element,line,match:true});
  });
  let mobileLayout,mobileAspect;
  const projected=new THREE.Vector3();
  const render=()=>{
   const width=host.clientWidth,height=host.clientHeight;
   controls.update();camera.updateMatrixWorld();
   nodes.forEach(node=>{
    node.line.material.opacity=selected?(node.account.handle===selected?.65:.016):(node.account.relationship==='owned'?.065:.11);
    projected.copy(node.position).project(camera);
    const show=node.match&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.18&&Math.abs(projected.y)<1.18;
    node.element.hidden=!show;node.element.tabIndex=show&&Math.abs(projected.x)<.96&&Math.abs(projected.y)<.96?0:-1;if(!show)return;
    const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;const distance=camera.position.distanceTo(node.position);const scale=mobileLayout?THREE.MathUtils.clamp(25/distance,.8,node.account.handle===selected?1.25:1.05):THREE.MathUtils.clamp(28/distance,.62,1.28);
    node.element.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
    node.element.style.setProperty('--node-depth',String(THREE.MathUtils.clamp(1.22-distance*.014,.52,1)));
    node.element.style.zIndex=String(node.account.handle===selected?200:Math.round(100-distance));
   });
   renderer.render(scene,camera);
  };
  const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   const phone=matchMedia('(max-width:650px)').matches;
   const aspect=w/h;
   if(phone!==mobileLayout||(phone&&Math.abs(aspect-mobileAspect)>.005)){
    mobileLayout=phone;homeDistance=phone?32:30;
    mobileAspect=aspect;
    const layoutScale=new THREE.Vector3(phone?.78*aspect/.91:1,phone?1.1:1,phone?.55:1);
    nodes.forEach(node=>{
     if(phone){
      const owned=node.account.relationship==='owned';
      const angle=owned?node.clusterIndex*2.39996:node.clusterIndex*Math.PI*2/node.clusterCount+.7;
      const radius=owned?Math.sqrt(3.5**2+(13.8**2-3.5**2)*(node.clusterIndex+.5)/node.clusterCount):15;
      // Fit the account constellation into the viewport between the phone's controls.
      node.position.set(Math.cos(angle)*radius*layoutScale.x,Math.sin(angle)*radius*.8,Math.sin(angle)*radius*.12);
     }else node.position.copy(node.basePosition);
     const midpoint=node.position.clone().multiplyScalar(.52).add(new THREE.Vector3(0,1.3*layoutScale.y,2.6*layoutScale.z));
     node.line.geometry.setFromPoints(new THREE.QuadraticBezierCurve3(new THREE.Vector3(),midpoint,node.position).getPoints(40));
     node.line.geometry.computeBoundingSphere();
    });
    orbitalTracks.scale.copy(layoutScale);
    stopCameraMotion();
    const chosen=nodes.find(node=>node.account.handle===selected);
    if(chosen){controls.target.copy(chosen.position);camera.position.copy(chosen.position).add(new THREE.Vector3(.7,.4,13.5));}
    else{controls.target.set(0,0,0);camera.position.set(0,1.5,homeDistance);}
   }
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();
  };const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  const tick=time=>{if(disposed||document.hidden){frame=0;last=0;return;}if(last)elapsed+=Math.min((time-last)/1000,.05);last=time;if(!paused){brand.rotation.y=Math.sin(elapsed*.3)*.2;brand.position.y=Math.sin(elapsed*.7)*.1;}render();frame=paused?0:requestAnimationFrame(tick);};
  const start=()=>{if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(tick);};requestRender=start;controls.enableDamping=!paused;controls.addEventListener('change',()=>{if(paused)start();});start();
  document.addEventListener('visibilitychange',start);
  const zoom=factor=>{const delta=camera.position.clone().sub(controls.target).multiplyScalar(factor);const length=THREE.MathUtils.clamp(delta.length(),controls.minDistance,controls.maxDistance);delta.setLength(length).add(controls.target);moveCamera(controls.target.clone(),delta,.5,'power2.out');start();};
  $('#zoom-in').addEventListener('click',()=>zoom(.8));$('#zoom-out').addEventListener('click',()=>zoom(1.25));
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopCameraMotion();cancelAnimationFrame(frame);disposed=true;document.body.classList.add('universe-fallback');nodeLayer.hidden=true;$('.universe-warning').hidden=false;setDirectory(true);});
  document.body.classList.add('universe-ready');setDirectory(false,false);updateProgress();
  window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(event.persisted)return;disposed=true;controls.dispose();resizeObserver.disconnect();resources.forEach(r=>r.dispose());renderer.dispose();});
  window.addEventListener('pageshow',event=>{if(event.persisted){last=0;start();}});
 }catch(error){disposed=true;cancelAnimationFrame(frame);controls?.dispose();controls=null;document.body.classList.add('universe-fallback');nodeLayer.hidden=true;$('.universe-warning').hidden=false;setDirectory(true);$('#reset-universe').hidden=true;$('#zoom-in').hidden=true;$('#zoom-out').hidden=true;resources.forEach(r=>r.dispose());renderer?.dispose();renderer?.domElement.remove();}
}
