"""La categoría de cada nota de Meet: venta, sesión con estudiante, reunión del equipo, entrevista u otra.

Se decide en este orden y gana la primera:
1. La que se eligió a mano para esa nota (`category_manual`).
2. La regla de su serie (la reunión recurrente: «Educational Team», «Scale Session»): se elige una vez y
   vale para todas las notas de la serie, también las que lleguen después. Viven en la integración
   (conexion.reglas()).
3. Tiene agenda de Work: venta.
4. Palabras del título (PALABRAS).
5. Algún invitado tiene suscripción en Work: estudiante.
6. Sin invitados de afuera: equipo. Si no, otra.
"""
import re

from app.models import Subscription

CATEGORIAS = {
    'sales': 'Venta',
    'student': 'Sesión con estudiante',
    'team': 'Reunión del equipo',
    'interview': 'Entrevista',
    'other': 'Otra',
}

# Probadas contra las 810 notas del Drive de santiago@ (05/11/2026). La primera que coincide gana.
PALABRAS = (
    ('sales', re.compile(r'\[plan\]', re.I)),
    ('interview', re.compile(r'entrevista|reclutamiento|hiring|interview', re.I)),
    ('student', re.compile(r'scale session|consultor[ií]a|consulting session|ns session|exam session|tesis|'
                           r'hall of fame|sesi[oó]n privada|acompañamiento', re.I)),
    ('team', re.compile(r'\bteam\b|closers|setters|rrhh|fulfillment|meeting|onboarding|formaci[oó]n|'
                        r'capacitaci[oó]n|coworking|operaciones|project', re.I)),
)


def _es_estudiante(nota):
    return bool(nota.person_uuid) and Subscription.query.filter_by(person_uuid=nota.person_uuid).first() is not None


def automatica(nota, reglas):
    if nota.series and reglas.get(nota.series):
        return reglas[nota.series]
    if nota.appointment_id:
        return 'sales'
    for categoria, patron in PALABRAS:
        if patron.search(nota.title or ''):
            return categoria
    if _es_estudiante(nota):
        return 'student'
    return 'team' if not nota.guests else 'other'


def clasificar(nota, reglas):
    """Pone la categoría si no se eligió a mano. Devuelve True si cambió."""
    if nota.category_manual:
        return False
    nueva = automatica(nota, reglas)
    cambio = nota.category != nueva
    nota.category = nueva
    return cambio
