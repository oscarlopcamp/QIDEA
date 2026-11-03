"""Integration lane: connects the quantum circuit to the classical optimiser."""

import numpy as np
from qiskit.primitives import StatevectorEstimator

from quantum.ansatz import build_ansatz
from quantum.hamiltonian import H2_HAMILTONIAN
from classical.optimizer import minimize_energy

ansatz = build_ansatz(H2_HAMILTONIAN.num_qubits)
estimator = StatevectorEstimator()
history = []


def energy(params) -> float:
    """The bridge: run the circuit with these parameters and return the measured energy."""
    result = estimator.run([(ansatz, H2_HAMILTONIAN, params)]).result()
    value = float(result[0].data.evs)
    history.append(value)
    return value


print(ansatz.draw())
rng = np.random.default_rng(seed=7)
result = minimize_energy(energy, rng.uniform(0, np.pi, ansatz.num_parameters))

exact = float(np.linalg.eigvalsh(H2_HAMILTONIAN.to_matrix()).min())
print(f"Iterations:   {len(history)}")
print(f"VQE energy:   {result.fun:.6f}")
print(f"Exact energy: {exact:.6f}")
print(f"Error:        {abs(result.fun - exact):.2e}")
