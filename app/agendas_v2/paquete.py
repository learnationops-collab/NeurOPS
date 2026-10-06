# ruff: noqa: E501  (el prompt es prosa para la IA: una idea por línea, sin cortes)
"""Configuración asistida por IA: un funnel completo en un solo JSON (el «paquete»).

1. prompt(d): el texto que se pega en Claude/ChatGPT. Explica el formato, trae el equipo real de Team
   (por email) y le pide a la IA que pregunte lo que falte y devuelva SOLO el JSON.
2. revisar(d, paquete): valida el paquete sin escribir nada. Devuelve (resumen, errores).
3. importar(d, paquete, usuario_id): crea prioridades, formulario, funnel y evento en UNA transacción.

Reglas: siempre crea cosas nuevas (nunca pisa lo que existe), el evento queda SIN publicar para
revisarlo en Thalamus, el equipo no se crea (se referencia por email a personas que ya están en Team)
y todo se referencia por nombre o por clave, nunca por id. Cada documento pasa por el normalizador.
"""

import json

from app import db
from app.agendas_v2.modelos import MODELOS
from app.agendas_v2.nucleo.catalogos import DURACIONES, ESTRATEGIAS
from app.agendas_v2.nucleo.datos import es_closer
from app.agendas_v2.nucleo.normalizar import NORM
from app.agendas_v2.nucleo.util import slugify, uid

VERSION = 1
TIPOS_PREGUNTA = ('opciones', 'lista', 'texto', 'parrafo')
CON_OPCIONES = ('opciones', 'lista')

EJEMPLO = {
    'paquete_thalamus': VERSION,
    'funnel': {
        'nombre': 'Workshop octubre',
        'slug': 'workshop',
        'setting': False,
        'origenes': [{'nombre': 'Instagram'}, {'nombre': 'En vivo'}],
    },
    'prioridades': [
        {'nombre': 'Ultra', 'estrategia': 'llenar', 'closers': ['closer1@empresa.com']},
        {'nombre': 'General', 'estrategia': 'repartir', 'closers': ['closer1@empresa.com', 'closer2@empresa.com']},
    ],
    'formulario': {
        'nombre': 'Calificación workshop',
        'contacto': {'nombre': True, 'telefono': True, 'email': True, 'instagram': False},
        'preguntas': [
            {
                'id': 'inversion',
                'tipo': 'opciones',
                'titulo': '¿Cuánto podrías invertir en tu formación?',
                'ayuda': '',
                'obligatoria': True,
                'peso': 3,
                'opciones': [
                    {'id': 'alta', 'texto': 'Más de 1000 USD', 'puntos': 10},
                    {'id': 'media', 'texto': 'Entre 300 y 1000 USD', 'puntos': 6},
                    {'id': 'nada', 'texto': 'No puedo invertir ahora', 'puntos': 0, 'descalifica': True},
                ],
            },
            {'id': 'profesion', 'tipo': 'texto', 'titulo': '¿A qué te dedicás?', 'obligatoria': True},
        ],
        'reglas': [{'prioridad': 'Ultra', 'si': [{'pregunta': 'inversion', 'respuestas': ['alta']}]}],
        'resto': 'General',
        'fin': {'titulo': 'Gracias por tu sinceridad', 'texto': 'Por ahora no vamos a agendar la sesión.'},
    },
    'evento': {
        'nombre': 'Llamada de diagnóstico',
        'slug': 'diagnostico',
        'duracion': 45,
        'antel': {'n': 4, 'u': 'h'},
        'paso': {'n': 60, 'u': 'min'},
        'reservas': {'modo': 'dias', 'n': 14, 'tipo': 'corridos'},
        'desc': 'Una llamada de 45 minutos para ver si el programa es para vos.',
        'indic': 'Conectate desde una computadora y tené a mano tu último simulacro.',
        'redir': '',
    },
}


def _equipo(d):
    closers = [p for p in d['personas'] if es_closer(d, p) and p.get('email')]
    filas = [f'- {p["nombre"]} <{p["email"]}> (closer)' for p in closers]
    return '\n'.join(filas) or '- (Team está vacío: sumá a los closers en Thalamus › Team antes de importar)'


def prompt(d):
    """El prompt para la IA, con el equipo real de Team."""
    return f"""Sos un asistente que configura funnels de agendamiento en «Learnation Thalamus» (el sistema de agendas de Learnation, que reemplaza a Calendly + Typeform).

Tu trabajo: entrevistarme hasta tener todo lo necesario y al final devolver UN SOLO bloque JSON con el formato de abajo, que yo voy a importar en Thalamus.

## Cómo trabajar
1. Preguntame, de a pocas preguntas por vez, lo que necesites: para qué es el funnel (workshop, VSL, anuncios…), las preguntas del formulario de calificación y sus opciones, cuáles opciones descalifican, cómo segmentar a los leads en prioridades, qué closers atienden cada prioridad, la duración de la llamada y con cuánta anticipación se puede agendar. Si te paso un Typeform o un formulario viejo, usalo de base.
2. Proponé una configuración razonable cuando yo no tenga una opinión, y decime qué supusiste.
3. Cuando esté todo, devolvé SOLO el JSON (sin comentarios dentro), en un bloque ```json.

## Cómo funciona Thalamus (para que la configuración tenga sentido)
- El lead completa el formulario (datos de contacto + preguntas). Si elige una opción con "descalifica": true, no agenda: ve el mensaje de "fin".
- Las REGLAS se miran en orden: la primera que se cumple decide la PRIORIDAD del lead. Una regla se cumple si, en cada condición, el lead eligió alguna de las respuestas listadas. Si ninguna se cumple, va a la prioridad "resto".
- Cada PRIORIDAD es un grupo de closers con una estrategia: "llenar" (se llena el primer closer y después el siguiente), "horario" (el lead ve todos los horarios; cada uno va al primer closer libre de la lista) o "repartir" (cada horario va a quien tenga menos agendas). Si una prioridad no tiene lugar, el lead pasa a la siguiente.
- Los "puntos" (0 a 10) de cada opción y el "peso" (0 a 5) de cada pregunta arman una nota del lead que ve el closer. No rutean.
- Los horarios de cada closer NO van en el JSON: cada closer ya tiene su horario en Team.

## Equipo disponible (usá EXACTAMENTE estos emails; no inventes personas)
{_equipo(d)}

## Formato del JSON
- "paquete_thalamus": siempre {VERSION}.
- "funnel": "nombre", "slug" (minúsculas y guiones; va en el link), "setting" (true si es un funnel de setting: cada setter de la empresa recibe su propio link y la agenda queda a su nombre; no lleva orígenes) y "origenes" (solo si no es de setting): lista de procedencias para armar un link por cada una, cada una {{"nombre": "Instagram"}}. Los setters NO van en el JSON.
- "prioridades": lista ordenada (la primera es la más importante). Cada una: "nombre" (único), "estrategia" ("llenar" | "horario" | "repartir"), "closers": emails de closers del equipo, en orden.
- "formulario":
  - "nombre".
  - "contacto": qué datos de contacto se piden (true/false): "nombre", "telefono", "email", "instagram". Nombre, teléfono y email conviene dejarlos en true.
  - "preguntas": cada una con "id" (clave corta única, minúsculas, sin espacios; no puede empezar con "c-"), "tipo" ("opciones" = opción única con botones, "lista" = desplegable, "texto" = texto corto, "parrafo" = texto largo), "titulo", "ayuda" (opcional), "obligatoria" (true/false), "peso" (0 a 5) y, si el tipo es "opciones" o "lista", "opciones": cada una con "id" (clave única dentro de la pregunta), "texto", "puntos" (0 a 10) y opcional "descalifica": true. NO pongas preguntas de nombre, teléfono, email ni Instagram: esas van en "contacto".
  - "reglas": lista ordenada. Cada una: "prioridad" (nombre de una prioridad) y "si": lista de condiciones {{"pregunta": "<id de pregunta con opciones>", "respuestas": ["<id de opción>", ...]}}.
  - "resto": nombre de la prioridad para quien no cumple ninguna regla.
  - "fin": "titulo" y "texto" del mensaje para el lead que no califica.
- "evento": "nombre", "slug", "duracion" (minutos: {', '.join(str(x) for x in DURACIONES)}), "antel" (anticipación mínima: "n" y "u" = "min" | "h" | "d"), "paso" (cada cuánto se ofrecen horarios: "n" y "u" = "min" | "h"), "reservas" (hasta cuándo se puede agendar: {{"modo": "dias", "n": 14, "tipo": "corridos" | "habiles"}}), "desc" (texto que ve el lead), "redir" (opcional: URL https a donde va el lead después de agendar), "indic" (indicaciones para la sesión: qué tiene que tener listo el lead; van en la invitación de Google Calendar).

## Ejemplo (solo para mostrar la forma; usá los datos reales que te dé)
```json
{json.dumps(EJEMPLO, ensure_ascii=False, indent=2)}
```

Empezá preguntándome para qué es el funnel."""


# --- Revisión ------------------------------------------------------------------------------------


def _txt(x):
    return x.strip() if isinstance(x, str) else ''


def _lista(x):
    return x if isinstance(x, list) else []


def _obj(x):
    return x if isinstance(x, dict) else {}


def revisar(d, paquete):
    """Valida el paquete contra los datos de Thalamus. Devuelve (plan, errores): `plan` es lo que hace
    falta para crear (o None si hay errores) y cada error dice dónde está el problema."""
    errores = []
    p = _obj(paquete)
    if p.get('paquete_thalamus') != VERSION:
        errores.append(f'"paquete_thalamus" tiene que ser {VERSION}.')

    personas_por_email = {(x.get('email') or '').lower(): x for x in d['personas'] if x.get('email')}

    # Funnel
    fu = _obj(p.get('funnel'))
    fu_nombre = _txt(fu.get('nombre'))
    fu_slug = slugify(fu.get('slug')) or slugify(fu_nombre)
    if not fu_nombre:
        errores.append('funnel: falta "nombre".')
    if fu_slug and any(f['slug'] == fu_slug for f in d['funnels']):
        errores.append(f'funnel: ya existe un funnel con el slug "{fu_slug}". Usá otro.')
    origenes = []
    for i, o in enumerate(_lista(fu.get('origenes'))):
        o = _obj(o)
        if _txt(o.get('setter')):
            errores.append(f'funnel.origenes[{i}]: los setters ya no van en los orígenes. Si el funnel es de setting, poné "setting": true y cada setter tiene su link.')
        elif _txt(o.get('nombre')):
            origenes.append({'id': uid('o'), 'nombre': _txt(o.get('nombre')), 'setter': ''})
        else:
            errores.append(f'funnel.origenes[{i}]: falta "nombre".')

    # Prioridades
    prioridades, ids_prioridad = [], {}
    for i, g in enumerate(_lista(p.get('prioridades'))):
        g = _obj(g)
        nombre = _txt(g.get('nombre'))
        if not nombre:
            errores.append(f'prioridades[{i}]: falta "nombre".')
            continue
        if nombre.lower() in ids_prioridad:
            errores.append(f'prioridades[{i}]: el nombre "{nombre}" está repetido.')
            continue
        estrategia = g.get('estrategia') or 'llenar'
        if estrategia not in ESTRATEGIAS:
            errores.append(f'prioridades[{i}] ({nombre}): "estrategia" tiene que ser llenar, horario o repartir.')
        miembros = []
        for email in _lista(g.get('closers')):
            persona = personas_por_email.get(_txt(email).lower())
            if not persona:
                errores.append(f'prioridades[{i}] ({nombre}): "{email}" no está en Team.')
            elif not es_closer(d, persona):
                errores.append(
                    f'prioridades[{i}] ({nombre}): {persona["nombre"]} no tiene un rol que atienda llamadas.'
                )
            elif persona['id'] not in miembros:
                miembros.append(persona['id'])
        if not miembros:
            errores.append(f'prioridades[{i}] ({nombre}): no tiene closers.')
        ids_prioridad[nombre.lower()] = uid('d')
        prioridades.append(
            {'id': ids_prioridad[nombre.lower()], 'nombre': nombre, 'estrategia': estrategia, 'miembros': miembros}
        )
    if not prioridades:
        errores.append('prioridades: hace falta al menos una.')

    def prioridad(nombre, donde):
        gid = ids_prioridad.get(_txt(nombre).lower())
        if not gid:
            errores.append(f'{donde}: la prioridad "{nombre}" no está en "prioridades".')
        return gid or ''

    # Formulario
    fo = _obj(p.get('formulario'))
    if not _txt(fo.get('nombre')):
        errores.append('formulario: falta "nombre".')
    preguntas, opciones_de = [], {}
    for i, q in enumerate(_lista(fo.get('preguntas'))):
        q = _obj(q)
        qid = slugify(q.get('id'))
        donde = f'formulario.preguntas[{i}]'
        if not qid or qid.startswith('c-'):
            errores.append(f'{donde}: "id" falta o empieza con "c-".')
            continue
        if qid in opciones_de:
            errores.append(f'{donde}: el id "{qid}" está repetido.')
            continue
        if q.get('tipo') not in TIPOS_PREGUNTA:
            errores.append(f'{donde} ({qid}): "tipo" tiene que ser opciones, lista, texto o parrafo.')
        if not _txt(q.get('titulo')):
            errores.append(f'{donde} ({qid}): falta "titulo".')
        opciones = []
        if q.get('tipo') in CON_OPCIONES:
            vistos = set()
            for j, o in enumerate(_lista(q.get('opciones'))):
                o = _obj(o)
                oid = slugify(o.get('id'))
                if not oid or oid in vistos or not _txt(o.get('texto')):
                    errores.append(f'{donde}.opciones[{j}] ({qid}): "id" único y "texto" son obligatorios.')
                    continue
                vistos.add(oid)
                opciones.append({**o, 'id': oid})
            if len(opciones) < 2:
                errores.append(f'{donde} ({qid}): una pregunta de opciones necesita al menos 2 opciones.')
        opciones_de[qid] = {o['id'] for o in opciones}
        preguntas.append({**q, 'id': qid, 'opciones': opciones})

    reglas = []
    for i, r in enumerate(_lista(fo.get('reglas'))):
        r = _obj(r)
        donde = f'formulario.reglas[{i}]'
        cond = []
        for c in _lista(r.get('si')):
            c = _obj(c)
            qid = slugify(c.get('pregunta'))
            if not opciones_de.get(qid):
                errores.append(f'{donde}: "{c.get("pregunta")}" no es una pregunta con opciones del formulario.')
                continue
            ops = [slugify(x) for x in _lista(c.get('respuestas'))]
            malas = [x for x in ops if x not in opciones_de[qid]]
            if malas or not ops:
                errores.append(f'{donde}: respuestas que no existen en "{qid}": {", ".join(malas) or "(ninguna)"}.')
                continue
            cond.append({'q': qid, 'ops': ops})
        if not cond:
            errores.append(f'{donde}: no tiene condiciones válidas.')
        reglas.append({'id': uid('r'), 'grupo': prioridad(r.get('prioridad'), donde), 'cond': cond})
    resto = prioridad(fo.get('resto'), 'formulario.resto') if fo.get('resto') else ''

    # Evento
    ev = _obj(p.get('evento'))
    if not _txt(ev.get('nombre')):
        errores.append('evento: falta "nombre".')
    if ev.get('duracion') not in DURACIONES:
        errores.append(f'evento: "duracion" tiene que ser uno de {", ".join(str(x) for x in DURACIONES)}.')

    if errores:
        return None, errores
    return {
        'prioridades': prioridades,
        'formulario': {**fo, 'preguntas': preguntas, 'reglas': reglas, 'resto': resto},
        'funnel': {**fu, 'slug': fu_slug, 'setting': fu.get('setting') is True,
                   'origenes': [] if fu.get('setting') is True else origenes},
        'evento': ev,
    }, []


def resumen(plan):
    """Lo que se va a crear, para la vista previa."""
    fo, ev = plan['formulario'], plan['evento']
    return {
        'funnel': plan['funnel']['nombre'],
        'slug': plan['funnel']['slug'],
        'origenes': len(plan['funnel']['origenes']),
        'setting': plan['funnel']['setting'],
        'prioridades': [
            {'nombre': g['nombre'], 'estrategia': g['estrategia'], 'closers': len(g['miembros'])}
            for g in plan['prioridades']
        ],
        'formulario': fo['nombre'],
        'preguntas': len(fo['preguntas']),
        'reglas': len(fo['reglas']),
        'evento': ev['nombre'],
        'duracion': ev['duracion'],
    }


# --- Importación ---------------------------------------------------------------------------------


def _siguiente_orden(d, col):
    return max([x.get('orden') or 0 for x in d[col]] or [0]) + 1


def importar(d, plan, usuario_id=None):
    """Crea todo en una transacción. Devuelve los ids creados. El evento queda sin publicar."""
    from app.agendas_v2.servicio import _subir_version

    creados = {'prioridades': []}

    def crear(col, doc_id, datos):
        doc = NORM[col](doc_id, datos)
        fila = MODELOS[col](id=doc_id, datos={k: v for k, v in doc.items() if k != 'id'}, orden=doc.get('orden') or 0)
        fila.actualizado_por_id = usuario_id
        db.session.add(fila)
        return doc

    orden = _siguiente_orden(d, 'grupos')
    for i, g in enumerate(plan['prioridades']):
        crear('grupos', g['id'], {**g, 'orden': orden + i})
        creados['prioridades'].append(g['id'])

    fo_id, fu_id, ev_id = uid('d'), uid('d'), uid('d')
    crear('formularios', fo_id, {**plan['formulario'], 'orden': _siguiente_orden(d, 'formularios')})
    crear('funnels', fu_id, {**plan['funnel'], 'orden': _siguiente_orden(d, 'funnels')})
    crear(
        'eventos',
        ev_id,
        {
            **plan['evento'],
            'funnel': fu_id,
            'formulario': fo_id,
            'activo': True,
            'publicado': '',
            'persona': '',
            'orden': _siguiente_orden(d, 'eventos'),
        },
    )
    creados.update({'formulario': fo_id, 'funnel': fu_id, 'evento': ev_id})
    _subir_version()
    db.session.commit()
    return creados
