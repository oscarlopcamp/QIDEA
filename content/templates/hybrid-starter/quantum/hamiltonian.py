"""Quantum lane: the observable whose lowest energy we are looking for."""

from qiskit.quantum_info import SparsePauliOp

# A two-qubit Hamiltonian in the style of the H2 molecule (reduced to two qubits).
H2_HAMILTONIAN = SparsePauliOp.from_list(
    [
        ("II", -1.0523),
        ("IZ", 0.3979),
        ("ZI", -0.3979),
        ("ZZ", -0.0113),
        ("XX", 0.1809),
    ]
)
