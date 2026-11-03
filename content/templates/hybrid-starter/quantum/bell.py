"""Quantum lane: the smallest entangled state. Run this file on its own."""

from qiskit import QuantumCircuit
from qiskit.visualization import plot_histogram

from qidea import LocalSimulator

qc = QuantumCircuit(2, name="Bell state")
qc.h(0)
qc.cx(0, 1)
qc.measure_all()

qc.draw("mpl")  # shows in QIDEA's Results panel

counts = LocalSimulator().run(qc, shots=1024).result().get_counts()
print(counts)
plot_histogram(counts, title="Bell state")
