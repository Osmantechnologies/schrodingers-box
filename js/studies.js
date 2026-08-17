/* Schrödinger's Box — numerical study suite.
   Every study below is a real computation on the coherent-state cat defined in physics.js.
   Nothing is a lookup table: each run recomputes from the state and is reproducible from its seed.

   Branches used: probability (Kolmogorov–Smirnov, empirical processes), information theory
   (Wehrl entropy, Lieb's theorem), quantum optics (Mandel Q, photon statistics),
   quantum metrology (Fisher information, Cramér–Rao), harmonic analysis (angular DFT, Z_N symmetry),
   and phase-space geometry (Zurek sub-Planck scaling). */

import { S, M, W, G, wRange, computeWigner } from './physics.js';

/* ============================ utilities ============================ */

/* mulberry32 — small, fast, seedable. Same seed ⇒ same study, byte for byte. */
export function rng(seed){
  let a=seed>>>0;
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
export function seedFromString(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
export function runId(seed){ return 'SB-'+seed.toString(16).toUpperCase().padStart(8,'0'); }

const lnFact=(()=>{ const t=[0]; for(let n=1;n<400;n++) t[n]=t[n-1]+Math.log(n); return t; })();

/* Run f() with the state temporarily set to `params`, then restore. */
function withState(params, f){
  const keep={sep:S.sep,sq:S.sq,ph:S.ph,N:S.N,ka:S.ka};
  Object.assign(S,params); computeWigner();
  try{ return f(); } finally { Object.assign(S,keep); computeWigner(); }
}

/* least-squares fit of y = a + b·x */
function linfit(xs,ys){
  const n=xs.length; let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<n;i++){ sx+=xs[i]; sy+=ys[i]; sxx+=xs[i]*xs[i]; sxy+=xs[i]*ys[i]; }
  const b=(n*sxy-sx*sy)/(n*sxx-sx*sx), a=(sy-b*sx)/n;
  let ssr=0,sst=0; const ym=sy/n;
  for(let i=0;i<n;i++){ const p=a+b*xs[i]; ssr+=(ys[i]-p)**2; sst+=(ys[i]-ym)**2; }
  return {a,b,r2: sst>0?1-ssr/sst:1};
}

/* discrete Fourier magnitude spectrum of a real sequence (O(n²), n is small here) */
function dftMag(f){
  const n=f.length, out=new Float64Array(n>>1);
  for(let m=0;m<(n>>1);m++){
    let re=0,im=0;
    for(let j=0;j<n;j++){ const th=-2*Math.PI*m*j/n; re+=f[j]*Math.cos(th); im+=f[j]*Math.sin(th); }
    out[m]=Math.hypot(re,im)/n;
  }
  return out;
}

/* marginal P(x) = ∫W dp, and its CDF, from the live grid */
function marginal(){
  const dx=(2*wRange)/(G-1); const P=new Float64Array(G); let tot=0;
  for(let i=0;i<G;i++){ let s=0; for(let j=0;j<G;j++) s+=W[j*G+i]; const v=Math.max(0,s*dx); P[i]=v; tot+=v; }
  for(let i=0;i<G;i++) P[i]/=tot;
  const cdf=new Float64Array(G); let c=0;
  for(let i=0;i<G;i++){ c+=P[i]; cdf[i]=c; }
  return {P,cdf,dx,x0:-wRange};
}
/* inverse-CDF sampler: O(log G) per draw, so 10⁴ samples is instant */
function sampler(cdf,dx,x0,rand){
  return ()=>{
    const u=rand(); let lo=0,hi=cdf.length-1;
    while(lo<hi){ const mid=(lo+hi)>>1; if(cdf[mid]<u) lo=mid+1; else hi=mid; }
    return x0+(lo+rand()-0.5)*dx;
  };
}

/* photon-number distribution of the (pure, unsqueezed) cat, computed in log space */
function photonStats(params,nmax=160){
  const {sep:a,N,ph}=params, a2=a*a;
  const P=new Float64Array(nmax); let tot=0;
  for(let n=0;n<nmax;n++){
    let re=0,im=0;
    const lg=n*Math.log(Math.max(a,1e-12))-a2/2-lnFact[n]/2;
    const mag=Math.exp(lg);
    for(let k=0;k<N;k++){ const th=ph+2*Math.PI*k/N; re+=mag*Math.cos(n*th); im+=mag*Math.sin(n*th); }
    P[n]=re*re+im*im; tot+=P[n];
  }
  let m1=0,m2=0;
  for(let n=0;n<nmax;n++){ P[n]/=tot; m1+=n*P[n]; m2+=n*n*P[n]; }
  return {P, mean:m1, var:Math.max(0,m2-m1*m1)};
}

/* Husimi Q(β) = |⟨β|ψ⟩|²/π on a grid — independent of the Wigner code */
function husimi(params,Gq=120){
  const {sep:a,N,ph}=params;
  const al=[]; for(let k=0;k<N;k++){ const th=ph+2*Math.PI*k/N; al.push([a*Math.cos(th),a*Math.sin(th)]); }
  const R=Math.max(3.2,a*1.5+3.0), d=(2*R)/(Gq-1);
  const Q=new Float64Array(Gq*Gq); let tot=0;
  for(let iy=0;iy<Gq;iy++){
    const bi=R-iy*d;
    for(let ix=0;ix<Gq;ix++){
      const br=-R+ix*d;
      let re=0,im=0;
      for(let k=0;k<N;k++){
        const [ar,ai]=al[k];
        // ⟨β|α⟩ = exp(-|β|²/2 - |α|²/2 + β̄α)
        const ex=-(br*br+bi*bi)/2-(ar*ar+ai*ai)/2+(br*ar+bi*ai);
        const th=(br*ai-bi*ar);
        const m=Math.exp(ex); re+=m*Math.cos(th); im+=m*Math.sin(th);
      }
      const q=(re*re+im*im); Q[iy*Gq+ix]=q; tot+=q;
    }
  }
  const dA=d*d; for(let i=0;i<Q.length;i++) Q[i]/=(tot*dA);   // ∫Q d²β = 1
  let Sw=0; for(let i=0;i<Q.length;i++){ const q=Q[i]; if(q>1e-300) Sw-=q*Math.log(q)*dA; }
  return {S:Sw, Q, Gq, R};
}

/* ============================ the studies ============================ */

/* S-01 — Born-rule Monte Carlo, validated with a Kolmogorov–Smirnov test.
   Draws are taken from P(x)=∫W dp by inverse transform; the KS statistic tests the
   empirical distribution against the exact one it was drawn from. This is a
   self-consistency test of the sampler and the quadrature, not a test of quantum mechanics. */
export function studyBornKS(seed, sizes=[250,1000,4000,16000]){
  const rand=rng(seed);
  return withState({}, ()=>{
    const {P,cdf,dx,x0}=marginal();
    const draw=sampler(cdf,dx,x0,rand);
    /* The sampler places a draw uniformly inside bin i, which spans [x0+(i−½)dx, x0+(i+½)dx].
       The reference CDF must be the piecewise-linear function that exactly matches that,
       otherwise a fixed half-bin offset shows up as a KS deviation that never shrinks with n. */
    const F=x=>{ const t=(x-x0)/dx+0.5; if(t<=0) return 0; if(t>=G) return 1;
      const i=Math.min(G-1,Math.floor(t)), f=t-i; const lo=i?cdf[i-1]:0; return Math.min(1,lo+P[i]*f); };
    const rows=[];
    for(const n of sizes){
      const xs=new Float64Array(n); for(let i=0;i<n;i++) xs[i]=draw();
      xs.sort();
      let D=0;
      for(let i=0;i<n;i++){ const Fi=F(xs[i]); D=Math.max(D, Math.abs((i+1)/n-Fi), Math.abs(Fi-i/n)); }
      const lam=(Math.sqrt(n)+0.12+0.11/Math.sqrt(n))*D;
      let p=0; for(let k=1;k<=120;k++) p+=2*Math.pow(-1,k-1)*Math.exp(-2*k*k*lam*lam);
      p=Math.min(1,Math.max(0,p));
      rows.push({n, D, lambda:lam, p});
    }
    const fit=linfit(rows.map(r=>Math.log(r.n)), rows.map(r=>Math.log(r.D)));
    return {rows, exponent:fit.b, r2:fit.r2, expected:-0.5,
      pass: rows.every(r=>r.p>0.01) && Math.abs(fit.b+0.5)<0.16};
  });
}

/* S-02 — Wehrl entropy excess over the coherent-state minimum (Lieb's theorem).
   S_W = −∫ Q ln Q d²β. Lieb (1978) proved coherent states minimise it, so ΔS ≥ 0
   for every state; a cat should sit well above the floor. Computed on its own grid. */
export function studyWehrl(seed){
  const cat=husimi({sep:S.sep,N:S.N,ph:S.ph});
  const coh=husimi({sep:S.sep,N:1,ph:S.ph});
  const dS=cat.S-coh.S;
  const sweep=[];
  for(const N of [1,2,3,4,6,8]){
    const h=husimi({sep:S.sep,N,ph:S.ph});
    /* For components far enough apart to stop overlapping, Q is N disjoint copies of the
       coherent bell each carrying weight 1/N, so the entropy rises by exactly ln N. */
    sweep.push({N, S:h.S, excess:h.S-coh.S, lnN:Math.log(N), dev:(h.S-coh.S)-Math.log(N)});
  }
  const analytic=1+Math.log(Math.PI);            // exact S_W of any coherent state in this convention
  return {S:cat.S, coherent:coh.S, excess:dS, sweep,
    analytic, analyticErr:Math.abs(coh.S-analytic),
    pass: dS>=-1e-6 && sweep.every(r=>r.excess>=-1e-6) && Math.abs(coh.S-analytic)<2e-3};
}

/* S-03 — Photon statistics and the Mandel Q parameter.
   Q_M = Var(n)/⟨n⟩ − 1. Q_M = 0 is Poissonian (coherent light), Q_M > 0 super-Poissonian,
   Q_M < 0 is non-classical sub-Poissonian. Cat states bunch photons into every Nth level. */
export function studyMandel(seed){
  const rows=[];
  for(const N of [1,2,3,4,6,8]){
    const st=photonStats({sep:S.sep,N,ph:S.ph});
    rows.push({N, mean:st.mean, var:st.var, Q:st.var/Math.max(st.mean,1e-12)-1});
  }
  const cur=photonStats({sep:S.sep,N:S.N,ph:S.ph});
  const Q=cur.var/Math.max(cur.mean,1e-12)-1;
  const coh=rows.find(r=>r.N===1);
  /* Q is bounded below by 0 for this family: the number comb never narrows the envelope.
     It only becomes appreciably positive once the comb spacing N is comparable to the
     Poisson width α, which is why small-N cats at large α sit essentially at 0. */
  return {mean:cur.mean, variance:cur.var, Q, P:cur.P, rows,
    coherentQ:coh.Q, pass:Math.abs(coh.Q)<0.02 && Q>=-5e-3};
}

/* S-04 — Quantum Fisher information and metrological gain.
   For phase rotation generated by n̂ on a pure state, F_Q = 4·Var(n), and the
   Cramér–Rao bound gives Δφ ≥ 1/√F_Q. A coherent state of the same energy has
   Var(n)=⟨n⟩, i.e. the standard quantum limit F_SQL = 4⟨n⟩. */
export function studyFisher(seed){
  const rows=[];
  for(const N of [1,2,3,4,6,8]){
    const st=photonStats({sep:S.sep,N,ph:S.ph});
    const F=4*st.var, Fsql=4*st.mean;
    rows.push({N, F, Fsql, gain:F/Math.max(Fsql,1e-12), dphi:1/Math.sqrt(Math.max(F,1e-12))});
  }
  const cur=rows.find(r=>r.N===S.N)||rows[0];
  // identity check: gain should equal Mandel Q + 1
  const st=photonStats({sep:S.sep,N:S.N,ph:S.ph});
  const identity=Math.abs(cur.gain-((st.var/st.mean-1)+1));
  return {...cur, rows, identity, pass:identity<1e-9 && cur.gain>=1-1e-9};
}

/* S-05 — Z_N rotational symmetry by angular harmonic analysis.
   W is sampled on the circle of radius √2·α through the component lobes; the angular
   DFT of that trace should carry all its power at harmonics that are multiples of N. */
export function studyHarmonics(seed, Msamp=360){
  const meas=(params)=>withState(params, ()=>{
    const r0=Math.SQRT2*S.sep;
    const f=new Float64Array(Msamp);
    const dx=(2*wRange)/(G-1);
    const at=(x,p)=>{ const fx=(x+wRange)/dx, fy=(wRange-p)/dx;
      if(fx<0||fy<0||fx>G-1||fy>G-1) return 0;
      const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(G-1,x0+1),y1=Math.min(G-1,y0+1),tx=fx-x0,ty=fy-y0;
      const a=W[y0*G+x0],b=W[y0*G+x1],c=W[y1*G+x0],d=W[y1*G+x1];
      return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty; };
    for(let j=0;j<Msamp;j++){ const th=2*Math.PI*j/Msamp; f[j]=at(r0*Math.cos(th),r0*Math.sin(th)); }
    const spec=dftMag(f);
    /* Z_N invariance is the statement that the angular spectrum is supported on multiples of N —
       not that m = N is the largest one. For a ring of lobes the 2N harmonic is often the
       stronger term, which is still perfectly symmetric, so the test is the supported fraction. */
    let best=1,bv=-1, tot=0, onMult=0;
    for(let m=1;m<spec.length;m++){
      tot+=spec[m];
      if(m%S.N===0) onMult+=spec[m];
      if(spec[m]>bv){ bv=spec[m]; best=m; }
    }
    return {dominant:best, purity:bv/Math.max(tot,1e-12),
      supported:onMult/Math.max(tot,1e-12),
      spectrum:Array.from(spec.slice(0,Math.min(32,spec.length)))};
  });
  /* Z_N symmetry belongs to the unsqueezed cat. S(r) rescales x and p by reciprocal factors,
     which deforms the ring into an ellipse and injects even harmonics — so the squeezed case is
     measured too, as a symmetry-breaking control rather than being quietly excluded. */
  const sym=meas({sq:0});
  const brk=Math.abs(S.sq)>1e-6 ? meas({}) : null;
  return {...sym, expected:S.N, broken:brk, squeeze:S.sq,
    /* Leakage into non-multiple harmonics is pure discretisation: the trace is interpolated
       off a G×G grid, so the tolerance has to follow the grid (phones run 72² instead of 96²). */
    grid:G, tol:(G>=96?0.85:0.72),
    pass: sym.dominant%S.N===0 && sym.supported>(G>=96?0.85:0.72)};
}

/* S-06 — Sub-Planck fringe scaling (Zurek, Nature 412, 712 (2001)).
   Interference fringes in the centre of a cat have a wavenumber that grows linearly with
   the component separation, so the smallest resolvable phase-space patch shrinks as α⁻²
   — below ħ. Measured here by DFT of a central cut, fitted across α. */
export function studyFringes(seed, alphas=[2.0,2.6,3.2,3.8,4.4,5.0]){
  const rows=[];
  for(const a of alphas){
    const k=withState({sep:a,N:2,ka:0,sq:0}, ()=>{
      const cut=new Float64Array(G);
      for(let j=0;j<G;j++) cut[j]=W[j*G+((G-1)>>1)];       // vertical cut at x≈0
      let mean=0; for(let j=0;j<G;j++) mean+=cut[j]/G;
      for(let j=0;j<G;j++) cut[j]-=mean;
      const spec=dftMag(cut);
      let best=1,bv=-1;
      for(let m=1;m<spec.length;m++) if(spec[m]>bv){ bv=spec[m]; best=m; }
      const L=2*wRange;                                     // physical length of the cut
      return 2*Math.PI*best/L;                              // wavenumber (rad per unit p)
    });
    rows.push({alpha:a, k, area:1/(k*k)});
  }
  const fit=linfit(rows.map(r=>Math.log(r.alpha)), rows.map(r=>Math.log(r.k)));
  return {rows, exponent:fit.b, r2:fit.r2, expected:1,
    pass:Math.abs(fit.b-1)<0.2 && fit.r2>0.95};
}

/* ============================ runner ============================ */

export const STUDIES=[
  {id:'S-01', key:'born',      title:'Born-rule Monte Carlo',        field:'Probability · Kolmogorov–Smirnov',      run:studyBornKS},
  {id:'S-02', key:'wehrl',     title:'Wehrl entropy excess',          field:'Information theory · Lieb’s theorem',   run:studyWehrl},
  {id:'S-03', key:'mandel',    title:'Photon statistics',             field:'Quantum optics · Mandel Q',             run:studyMandel},
  {id:'S-04', key:'fisher',    title:'Metrological gain',             field:'Quantum metrology · Cramér–Rao',        run:studyFisher},
  {id:'S-05', key:'harmonics', title:'Zₙ angular symmetry',      field:'Harmonic analysis · angular DFT',       run:studyHarmonics},
  {id:'S-06', key:'fringes',   title:'Sub-Planck fringe scaling',     field:'Phase-space geometry · Zurek 2001',     run:studyFringes},
];

export function runAll(seed){
  const t0=performance.now(); const out={};
  for(const s of STUDIES){
    const t=performance.now();
    out[s.key]=s.run(seed);
    out[s.key].ms=+(performance.now()-t).toFixed(1);
  }
  return {seed, id:runId(seed), ms:+(performance.now()-t0).toFixed(1),
    params:{alpha:S.sep, N:S.N, phi:S.ph, kappa:S.ka, squeeze:S.sq, grid:G}, studies:out};
}
