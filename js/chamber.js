/* Schrödinger's Box — chamber renderer (three.js scene, hologram cat, post chain).
   Shared by the landing page hero and the lab. Scene composition is identical on both;
   only camera framing and interaction differ, via initGL(..., opts). */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshSurfaceSampler } from '../vendor/MeshSurfaceSampler.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { S, isMobile, reduced } from './physics.js';

let chamber=null, glc=null;
let OPT={ camScale:1, fovScale:1, modelURL:'models/schrodinger-cat.glb', onFail:null };
export const gl={ get renderer(){return renderer;}, get bloomPass(){return bloomPass;}, get camera(){return camera;}, get scene(){return scene;}, get ready(){return !!renderer;} };



let renderer=null, scene, camera, cat, motes, scanPlane, scanEdge, rings=[], flash, catMat, motesMat, ringsGroup, frames;
let composer=null, bloomPass=null, filmPass=null, catRefl=null, reflGroup=null;
const AMBER=new THREE.Color('#ff9d18'), AMBER2=new THREE.Color('#ffb547'), AMBERHI=new THREE.Color('#ffd58a');
function glowTexture(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); const g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,'rgba(255,220,160,1)'); g.addColorStop(.25,'rgba(255,157,24,.55)'); g.addColorStop(.6,'rgba(255,120,10,.12)'); g.addColorStop(1,'rgba(255,100,0,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }

const gridMats=[];
function lines(points, color, opacity){ const g=new THREE.BufferGeometry().setFromPoints(points); const m=new THREE.LineBasicMaterial({color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false}); m.userData.base=opacity; gridMats.push(m); return new THREE.LineSegments(g,m); }
function buildChamber(){
  const HW=4.2, HH=2.6, HD=4.2, step=.6;
  const grid=[], gridBright=[];
  // floor
  for(let x=-HW;x<=HW+1e-6;x+=step){ grid.push(new THREE.Vector3(x,-HH,-HD), new THREE.Vector3(x,-HH,HD)); }
  for(let z=-HD;z<=HD+1e-6;z+=step){ grid.push(new THREE.Vector3(-HW,-HH,z), new THREE.Vector3(HW,-HH,z)); }
  // ceiling
  for(let x=-HW;x<=HW+1e-6;x+=step){ grid.push(new THREE.Vector3(x,HH,-HD), new THREE.Vector3(x,HH,HD)); }
  for(let z=-HD;z<=HD+1e-6;z+=step){ grid.push(new THREE.Vector3(-HW,HH,z), new THREE.Vector3(HW,HH,z)); }
  // back wall
  for(let x=-HW;x<=HW+1e-6;x+=step){ grid.push(new THREE.Vector3(x,-HH,-HD), new THREE.Vector3(x,HH,-HD)); }
  for(let y=-HH;y<=HH+1e-6;y+=step){ grid.push(new THREE.Vector3(-HW,y,-HD), new THREE.Vector3(HW,y,-HD)); }
  // side walls
  for(let z=-HD;z<=HD+1e-6;z+=step){ grid.push(new THREE.Vector3(-HW,-HH,z), new THREE.Vector3(-HW,HH,z), new THREE.Vector3(HW,-HH,z), new THREE.Vector3(HW,HH,z)); }
  for(let y=-HH;y<=HH+1e-6;y+=step){ grid.push(new THREE.Vector3(-HW,y,-HD), new THREE.Vector3(-HW,y,HD), new THREE.Vector3(HW,y,-HD), new THREE.Vector3(HW,y,HD)); }
  // box edges bright
  const c=[[-HW,-HH,-HD],[HW,-HH,-HD],[HW,HH,-HD],[-HW,HH,-HD],[-HW,-HH,HD],[HW,-HH,HD],[HW,HH,HD],[-HW,HH,HD]].map(a=>new THREE.Vector3(...a));
  const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  E.forEach(([a,b])=>gridBright.push(c[a],c[b]));
  scene.add(lines(grid,AMBER,.10));
  scene.add(lines(gridBright,AMBER2,.55));
  // nested time frames (receding rectangles)
  frames=new THREE.Group();
  for(let i=1;i<=6;i++){ const z=-HD+i*(HD*2/7); const w=HW*(1-i*.02), h=HH*(1-i*.02); const pts=[new THREE.Vector3(-w,-h,z),new THREE.Vector3(w,-h,z),new THREE.Vector3(w,-h,z),new THREE.Vector3(w,h,z),new THREE.Vector3(w,h,z),new THREE.Vector3(-w,h,z),new THREE.Vector3(-w,h,z),new THREE.Vector3(-w,-h,z)]; const l=lines(pts,AMBER,.10+ (i===3?.15:0)); frames.add(l); }
  scene.add(frames);
  // floor rings
  ringsGroup=new THREE.Group();
  for(let i=0;i<9;i++){ const pts=[]; for(let a=0;a<=64;a++){ const th=a/64*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(th),0,Math.sin(th))); } const g=new THREE.BufferGeometry().setFromPoints(pts); const m=new THREE.LineBasicMaterial({color:AMBER,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}); const r=new THREE.Line(g,m); r.position.y=-HH+.01; ringsGroup.add(r); rings.push(r); }
  scene.add(ringsGroup);
  // scan plane
  scanPlane=new THREE.Mesh(new THREE.PlaneGeometry(HW*2,HD*2), new THREE.MeshBasicMaterial({color:AMBER,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  scanPlane.rotation.x=-Math.PI/2; scene.add(scanPlane);
  const ep=[new THREE.Vector3(-HW,0,-HD),new THREE.Vector3(HW,0,-HD),new THREE.Vector3(HW,0,-HD),new THREE.Vector3(HW,0,HD),new THREE.Vector3(HW,0,HD),new THREE.Vector3(-HW,0,HD),new THREE.Vector3(-HW,0,HD),new THREE.Vector3(-HW,0,-HD)];
  scanEdge=lines(ep,AMBERHI,.5); scene.add(scanEdge);
  // flash sprite
  flash=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:AMBERHI,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false})); flash.scale.set(9,9,1); flash.position.set(0,-.2,0); scene.add(flash);
  // ambient glow under cat
  const under=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:AMBER,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false})); under.scale.set(7,3.2,1); under.position.set(0,-HH+.2,0); scene.add(under);
}

const CAT_VS=`
attribute float aSize; attribute float aCopy; attribute float aRand; attribute vec3 aColor;
uniform float uTime,uSep,uPhase,uComp,uKappa,uCollapse,uSqueeze,uPix,uKeep,uFloor,uScanY,uGain,uEcho,uRefl;
varying float vA; varying vec3 vC;
void main(){
  float k=aCopy, N=uComp;
  float show=step(k, N-0.5);
  // copy 0 = the present: crisp, centred. copies 1..N-1 = temporal ghosts fanning out +/- and receding in z.
  float rank=ceil(k*0.5);                       // 0,1,1,2,2,3
  float side=mod(k,2.0)*2.0-1.0;                // alternate sides
  float dist=rank;
  float off=rank*side*(0.25+uSep*0.20);
  vec3 p=position;
  p.x*=exp(-0.10*uSqueeze); p.y=(p.y-uFloor)*exp(0.10*uSqueeze)+uFloor;
  float ph=uPhase*2.0 + k*1.0472;
  float shim=0.014*(1.0+uKappa*6.0);
  p+=shim*vec3(sin(uTime*1.7+aRand*40.0+ph), cos(uTime*1.3+aRand*30.0+ph), sin(uTime*2.1+aRand*20.0));
  // decoherence dispersion (grows with kappa)
  vec3 dir=vec3(sin(aRand*97.0),cos(aRand*71.0),sin(aRand*53.0));
  p+=dir*uKappa*0.9*(0.3+0.7*fract(aRand*13.7));
  // slow breathing of the ghosts = phase-space rotation made visible
  float breathe=0.08*sin(uTime*0.6+k*1.3)*rank*side;
  vec3 world=p+vec3(off+breathe,0.0,-rank*uEcho);
  // collapse: ghosts converge onto the present; only the kept branch survives
  vec3 target=p*(1.0+0.02*sin(uTime*30.0+aRand*10.0)*uCollapse);
  world=mix(world,target,smoothstep(0.0,1.0,uCollapse));
  vec4 mv=modelViewMatrix*vec4(world,1.0);
  gl_Position=projectionMatrix*mv;
  float base=pow(0.22, dist);
  float keep=1.0-step(0.5,abs(k-uKeep));
  float a=mix(base, keep, uCollapse);
  a*= (1.0-uKappa*0.35);
  float scan=exp(-pow((world.y-uScanY)*2.5,2.0));
  vA=show*a*(1.0+0.9*scan)*uGain;
#ifdef REFL
  vA*=0.20*uRefl*clamp(1.0-(world.y-uFloor)*0.30,0.0,1.0);
#endif
  vC=aColor;
  gl_PointSize=aSize*uPix*(9.5/max(0.5,-mv.z))*(1.0+0.3*uCollapse*keep+0.4*scan);
}`;
const CAT_FS=`
precision highp float; varying float vA; varying vec3 vC;
void main(){ vec2 q=gl_PointCoord-0.5; float d=length(q); if(d>0.5) discard; float a=smoothstep(0.5,0.22,d); float core=smoothstep(0.28,0.0,d); vec3 col=vC*(0.7+0.5*a)+vec3(1.0,0.9,0.7)*core*0.35; gl_FragColor=vec4(col, (a*0.6+core*0.45)*vA); }`;

export async function buildCatPNG(){
  const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='assets/quantum-cat.png'; });
  const SZ=isMobile?160:220; const c=document.createElement('canvas'); c.width=c.height=SZ; const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,SZ,SZ); const d=x.getImageData(0,0,SZ,SZ).data;
  const target=isMobile?4200:9800; const cand=[];
  for(let py=0;py<SZ;py++)for(let px=0;px<SZ;px++){ const i=(py*SZ+px)*4; const a=d[i+3]; if(a<40) continue; const lum=(d[i]*.5+d[i+1]*.4+d[i+2]*.1)/255; if(lum<.14) continue; cand.push([px,py,lum,d[i]/255,d[i+1]/255,d[i+2]/255]); }
  // weighted thinning: bright wire/edge pixels survive, dim interior mostly thins out
  let wsum=0; for(const c of cand) wsum+=c[2]*c[2]*c[2]*3.2+.03;
  const pts=[]; const keepP=Math.min(1,target/wsum);
  for(const cnd of cand){ const w=cnd[2]*cnd[2]*cnd[2]*3.2+.03; if(Math.random()<keepP*w) pts.push(cnd); }
  const COPIES=6, n=pts.length*COPIES;
  const pos=new Float32Array(n*3), size=new Float32Array(n), copy=new Float32Array(n), rnd=new Float32Array(n), col=new Float32Array(n*3);
  const H=5.0, W2=5.0;
  let o=0;
  for(let k=0;k<COPIES;k++){
    for(let i=0;i<pts.length;i++,o++){
      const [px,py,lum,r,g,b]=pts[i];
      const nx=(px/SZ-.5), ny=(.5-py/SZ);
      // pseudo-volume: thickness varies with distance from silhouette centreline
      const th=0.55*(0.35+lum);
      const z=(Math.random()-.5)*th + (Math.random()-.5)*0.15;
      pos[o*3]=nx*W2; pos[o*3+1]=ny*H-.1; pos[o*3+2]=z;
      size[o]=(0.45+lum*1.7)*(Math.random()<.05?2.2:1);
      copy[o]=k; rnd[o]=Math.random();
      const boost=.45+lum*.95; col[o*3]=Math.min(1,(r*.7+.35)*boost); col[o*3+1]=Math.min(1,(g*.75+.18)*boost); col[o*3+2]=Math.min(1,(b*.5+.02)*boost);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(size,1));
  geo.setAttribute('aCopy',new THREE.BufferAttribute(copy,1));
  geo.setAttribute('aRand',new THREE.BufferAttribute(rnd,1));
  geo.setAttribute('aColor',new THREE.BufferAttribute(col,3));
  catMat=new THREE.ShaderMaterial({vertexShader:CAT_VS,fragmentShader:CAT_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uSep:{value:S.sep},uPhase:{value:S.ph},uComp:{value:S.N},uKappa:{value:S.ka},uCollapse:{value:0},uSqueeze:{value:S.sq},uPix:{value:1},uKeep:{value:2},uFloor:{value:-2.6},uScanY:{value:0},uGain:{value:1},uEcho:{value:0.75},uRefl:{value:1}}});
  cat=new THREE.Points(geo,catMat); cat.frustumCulled=false; scene.add(cat);
}
/* ---------- GLB hologram cat (primary path). The PNG point cloud above is the fallback. ---------- */
const CAT_CFG={ scale:4.6, rotY:Math.PI/4-0.32, floorY:-2.6, x:0.0, z:0.1 };   // one place for all corrective transforms
const HOLO_VS=`
attribute vec3 aBary; varying vec3 vB; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv;
void main(){ vB=aBary; vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`;
const HOLO_FS=`
precision highp float; uniform sampler2D map; uniform float uAlpha,uScanY,uKappa,uTime,uHasMap,uFloor,uRefl; uniform vec3 uCol;
varying vec3 vB; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv;
void main(){
  vec3 d=fwidth(vB); vec3 a3=smoothstep(vec3(0.0), d*1.05, vB); float edge=1.0-min(min(a3.x,a3.y),a3.z);
  float fres=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.4);
  float tex=uHasMap>0.5 ? dot(texture2D(map,vUv).rgb,vec3(0.333)) : 0.5;
  float scan=exp(-pow((vW.y-uScanY)*3.0,2.0));
  float noise=0.86+0.14*sin(vW.y*38.0+uTime*3.0+vW.x*17.0);
  float lum=edge*0.88*noise + fres*0.42 + tex*0.18 + scan*0.5*(edge+fres+0.15);
  if(!gl_FrontFacing) lum*=0.28;
  lum*=1.0-uKappa*0.3;
#ifdef REFL
  lum*=0.22*uRefl*clamp(1.0-(uFloor-vW.y)*0.30,0.0,1.0);
#endif
  vec3 col=uCol*lum + vec3(1.0,0.90,0.70)*(edge*0.12+fres*0.10) + vec3(1.0,0.86,0.58)*scan*0.22;
  gl_FragColor=vec4(col, clamp(lum,0.0,1.0)*uAlpha);
}`;
let holoMats=[], catGroup=null, ghostGroups=[], catParts={};
function holoMaterial(map){ return new THREE.ShaderMaterial({vertexShader:HOLO_VS,fragmentShader:HOLO_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{map:{value:map||null},uHasMap:{value:map?1:0},uAlpha:{value:1},uScanY:{value:0},uKappa:{value:0},uTime:{value:0},uFloor:{value:CAT_CFG.floorY},uRefl:{value:1},uCol:{value:new THREE.Color('#ffb143')}}}); }
function withBary(geo){ const g=geo.index?geo.toNonIndexed():geo; const n=g.attributes.position.count; const b=new Float32Array(n*3); for(let i=0;i<n;i+=3){ b[i*3]=1; b[i*3+4]=1; b[i*3+8]=1; } g.setAttribute('aBary',new THREE.BufferAttribute(b,3)); return g; }
export async function buildCatGLB(){
  const gltf=await new Promise((res,rej)=>new GLTFLoader().load(OPT.modelURL,res,undefined,rej));
  const root=gltf.scene;
  // semantic map from inspection (Tripo names are opaque): traversal order of meshes with >100 tris
  const meshes=[]; root.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  const big=meshes.filter(m=>(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3>100);
  const ROLE=['head','torso','hindL','hindR','frontL','frontR','tail','whiskerA','whiskerB'];
  big.forEach((m,i)=>{ m.userData.role=ROLE[i]||('part'+i); catParts[m.userData.role]=m; });
  meshes.forEach(m=>{ if(!big.includes(m)) m.visible=false; });          // 31 fragments <= 20 tris: hidden
  // replace materials with the hologram shader, keep the baked texture for stripe modulation
  big.forEach(m=>{ const map=(m.material&&m.material.map)||null; if(map){ map.colorSpace=THREE.SRGBColorSpace; } m.geometry=withBary(m.geometry); m.material=holoMaterial(map); m.material.userData.ghost=false; holoMats.push(m.material); m.frustumCulled=false; });
  // hierarchy: catGroup (placement) > body (breathing) > [ headPivot(head, whiskers), tailPivot(tail), rest ]
  catGroup=new THREE.Group(); const body=new THREE.Group(); body.name='body'; catGroup.add(body);
  const headPivot=new THREE.Group(), tailPivot=new THREE.Group();
  const hp=new THREE.Vector3(-0.27,0.46,0.12), tp=new THREE.Vector3(0.02,0.50,-0.34);      // neck / tail-base pivots in model space (from bbox inspection)
  headPivot.position.copy(hp); tailPivot.position.copy(tp);
  const attach=(piv,m)=>{ m.position.sub(piv.position); piv.add(m); };
  big.forEach(m=>{ const r=m.userData.role; if(r==='head'||r==='whiskerA'||r==='whiskerB') attach(headPivot,m); else if(r==='tail') attach(tailPivot,m); else body.add(m); });
  body.add(headPivot,tailPivot);
  catGroup.position.set(CAT_CFG.x,CAT_CFG.floorY,CAT_CFG.z); catGroup.rotation.y=CAT_CFG.rotY; catGroup.scale.setScalar(CAT_CFG.scale);
  catGroup.userData={headPivot,tailPivot,body};
  scene.add(catGroup); catGroup.updateMatrixWorld(true);
  // ghosts: two temporal echoes (rank 1, either side); deeper ranks are carried by particles only
  for(const side of [-1,1]){ const g=catGroup.clone(true); g.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.userData.ghost=true; o.material.uniforms.uAlpha.value=0.3; holoMats.push(o.material); } }); g.userData.side=side; scene.add(g); ghostGroups.push(g); }
  // particle surface: sample the real mesh surface once; head gets a density boost so the face reads
  const total=isMobile?3200:6500, COPIES=6;
  const budget={head:0.30,torso:0.30,hindL:0.07,hindR:0.07,frontL:0.07,frontR:0.07,tail:0.10,whiskerA:0.01,whiskerB:0.01};
  const pts=[]; const tmp=new THREE.Vector3(), nrm=new THREE.Vector3();
  big.forEach(m=>{ const n=Math.round(total*(budget[m.userData.role]||0.02)); if(!n) return; const smp=new MeshSurfaceSampler(m).build(); for(let i=0;i<n;i++){ smp.sample(tmp,nrm); tmp.applyMatrix4(m.matrixWorld); const isHead=m.userData.role==='head'; pts.push([tmp.x,tmp.y,tmp.z, isHead?0.85:0.6]); } });
  const n=pts.length*COPIES; const pos=new Float32Array(n*3), size=new Float32Array(n), copy=new Float32Array(n), rnd=new Float32Array(n), col=new Float32Array(n*3);
  let o=0; for(let k=0;k<COPIES;k++) for(let i=0;i<pts.length;i++,o++){ const [x,y,z,lum]=pts[i]; pos[o*3]=x; pos[o*3+1]=y; pos[o*3+2]=z; size[o]=(0.55+lum*1.1)*(Math.random()<.04?1.8:1); copy[o]=k; rnd[o]=Math.random(); const b=.55+lum*.7; col[o*3]=Math.min(1,1.0*b); col[o*3+1]=Math.min(1,.60*b); col[o*3+2]=Math.min(1,.14*b); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('aSize',new THREE.BufferAttribute(size,1)); geo.setAttribute('aCopy',new THREE.BufferAttribute(copy,1)); geo.setAttribute('aRand',new THREE.BufferAttribute(rnd,1)); geo.setAttribute('aColor',new THREE.BufferAttribute(col,3));
  catMat=new THREE.ShaderMaterial({vertexShader:CAT_VS,fragmentShader:CAT_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uSep:{value:S.sep},uPhase:{value:S.ph},uComp:{value:S.N},uKappa:{value:S.ka},uCollapse:{value:0},uSqueeze:{value:S.sq},uPix:{value:1},uKeep:{value:2},uFloor:{value:CAT_CFG.floorY},uScanY:{value:0},uGain:{value:1},uEcho:{value:0.75},uRefl:{value:1}}});
  cat=new THREE.Points(geo,catMat); cat.frustumCulled=false; scene.add(cat);
  buildReflections();
  resize();
  console.info('[cat] GLB hierarchy:', meshes.length,'meshes;', big.length,'used:', big.map(m=>m.userData.role+'('+(m.geometry.attributes.position.count/3|0)+' tris)').join(', '), '· particles', pts.length, 'x 6 copies');
}
function buildReflections(){
  // particles: same geometry + same uniform object, REFL define fades and mirrors through the floor
  if(cat&&catMat){ const m=new THREE.ShaderMaterial({vertexShader:CAT_VS,fragmentShader:CAT_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:catMat.uniforms,defines:{REFL:1}});
    catRefl=new THREE.Points(cat.geometry,m); catRefl.frustumCulled=false; catRefl.position.y=2*CAT_CFG.floorY; catRefl.scale.y=-1; scene.add(catRefl); }
  if(catGroup){ reflGroup=catGroup.clone(true); reflGroup.traverse(o=>{ if(o.isMesh){ const src=o.material; o.material=new THREE.ShaderMaterial({vertexShader:HOLO_VS,fragmentShader:HOLO_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:src.uniforms,defines:{REFL:1}}); } });
    scene.add(reflGroup); }
}
const FILM_SHADER={
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uShock:{value:0},uGrain:{value:0.045}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime,uShock,uGrain; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){ vec2 uv=vUv; vec2 c=uv-0.5; float r=length(c);
    float ab=(0.0022+uShock*0.018)*r;
    vec3 col; col.r=texture2D(tDiffuse,uv+c*ab).r; col.g=texture2D(tDiffuse,uv).g; col.b=texture2D(tDiffuse,uv-c*ab).b;
    float vig=smoothstep(0.98,0.30,r); col*=mix(0.62,1.0,vig);
    float g=(hash(floor(uv*vec2(1600.0,900.0))+fract(uTime*7.0))-0.5)*uGrain;
    col+=g*(0.6+0.4*(1.0-vig));
    col+=uShock*0.12*vec3(1.0,0.82,0.55)*(1.0-r);
    gl_FragColor=vec4(col,1.0); }`
};
function buildComposer(){
  const w=chamber.clientWidth,h=chamber.clientHeight;
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bloomPass=new UnrealBloomPass(new THREE.Vector2(w/2,h/2), isMobile?0.34:0.42, 0.32, 0.8);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  filmPass=new ShaderPass(FILM_SHADER); composer.addPass(filmPass);
}
function updateCatMotion(T){
  if(!catGroup) return;
  const {headPivot,tailPivot,body}=catGroup.userData; const still=reduced||!S.running;
  const t=still?0:T;
  body.scale.y=1+0.005*Math.sin(t*1.25);                       // breathing +/-0.5%
  body.position.x=0.004*Math.sin(t*0.37);                      // weight shift
  headPivot.rotation.y=0.035*Math.sin(t*0.45)+0.012*Math.sin(t*1.7);   // yaw +/-2 deg
  headPivot.rotation.x=0.02*Math.sin(t*0.61);                  // pitch +/-1.2 deg
  tailPivot.rotation.y=0.05*Math.sin(t*0.9)+0.02*Math.sin(t*2.3);      // sway +/-3 deg
  // squeeze as anisotropic scale about the feet; ghosts follow separation
  const sx=Math.exp(-0.10*S.sq), sy=Math.exp(0.10*S.sq);
  catGroup.scale.set(CAT_CFG.scale*sx,CAT_CFG.scale*sy,CAT_CFG.scale);
  const off=0.25+S.sep*0.20, breathe=0.08*Math.sin(T*0.6+1.3);
  ghostGroups.forEach(g=>{ const sd=g.userData.side; g.scale.copy(catGroup.scale); g.position.set(CAT_CFG.x+sd*(off+breathe)*(1-S.collapse),CAT_CFG.floorY,CAT_CFG.z-S.echo*(1-S.collapse)); g.rotation.y=CAT_CFG.rotY; g.visible=S.N>1; });
  const ghostA=0.16*(1-S.ka*0.35)*(1-S.collapse), primA=0.78+0.22*S.collapse;
  if(reflGroup){ reflGroup.position.set(catGroup.position.x,CAT_CFG.floorY,catGroup.position.z); reflGroup.rotation.y=catGroup.rotation.y; reflGroup.scale.set(catGroup.scale.x,-catGroup.scale.y,catGroup.scale.z);
    const rb=reflGroup.children[0]; if(rb){ rb.scale.copy(body.scale); rb.position.copy(body.position); const n=rb.children.length; if(n>=2){ rb.children[n-2].rotation.copy(headPivot.rotation); rb.children[n-1].rotation.copy(tailPivot.rotation); } } }
  const scanY=scanPlane?scanPlane.position.y:0;
  for(const m of holoMats){ const u=m.uniforms; u.uTime.value=T; u.uScanY.value=scanY; u.uKappa.value=S.ka; u.uRefl.value=S.refl; u.uAlpha.value=m.userData.ghost?ghostA:primA; }
  if(catMat){ catMat.uniforms.uScanY.value=scanY; catMat.uniforms.uGain.value=S.gain; catMat.uniforms.uEcho.value=S.echo; catMat.uniforms.uRefl.value=S.refl; }
}

const MOTE_VS=`
attribute float aRad,aPh,aLift,aSpd,aSz; uniform float uTime,uPix,uKappa; varying float vA;
void main(){ float a=aPh+uTime*aSpd; vec3 p=vec3(cos(a)*aRad, aLift+sin(uTime*0.7+aPh*3.0)*0.12, sin(a)*aRad*0.75); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; vA=0.35+0.4*sin(a*3.0+uTime*4.0); vA*=1.0-uKappa*0.4; gl_PointSize=aSz*uPix*(7.0/max(0.5,-mv.z)); }`;
const MOTE_FS=`precision highp float; varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; float d=length(q); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(1.0,0.66,0.2,a*vA); }`;
function buildMotes(){
  const n=isMobile?500:1400; const pos=new Float32Array(n*3), rad=new Float32Array(n), ph=new Float32Array(n), lift=new Float32Array(n), spd=new Float32Array(n), sz=new Float32Array(n);
  for(let i=0;i<n;i++){ rad[i]=1.4+Math.random()*3.6; ph[i]=Math.random()*Math.PI*2; lift[i]=(Math.random()-.5)*4.6; spd[i]=(0.06+Math.random()*.22)*(Math.random()<.5?1:-1); sz[i]=.5+Math.random()*1.4; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aRad',new THREE.BufferAttribute(rad,1)); g.setAttribute('aPh',new THREE.BufferAttribute(ph,1)); g.setAttribute('aLift',new THREE.BufferAttribute(lift,1)); g.setAttribute('aSpd',new THREE.BufferAttribute(spd,1)); g.setAttribute('aSz',new THREE.BufferAttribute(sz,1));
  motesMat=new THREE.ShaderMaterial({vertexShader:MOTE_VS,fragmentShader:MOTE_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPix:{value:1},uKappa:{value:0}}});
  motes=new THREE.Points(g,motesMat); motes.frustumCulled=false; scene.add(motes);
}

export function initGL(canvasEl, containerEl, opts={}){
  glc=canvasEl; chamber=containerEl; OPT=Object.assign(OPT,opts);
  try{ renderer=new THREE.WebGLRenderer({canvas:glc,antialias:false,alpha:false,powerPreference:'high-performance'}); }
  catch(e){ renderer=null; }
  if(!renderer){ if(OPT.onFail) OPT.onFail(); return false; }
  renderer.setClearColor(0x050403,1); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
  scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x050403,0.035);
  camera=new THREE.PerspectiveCamera(42,1,.1,100);
  buildChamber(); buildMotes(); buildComposer();
  resize(); new ResizeObserver(resize).observe(chamber);
  return true;
}
export function resize(){
  if(!renderer) return;
  const w=chamber.clientWidth, h=chamber.clientHeight;
  const dprCap=isMobile?1.3:1.5;
  const dpr=Math.min(devicePixelRatio||1,dprCap)*S.quality;
  renderer.setPixelRatio(dpr); renderer.setSize(w,h,false);
  if(composer){ composer.setPixelRatio(dpr); composer.setSize(w,h); bloomPass.resolution.set(w/2,h/2); bloomPass.enabled=S.quality>0.72; }
  camera.aspect=w/h; camera.fov=(w<h?58:42)*(OPT.fovScale||1); camera.updateProjectionMatrix();
  const px=dpr*(isMobile?1.35:1); if(catMat) catMat.uniforms.uPix.value=px; if(motesMat) motesMat.uniforms.uPix.value=px;
}


/* ---- per-frame scene update, extracted verbatim from the original loop ---- */
const camTarget=new THREE.Vector3(0,-.35,0);
export function updateScene(T){
  if(!renderer) return;
  const auto=S.orbitAuto&&!reduced? Math.sin(T*.11)*.10 : 0;
  const th=auto+S.orbit.th+S.pointer.x*.10, ph=.07+S.orbit.phi+S.pointer.y*.05;
  const R=(isMobile?10.5:11.5)*S.zoom*(OPT.camScale||1);
  const cx=Math.sin(th)*Math.cos(ph)*R, cy=Math.sin(ph)*R+.4, cz=Math.cos(th)*Math.cos(ph)*R;
  camera.position.lerp(new THREE.Vector3(cx,cy,cz),.08); camera.lookAt(camTarget);
  if(catMat){ const u=catMat.uniforms; u.uTime.value=T; u.uSep.value=S.sep; u.uPhase.value=S.ph; u.uComp.value=S.N; u.uKappa.value=S.ka; u.uSqueeze.value=S.sq; u.uCollapse.value=S.collapse; }
  motesMat.uniforms.uTime.value=T; motesMat.uniforms.uKappa.value=S.ka;
  rings.forEach((r,i)=>{ const w=((i/rings.length)+T*S.ringRate)%1; const rad=(.6+w*4.4)*(1-.7*S.collapse); r.scale.set(rad,1,rad*.78); r.material.opacity=(1-w)*.28*(1-S.ka*.5)+.05*S.collapse; });
  const sy=((T*S.scanRate)%3.2)-1.6; const y=S.collapse>.05? -2.55+(S.collapse*5.1) : sy*1.55; scanPlane.position.y=y; scanEdge.position.y=y; scanPlane.material.opacity=.045+.12*S.collapse; scanEdge.material.opacity=.45+.5*S.collapse;
  const fl=Math.max(0,Math.sin(Math.PI*Math.min(1,S.collapse*1.6))); flash.material.opacity=fl*.55; flash.scale.setScalar(9+fl*6);
  frames.children.forEach((f,i)=>{ f.material.opacity=(.10+(i===3?.15:0))*(1-.6*S.collapse)*S.grid; });
  for(const m of gridMats){ if(m.userData.base!=null && !frames.children.some(f=>f.material===m)) m.opacity=m.userData.base*S.grid; }
  updateCatMotion(T);
  if(filmPass){ filmPass.uniforms.uTime.value=T; filmPass.uniforms.uShock.value=fl; filmPass.uniforms.uGrain.value=reduced?Math.min(0.02,S.grain):S.grain; }
  if(bloomPass){ bloomPass.strength=S.bloom; }
  if(composer) composer.render(); else renderer.render(scene,camera);
}

/* ---- pointer parallax, drag-orbit and wheel zoom ---- */
export function attachPointer(el,{wheel=true,ignore='.panel,button,input,.tabs,a'}={}){
  el.addEventListener('pointermove',e=>{ const r=el.getBoundingClientRect(); const x=((e.clientX-r.left)/r.width-.5)*2, y=((e.clientY-r.top)/r.height-.5)*2;
    if(S.drag){ S.orbit.th+=(x-S.drag.x)*1.4; S.orbit.phi+=(y-S.drag.y)*.6; S.orbit.phi=Math.max(-.35,Math.min(.5,S.orbit.phi)); S.drag={x,y}; }
    else if(!isMobile){ S.pointer.x=x; S.pointer.y=y; } });
  el.addEventListener('pointerdown',e=>{ if(ignore&&e.target.closest(ignore)) return; const r=el.getBoundingClientRect();
    S.drag={x:((e.clientX-r.left)/r.width-.5)*2,y:((e.clientY-r.top)/r.height-.5)*2}; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup',()=>S.drag=null); el.addEventListener('pointercancel',()=>S.drag=null);
  el.addEventListener('pointerleave',()=>{ if(!S.drag){ S.pointer.x=0; S.pointer.y=0; } });
  if(wheel) el.addEventListener('wheel',e=>{ if(e.target.closest('.panel')) return; e.preventDefault(); S.zoom=Math.max(.7,Math.min(1.5,S.zoom+Math.sign(e.deltaY)*.05)); },{passive:false});
}
