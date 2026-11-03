/** A Bell-state circuit: the smallest program that proves Qiskit works end to end. */
export const BELL_CHECK = `from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler

qc = QuantumCircuit(2)
qc.h(0)
qc.cx(0, 1)
qc.measure_all()
print(qc.draw())

result = StatevectorSampler(seed=7).run([qc], shots=1024).result()
print("Counts:", result[0].data.meas.get_counts())
`
