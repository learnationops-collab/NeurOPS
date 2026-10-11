"""Editar en lote las agendas desde Revisar (10/10/2026).

La edicion masiva del Tablero de Agendas de Operaciones (`public/financial_agendas_bulk.py`) se fue
con sus tablas viejas: el operador mira los registros en el Revisar del dashboard comercial, y lo
que solo el hacia llega como acciones de esa vista (ver `operar/operacion.js` en el frontend).

La diferencia de fondo con la vieja es QUE se edita. Aquella escribia en `FinancialAgenda`, el
espejo de n8n/Calendly, y le pasaba a la cita solo la fuente, con su propio cruce. Las filas de
Revisar son `Appointment`: esta edita las citas y cada una pasa por la MISMA funcion con la que se
corrige una agenda desde la ficha (`ficha_agendas_service.editar_agenda` para la fuente y el closer,
`ficha_acciones_service.estado_agenda` para el pre call). Asi la edicion masiva y la individual no
pueden decir cosas distintas de la misma agenda: el setter que se le atribuye a una fuente, el
closer que se acepta, el choque de horario y la fila del Tablero que se mueve con la cita (y la que
no se toca) son los de la ficha, agenda por agenda.

Que se puede cambiar en lote es lo de la vieja, menos el Call Confirmer, que ya no se usa (los
closers confirman sus propias agendas):

  · Fuente: del catalogo que ofrece la ficha (`ficha_vocabulario.fuentes_disponibles`).
  · Closer: un closer activo (`ficha_acciones_service.closer_activo`).
  · Estado pre call: solo los que no piden un motivo. La vieja aceptaba Pendiente, Contactado,
    Confirmado y Sin respuesta; en el vocabulario de Revisar (`PRE_CALL`) eso es «Confirmada» y
    «Sin confirmar» (Contactado y Sin respuesta se ven como «Sin confirmar»). «Canceló» no va: una
    cancelacion tiene su motivo y su flujo, y no tiene sentido aplicarla igual a doscientas agendas.

Solo admin y operador (`ROLES_QUE_OPERAN`). El `before_request` del blueprint deja pasar tambien a
la direccion, al closer y al setter, que ven Revisar pero no operan: aca reciben un 403 explicito.
"""
from flask import jsonify, request
from flask_login import current_user

from app import db
from app.api.comercial import ROLES_QUE_OPERAN, bp
from app.models import Appointment
from app.services import ficha_acciones_service as acciones
from app.services import ficha_agendas_service
from app.services.comercial_service import PRE_CALL, pre_call_de
from app.services.ficha_lead_service import permisos_de

# El mismo tope que la edicion masiva vieja: una escritura en lote sobre datos historicos.
LIMITE_LOTE = 5000

# Los campos que se cambian en lote, con el nombre con el que se los nombra en los mensajes.
CAMPOS = {'fuente': 'Fuente', 'closer_id': 'Closer', 'pre_call': 'Estado pre call'}

# Los pre call que se aplican en lote: los que no piden un motivo (ver el docstring del modulo).
PRE_CALL_EN_LOTE = ('confirmada', 'sin_confirmar')

# Lo que dice la bitacora de cada agenda (ver `desde` en `editar_agenda` y `estado_agenda`).
DESDE = 'la edición en lote de Revisar'


def _solo_quien_opera():
    """403 para quien entra al tablero pero no opera los registros; None para admin y operador."""
    if current_user.role not in ROLES_QUE_OPERAN:
        return jsonify({'message': 'Editar en lote es de Operaciones.'}), 403
    return None


def _ids_del_pedido(crudos):
    """Los ids del pedido, enteros y sin repetir (en el orden en que llegaron), o `ValueError`."""
    if not isinstance(crudos, list) or not crudos:
        raise ValueError('Elegí al menos una agenda.')
    if len(crudos) > LIMITE_LOTE:
        raise ValueError(f'Se pueden editar hasta {LIMITE_LOTE} agendas por lote.')
    ids = []
    for crudo in crudos:
        if isinstance(crudo, bool):
            raise ValueError('La lista de agendas tiene valores que no son ids.')
        try:
            ids.append(int(crudo))
        except (TypeError, ValueError):
            raise ValueError('La lista de agendas tiene valores que no son ids.') from None
    return list(dict.fromkeys(ids))


def _cambios_del_pedido(crudos):
    """Los cambios pedidos, ya validados contra lo que acepta la ficha, o `ValueError`.

    Un campo en null o vacio es «No cambiar» y se descarta. Se valida todo ANTES de tocar una sola
    agenda: un valor que no sirve no puede dejar el lote aplicado a medias.
    """
    from app.services.ficha_vocabulario import fuentes_elegibles

    if not isinstance(crudos, dict):
        raise ValueError('No se indicó ningún campo para cambiar.')
    desconocidos = sorted(k for k in crudos if k not in CAMPOS)
    if desconocidos:
        raise ValueError(f'Estos campos no se editan en lote: {", ".join(desconocidos)}.')
    cambios = {k: v for k, v in crudos.items() if v not in (None, '')}
    if not cambios:
        raise ValueError('No se indicó ningún campo para cambiar.')

    if 'fuente' in cambios:
        fuente = cambios['fuente'].strip() if isinstance(cambios['fuente'], str) else ''
        if fuente not in fuentes_elegibles():
            raise ValueError(f'«{cambios["fuente"]}» no es una fuente del catálogo: elegí una de la lista.')
        cambios['fuente'] = fuente
    if 'closer_id' in cambios:
        try:
            cambios['closer_id'] = acciones.closer_activo(int(cambios['closer_id'])).id
        except (TypeError, ValueError):
            raise ValueError('El closer elegido no existe o no está activo.') from None
        except acciones.ErrorDeAccion as e:
            raise ValueError(str(e)) from None
    if 'pre_call' in cambios and cambios['pre_call'] not in PRE_CALL_EN_LOTE:
        raise ValueError('En lote solo se aplica un pre call que no pide motivo: '
                         'Confirmada o Sin confirmar.')
    return cambios


def _editar_una(appt, cambios):
    """Aplica los cambios a UNA agenda con la logica de la ficha. True si cambio algo.

    Primero la fuente y el closer, despues el pre call: `editar_agenda` valida todo (el closer, el
    choque de horario) antes de escribir nada, asi que una agenda que no se puede mover queda como
    estaba, sin el pre call aplicado a medias. Mismos permisos que las rutas de la ficha
    (`reportar`, y `reasignar` para cambiar el closer), por si algun dia se separan de los de
    Operaciones.
    """
    permisos = permisos_de(current_user, appt)
    if not permisos['reportar']:
        raise acciones.ErrorDeAccion('No tenés permiso para corregir esta agenda.')

    cambio = False
    datos = {k: cambios[k] for k in ('fuente', 'closer_id') if k in cambios}
    if 'closer_id' in datos and datos['closer_id'] != appt.closer_id and not permisos['reasignar']:
        raise acciones.ErrorDeAccion('No tenés permiso para cambiarle el closer a esta agenda.')
    if datos:
        cambio = bool(ficha_agendas_service.editar_agenda(appt, datos, current_user,
                                                          desde=DESDE)['cambios'])

    # «Ya lo tenia» es lo que la tabla muestra (`pre_call_de`), no la columna: una agenda que el
    # closer dejo en 'conversando' ya se ve «Sin confirmar», y pisarla con 'Pendiente' le borraria
    # al closer en que paso de la confirmacion iba.
    pre = cambios.get('pre_call')
    if pre and pre_call_de(appt) != pre:
        acciones.estado_agenda(appt, {'campo': 'pre_call', 'valor': pre}, current_user, desde=DESDE)
        cambio = True
    return cambio


def _plural(n, uno, varios):
    return f'{n} {uno if n == 1 else varios}'


@bp.route('/agendas/lote', methods=['POST'])
def editar_agendas_en_lote():
    """Aplica una misma fuente, closer y/o pre call a varias agendas (`Appointment`) de Revisar.

    Cuerpo: `{ "ids": [ids de Appointment], "cambios": { "fuente"?, "closer_id"?, "pre_call"? } }`.

    Cada agenda se corrige por separado y con su propio commit, como desde la ficha: una que no se
    puede cambiar (no existe, o el closer ya tiene otra llamada sin resolver a esa hora) va a
    `errores` con su motivo y el resto del lote sigue. Responde cuantas cambiaron y cuantas ya
    tenian esos valores.
    """
    prohibido = _solo_quien_opera()
    if prohibido:
        return prohibido

    datos = request.get_json(silent=True) or {}
    try:
        ids = _ids_del_pedido(datos.get('ids'))
        cambios = _cambios_del_pedido(datos.get('cambios'))
    except ValueError as e:
        return jsonify({'message': str(e)}), 400

    citas = {a.id: a for a in Appointment.query.filter(Appointment.id.in_(ids)).all()}
    cambiadas, sin_cambios, errores = 0, 0, []
    for appt_id in ids:
        appt = citas.get(appt_id)
        if not appt:
            errores.append({'id': appt_id, 'message': 'Esa agenda ya no existe.'})
            continue
        try:
            if _editar_una(appt, cambios):
                cambiadas += 1
            else:
                sin_cambios += 1
        except acciones.ErrorDeAccion as e:
            db.session.rollback()
            errores.append({'id': appt_id, 'message': str(e)})
        except Exception as e:
            # Mismo trato que las rutas de la ficha: el motivo en el texto, y el lote sigue.
            db.session.rollback()
            errores.append({'id': appt_id, 'message': str(e) or 'No se pudo guardar.'})

    partes = [_plural(cambiadas, 'agenda actualizada', 'agendas actualizadas')]
    if sin_cambios:
        partes.append(f'{sin_cambios} ya lo tenía{"n" if sin_cambios != 1 else ""}')
    if errores:
        partes.append(f'{_plural(len(errores), "no se pudo cambiar", "no se pudieron cambiar")}')
    return jsonify({
        'pedidas': len(ids),
        'cambiadas': cambiadas,
        'sin_cambios': sin_cambios,
        'errores': errores,
        'campos': [c for c in CAMPOS if c in cambios],
        'message': ' · '.join(partes),
    }), 200


@bp.route('/agendas/lote/opciones', methods=['GET'])
def opciones_de_agendas_en_lote():
    """Lo que ofrece el panel «Editar en lote»: las mismas listas que la ficha (las fuentes en sus
    dos grupos y los closers activos) y los pre call que se aplican en lote."""
    prohibido = _solo_quien_opera()
    if prohibido:
        return prohibido

    from app.services.ficha_vocabulario import closers_disponibles, fuentes_disponibles

    return jsonify({
        'campos': CAMPOS,
        'fuentes': fuentes_disponibles(),
        'closers': closers_disponibles(),
        'pre_call': [e for e in PRE_CALL if e['key'] in PRE_CALL_EN_LOTE],
        'limite': LIMITE_LOTE,
    }), 200
