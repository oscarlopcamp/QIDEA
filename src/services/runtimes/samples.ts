/** A Bell-state circuit: the smallest program that proves Qiskit works end to end. */
export const BELL_CHECK = `from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler
from qidea import show_circuit, show_counts

qc = QuantumCircuit(2, name="Bell state")
qc.h(0)
qc.cx(0, 1)
qc.measure_all()
print(qc.draw())

result = StatevectorSampler(seed=7).run([qc], shots=1024).result()
counts = result[0].data.meas.get_counts()
print("Counts:", counts)
show_circuit(qc)
show_counts(counts, "Bell state")
`
