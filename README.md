# Schrödinger's Box

> *"To this day, we don't know if our cat (Schrödinger), is alive or dead."* — Elon Musk, 17 Sep 2023

An interactive quantum observation chamber. A cat state lives inside a WebGL box; every number on the page — the Wigner function, negativity, purity, fidelity, photon statistics, and the result you get when you press **OBSERVE** — is computed from the actual state vector. Nothing is typed in.

**Live:** https://lumiotradingbot-cyber.github.io/schrodingers-box/

![Schrödinger's Box](assets/reference-mockup.png)

## What's real

The state is a coherent-state cat: an equal superposition of *N* coherent states |α<sub>k</sub>⟩ on a ring in phase space, α<sub>k</sub> = α·e<sup>i(2πk/N + φ)</sup>.

| Control | What it does to the state |
|---|---|
| **Separation α** | Ring radius. ⟨n⟩ = α². |
| **Squeeze r** | Applies S(r) to the whole state — a canonical rescaling W(x,p) → W(x·e<sup>r</sup>, p·e<sup>−r</sup>). |
| **Phase φ** | Rotates the ring. When the clock runs, the state also rotates under free evolution H = ħωa<sup>†</sup>a. |
| **Components** | N = 2, 3 or 6. Sixfold symmetry reproduces the Oxford PRX figure. |
| **Decoherence κ** | Damps coherences by e<sup>−0.15κ·\|α<sub>j</sub>−α<sub>k</sub>\|²</sup> — the photon-loss form: distant branches lose their fringes first. |
| **OBSERVE** | Draws one sample from the marginal P(x) = ∫W dp and reports which branch it belongs to. Repeat 200 times and `hist()` converges to P(x). |

Metrics, all numerical integrals over a 96×96 grid (72×72 on phones):

- **Negativity** — ∫<sub>W<0</sub> |W| d²β. Zero for any classical state. For N=2 it converges to 1/π ≈ 0.318, the textbook value.
- **Purity** — Tr ρ² = π ∫W² d²β. Reads 0.9999 at κ=0.
- **Fidelity** — π ∫ W·W<sub>pure</sub> d²β, overlap with the undamped cat.
- **P(n)**, ⟨n⟩, parity — from ψ<sub>n</sub> ∝ Σ<sub>k</sub> α<sub>k</sub><sup>n</sup>e<sup>−|α|²/2</sup>/√n!.

The 3D chamber is illustrative: the point-cloud cat is seeded from a generated image, and its temporal copies are placed by the same α, φ, N and κ. The readouts are real; the cat is a picture of the readouts.

## Terminal

Type `help` in the bottom bar. `psi()` prints the ket. `wigner(x,p)` evaluates W at a point. `hist()` shows your observation histogram. The state is also exposed on `window.__PSI` — `__PSI.tex()` prints it as LaTeX.

## Keys

`Space` play/pause · `O` observe · `Esc` reset / close · drag to orbit · wheel to zoom

## Run locally

Any static server — ES modules won't load over `file://`:

```bash
python -m http.server 8080
```

then open http://localhost:8080. No build step. `vendor/three.module.js` is Three.js r169 (MIT).

## The paper

Saner, Băzăvan, Webb, Araneda, Lucas, Ballance, Srinivas — *Generating Arbitrary Superpositions of Nonclassical Quantum Harmonic Oscillator States*, Phys. Rev. X **16**, 021049 (2026). Oxford's trapped-ion group built superpositions whose components are themselves squeezed, trisqueezed and quadsqueezed, using a mid-circuit measurement to project the ion's motion into the shape they wanted.

> "This approach gave us a tool to sculpt the quantum superposition into almost any shape." — Sebastian Saner

## Licence

MIT. Cat asset generated; Three.js MIT.
