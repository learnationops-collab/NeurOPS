"""Un monto que llega de un formulario o de la API: número finito y no negativo."""
import math


def monto_valido(valor):
    """El monto como float, o None si no es un número, es NaN/infinito o es negativo."""
    try:
        monto = float(valor)
    except (TypeError, ValueError):
        return None
    return monto if math.isfinite(monto) and monto >= 0 else None
