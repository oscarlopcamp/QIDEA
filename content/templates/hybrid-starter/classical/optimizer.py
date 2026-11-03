"""Classical lane: a standard optimiser. It knows nothing about quantum computing."""

from scipy.optimize import minimize


def minimize_energy(cost, initial_params, max_iterations: int = 200):
    """Minimise `cost(params) -> float` with COBYLA, a gradient-free method."""
    return minimize(cost, initial_params, method="COBYLA", options={"maxiter": max_iterations})
