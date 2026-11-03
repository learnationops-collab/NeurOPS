"""Carga los puntajes iniciales del formulario «Asistente Ejecutiva» (slug
`assistant`). Después se ajustan a mano desde Hiring → Forms.

Sin `--aplicar` solo muestra qué cambiaría. En el servidor:
    railway ssh --service "learnation work" -- python scripts/puntajes_asistente_ejecutiva.py [--aplicar]

Criterio (presupuesto 200-400 USD por 4 h diarias; lo que más pesa, ×3, es lo
que el puesto no puede enseñar: pedir poco, responder rápido y usar Claude en
serio):
  ×3 remuneración, respuesta rápida, uso de Claude
  ×2 empleo actual, experiencia, herramientas, cualidad diferencial
  ×1 equipo, educación, idiomas, otras IA, persona indicada, CV
  no suman: edad, horario (la única opción que no descarta), link verificado
"""
import sys

from app import create_app, db
from app.models import HiringForm
from app.services import hiring_forms

SLUG = 'assistant'

# {id: (peso, {texto de opción: pts} | None)}. Las opciones que no figuran valen 0.
PUNTAJES = {
    'equipo_zpm8by': (1, {'Mi computadora es veloz': 2, 'UPS': 1}),
    'empleo': (2, {
        'Actualmente no estoy trabajando': 3,
        'Tengo un trabajo part-time': 2,
        'Tengo un emprendimiento o trabajo freelance, part-time': 2,
        'Tengo un trabajo full-time, pero busco cambiarlo en menos de 1 mes': 1,
        'Tengo un emprendimiento o trabajo freelance, full-time': 1,
    }),
    'educacion': (1, {
        'No, ya completé mis estudios universitarios.': 3,
        'Estoy en etapa de titulación, ya no debo invertir tiempo en clases.': 3,
        'Si, estoy estudiando part-time.': 2,
        'No, no cuento con estudios universitarios.': 1,
    }),
    'disponibilidad': (3, {
        'En menos de 5 minutos.': 3,
        'En menos de 15 minutos.': 2,
        'Entre 15 minutos y 1 hora.': 1,
    }),
    'horario': (0, None),
    'experiencia': (2, {'Menos de 1 año': 1, 'Entre 1 y 2 años': 2, 'Entre 3 y 5 años': 3, 'Más de 5 años': 3}),
    'idioma2': (1, {'Básico': 1, 'Intermedio': 2, 'Avanzado o nativo': 3}),
    'ingles': (1, {'Básico': 1, 'Intermedio': 2, 'Avanzado o nativo': 3}),
    'sheets_1u68w3': (2, {
        'Sheets o Excel': 2, 'n8n': 2, 'Administrador de Anuncios de Meta': 1, 'Notion': 1, 'Loom': 1,
        'Cap Cut': 1, 'Paquete adobe (ej: Illustrator, Premiere, Photoshop)': 1,
    }),
    'ia_nivel_yfl5oa': (1, {'Gemini': 1, 'DeepSeek': 1, 'Grok': 1, 'Perplexity': 1, 'Copilot': 1}),
    'ia_avanzado_4vavsj': (3, {
        'Claude Code y Cowork': 3, 'Skills': 2, 'Conectores (MCP)': 2,
        'Proyectos, Instrucciones y Contexto': 1, 'Artifacts': 1,
    }),
    'aporte': (2, None),
    'extra_kzy7pq': (1, None),
    'cv': (1, None),
    'edad': (0, None),
    'video_verificado': (0, None),
}

# Pretensión mensual en USD: 150 o menos es lo ideal; arriba de 300, 0.
TRAMOS_REMUNERACION = [{'hasta': 150, 'pts': 3}, {'hasta': 220, 'pts': 2}, {'hasta': 300, 'pts': 1}]


def _con_puntos(p):
    pid = p.get('id')
    nueva = dict(p)
    if pid == 'remuneracion':
        nueva.update(peso=3, tramos=TRAMOS_REMUNERACION)
        return nueva
    if pid not in PUNTAJES:
        return nueva
    peso, pts = PUNTAJES[pid]
    nueva['peso'] = peso
    if pts is not None:
        opciones = [o if isinstance(o, dict) else {'t': o} for o in p.get('o') or []]
        sobran = set(pts) - {str(o.get('t') or '').strip() for o in opciones}
        if sobran:
            print(f'  ! {pid}: no encontré las opciones {sorted(sobran)}')
        nueva['o'] = [{**o, 'pts': pts.get(str(o.get('t') or '').strip(), 0)} for o in opciones]
    return nueva


def main(aplicar):
    form = HiringForm.query.filter_by(slug=SLUG).first()
    if form is None:
        sys.exit(f'No hay formulario con slug «{SLUG}».')
    print(f'Formulario {form.id} «{form.nombre}»')
    nuevas = [_con_puntos(p) if isinstance(p, dict) else p for p in form.preguntas]
    faltan = set(PUNTAJES) | {'remuneracion'}
    faltan -= {p.get('id') for p in nuevas if isinstance(p, dict)}
    if faltan:
        print(f'  ! no están en el formulario: {sorted(faltan)}')
    for p in nuevas:
        if isinstance(p, dict) and ('peso' in p or 'tramos' in p):
            ops = {str(o.get('t'))[:40]: o.get('pts') for o in p.get('o') or [] if isinstance(o, dict) and o.get('pts')}
            print(f"  {p['id']}: ×{p.get('peso')} {p.get('tramos') or ops or ''}")
    hiring_forms.validar_preguntas(nuevas)
    if not aplicar:
        print('Prueba: no se guardó nada. Corré con --aplicar.')
        return
    form.preguntas = nuevas
    db.session.commit()
    print('Guardado.')


if __name__ == '__main__':
    with create_app().app_context():
        main('--aplicar' in sys.argv)
