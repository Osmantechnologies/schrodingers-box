/* Schrödinger's Box — physics core.
   Coherent-state cat: |psi> = N * S(r) * sum_k |alpha e^{i(2pi k/N + phi)}>
   One instance per page. Both the landing page and the lab import this file,
   so every number on both pages comes from the same computation. */

export const S = {
  sep:3.2, sq:0.75, ph:0.785, N:6, ka:0.02,
  running:true, speed:1, zoom:1, t:436.32, tau:0,        // t = display clock (s), tau = physical phase time
  observed:false, collapse:0, keep:2, obsHist:[],
  pointer:{x:0,y:0}, drag:null, orbitAuto:true, orbit:{th:0,phi:0}, quality:1,
  gain:1, scanRate:0.5, echo:0.75, ringRate:0.12, bloom:0.42, grain:0.045, grid:1, refl:1,
};
export const INITIAL={sep:3.2,sq:0.75,ph:0.785,N:6,ka:0.02};
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = matchMedia('(max-width: 820px)').matches;

/* ======================================================================
   1. Physics — coherent-state cat, Wigner function, metrics
   ====================================================================== */
export const G = isMobile ? 72 : 96;                          // grid
export const W = new Float32Array(G*G), Wp = new Float32Array(G*G);
export let wRange = 6, wMin = 0, wMax = 0;
export const M = { neg:0, pur:1, fid:1, n:0, par:1, wmin:0, Pn:new Float32Array(32) };

// α_k on the ring
export function alphas(N, sep, ph){ const a=[]; for(let k=0;k<N;k++){ const th=ph+2*Math.PI*k/N; a.push([sep*Math.cos(th), sep*Math.sin(th)]); } return a; }

// Compute W on grid. Pure cat + damped cat share the same term structure; cross terms get factor D_jk.
export function computeWigner(){
  const N=S.N, al=alphas(N,S.sep,S.ph);
  const er = Math.exp(S.sq*0.5), ei = 1/er;            // squeeze mapping (r scaled for on-screen sanity)
  wRange = Math.max(3.2, S.sep*Math.SQRT2*Math.max(er,ei)+2.4);   // ring radius √2·α, stretched by squeeze, plus lobe width
  // normalisation: Σ_jk <α_k|α_j> D_jk
  const ov=(j,k)=>{ const [ar,ai]=al[j],[br,bi]=al[k]; const re=-(ar*ar+ai*ai)/2-(br*br+bi*bi)/2+ (br*ar+bi*ai); const im=(br*ai-bi*ar); return [Math.exp(re)*Math.cos(im), Math.exp(re)*Math.sin(im)]; }; // <α_k|α_j> = exp(-|a|²/2-|b|²/2 + b*·a) with b=α_k
  const damp=(j,k)=>{ if(j===k) return 1; const [ar,ai]=al[j],[br,bi]=al[k]; const d2=(ar-br)**2+(ai-bi)**2; return Math.exp(-S.ka*d2*0.15); };   // photon-loss form: distant branches lose coherence first
  let Zp=0, Zd=0;
  for(let j=0;j<N;j++)for(let k=0;k<N;k++){ const [re]=ov(j,k); Zp+=re; Zd+=re*damp(j,k); }
  const twoPi=2/Math.PI;
  wMin=Infinity; wMax=-Infinity;
  const dx=(2*wRange)/(G-1);
  for(let iy=0;iy<G;iy++){
    const p0=(wRange-iy*dx);
    for(let ix=0;ix<G;ix++){
      const x0=(-wRange+ix*dx);
      // apply squeeze as coordinate rescale
      const x=x0*er, p=p0*ei;
      // β = (x+ip)/√2 in coherent-state units
      const br=x/Math.SQRT2, bi=p/Math.SQRT2;
      let sumP=0, sumD=0;
      for(let j=0;j<N;j++){
        const [ajr,aji]=al[j];
        const ujr=ajr-br, uji=aji-bi;
        for(let k=0;k<N;k++){
          const [akr,aki]=al[k];
          const ukr=akr-br, uki=aki-bi;
          // e^{i(θj-θk)} exp(-|u_k|²/2 - |u_j|²/2 - u_k* u_j)
          const thj=br*aji-bi*ajr, thk=br*aki-bi*akr;    // Im(β* α)
          const cre=-(ukr*ukr+uki*uki)/2-(ujr*ujr+uji*uji)/2-(ukr*ujr+uki*uji);
          const cim=(thj-thk)-(ukr*uji-uki*ujr);
          const val=Math.exp(cre)*Math.cos(cim);
          sumP+=val; sumD+=val*damp(j,k);
        }
      }
      const wp=twoPi*sumP/Zp, wd=twoPi*sumD/Zd;
      const i=iy*G+ix; Wp[i]=wp; W[i]=wd;
      if(wd<wMin)wMin=wd; if(wd>wMax)wMax=wd;
    }
  }
  // metrics. W is normalised so ∫W d²β = 1 with β=(x+ip)/√2 → d²β = dx dp / 2.
  // Tr ρ² = π ∫ W² d²β ; F(ρ,ρ_pure) = π ∫ W W_pure d²β ; negativity = ∫_{W<0} |W| d²β
  const dA=dx*dx/2;
  let neg=0,pur=0,fid=0;
  for(let i=0;i<G*G;i++){ const w=W[i]; if(w<0)neg-=w; pur+=w*w; fid+=w*Wp[i]; }
  M.neg=-neg*dA; M.pur=Math.min(1,pur*dA*Math.PI); M.fid=Math.min(1,fid*dA*Math.PI);
  { let mass=0; for(let i=0;i<G*G;i++) mass+=W[i]; M.mass=Math.max(0,Math.min(1,mass*dA)); const fringe=Math.PI/(2*Math.SQRT2*Math.max(S.sep,0.15)); M.res=Math.max(0,Math.min(1,(fringe/dx)/2.2)); }
  M.wmin=wMin;
  // lobe height (W at α_0) — used to scale the colormap so the ring stays visible under the centre fringes
  { const [ar,ai]=al[0]; M.lobe=Math.abs(wAt(Math.SQRT2*ar/er, Math.SQRT2*ai*er)); }
  // photon statistics of the (pure) cat: ψ_n ∝ Σ_k α_k^n e^{-|α|²/2}/√n!
  const a2=S.sep*S.sep; let tot=0, mean=0, par=0;
  const lnf=[0]; for(let n=1;n<64;n++) lnf[n]=lnf[n-1]+Math.log(n);
  const P=[]; for(let n=0;n<64;n++){ let re=0,im=0; for(let k=0;k<N;k++){ const th=S.ph+2*Math.PI*k/N; const mag=Math.exp(n*Math.log(Math.max(S.sep,1e-9))-a2/2-lnf[n]/2); re+=mag*Math.cos(n*th); im+=mag*Math.sin(n*th);} const pn=re*re+im*im; P.push(pn); tot+=pn; }
  for(let n=0;n<64;n++){ const pn=P[n]/tot; if(n<32)M.Pn[n]=pn; mean+=n*pn; par+=(n%2?-1:1)*pn; }
  M.n=mean; M.par=par;
}
// evaluate W at an arbitrary point (for terminal + hover), bilinear on grid
export function wAt(x,p){ const dx=(2*wRange)/(G-1); const fx=(x+wRange)/dx, fy=(wRange-p)/dx; if(fx<0||fy<0||fx>G-1||fy>G-1) return 0; const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(G-1,x0+1),y1=Math.min(G-1,y0+1),tx=fx-x0,ty=fy-y0; const a=W[y0*G+x0],b=W[y0*G+x1],c=W[y1*G+x0],d=W[y1*G+x1]; return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty; }
// sample x from marginal P(x)=∫W dp (Born rule)
export function sampleX(){ const dx=(2*wRange)/(G-1); const Px=new Float64Array(G); let tot=0; for(let ix=0;ix<G;ix++){ let s=0; for(let iy=0;iy<G;iy++) s+=Math.max(0,W[iy*G+ix]); Px[ix]=s; tot+=s; } let r=Math.random()*tot; for(let ix=0;ix<G;ix++){ r-=Px[ix]; if(r<=0) return -wRange+ix*dx+ (Math.random()-.5)*dx; } return 0; }
// which branch does x belong to → nearest α_k real part (in x units √2·Re α · e^{-r/2})
export function nearestBranch(x){ const al=alphas(S.N,S.sep,S.ph); const er=Math.exp(S.sq*0.5); let best=0,bd=Infinity; al.forEach(([ar],k)=>{ const xk=Math.SQRT2*ar/er; const d=Math.abs(xk-x); if(d<bd){bd=d;best=k;} }); return best; }


/* ---- shared Wigner painting (used by the landing hero inset) ---- */
export function colormap(v){
  if(v>=0){ const t=Math.pow(v,.75); return [Math.round(20+235*t), Math.round(10+160*Math.pow(t,1.15)), Math.round(4+70*Math.pow(t,1.8))]; }
  const t=Math.pow(-v,.7); return [Math.round(6+40*t), Math.round(4+18*t), Math.round(8+70*t)];
}
const _off=typeof document!=='undefined'?document.createElement('canvas'):null;
export function paintWigner(canvas,{grid=4,axes=true}={}){
  if(!canvas||!_off) return;
  const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height;
  _off.width=G; _off.height=G; const ox=_off.getContext('2d');
  const img=ox.createImageData(G,G); const d=img.data;
  const mx=Math.max(1e-6, Math.max(M.lobe*1.15, 1e-6));
  for(let i=0;i<G*G;i++){ const [r,g,b]=colormap(Math.max(-1,Math.min(1,W[i]/mx))); d[i*4]=r; d[i*4+1]=g; d[i*4+2]=b; d[i*4+3]=255; }
  ox.putImageData(img,0,0);
  ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled=true; ctx.drawImage(_off,0,0,w,h);
  if(!axes) return;
  ctx.strokeStyle='rgba(255,157,24,.14)'; ctx.lineWidth=1;
  for(let i=1;i<grid;i++){ const x=Math.round(i*w/grid)+.5,y=Math.round(i*h/grid)+.5; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
}
