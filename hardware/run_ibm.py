#!/usr/bin/env python
"""
Schrödinger's Box — IBM Quantum hardware run.

Prepares n-qubit GHZ states — the discrete-variable cat, |0…0> + |1…1> — on a real
superconducting QPU and measures them two ways:

  1. Populations.  Measure in Z. An ideal GHZ gives half |0…0> and half |1…1> and
     nothing else. Everything else in the histogram is decoherence and readout error.

  2. Parity oscillations (MQC).  Phase-kick every qubit by phi, rotate, then measure the
     parity <Z⊗…⊗Z>. For a genuine n-body coherence the parity oscillates as cos(n·phi):
     the fringe frequency counts the components of the superposition. This is the direct
     hardware analogue of the interference fringes the site computes in phase space, where
     the fringe wavenumber grows with the separation of the components.

  Together they bound the GHZ fidelity from below:
     F >= (P_0…0 + P_1…1)/2 + C/2,        C = parity oscillation amplitude
  and F > 1/2 certifies genuine multipartite entanglement.

The script writes the RAW measurement counts to runs.json. All analysis — parity, fit,
fidelity bound — is done by the web page from those counts, so the committed artefact is
the experimental record itself and not a summary of it.

Usage
-----
  set IBM_QUANTUM_TOKEN=<your api key>          (PowerShell: $env:IBM_QUANTUM_TOKEN="...")
  set IBM_QUANTUM_CRN=<your instance CRN>       (optional on some plans)

  python hardware/run_ibm.py --dry-run          # validate circuits on a local simulator, writes nothing
  python hardware/run_ibm.py                    # submit to the least-busy real QPU
  python hardware/run_ibm.py --backend ibm_brisbane --shots 2048

A dry run NEVER writes runs.json. Only real hardware results are ever committed.
"""

import argparse, json, os, sys, time, datetime, math

SIZES  = [2, 3, 4, 5]      # GHZ widths to measure
SHOTS  = 2048
OUT    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs.json")


def build_circuits(sizes):
    """Return (circuits, index) — index describes what each circuit is, in submission order."""
    from qiskit import QuantumCircuit

    def ghz(n):
        qc = QuantumCircuit(n, n)
        qc.h(0)
        for i in range(n - 1):
            qc.cx(i, i + 1)
        return qc

    circuits, index = [], []
    for n in sizes:
        # --- populations
        qc = ghz(n)
        qc.measure(range(n), range(n))
        circuits.append(qc)
        index.append({"kind": "pop", "n": n})

        # --- parity oscillation: two full periods of cos(n·phi), 8 points per period
        pts = 16
        span = 2 * (2 * math.pi / n)
        for k in range(pts):
            phi = span * k / pts
            qc = ghz(n)
            for q in range(n):
                qc.rz(phi, q)
            for q in range(n):
                qc.ry(-math.pi / 2, q)
            qc.measure(range(n), range(n))
            circuits.append(qc)
            index.append({"kind": "parity", "n": n, "phi": phi})
    return circuits, index


def counts_to_dict(bitarray):
    """SamplerV2 BitArray -> {bitstring: count} with plain ints."""
    return {k: int(v) for k, v in bitarray.get_counts().items()}


def dry_run(sizes, shots):
    """Validate the circuits locally. Prints the parity fit; writes nothing."""
    from qiskit import transpile
    from qiskit.providers.basic_provider import BasicSimulator

    circuits, index = build_circuits(sizes)
    sim = BasicSimulator()
    tc = transpile(circuits, sim)
    res = sim.run(tc, shots=shots).result()

    print(f"dry run — {len(circuits)} circuits, {shots} shots, local simulator\n")
    for n in sizes:
        pops = None
        pts = []
        for i, meta in enumerate(index):
            if meta["n"] != n:
                continue
            c = res.get_counts(i)
            tot = sum(c.values())
            if meta["kind"] == "pop":
                z = "0" * n
                o = "1" * n
                pops = (c.get(z, 0) / tot, c.get(o, 0) / tot)
            else:
                par = sum(((-1) ** b.count("1")) * v for b, v in c.items()) / tot
                pts.append((meta["phi"], par))
        # amplitude of cos(n·phi) by projection
        num = sum(p * math.cos(n * phi) for phi, p in pts)
        den = sum(math.cos(n * phi) ** 2 for phi, p in pts)
        amp = abs(num / den) if den else 0.0
        f_lb = (pops[0] + pops[1]) / 2 + amp / 2
        print(f"  GHZ-{n}:  P|0..0>={pops[0]:.3f}  P|1..1>={pops[1]:.3f}  "
              f"C={amp:.3f}  F>={f_lb:.3f}  (ideal 1.000)")
    print("\nnothing written — dry runs never touch runs.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="validate locally, write nothing")
    ap.add_argument("--backend", default=None, help="QPU name; default = least busy")
    ap.add_argument("--shots", type=int, default=SHOTS)
    ap.add_argument("--sizes", default=",".join(map(str, SIZES)))
    args = ap.parse_args()
    sizes = [int(s) for s in args.sizes.split(",") if s.strip()]

    if args.dry_run:
        dry_run(sizes, args.shots)
        return 0

    token = os.environ.get("IBM_QUANTUM_TOKEN", "").strip()
    if not token:
        print("IBM_QUANTUM_TOKEN is not set.\n"
              "Create a free API key at https://quantum.cloud.ibm.com (Open Plan), then set it:\n"
              "  PowerShell:  $env:IBM_QUANTUM_TOKEN=\"<key>\"\n"
              "  bash:        export IBM_QUANTUM_TOKEN=<key>\n"
              "Run with --dry-run to validate the circuits without an account.", file=sys.stderr)
        return 2
    crn = os.environ.get("IBM_QUANTUM_CRN", "").strip() or None

    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

    # channel naming moved with the platform migration; try the current one, then the old one
    service = None
    errs = []
    for ch in ("ibm_quantum_platform", "ibm_cloud", "ibm_quantum"):
        try:
            service = QiskitRuntimeService(channel=ch, token=token, instance=crn)
            print(f"connected on channel '{ch}'")
            break
        except Exception as e:  # noqa: BLE001
            errs.append(f"{ch}: {e}")
    if service is None:
        print("could not connect:\n  " + "\n  ".join(errs), file=sys.stderr)
        return 3

    if args.backend:
        backend = service.backend(args.backend)
    else:
        backend = service.least_busy(operational=True, simulator=False,
                                     min_num_qubits=max(sizes))
    print(f"backend: {backend.name}  ({backend.num_qubits} qubits)")

    circuits, index = build_circuits(sizes)
    pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
    isa = pm.run(circuits)
    print(f"submitting {len(isa)} circuits × {args.shots} shots …")

    t0 = time.time()
    sampler = SamplerV2(mode=backend)
    job = sampler.run(isa, shots=args.shots)
    print(f"job id: {job.job_id()}  — waiting (queue can take a while)")
    result = job.result()
    wall = time.time() - t0
    print(f"done in {wall:.1f}s")

    runs = {}
    for i, meta in enumerate(index):
        creg = next(iter(result[i].data.keys()))
        counts = counts_to_dict(getattr(result[i].data, creg))
        r = runs.setdefault(meta["n"], {"n": meta["n"], "populations": None, "parity": []})
        if meta["kind"] == "pop":
            r["populations"] = counts
        else:
            r["parity"].append({"phi": meta["phi"], "counts": counts})

    payload = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "backend": backend.name,
        "device_qubits": backend.num_qubits,
        "shots": args.shots,
        "job_id": job.job_id(),
        "wall_seconds": round(wall, 1),
        "circuits": len(isa),
        "protocol": "GHZ populations + parity oscillation (MQC); F >= (P0+P1)/2 + C/2",
        "runs": [runs[n] for n in sorted(runs)],
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1)
    print(f"wrote {OUT}  ({os.path.getsize(OUT)/1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
