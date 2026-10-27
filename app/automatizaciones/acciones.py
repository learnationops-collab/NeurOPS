"""Lo que el setter hace sobre el flujo de una conversación desde la bandeja (27/10/2026).

  · **Continuar** reabre el último recorrido en el paso elegido, en su misma versión: conserva
    campaña, setter y registro, como el botón que retoma un recorrido cortado (`Motor._boton`).
  · **Reiniciar** y **cambiar de flujo** abren un recorrido nuevo que hereda la campaña, la palabra y
    el setter del anterior. No cuentan como entrada nueva: no pasan por `registro.entrada`.
  · Fuera de la ventana de 24 h Instagram no deja escribir: el recorrido queda **pendiente** en ese
    paso y arranca cuando el lead vuelve a escribir, salvo que escriba la palabra de una campaña (esa
    gana y lo descarta, `Motor._iniciar`).
  · Toda acción saca al bot de la pausa.

Lo llama la API con el candado del motor tomado (`servicio.con_motor`), así no se pisa con el reloj.
Usa las piezas internas del motor (`_abierta`, `_cerrar`, `_correr`): es una extensión suya, aparte
para que motor.py no crezca.
"""
from app import db
from app.automatizaciones import efectos
from app.automatizaciones.modelos import AutEjecucion
from app.automatizaciones.nucleo import grafo as g

MOVIDA = 'La movió una persona del equipo'


class AccionInvalida(ValueError):
    """Lo que se pidió no se puede hacer (no hay recorrido, el paso no existe, el flujo no está publicado)."""


def _ultima(contacto):
    return AutEjecucion.query.filter_by(contacto_id=contacto.id).order_by(AutEjecucion.id.desc()).first()


def _pendientes(contacto):
    return AutEjecucion.query.filter_by(contacto_id=contacto.id, estado=AutEjecucion.PENDIENTE).all()


def descartar_pendientes(contacto, detalle, salvo=None):
    for ejecucion in _pendientes(contacto):
        if ejecucion is not salvo:
            ejecucion.estado, ejecucion.detalle = AutEjecucion.CANCELADA, detalle


def _soltar(motor, contacto, salvo=None):
    """Corta lo abierto y lo pendiente antes de moverla: un contacto tiene un solo recorrido vivo."""
    abierta = motor._abierta(contacto)
    if abierta and abierta is not salvo:
        motor._cerrar(abierta, AutEjecucion.CANCELADA, MOVIDA, liberar=False)
    descartar_pendientes(contacto, MOVIDA, salvo=salvo)


def _arrancar(motor, ejecucion, nodo_id):
    """'en_curso' si mandó el paso ahora; 'pendiente' si espera a que el lead escriba."""
    ejecucion.contacto.bot_pausado_hasta = None
    ejecucion.nodo_actual, ejecucion.detalle, ejecucion.despertar_en = nodo_id, None, None
    if not motor.en_ventana(ejecucion.contacto):
        ejecucion.estado = AutEjecucion.PENDIENTE
        db.session.flush()
        return 'pendiente'
    ejecucion.estado = AutEjecucion.EN_CURSO
    motor._correr(ejecucion)
    return 'en_curso'


def continuar(motor, contacto, nodo_id):
    ejecucion = _ultima(contacto)
    if ejecucion is None:
        raise AccionInvalida('No pasó por ningún flujo: usá «Iniciar flujo»')
    if nodo_id not in g.nodos_por_id(ejecucion.version.grafo):
        raise AccionInvalida('Ese paso no existe en la versión del flujo en la que está')
    _soltar(motor, contacto, salvo=ejecucion)
    return _arrancar(motor, ejecucion, nodo_id), ejecucion


def nuevo_recorrido(motor, contacto, version):
    """Reiniciar (la versión publicada de su flujo) o mandarla a otro flujo, desde el paso 1."""
    if version is None:
        raise AccionInvalida('Ese flujo no tiene ninguna versión publicada')
    previa = _ultima(contacto)
    _soltar(motor, contacto)
    ejecucion = AutEjecucion(
        contacto=contacto, version=version, estado=AutEjecucion.EN_CURSO, iniciada_en=motor.ahora,
        campana_id=previa.campana_id if previa else None, clave=previa.clave if previa else None,
        setter_id=previa.setter_id if previa else None, meta_ad_id=previa.meta_ad_id if previa else None)
    db.session.add(ejecucion)
    db.session.flush()
    return _arrancar(motor, ejecucion, version.grafo.get('inicio')), ejecucion


def ultima_version(contacto):
    """La versión publicada del flujo de su último recorrido (para reiniciar), o None."""
    previa = _ultima(contacto)
    return previa.version.flujo.version_publicada if previa else None


def retomar_pendiente(motor, contacto, evento):
    """El lead volvió a escribir: arranca lo que dejó pendiente un setter. True si arrancó."""
    pendiente = (AutEjecucion.query.filter_by(contacto_id=contacto.id, estado=AutEjecucion.PENDIENTE)
                 .order_by(AutEjecucion.id.desc()).first())
    if pendiente is None or motor._version_de_campana(evento.texto, evento.momento)[0]:
        return False
    pendiente.estado = AutEjecucion.EN_CURSO
    motor._correr(pendiente)
    efectos.anotar(motor._entrante, pendiente, tipo='pendiente')
    return True


def bot(motor, contacto, pausado):
    if pausado:
        motor.pausar(contacto)
    else:
        contacto.bot_pausado_hasta = None
    db.session.flush()
