from typing import Any, Tuple, Optional

class BaseService:
    """
    Clase base para todos los servicios.
    Provee métodos utilitarios comunes y estandarización de respuestas.
    """
    
    @staticmethod
    def success(data: Any = None, message: str = "Operación exitosa") -> Tuple[dict, int]:
        return {
            "success": True,
            "message": message,
            "data": data
        }, 200

    @staticmethod
    def error(message: str, code: int = 400, errors: Any = None) -> Tuple[dict, int]:
        return {
            "success": False,
            "message": message,
            "errors": errors
        }, code
