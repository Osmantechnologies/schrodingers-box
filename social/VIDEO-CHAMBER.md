# Video post — the chamber demo. First person. Numbers checked 2026-11-16.
Record the lab (lab.html) in one take, ~60–90s: boot → drag orbit → Components 2→6 →
Separation up → Decoherence κ up (fringes die) → κ back → OBSERVE → collapse + result card →
Esc re-prepare. 1600×900. Attach the video; no other images needed.

## Long version

**This is what a cat state looks like when you are allowed to touch it.**

What you are watching: a live quantum state, not an animation of one. Every panel on screen is computed from the same state vector while the video runs, a superposition of up to 6 coherent states held on a 96×96 phase-space grid, re-evaluated as I drag the sliders.

**The panels.** Left: the controls, separation α from 0 to 10, squeeze, phase, 2, 3 or 6 components, decoherence κ. Centre: the chamber, one crisp cat and her temporal copies, spaced by the same α that spaces the physics. Right: negativity, purity and fidelity read live, the Wigner function W(x,p) with its interference fringes, and the photon-number comb that keeps only every Nth level. Bottom: OBSERVE.

**What drives it.** One state, |ψ⟩, a ring of coherent components. Move a slider and the state changes; the Wigner plot, the telemetry, the comb and the cat all follow from it, none of them scripted. Push κ and watch the order of death: the fringes between the lobes go first, the lobes survive. That ordering is the photon-loss law, and it is why real cats never superpose.

**The physics is honest.** A two-lobe cat's negativity reads 0.3175; the textbook value is 1/π = 0.318. The fringes you see dip below zero, which no classical distribution can do. OBSERVE does not flip a coin: it draws one sample from the state's own marginal, and two hundred presses pile up into the distribution on screen, because they have no choice.

**The result.** At the press, the copies converge, one cat remains, and the readouts snap to a pure state: negativity 0.000, purity 1.000. The card names the branch she collapsed into and the exact position that was drawn. Esc, and she is six places at once again.

**The stack.** Closed-form coherent-state overlaps, no lookup tables. A generated cat mesh rendered as a hologram, the one illustrative layer, a picture of the readouts. Six seeded studies re-run against Lieb, Zurek and the KS test on every load. MIT, in the open.

If she comes up DEAD, the distribution said so.

github.com/Osmantechnologies/schrodingers-box

## Short version (≤280, link included)

> A live cat state, not an animation of one. Fringes that dip below zero, decoherence that kills them in the right order, an OBSERVE button that samples the Born rule. If she comes up DEAD, the distribution said so. https://osmantechnologies.github.io/schrodingers-box/lab.html
