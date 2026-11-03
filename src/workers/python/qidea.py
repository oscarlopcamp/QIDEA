"""QIDEA helpers for your Python code.

    from qidea import LocalSimulator, show_counts, show_circuit

    counts = LocalSimulator().run(qc, shots=1024).result().get_counts()
    show_circuit(qc)
    show_counts(counts)

Qiskit's own `plot_histogram(counts)` and `qc.draw("mpl")` also show their result in
QIDEA's Results panel.
"""

import json as _json

import _qidea_native

__version__ = "0.1.0"
__all__ = ["LocalSimulator", "get_backend", "show_counts", "show_circuit", "plot_histogram", "circuit_to_ir"]


# --------------------------------------------------------------------------- results


def _as_counts(data):
    """Accept a counts dict, a Qiskit Counts, a result with get_counts(), or a BitArray."""
    if hasattr(data, "get_counts"):
        data = data.get_counts()
    return {str(k): int(v) for k, v in dict(data).items()}


def show_counts(counts, title="Measurement results"):
    """Show measurement counts as a histogram in the Results panel."""
    _qidea_native.emit("histogram", _json.dumps({"title": str(title), "counts": _as_counts(counts)}))


def plot_histogram(data, figsize=None, color=None, number_to_keep=None, sort="asc",
                   target_string=None, legend=None, bar_labels=True, title=None, ax=None, filename=None):
    """Drop-in replacement for qiskit.visualization.plot_histogram."""
    if isinstance(data, (list, tuple)):
        for i, d in enumerate(data):
            label = legend[i] if legend and i < len(legend) else f"Execution {i + 1}"
            show_counts(d, f"{title} – {label}" if title else label)
    else:
        show_counts(data, title or "Measurement results")


# --------------------------------------------------------------------------- circuits


def _param(p):
    try:
        return float(p)
    except (TypeError, ValueError):
        return str(p)


def circuit_to_ir(circuit):
    """Describe a QuantumCircuit as plain data for QIDEA's circuit view."""
    return {
        "name": circuit.name,
        "qubits": [_bit_label(circuit, q) for q in circuit.qubits],
        "clbits": [_bit_label(circuit, c) for c in circuit.clbits],
        "ops": [
            {
                "name": inst.operation.name,
                "qubits": [circuit.find_bit(q).index for q in inst.qubits],
                "clbits": [circuit.find_bit(c).index for c in inst.clbits],
                "params": [_param(p) for p in getattr(inst.operation, "params", [])],
            }
            for inst in circuit.data
        ],
    }


def _bit_label(circuit, bit):
    loc = circuit.find_bit(bit)
    if loc.registers:
        reg, idx = loc.registers[0]
        return f"{reg.name}{idx}" if reg.size > 1 else reg.name
    return f"bit{loc.index}"


def show_circuit(circuit, title=None):
    """Draw a circuit in the Results panel."""
    payload = {"title": str(title or circuit.name), "circuit": circuit_to_ir(circuit)}
    _qidea_native.emit("circuit", _json.dumps(payload))


# --------------------------------------------------------------------------- backend


class _Result:
    def __init__(self, counts_list, shots, backend_name):
        self._counts = counts_list
        self.shots = shots
        self.backend_name = backend_name

    def get_counts(self, experiment=None):
        if experiment is None:
            return self._counts[0] if len(self._counts) == 1 else list(self._counts)
        return self._counts[experiment]


class _Job:
    def __init__(self, result):
        self._result = result

    def result(self):
        return self._result

    def status(self):
        return "DONE"


class LocalSimulator:
    """QIDEA's in-browser state-vector simulator.

    Real quantum hardware will plug in behind the same `run()` interface, so code written
    against this backend keeps working when you switch.
    """

    name = "qidea_local_simulator"

    @property
    def max_qubits(self):
        return int(_qidea_native.max_qubits())

    def run(self, circuits, shots=1024, seed=None):
        from qiskit import qasm2

        single = not isinstance(circuits, (list, tuple))
        batch = [circuits] if single else list(circuits)
        counts = []
        for qc in batch:
            if qc.num_parameters:
                raise ValueError(
                    f"Circuit '{qc.name}' has unbound parameters {sorted(p.name for p in qc.parameters)}. "
                    "Bind them first with qc.assign_parameters(values)."
                )
            if not qc.num_clbits:
                raise ValueError(f"Circuit '{qc.name}' has no measurements. Add qc.measure_all() before running.")
            out = _json.loads(_qidea_native.run_qasm(qasm2.dumps(qc), int(shots), -1 if seed is None else int(seed)))
            counts.append(out["counts"])
        return _Job(_Result(counts, int(shots), self.name))

    def __repr__(self):
        return f"<LocalSimulator max_qubits={self.max_qubits}>"


def get_backend(name="local_simulator"):
    """Return a backend by name. Only the local simulator exists today."""
    if name not in ("local_simulator", LocalSimulator.name):
        raise ValueError(f"Unknown backend '{name}'. Available: local_simulator")
    return LocalSimulator()


# --------------------------------------------------------------------------- Qiskit hooks


def _install_qiskit_hooks():
    """Route Qiskit's matplotlib-based plots to QIDEA's Results panel."""
    import qiskit.visualization as viz
    from qiskit import QuantumCircuit

    viz.plot_histogram = plot_histogram
    original_draw = QuantumCircuit.draw

    def draw(self, output=None, *args, **kwargs):
        if output == "mpl":
            show_circuit(self)
            return None
        return original_draw(self, output, *args, **kwargs)

    draw.__doc__ = original_draw.__doc__
    QuantumCircuit.draw = draw
