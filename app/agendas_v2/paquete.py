# ruff: noqa: E501  (el prompt es prosa para la IA: una idea por línea, sin cortes)
"""Configuración asistida por IA: un funnel completo en un solo JSON (el «paquete»).

1. prompt(d): el texto que se pega en Claude/ChatGPT. Explica el formato, trae el equipo real de Team
   (por email) y le pide a la IA que pregunte lo que falte y devuelva SOLO el JSON.
2. revisar(d, paquete): valida el paquete sin escribir nada. Devuelve (resumen, errores).
3. importar(d, paquete, usuario_id): crea prioridades, formulario, funnel y evento en UNA transacción.

Edición con IA (sobre un evento que ya existe): exportar(d, evento_id) arma el paquete de lo que hay,
prompt(d, actual) se lo pasa a la IA para que lo cambie, revisar(d, paquete, editando=evento_id) y
aplicar(d, plan, evento_id) lo escriben ENCIMA (mismos ids, mismos links). El evento y el formulario
quedan como borrador hasta publicar; el funnel y las prioridades se aplican en el momento.

Reglas: siempre crea cosas nuevas (nunca pisa lo que existe), el evento queda SIN publicar para
revisarlo en Thalamus, el equipo no se crea (se referencia por email a personas que ya están en Team)
y todo se referencia por nombre o por clave, nunca por id. Cada documento pasa por el normalizador.
"""

import json

from app import db
from app.agendas_v2.modelos import MODELOS
from app.agendas_v2.nucleo.catalogos import DURACIONES, ESTRATEGIAS
from app.agendas_v2.nucleo.datos import buscar, es_closer, rol_closer
from app.agendas_v2.nucleo.normalizar import NORM, TIPOS_FUNNEL
from app.agendas_v2.nucleo.util import slugify, uid

VERSION = 1
TIPOS_PREGUNTA = ('opciones', 'lista', 'texto', 'parrafo')
CON_OPCIONES = ('opciones', 'lista')

EJEMPLO = {
    'paquete_thalamus': VERSION,
    'funnel': {
        'nombre': 'Workshop octubre',
        'slug': 'workshop',
        'tipo': 'workshop',
        'origenes': [{'nombre': 'Instagram'}, {'nombre': 'Grabación'}],
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


LAV = {str(dia): ([['09:00', '18:00']] if 1 <= dia <= 5 else []) for dia in range(7)}


def _closers_app():
    """Los closers activos de la app: {email: {nombre, email, tz, calendar, whatsapp}}."""
    from app.agendas_v2.servicio import usuarios_del_equipo
    from app.models.user import ROLE_CLOSER

    return {u['email']: u for u in usuarios_del_equipo((ROLE_CLOSER,)) if u['email']}


def _equipo(d):
    """Los closers que la IA puede usar: los de Team y los de la app que todavía no están (se suman
    solos al importar), con lo que les falta para recibir agendas."""
    from app.agendas_v2.nucleo.datos import horas_semana

    app = _closers_app()
    en_team = {(p.get('email') or '').lower(): p for p in d['personas'] if p.get('email') and es_closer(d, p)}
    filas = []
    for email in sorted(set(app) | set(en_team)):
        u, p = app.get(email), en_team.get(email)
        nombre = (p or {}).get('nombre') or (u or {}).get('nombre') or email
        horario = bool(p and horas_semana(p))
        estado = [
            'Calendar ✓' if u and u['calendar'] else 'sin Calendar',
            'WhatsApp ✓' if u and u['whatsapp'] else 'sin WhatsApp',
            'horarios ✓' if horario else ('sin horarios' if p else 'no está en Team: se suma con horario de lunes a viernes de 9 a 18'),
        ]
        filas.append(f'- {nombre} <{email}> (closer) · ' + ' · '.join(estado))
    return '\n'.join(filas) or '- (no hay closers activos en la app)'


TAREA_CREAR = """Sos un asistente que configura funnels de agendamiento en «Learnation Thalamus» (el sistema de agendas de Learnation, que reemplaza a Calendly + Typeform).

Tu trabajo: entrevistarme hasta tener todo lo necesario y al final devolver UN SOLO bloque JSON con el formato de abajo, que yo voy a importar en Thalamus.

## Cómo trabajar
1. Preguntame, de a pocas preguntas por vez, lo que necesites: para qué es el funnel (workshop, VSL, anuncios…), las preguntas del formulario de calificación y sus opciones, cuáles opciones descalifican, cómo segmentar a los leads en prioridades, qué closers atienden cada prioridad, la duración de la llamada y con cuánta anticipación se puede agendar. Si te paso un Typeform o un formulario viejo, usalo de base.
2. Proponé una configuración razonable cuando yo no tenga una opinión, y decime qué supusiste.
3. Cuando esté todo, devolvé SOLO el JSON (sin comentarios dentro), en un bloque ```json.
"""

TAREA_EDITAR = """Sos un asistente que edita un funnel de agendamiento en «Learnation Thalamus» (el sistema de agendas de Learnation, que reemplaza a Calendly + Typeform).

Abajo está el funnel TAL COMO ESTÁ HOY, en JSON. Tu trabajo: preguntarme qué quiero cambiar, proponerme el cambio y al final devolver el JSON COMPLETO con los cambios aplicados (no solo lo que cambió), que yo voy a pegar en Thalamus.

## Cómo trabajar
1. Preguntame qué quiero cambiar. Si no está claro, preguntá antes de cambiar.
2. No toques lo que no te pedí. Mantené los "id" de las preguntas y opciones que no cambian y no cambies los "slug": son los links que ya se compartieron.
3. Antes del JSON, resumime en una lista qué cambiaste.
4. Devolvé el JSON completo (sin comentarios dentro), en un bloque ```json.

## El funnel hoy
```json
{actual}
```
"""


TAREA_COMPLETAR = """Sos un asistente que configura funnels de agendamiento en «Learnation Thalamus» (el sistema de agendas de Learnation, que reemplaza a Calendly + Typeform).

El funnel de abajo YA EXISTE pero todavía no tiene un agendamiento armado: le falta lo necesario para recibir agendas (estrategias de closers, formulario con su segmentación y el evento). Tu trabajo: entrevistarme y devolver UN SOLO bloque JSON con el funnel completo.

## Cómo trabajar
1. Mirá lo que ya existe en Thalamus (más abajo). Proponeme reusar lo que sirva (un formulario o estrategias que ya están armados) y crear de cero solo lo que falte. Preguntame antes de decidir.
2. Preguntame, de a pocas preguntas por vez, lo que necesites: las preguntas del formulario y sus opciones, cuáles descalifican, cómo segmentar a los leads, qué closers atienden cada estrategia, la duración de la llamada y con cuánta anticipación se puede agendar.
3. Mantené el "nombre", el "slug" y el "tipo" del funnel salvo que te pida cambiarlos.
4. Devolvé SOLO el JSON (sin comentarios dentro), en un bloque ```json.

## El funnel hoy
```json
{actual}
```
"""


def _existente(d):
    """Lo que ya está armado en Thalamus y la IA puede reusar con {"usar": "<nombre>"}."""
    emails = {p['id']: p.get('email') for p in d['personas']}
    nombre_g = {g['id']: g['nombre'] for g in d['grupos']}
    estrategias = [
        f'- "{g["nombre"]}" ({g["estrategia"]}): ' + (', '.join(e for e in (emails.get(m) for m in g['miembros']) if e) or 'sin closers')
        for g in d['grupos']
    ]
    formularios = []
    for f in d['formularios']:
        destinos = sorted({nombre_g.get(r['grupo'], '?') for r in f['reglas']} | ({nombre_g.get(f['resto'], '?')} if f.get('resto') else set()))
        formularios.append(f'- "{f["nombre"]}": {len(f["preguntas"])} preguntas; segmenta a: {", ".join(destinos) or "(sin segmentación)"}')
        # Su segmentación, para copiarla o adaptarla en un formulario nuevo.
        preguntas = {q['id']: q for q in f['preguntas']}
        for r in f['reglas']:
            conds = []
            for c in r['cond']:
                q = preguntas.get(c['q'])
                textos = [next((o['texto'] for o in (q or {}).get('opciones', []) if o['id'] == x), x) for x in c['ops']]
                conds.append(f'"{q["titulo"] if q else c["q"]}" es {" o ".join(textos)}')
            formularios.append(f'    · si {" y ".join(conds)} → {nombre_g.get(r["grupo"], "?")}')
        if f.get('resto'):
            formularios.append(f'    · el resto → {nombre_g.get(f["resto"], "?")}')
    return (
        '## Lo que ya existe en Thalamus (podés reusarlo)\n'
        'Para reusar algo, en vez de definirlo poné {"usar": "<nombre exacto>"}: en "formulario" (reusa ese formulario con su segmentación) o como un elemento de "prioridades" (reusa esa estrategia tal como está). Lo reusado no se modifica. Si reusás un formulario, sus reglas ya apuntan a sus estrategias: no hace falta listarlas.\n'
        '### Estrategias (en el JSON, "prioridades")\n' + ('\n'.join(estrategias) or '- (ninguna todavía: hay que crearlas)') + '\n'
        '### Formularios\n' + ('\n'.join(formularios) or '- (ninguno todavía: hay que crearlo)') + '\n'
    )


def prompt(d, actual=None, completar=None):
    """El prompt para la IA, con el equipo real de Team y lo que ya existe para reusar. Con `actual`
    (el paquete de `exportar`) es para editar ese agendamiento; con `completar` (el funnel de
    `exportar_funnel`), para armarle a un funnel su primer agendamiento."""
    if completar:
        tarea = TAREA_COMPLETAR.format(actual=json.dumps(completar, ensure_ascii=False, indent=2))
        cierre = 'Empezá contándome qué ya existe que sirva para este funnel y qué falta crear.'
    elif actual:
        tarea = TAREA_EDITAR.format(actual=json.dumps(actual, ensure_ascii=False, indent=2))
        cierre = 'Empezá preguntándome qué quiero cambiar.'
    else:
        tarea = TAREA_CREAR
        cierre = 'Empezá preguntándome para qué es el funnel.'
    return tarea + '\n' + _existente(d) + f"""

## Cómo funciona Thalamus (para que la configuración tenga sentido)
- El lead completa el formulario (datos de contacto + preguntas). Si elige una opción con "descalifica": true, no agenda: ve el mensaje de "fin".
- SEGMENTACIÓN: las REGLAS del formulario se miran en orden y la primera que se cumple decide a qué ESTRATEGIA (en el JSON, "prioridad") va el lead. Una regla se cumple si, en cada condición, el lead eligió alguna de las respuestas listadas. Si ninguna se cumple, va a la estrategia "resto".
- Cada ESTRATEGIA es un grupo de closers con una forma de repartir: "llenar" (se llena el primer closer y después el siguiente), "horario" (el lead ve todos los horarios; cada uno va al primer closer libre de la lista) o "repartir" (cada horario va a quien tenga menos agendas). Si una estrategia no tiene lugar, el lead pasa a la siguiente.
- Los "puntos" (0 a 10) de cada opción y el "peso" (0 a 5) de cada pregunta arman una nota del lead que ve el closer. No rutean.
- Los horarios de cada closer NO van en el JSON: cada closer ya tiene su horario en Team.

## Closers disponibles (usá EXACTAMENTE estos emails; no inventes personas)
Si uno no está en Team se suma solo al importar. Para que reciba agendas necesita Calendar y WhatsApp (los confirma cada closer en su Configuración de NeurOPS) y horarios; preferí a los que ya tienen todo y avisame si elegís a alguien al que le falta algo.
{_equipo(d)}

## Formato del JSON
- "paquete_thalamus": siempre {VERSION}.
- "funnel": "nombre", "slug" (minúsculas y guiones; va en el link), "tipo" ("workshop", "vsl", "setting" u "otro": para qué cuenta en las estadísticas; en "setting" cada setter de la empresa recibe su propio link y la agenda queda a su nombre, y no lleva orígenes; en "workshop", un origen llamado "Grabación" cuenta como la grabación del workshop) y "origenes" (solo si no es de setting): lista de procedencias para armar un link por cada una, cada una {{"nombre": "Instagram"}}. Los setters NO van en el JSON.
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

{cierre}"""


# --- Revisión ------------------------------------------------------------------------------------


def _txt(x):
    return x.strip() if isinstance(x, str) else ''


def _lista(x):
    return x if isinstance(x, list) else []


def _obj(x):
    return x if isinstance(x, dict) else {}


def revisar(d, paquete, editando=None, en_funnel=None):
    """Valida el paquete contra los datos de Thalamus. Devuelve (plan, errores): `plan` es lo que hace
    falta para crear (o None si hay errores) y cada error dice dónde está el problema.
    `editando`: id del evento que se edita. Sus links no cambian (se conservan los slugs) y las
    prioridades y los orígenes que ya existen (por nombre) se actualizan en vez de crearse.
    `en_funnel`: id de un funnel que ya existe y se completa (su primer agendamiento): no se crea
    otro funnel y su link no cambia.
    En cualquier modo, {"usar": "<nombre>"} en el formulario o en una prioridad reutiliza lo que ya
    existe con ese nombre, sin tocarlo."""
    errores = []
    p = _obj(paquete)
    ev_actual = buscar(d, 'eventos', editando) if editando else None
    if editando and not ev_actual:
        return None, ['El evento que querés editar ya no existe.']
    fu_actual = buscar(d, 'funnels', ev_actual['funnel']) if ev_actual else (buscar(d, 'funnels', en_funnel) if en_funnel else None)
    if en_funnel and not fu_actual:
        return None, ['El funnel que querés completar ya no existe.']
    grupos_por_nombre = {g['nombre'].lower(): g['id'] for g in d['grupos']} if editando else {}
    existentes = {g['nombre'].lower(): g for g in d['grupos']}
    usadas = []
    fo_actual = buscar(d, 'formularios', ev_actual['formulario']) if ev_actual else None
    ids_reglas = [r['id'] for r in (fo_actual or {}).get('reglas', [])]
    if p.get('paquete_thalamus') != VERSION:
        errores.append(f'"paquete_thalamus" tiene que ser {VERSION}.')

    personas_por_email = {(x.get('email') or '').lower(): x for x in d['personas'] if x.get('email')}
    app = _closers_app()
    personas_nuevas = {}

    # Funnel
    fu = _obj(p.get('funnel'))
    fu_nombre = _txt(fu.get('nombre'))
    fu_slug = fu_actual['slug'] if fu_actual else (slugify(fu.get('slug')) or slugify(fu_nombre))
    if not fu_nombre:
        errores.append('funnel: falta "nombre".')
    if fu_slug and any(f['slug'] == fu_slug and f is not fu_actual for f in d['funnels']):
        errores.append(f'funnel: ya existe un funnel con el slug "{fu_slug}". Usá otro.')
    origenes = []
    for i, o in enumerate(_lista(fu.get('origenes'))):
        o = _obj(o)
        if _txt(o.get('setter')):
            errores.append(f'funnel.origenes[{i}]: los setters ya no van en los orígenes. Si el funnel es de setting, poné "tipo": "setting" y cada setter tiene su link.')
        elif _txt(o.get('nombre')):
            previo = next((x for x in (fu_actual or {}).get('origenes', [])
                           if (x.get('nombre') or '').lower() == _txt(o.get('nombre')).lower()), None)
            origenes.append({'id': previo['id'] if previo else uid('o'), 'nombre': _txt(o.get('nombre')), 'setter': ''})
        else:
            errores.append(f'funnel.origenes[{i}]: falta "nombre".')

    # Prioridades
    prioridades, ids_prioridad = [], {}
    for i, g in enumerate(_lista(p.get('prioridades'))):
        g = _obj(g)
        if _txt(g.get('usar')):
            previa = existentes.get(_txt(g.get('usar')).lower())
            if not previa:
                errores.append(f'prioridades[{i}]: no existe una estrategia llamada "{g.get("usar")}" para reusar.')
            else:
                ids_prioridad[previa['nombre'].lower()] = previa['id']
                usadas.append(previa)
            continue
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
            u = app.get(_txt(email).lower())
            if not persona and u:
                # Un closer de la app que no está en Team: se suma (con su zona y lunes a viernes de 9 a 18).
                persona = personas_nuevas.get(u['email']) or {
                    'id': uid('d'), 'nombre': u['nombre'], 'email': u['email'], 'rol': rol_closer(d),
                    'tz': u['tz'], 'horario': LAV, 'nuevo': True,
                }
                personas_nuevas[u['email']] = persona
            if not persona:
                errores.append(f'prioridades[{i}] ({nombre}): "{email}" no es un closer activo de la app.')
            elif not persona.get('nuevo') and not es_closer(d, persona):
                errores.append(
                    f'prioridades[{i}] ({nombre}): {persona["nombre"]} no tiene un rol que atienda llamadas.'
                )
            elif persona['id'] not in miembros:
                miembros.append(persona['id'])
        if not miembros:
            errores.append(f'prioridades[{i}] ({nombre}): no tiene closers.')
        ids_prioridad[nombre.lower()] = grupos_por_nombre.get(nombre.lower()) or uid('d')
        prioridades.append(
            {'id': ids_prioridad[nombre.lower()], 'nombre': nombre, 'estrategia': estrategia, 'miembros': miembros}
        )
    if not prioridades and not usadas:
        errores.append('prioridades: hace falta al menos una (nueva, o {"usar": "<nombre>"} de una que ya existe).')

    def prioridad(nombre, donde):
        gid = ids_prioridad.get(_txt(nombre).lower())
        if not gid:
            errores.append(f'{donde}: la prioridad "{nombre}" no está en "prioridades".')
        return gid or ''

    # Formulario
    fo = _obj(p.get('formulario'))
    fo_usado = None
    if _txt(fo.get('usar')):
        fo_usado = next((x for x in d['formularios'] if x['nombre'].lower() == _txt(fo.get('usar')).lower()), None)
        if not fo_usado:
            errores.append(f'formulario: no existe un formulario llamado "{fo.get("usar")}" para reusar.')
        fo = {}
    elif not _txt(fo.get('nombre')):
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
        reglas.append({'id': ids_reglas[i] if i < len(ids_reglas) else uid('r'),
                       'grupo': prioridad(r.get('prioridad'), donde), 'cond': cond})
    resto = prioridad(fo.get('resto'), 'formulario.resto') if fo.get('resto') else ''
    if not fo_usado and not reglas and not resto:
        errores.append('formulario: falta la segmentación: "reglas" y/o "resto" (a qué estrategia va cada lead).')

    # Evento
    tipo = fu.get('tipo') if fu.get('tipo') in TIPOS_FUNNEL else ('setting' if fu.get('setting') is True else None)
    if tipo is None:
        errores.append(f'funnel: "tipo" tiene que ser uno de {", ".join(TIPOS_FUNNEL)}.')
    ev = _obj(p.get('evento'))
    if not _txt(ev.get('nombre')):
        errores.append('evento: falta "nombre".')
    if ev.get('duracion') not in DURACIONES:
        errores.append(f'evento: "duracion" tiene que ser uno de {", ".join(str(x) for x in DURACIONES)}.')
    if ev_actual:
        ev = {**ev, 'slug': ev_actual['slug']}

    if errores:
        return None, errores
    return {
        'prioridades': prioridades,
        'personas_nuevas': [{k: v for k, v in x.items() if k != 'nuevo'} for x in personas_nuevas.values()],
        'usadas': [{'id': g['id'], 'nombre': g['nombre'], 'estrategia': g['estrategia'], 'miembros': g['miembros']} for g in usadas],
        'formulario_usado': {'id': fo_usado['id'], 'nombre': fo_usado['nombre']} if fo_usado else None,
        'formulario': ({'nombre': fo_usado['nombre'], 'preguntas': fo_usado['preguntas'], 'reglas': fo_usado['reglas']} if fo_usado
                       else {**fo, 'preguntas': preguntas, 'reglas': reglas, 'resto': resto}),
        'funnel': {**fu, 'slug': fu_slug, 'tipo': tipo, 'setting': tipo == 'setting',
                   'origenes': [] if tipo == 'setting' else origenes},
        'evento': ev,
    }, []


def resumen(plan):
    """Lo que se va a crear, para la vista previa."""
    fo, ev = plan['formulario'], plan['evento']
    return {
        'funnel': plan['funnel']['nombre'],
        'slug': plan['funnel']['slug'],
        'origenes': len(plan['funnel']['origenes']),
        'tipo': plan['funnel']['tipo'],
        'setting': plan['funnel']['setting'],
        'prioridades': [
            {'nombre': g['nombre'], 'estrategia': g['estrategia'], 'closers': len(g['miembros'])}
            for g in plan['prioridades']
        ] + [
            {'nombre': g['nombre'], 'estrategia': g['estrategia'], 'closers': len(g['miembros']), 'existente': True}
            for g in plan.get('usadas', [])
        ],
        'formulario': fo['nombre'],
        'formulario_existente': bool(plan.get('formulario_usado')),
        'personas_nuevas': [x['nombre'] for x in plan.get('personas_nuevas', [])],
        'preguntas': len(fo['preguntas']),
        'reglas': len(fo['reglas']),
        'evento': ev['nombre'],
        'duracion': ev['duracion'],
    }


# --- Importación ---------------------------------------------------------------------------------


def _siguiente_orden(d, col):
    return max([x.get('orden') or 0 for x in d[col]] or [0]) + 1


def _sumar_personas(d, plan, usuario_id):
    """Suma a Team a los closers de la app que el paquete usa y no estaban (unidos a su cuenta)."""
    from app.agendas_v2.servicio import _email_de_cuenta

    orden = _siguiente_orden(d, 'personas')
    for i, x in enumerate(plan.get('personas_nuevas', [])):
        doc = NORM['personas'](x['id'], {**x, 'orden': orden + i})
        fila = MODELOS['personas'](id=x['id'], datos={k: v for k, v in doc.items() if k != 'id'}, orden=doc['orden'])
        fila.email = doc['email'] or None
        fila.user_id = _email_de_cuenta(fila.email)
        fila.actualizado_por_id = usuario_id
        db.session.add(fila)


def importar(d, plan, usuario_id=None, en_funnel=None):
    """Crea todo en una transacción. Devuelve los ids creados. El evento queda sin publicar.
    `en_funnel`: el agendamiento va en ese funnel (que toma el nombre, el tipo y los links del paquete)
    en vez de crear uno. Lo reutilizado ({"usar": …}) no se crea ni se toca."""
    from app.agendas_v2.servicio import _subir_version

    creados = {'prioridades': []}

    def crear(col, doc_id, datos):
        doc = NORM[col](doc_id, datos)
        fila = MODELOS[col](id=doc_id, datos={k: v for k, v in doc.items() if k != 'id'}, orden=doc.get('orden') or 0)
        fila.actualizado_por_id = usuario_id
        db.session.add(fila)
        return doc

    _sumar_personas(d, plan, usuario_id)
    orden = _siguiente_orden(d, 'grupos')
    for i, g in enumerate(plan['prioridades']):
        crear('grupos', g['id'], {**g, 'orden': orden + i})
        creados['prioridades'].append(g['id'])

    fo_id, fu_id, ev_id = uid('d'), uid('d'), uid('d')
    if plan.get('formulario_usado'):
        fo_id = plan['formulario_usado']['id']
    else:
        crear('formularios', fo_id, {**plan['formulario'], 'orden': _siguiente_orden(d, 'formularios')})
    if en_funnel:
        fu_id = en_funnel
        fila = db.session.get(MODELOS['funnels'], fu_id)
        doc = NORM['funnels'](fu_id, {**(fila.datos or {}), **{k: plan['funnel'][k] for k in ('nombre', 'tipo', 'setting', 'origenes')}})
        fila.datos = {k: v for k, v in doc.items() if k != 'id'}
        fila.actualizado_por_id = usuario_id
    else:
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


# --- Edición con IA ------------------------------------------------------------------------------


def exportar(d, evento_id):
    """El paquete de un evento que ya existe (su funnel, formulario y prioridades), con el mismo formato
    que devuelve la IA: es lo que se le pasa para que lo edite. None si el evento no existe."""
    ev = buscar(d, 'eventos', evento_id)
    if not ev:
        return None
    fu = buscar(d, 'funnels', ev['funnel']) or {}
    fo = buscar(d, 'formularios', ev['formulario']) or {}
    reglas = fo.get('reglas') or []
    usados = [r['grupo'] for r in reglas] + ([fo['resto']] if fo.get('resto') else [])
    grupos = [g for g in d['grupos'] if g['id'] in usados]
    emails = {p['id']: p.get('email') for p in d['personas']}
    nombre_grupo = {g['id']: g['nombre'] for g in grupos}
    return {
        'paquete_thalamus': VERSION,
        'funnel': {
            'nombre': fu.get('nombre', ''),
            'slug': fu.get('slug', ''),
            'tipo': fu.get('tipo', 'otro'),
            'origenes': [{'nombre': o['nombre']} for o in fu.get('origenes', []) if o.get('nombre') and not o.get('setter')],
        },
        'prioridades': [
            {'nombre': g['nombre'], 'estrategia': g['estrategia'],
             'closers': [emails[m] for m in g['miembros'] if emails.get(m)]}
            for g in sorted(grupos, key=lambda g: g.get('orden') or 0)
        ],
        'formulario': {
            'nombre': fo.get('nombre', ''),
            'contacto': fo.get('contacto', {}),
            'preguntas': [
                {
                    'id': q['id'], 'tipo': q['tipo'], 'titulo': q['titulo'], 'ayuda': q['ayuda'],
                    'obligatoria': q['obligatoria'], 'peso': q['peso'],
                    **({'opciones': [
                        {'id': o['id'], 'texto': o['texto'], 'puntos': o['puntos'] or 0,
                         **({'descalifica': True} if o['descalifica'] else {})}
                        for o in q['opciones']
                    ]} if q['tipo'] in CON_OPCIONES else {}),
                }
                for q in fo.get('preguntas', [])
            ],
            'reglas': [
                {'prioridad': nombre_grupo.get(r['grupo'], ''),
                 'si': [{'pregunta': c['q'], 'respuestas': c['ops']} for c in r['cond']]}
                for r in reglas
            ],
            'resto': nombre_grupo.get(fo.get('resto'), ''),
            'fin': fo.get('fin', {}),
        },
        'evento': {
            'nombre': ev['nombre'], 'slug': ev['slug'], 'duracion': ev['duracion'],
            'antel': ev['antel'], 'paso': {'n': ev['paso']['n'], 'u': ev['paso']['u']},
            'reservas': {k: ev['reservas'][k] for k in ('modo', 'n', 'tipo')},
            'desc': ev['desc'], 'indic': ev['indic'], 'redir': ev['redir'],
        },
    }


def exportar_funnel(d, funnel_id):
    """Un funnel sin agendamiento, con el formato del paquete y lo demás vacío: lo que se le pasa a la IA
    para que lo complete. None si no existe."""
    fu = buscar(d, 'funnels', funnel_id)
    if not fu:
        return None
    return {
        'paquete_thalamus': VERSION,
        'funnel': {'nombre': fu['nombre'], 'slug': fu['slug'], 'tipo': fu.get('tipo', 'otro'),
                   'origenes': [{'nombre': o['nombre']} for o in fu.get('origenes', []) if o.get('nombre') and not o.get('setter')]},
        'prioridades': [],
        'formulario': None,
        'evento': None,
    }


def aplicar(d, plan, evento_id, usuario_id=None):
    """Escribe el paquete editado ENCIMA del evento, su funnel, su formulario y sus prioridades (mismos
    ids). Las prioridades nuevas se crean. Lo que el paquete no trae (publicación, colores, orden, la
    zona horaria) queda como estaba. Devuelve los ids tocados."""
    from app.agendas_v2.servicio import _subir_version

    ev = buscar(d, 'eventos', evento_id)

    def escribir(col, doc_id, cambios):
        fila = db.session.get(MODELOS[col], doc_id)
        previo = {**(fila.datos if fila else {}), 'orden': fila.orden if fila else _siguiente_orden(d, col)}
        doc = NORM[col](doc_id, {**previo, **cambios})
        if not fila:
            fila = MODELOS[col](id=doc_id)
            db.session.add(fila)
        fila.datos = {k: v for k, v in doc.items() if k != 'id'}
        fila.orden = doc.get('orden') or 0
        fila.actualizado_por_id = usuario_id

    _sumar_personas(d, plan, usuario_id)
    for g in plan['prioridades']:
        escribir('grupos', g['id'], {k: g[k] for k in ('nombre', 'estrategia', 'miembros')})
    # Un formulario reusado ({"usar": …}) pasa a ser el del evento, sin tocarlo; si no, se edita el suyo.
    formulario_id = plan['formulario_usado']['id'] if plan.get('formulario_usado') else ev['formulario']
    if not plan.get('formulario_usado'):
        fo = plan['formulario']
        # Lo que el paquete no trae de cada pregunta (el placeholder) queda como estaba.
        previas = {q['id']: q for q in (buscar(d, 'formularios', ev['formulario']) or {}).get('preguntas', [])}
        fo = {**fo, 'preguntas': [{**previas.get(q['id'], {}), **q} for q in fo['preguntas']]}
        escribir('formularios', ev['formulario'], {k: fo[k] for k in ('nombre', 'contacto', 'preguntas', 'reglas', 'resto', 'fin') if k in fo})
    fu = plan['funnel']
    escribir('funnels', ev['funnel'], {k: fu[k] for k in ('nombre', 'tipo', 'setting', 'origenes')})
    nuevo = plan['evento']
    escribir('eventos', evento_id, {
        **{k: nuevo[k] for k in ('nombre', 'duracion', 'antel', 'desc', 'indic', 'redir') if k in nuevo},
        **({'paso': {**ev['paso'], **nuevo['paso']}} if isinstance(nuevo.get('paso'), dict) else {}),
        **({'reservas': {**ev['reservas'], **nuevo['reservas']}} if isinstance(nuevo.get('reservas'), dict) else {}),
        'formulario': formulario_id,
    })
    _subir_version()
    db.session.commit()
    return {'evento': evento_id, 'formulario': formulario_id, 'funnel': ev['funnel'],
            'prioridades': [g['id'] for g in plan['prioridades']]}
