"""Quantum lane: the parameterised circuit whose parameters the optimiser tunes."""

from qiskit import QuantumCircuit
from qiskit.circuit import ParameterVector


def build_ansatz(num_qubits: int = 2) -> QuantumCircuit:
    """Two layers of RY rotations with an entangling CX between them."""
    theta = ParameterVector("θ", 2 * num_qubits)
    qc = QuantumCircuit(num_qubits)
    for q in range(num_qubits):
        qc.ry(theta[q], q)
    for q in range(num_qubits - 1):
        qc.cx(q, q + 1)
    for q in range(num_qubits):
        qc.ry(theta[num_qubits + q], q)
    return qc
