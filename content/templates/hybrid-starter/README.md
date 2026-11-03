# {{name}}

A hybrid quantum–classical project: a **variational quantum eigensolver (VQE)** that
finds the ground-state energy of a small two-qubit Hamiltonian.

The code is split into the three QIDEA lanes:

| Lane | Folder | Role |
|---|---|---|
| Quantum | `quantum/` | The parameterised circuit (ansatz) and the Hamiltonian |
| Classical | `classical/` | The optimiser that tunes the circuit parameters |
| Integration | `integration/` | The loop that connects both sides |

Open `integration/main.py` and press **Run** (or Ctrl/Cmd + Enter).
