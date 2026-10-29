"""Cliente mínimo de la API personal de Learnation Leadership (`/api/v1/me`).

Se conecta con tres variables de entorno: `LEADERSHIP_URL` (https://leadership.thelearnation.com),
`LEADERSHIP_TOKEN` (el token personal de Kerwin, Setting › Conexiones) y `LEADERSHIP_SYNC=1`, el
interruptor: sin él no se llama a Leadership aunque las otras dos estén (la PC de desarrollo las
tiene cargadas para otros usos y un guardado de prueba no debe crear tareas reales).
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

TIMEOUT = 30


class LeadershipError(RuntimeError):
    """Leadership respondió con error o no se pudo hablar con él."""


def configurado():
    return (os.environ.get('LEADERSHIP_SYNC') or '').strip() == '1' \
        and bool((os.environ.get('LEADERSHIP_TOKEN') or '').strip()) \
        and bool((os.environ.get('LEADERSHIP_URL') or '').strip())


class LeadershipClient:
    def __init__(self, url=None, token=None):
        self.base = ((url or os.environ.get('LEADERSHIP_URL') or '').strip().rstrip('/')) + '/api/v1/me'
        self.headers = {
            'Authorization': f"Bearer {(token or os.environ.get('LEADERSHIP_TOKEN') or '').strip()}",
            'Accept': 'application/json',
        }

    def _pedir(self, metodo, ruta, **kwargs):
        try:
            r = requests.request(metodo, self.base + ruta, headers=self.headers, timeout=TIMEOUT, **kwargs)
        except requests.RequestException as e:
            raise LeadershipError(f'{metodo} {ruta}: {e}')
        if r.status_code >= 400:
            raise LeadershipError(f'{metodo} {ruta}: {r.status_code} {r.text[:200]}')
        return (r.json() or {}).get('data')

    def proyectos(self):
        return self._pedir('GET', '/projects', params={'status': 'all'}) or []

    def crear_proyecto(self, nombre, descripcion):
        return self._pedir('POST', '/projects', json={'name': nombre, 'description': descripcion})

    def tareas(self, project_id):
        return self._pedir('GET', '/tasks', params={'project_id': project_id, 'status': 'all'}) or []

    def crear_tarea(self, datos):
        return self._pedir('POST', '/tasks', json=datos)

    def editar_tarea(self, task_id, datos):
        return self._pedir('PATCH', f'/tasks/{task_id}', json=datos)

    def alternar_tarea(self, task_id):
        return self._pedir('POST', f'/tasks/{task_id}/toggle')

    def borrar_tarea(self, task_id):
        return self._pedir('DELETE', f'/tasks/{task_id}')
