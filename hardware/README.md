# Hardware runs

Real measurements from an IBM Quantum superconducting QPU. This directory holds the
submission script and the raw counts it brings back. **`runs.json` is written only by a real
hardware job** — the study page shows an explicit "awaiting run" state when it is absent, and
never substitutes a simulation for it.

## The experiment

An n-qubit **GHZ state**, |0…0⟩ + |1…1⟩, is the discrete-variable cat: a superposition of two
maximally distinct classical outcomes. Two measurements are made on it.

| | What is measured | Ideal result |
|---|---|---|
| Populations | all qubits in Z | half \|0…0⟩, half \|1…1⟩, nothing else |
| Parity oscillation (MQC) | phase-kick by φ, rotate, measure ⟨Z⊗…⊗Z⟩ | cos(n·φ) |

The parity fringe frequency **counts the components of the superposition** — the same statement
the site makes in phase space, where the fringe wavenumber grows with component separation
(study S-06). Together the two measurements bound the fidelity from below,

    F ≥ (P|0…0⟩ + P|1…1⟩)/2 + C/2

with C the parity oscillation amplitude. **F > ½ certifies genuine multipartite entanglement** —
that is the claim the hardware either supports or fails to support, and the page reports whichever.

## Running it

Free access is IBM Quantum's Open Plan (10 minutes of QPU time per 28-day window; a full run
here costs well under a minute). Create an API key at <https://quantum.cloud.ibm.com>, then:

```bash
pip install qiskit qiskit-ibm-runtime

# validate the circuits locally first — no account needed, writes nothing
python hardware/run_ibm.py --dry-run

# submit to the least-busy real QPU
export IBM_QUANTUM_TOKEN=<your api key>     # PowerShell: $env:IBM_QUANTUM_TOKEN="..."
export IBM_QUANTUM_CRN=<instance CRN>       # only if your plan requires it
python hardware/run_ibm.py
```

Options: `--backend ibm_brisbane`, `--shots 2048`, `--sizes 2,3,4,5`.

The job is queued, so it can take anywhere from a minute to a few hours depending on demand.
When it returns, `runs.json` appears here and the study page renders it automatically —
backend name, job id and timestamp included, so any claim on the page is checkable against
IBM's own record of the job.

The token is read from the environment and never written to disk or committed.
