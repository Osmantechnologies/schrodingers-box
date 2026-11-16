# First post — Schrödinger's Box. One person, flowing, no section headers. Numbers checked 2026-11-16.
Attach in order: hero.jpg → p00-ref.jpg (paper) → p02-lab.jpg (instrument) → p01.jpg (six lobes).
Long version needs X Premium (over 280). Short version verified below.

## Long version

**Open Schrödinger's box.**

The cat is 91 years old. Schrödinger wrote it in 1935 as a complaint, a joke about taking superposition literally, and the world memorised it backwards: a question with two answers. Since September 2023 a real cat named Schrödinger has been missing; her owner wrote "we don't know if our cat is alive or dead," and the post is still up. She has been unresolved for 3 years.

In June, Oxford rebuilt the thought experiment in one trapped strontium ion. Saner et al., Phys. Rev. X 16, 021049: superpositions sculpted by mid-circuit measurement from squeezed, trisqueezed and quadsqueezed components, parts with no classical counterpart at all. Sixfold symmetry, six components where the story says two. Wigner negativity confirmed, the signature no classical mixture can fake. "A tool to sculpt the quantum superposition into almost any shape." The two-answer cat did not survive the paper. I asked a smaller question: everyone knows the box, so why does nobody get to open one?

So I built it. A cat state that lives in your browser, computed on a 96×96 phase-space grid, every frame, from the state itself. You set how far apart her branches sit, 2, 3 or 6 of them, and how fast the world leaks in. The ripples between the lobes are the interference; where they dip below zero you are looking at the part of her that has no classical version. Pressing OBSERVE draws one outcome from the state's own distribution, the Born rule, not a coin flip.

Then I made the box prove itself. Six studies re-run against published theory on every page load, reproducible from a seed. A two-lobe cat's negativity comes out at 0.3175 against the textbook 1/π = 0.318. The Wehrl entropy of a coherent state lands on the exact value 1 + ln π to 8 parts in 10¹⁴. The entropy excess of the cat counts her own components: ln 2 = 0.6931, ln 3 = 1.0983, to four decimals. The fine structure in her centre shrinks with separation at a fitted exponent of 0.955 against Zurek's predicted 1. The repo is MIT, because an experiment you cannot inspect is a demo.

The binary was never the physics. It was an assumption packed into the box in 1935 and never taken back out: a superposition is not two options, it is inhabited space between outcomes, and its occupants owe the classical world nothing. Oxford showed that in an ion. The box shows it to anyone with a browser. Next comes hardware, the same cat prepared on a superconducting processor, parity fringes counting her components, the protocol written and waiting for its run.

Sources: Saner, Băzăvan, Webb, Araneda, Lucas, Ballance, Srinivas, Phys. Rev. X 16, 021049 (2026). Zurek, Nature 412, 712 (2001). Lieb, Commun. Math. Phys. 62, 35 (1978). E. Musk on X, 17 September 2023. github.com/Osmantechnologies/schrodingers-box.

## Short version (≤280, link included)

> Schrödinger's cat is 91 and told as alive-or-dead. In June, Oxford built cat states with six parts, not two. So I built the box: a live cat state to sculpt and collapse in your browser. Negativity 0.3175 vs textbook 1/π. https://osmantechnologies.github.io/schrodingers-box/
