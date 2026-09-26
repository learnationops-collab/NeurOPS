"""Blueprint de la ficha unificada del lead — la superficie que sirve a los dos roles.

Por que hace falta un blueprint propio y no sirve ninguna guardia existente:

  · la de `closer` excluye a `director_comercial` con un 403 inline en cada ruta. Por eso hoy hay
    dos modales distintos para el mismo lead: el del closer habla con `/api/closer/*` y el de la
    direccion con `/api/comercial/*`, y ninguno de los dos muestra el recorrido completo;
  · la de `comercial` fuerza el alcance (a un closer le devuelve solo lo suyo), y la ficha necesita
    que cualquier closer pueda abrir cualquier lead — decision explicita del equipo, documentada en
    `closer.py` 2038-2047.

Lo que cada rol puede HACER no se resuelve escondiendo rutas: todas las rutas las alcanzan los
cinco roles, y cada escritura comprueba el bloque `permisos` de la lectura (ver
`ficha_lead_service.permisos_de`). Un boton escondido no protege nada; un 403 con motivo si.

Fuera de alcance responde **404, no 403**: el precedente es `GET /api/comercial/clientes/<id>`. Un
403 confirmaria que el recurso existe, que es informacion que quien pregunta no deberia obtener.
"""
from flask import Blueprint, jsonify
from flask_login import current_user, login_required

bp = Blueprint('ficha_api', __name__)

# Quien entra a la ficha. Los cinco roles que trabajan un lead: la direccion, el closer que la
# atiende, el setter que la genero y triage, que confirma.
ROLES_CON_ACCESO = ('admin', 'director_comercial', 'closer', 'setter', 'triage')


@bp.before_request
@login_required
def _solo_roles_con_acceso():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403


def sin_permiso(accion):
    """403 con el nombre de la accion: el frontend ya sabia que no podia, esto lo explica."""
    return jsonify({'message': f'Tu rol no puede {accion} desde la ficha del lead.',
                    'accion': accion}), 403


from app.api.ficha import escritura, lectura  # noqa: E402,F401  (cuelgan rutas del blueprint)
