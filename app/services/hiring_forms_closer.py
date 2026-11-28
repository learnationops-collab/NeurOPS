"""El formulario de Closer de ventas como formulario editable de Talent › Forms (ADR-W280).

Hay uno solo (`HiringForm.puesto == 'closer'`), sin slug: vive en
institute.thelearnation.com/formulario/ (y la página de la vacante en /vacante/), que
leen sus preguntas y su cierre de `GET /api/public/closer-form`. Las respuestas van a
`JobApplication`: las preguntas base tienen columna (y las usa Clarity); las que se suman
desde el editor van a `respuestas_extra`.

`PREGUNTAS_CLOSER` es copia fiel del `PREGUNTAS` que tenía la página (institute-site,
formulario/index.html) el 27/11/2026, con los tipos del editor: `pais` (la lista de países
con buscador que arma la página), `porcentaje` (el deslizador 0-100) y `link` (texto que
tiene que empezar con http).
"""
import copy
from datetime import datetime

from app import db
from app.models import HiringForm, JobApplication

PUESTO = 'closer'
NOMBRE = 'Closer de ventas'
LINK = 'https://institute.thelearnation.com/vacante/'
# La reapertura del 27/11/2026: cierra el lun 30/11 23:59 ART (UTC-3).
CIERRE_INICIAL = datetime(2026, 12, 1, 2, 59)

# Tipos que sabe dibujar /formulario/ (además de los comunes del editor).
TIPOS = ('radio', 'check', 'texto', 'parrafo', 'tel', 'link', 'pais', 'porcentaje')

_D, _E, _P, _O, _M = 'Datos', 'Experiencia', 'Perfil', 'Origen', 'Video y llamada'
_URL = 'Pegá el link (tiene que empezar con http:// o https://).'

PREGUNTAS_CLOSER = [
    {'id': 'nombre', 'bloque': _D, 'tipo': 'texto', 'req': True, 't': '¿Cómo te llamas?',
     'h': 'Nombre y apellido, como figura en tus documentos.'},
    {'id': 'email', 'bloque': _D, 'tipo': 'texto', 'mail': True, 'req': True, 't': 'Tu correo electrónico',
     'h': 'Ahí te avisamos si avanzás en el proceso.'},
    {'id': 'whatsapp', 'bloque': _D, 'tipo': 'tel', 'req': False, 't': 'Tu WhatsApp',
     'h': 'Con el código de área de tu país, para poder contactarte.'},
    {'id': 'edad', 'bloque': _D, 'tipo': 'radio', 'req': False, 't': 'Edad',
     'o': ['18 a 24 años', '25 a 29 años', '30 a 34 años', '35 a 40 años', '41 a 50 años']},
    {'id': 'pais', 'bloque': _D, 'tipo': 'pais', 'req': False, 't': 'Lugar de residencia', 'h': 'Escribí para buscar tu país.'},
    {'id': 'dedicacion', 'bloque': _E, 'tipo': 'parrafo', 'req': False, 't': '¿A qué te dedicas actualmente?'},
    {'id': 'conocimiento', 'bloque': _E, 'tipo': 'radio', 'req': True, 't': 'Tu conocimiento como Closer',
     'o': ['Tengo formación + experiencia', 'Tengo formación', 'Tengo experiencia']},
    {'id': 'formacion', 'bloque': _E, 'tipo': 'parrafo', 'req': True, 't': 'Cuéntame sobre tu formación como Closer'},
    {'id': 'cierre', 'bloque': _E, 'tipo': 'porcentaje', 'req': False, 't': 'Tu porcentaje de cierre sobre llamada tomada'},
    {'id': 'ingles', 'bloque': _E, 'tipo': 'radio', 'req': True, 't': '¿Hablas inglés?', 'o': ['Fluido', 'Intermedio', 'Básico', 'Nada']},
    {'id': 'reporte', 'bloque': _E, 'tipo': 'radio', 'req': True, 't': '¿Qué tan importante te parece reportar tus números a diario?',
     'o': ['Es parte del trabajo: sin datos no puedo mejorar mi tasa de cierre',
           'Me parece importante, aunque no siempre lo mantuve al día',
           'Lo hago si el equipo me lo pide, no por iniciativa propia',
           'Prefiero enfocarme en vender y que otro se ocupe de los números',
           'Nunca trabajé con reportes']},
    {'id': 'aportes', 'bloque': _P, 'tipo': 'parrafo', 'req': True, 't': 'Además de closear, ¿qué extra le podés aportar al equipo?'},
    {'id': 'habilidades', 'bloque': _P, 'tipo': 'parrafo', 'req': True, 't': '¿Qué experiencia en venta tienes?'},
    {'id': 'obstaculo', 'bloque': _P, 'tipo': 'parrafo', 'req': True,
     't': 'Si te encontraras con un obstáculo en este trabajo (como un porcentaje de cierre bajo), ¿qué harías para resolverlo?'},
    {'id': 'objetivos', 'bloque': _P, 'tipo': 'parrafo', 'req': True, 't': '¿Cómo esta posición se alinea con tus objetivos a largo plazo?',
     'h': 'Solo buscamos personas que quieran trabajar con nosotros a largo plazo.'},
    {'id': 'porque_mejor_opcion', 'bloque': _P, 'tipo': 'parrafo', 'req': True, 't': '¿Por qué eres la mejor opción para este puesto?',
     'h': 'No buscamos solo experiencia: buscamos hambre real, ganas de superarte y de meterle duro. Convencenos.'},
    {'id': 'porque', 'bloque': _P, 'tipo': 'parrafo', 'req': True, 't': '¿Por qué te llama la atención Learnation?'},
    {'id': 'fuente', 'bloque': _O, 'tipo': 'radio', 'req': True, 't': '¿De dónde salió esta postulación?',
     'o': ['Ads de Instagram', 'Me la pasó un colega o amigo', 'Bolsa de trabajo']},
    {'id': 'bolsa', 'bloque': _O, 'tipo': 'texto', 'req': True, 't': '¿Cuál bolsa de trabajo?',
     'h': 'Escribí el nombre de la bolsa donde viste el aviso.', 'si': {'id': 'fuente', 'es': 'Bolsa de trabajo'}},
    {'id': 'video', 'bloque': _M, 'tipo': 'link', 'req': True, 't': 'Preséntate en un video de 60 a 180 segundos.',
     'error': 'Pegá el link del video (tiene que empezar con http:// o https://) — no podemos revisar la postulación sin él.'},
    {'id': 'llamada', 'bloque': _M, 'tipo': 'link', 'req': True, 't': 'Coloca tu mejor llamada o roleplay',
     'h': 'Un link de Google Drive con la grabación. Asegurate de que el acceso también diga "Cualquier persona con el enlace".',
     'error': 'Pegá el link de la grabación (tiene que empezar con http:// o https://).'},
]
for _p in PREGUNTAS_CLOSER:
    _p['on'] = True
    _p['base'] = True

IDS_BASE = [p['id'] for p in PREGUNTAS_CLOSER]


def asegurar_closer():
    """El formulario de Closer; lo crea (activo, con el cierre de la reapertura) la primera vez."""
    form = HiringForm.query.filter_by(puesto=PUESTO).order_by(HiringForm.id).first()
    if form is not None:
        return form
    form = HiringForm(nombre=NOMBRE, slug=None, puesto=PUESTO, activo=True,
                      preguntas=copy.deepcopy(PREGUNTAS_CLOSER),
                      cierre_modo='fecha', cierre_en=CIERRE_INICIAL)
    db.session.add(form)
    db.session.commit()
    return form


def respuestas():
    """Postulaciones completas de la búsqueda en curso (las archivadas son de búsquedas anteriores)."""
    return JobApplication.activas().filter_by(completo=True).count()
