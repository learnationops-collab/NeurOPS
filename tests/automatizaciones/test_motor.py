"""El motor de punta a punta: eventos guardados por el webhook → ejecuciones → mensajes (transporte simulado)."""
from datetime import datetime, timedelta

import pytest

from app import db as _db
from app.automatizaciones import servicio
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, IgContacto, IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio, TransporteMeta, TransporteSimulado
from app.models.instagram import InstagramWebhookEvento
from tests.automatizaciones import flujos as f

T0 = datetime(2026, 10, 15, 13, 0, 0)


def ms(momento):
    return int((momento - datetime(1970, 1, 1)).total_seconds() * 1000)


class Escenario:
    """Un lead conversando con la cuenta: guarda eventos como el webhook y corre el cron."""

    def __init__(self):
        self.transporte = TransporteSimulado()
        self.ahora = T0
        self._mid = 0

    def mid(self):
        self._mid += 1
        return f'mid-{self._mid}'

    def llega(self, payload, minutos=0):
        self.ahora += timedelta(minutes=minutos)
        _db.session.add(InstagramWebhookEvento(tipos='test', payload=payload, recibido_en=self.ahora))
        _db.session.commit()
        return servicio.procesar_pendientes(self.ahora, self.transporte)

    def escribe(self, texto, minutos=0, **extra):
        return self.llega(f.dm(texto, self.mid(), ms(self.ahora + timedelta(minutes=minutos)), **extra), minutos)

    def toca(self, boton_payload, titulo='x', minutos=0):
        return self.llega(f.postback(titulo, boton_payload, self.mid(), ms(self.ahora + timedelta(minutes=minutos))), minutos)

    def pasa(self, minutos):
        self.ahora += timedelta(minutes=minutos)
        return servicio.tick(self.ahora, self.transporte)

    def textos(self):
        salida = []
        for e in self.transporte.enviados:
            c = e['cuerpo']
            salida.append(c.get('text') or (c.get('attachment') or {}).get('payload', {}).get('text')
                          or c['attachment']['type'])
        return salida

    def ejecucion(self):
        return AutEjecucion.query.order_by(AutEjecucion.id.desc()).first()


@pytest.fixture()
def flujo(db):
    def _crear(grafo=None, nombre='Guía'):
        nuevo = AutFlujo(nombre=nombre, grafo=grafo or f.guia())
        db.session.add(nuevo)
        db.session.commit()
        assert servicio.publicar(nuevo, momento=T0 - timedelta(minutes=1)) == []
        return nuevo
    return _crear


@pytest.fixture()
def lead(db):
    return Escenario()


def payload(flujo, nodo, boton):
    return f'AUT:{flujo.version_publicada_id}:{nodo}:{boton}'


# --- El recorrido del flujo «OBTENER GUÍA» ----------------------------------------------------

def test_la_palabra_clave_manda_los_botones_y_espera(flujo, lead):
    flujo()
    lead.escribe('Obtener Guía')

    assert lead.textos() == ['¿Cuál es tu perfil?']
    assert lead.transporte.enviados[0]['destinatario'] == {'id': f.LEAD}
    ejecucion = lead.ejecucion()
    assert (ejecucion.estado, ejecucion.nodo_actual) == (AutEjecucion.ESPERANDO_RESPUESTA, 'perfil')
    assert ejecucion.despertar_en == T0 + timedelta(minutes=60)


def test_boton_respuesta_libre_y_condicion(flujo, lead):
    guia = flujo()
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'medico'), 'Médico graduado', minutos=1)

    assert lead.textos()[1:] == ['Genial ya te lo mando 🙌', 'Antes, para qué examen te estás preparando?']
    assert lead.ejecucion().nodo_actual == 'examen'

    lead.escribe('ENARM', minutos=2)

    assert lead.textos()[-1] == 'Recursos para ENARM'
    assert lead.ejecucion().estado == AutEjecucion.TERMINADA
    contacto = IgContacto.query.one()
    assert contacto.variables == {'ultimo_boton': 'Médico graduado', 'examen': 'ENARM'}


def test_la_otra_rama_de_la_condicion_y_un_adjunto(flujo, lead):
    guia = flujo()
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'medico'))
    lead.escribe('MIR')

    assert lead.textos()[-2:] == ['Recursos generales', 'image']


def test_escribir_el_titulo_de_un_boton_vale_como_tocarlo(flujo, lead):
    flujo()
    lead.escribe('OBTENER GUIA')
    lead.escribe('estudiante')

    assert lead.textos()[-2:] == ['Recursos generales', 'image']


def test_un_texto_cualquiera_mientras_espera_botones_se_ignora(flujo, lead):
    flujo()
    lead.escribe('OBTENER GUIA')
    lead.escribe('hola?')

    assert lead.textos() == ['¿Cuál es tu perfil?']
    assert lead.ejecucion().estado == AutEjecucion.ESPERANDO_RESPUESTA


def test_si_no_responde_sale_el_seguimiento(flujo, lead):
    flujo()
    lead.escribe('OBTENER GUIA')

    lead.pasa(59)
    assert lead.textos() == ['¿Cuál es tu perfil?']
    lead.pasa(1)
    assert lead.textos()[-1] == 'Estas por ahi?'
    assert lead.ejecucion().estado == AutEjecucion.TERMINADA


def test_un_nodo_esperar_retoma_cuando_vence(flujo, lead):
    grafo = f.guia()
    grafo['nodos'].append({'id': 'pausa', 'tipo': 'esperar', 'minutos': 10})
    grafo['conexiones'] = [c for c in grafo['conexiones'] if c['id'] != 'c4']
    grafo['conexiones'] += [{'id': 'p1', 'desde': 'genial', 'salida': 'siguiente', 'hacia': 'pausa'},
                            {'id': 'p2', 'desde': 'pausa', 'salida': 'siguiente', 'hacia': 'examen'}]
    guia = flujo(grafo)
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'medico'))

    assert lead.ejecucion().estado == AutEjecucion.ESPERANDO_TIEMPO
    lead.pasa(10)
    assert lead.textos()[-1] == 'Antes, para qué examen te estás preparando?'


def test_una_palabra_clave_nueva_reinicia_el_flujo(flujo, lead):
    guia = flujo()
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'medico'))
    lead.escribe('obtener guia')

    estados = [e.estado for e in AutEjecucion.query.order_by(AutEjecucion.id)]
    assert estados == [AutEjecucion.CANCELADA, AutEjecucion.ESPERANDO_RESPUESTA]
    assert lead.textos()[-1] == '¿Cuál es tu perfil?'


def test_un_boton_viejo_retoma_desde_su_destino(flujo, lead):
    guia = flujo()
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'estudiante'))
    assert lead.ejecucion().estado == AutEjecucion.TERMINADA

    lead.toca(payload(guia, 'perfil', 'medico'), minutos=5)

    assert lead.textos()[-2:] == ['Genial ya te lo mando 🙌', 'Antes, para qué examen te estás preparando?']


def test_los_botones_de_manychat_no_hacen_nada(flujo, lead):
    flujo()
    resumen = lead.toca('ACT::007eb259d50abca2a4b9484804837078', 'Médico graduado')

    assert resumen['procesados'] == 1
    assert lead.transporte.enviados == []


# --- Una persona del equipo escribe -------------------------------------------------------------

def test_en_modo_real_un_eco_ajeno_pausa_el_bot(flujo, lead, monkeypatch):
    monkeypatch.setenv('IG_MOTOR_MODO', 'real')
    flujo()
    lead.escribe('OBTENER GUIA')
    lead.llega(f.eco('Hola! soy Elias', 'humano-1', ms(lead.ahora)))

    assert lead.ejecucion().estado == AutEjecucion.CANCELADA
    lead.escribe('OBTENER GUIA', minutos=5)
    assert lead.textos() == ['¿Cuál es tu perfil?']  # no volvió a arrancar
    mensaje = IgMensaje.query.filter_by(mid='humano-1').one()
    assert (mensaje.direccion, mensaje.origen) == (IgMensaje.SALIENTE, IgMensaje.OTRO)

    lead.pasa(24 * 60)
    lead.escribe('OBTENER GUIA')
    assert lead.textos()[-1] == '¿Cuál es tu perfil?'  # pasada la pausa, vuelve


def test_el_eco_de_un_mensaje_propio_no_pausa(flujo, lead, monkeypatch):
    monkeypatch.setenv('IG_MOTOR_MODO', 'real')
    flujo()
    lead.escribe('OBTENER GUIA')
    propio = lead.transporte.enviados[0]['mid']
    lead.llega(f.eco('¿Cuál es tu perfil?', propio, ms(lead.ahora)))

    assert lead.ejecucion().estado == AutEjecucion.ESPERANDO_RESPUESTA
    assert IgMensaje.query.filter_by(mid=propio).one().origen == IgMensaje.MOTOR


def test_en_modo_simulado_los_ecos_no_pausan(flujo, lead, monkeypatch):
    monkeypatch.setenv('IG_MOTOR_MODO', 'simulado')
    flujo()
    lead.escribe('OBTENER GUIA')
    lead.llega(f.eco('mensaje de ManyChat', 'mc-1', ms(lead.ahora)))

    assert lead.ejecucion().estado == AutEjecucion.ESPERANDO_RESPUESTA


# --- Ventana de 24 h y comentarios --------------------------------------------------------------

def test_no_escribe_pasadas_24_horas_del_ultimo_mensaje(flujo, lead):
    grafo = f.guia()
    grafo['nodos'].append({'id': 'pausa', 'tipo': 'esperar', 'minutos': 24 * 60})
    grafo['conexiones'] = [c for c in grafo['conexiones'] if c['id'] != 'c4']
    grafo['conexiones'] += [{'id': 'p1', 'desde': 'genial', 'salida': 'siguiente', 'hacia': 'pausa'},
                            {'id': 'p2', 'desde': 'pausa', 'salida': 'siguiente', 'hacia': 'examen'}]
    guia = flujo(grafo)
    lead.escribe('OBTENER GUIA')
    lead.toca(payload(guia, 'perfil', 'medico'))
    enviados = len(lead.transporte.enviados)

    lead.pasa(24 * 60)

    assert len(lead.transporte.enviados) == enviados
    assert lead.ejecucion().estado == AutEjecucion.VENTANA_VENCIDA


def test_por_comentario_responde_en_privado_y_no_abre_la_ventana(flujo, lead):
    grafo = f.guia(disparadores=[{'id': 'd1', 'canal': 'comentario', 'palabras': ['GUIA'], 'coincidencia': 'contiene'}])
    guia = flujo(grafo)
    lead.llega(f.comentario('quiero la guia!', 'c-99', ms(lead.ahora)))

    assert lead.transporte.enviados[0]['destinatario'] == {'comment_id': 'c-99'}
    assert IgContacto.query.one().ultimo_entrante_en is None
    assert IgContacto.query.one().username == 'ana'

    lead.toca(payload(guia, 'perfil', 'medico'), minutos=3)  # al tocar el botón se abre la ventana
    assert lead.transporte.enviados[-1]['destinatario'] == {'id': f.LEAD}


def test_un_rechazo_de_meta_por_ventana_cierra_la_ejecucion(flujo, lead):
    class Cerrado(TransporteSimulado):
        def enviar(self, destinatario, cuerpo):
            raise ErrorDeEnvio('fuera de ventana', ventana_cerrada=True)

    flujo()
    lead.transporte = Cerrado()
    lead.escribe('OBTENER GUIA')

    assert lead.ejecucion().estado == AutEjecucion.VENTANA_VENCIDA


# --- Procesamiento de los eventos guardados -----------------------------------------------------

def test_el_mismo_mensaje_dos_veces_se_procesa_una(flujo, lead):
    flujo()
    repetido = f.dm('OBTENER GUIA', 'mismo-mid', ms(lead.ahora))
    lead.llega(repetido)
    lead.llega(repetido)

    assert lead.textos() == ['¿Cuál es tu perfil?']
    assert [e.resultado for e in InstagramWebhookEvento.query.order_by(InstagramWebhookEvento.id)] == \
        ['flujo_iniciado', 'repetido']


def test_apagado_no_procesa_nada(flujo, db):
    flujo()
    db.session.add(InstagramWebhookEvento(tipos='messages', payload=f.dm('OBTENER GUIA', 'm1', ms(T0)), recibido_en=T0))
    db.session.commit()

    assert servicio.tick(T0) == {'procesados': 0, 'despertadas': 0}
    assert InstagramWebhookEvento.query.one().procesado_en is None


def test_lo_que_lleva_mucho_sin_procesar_no_se_contesta(flujo, lead):
    flujo()
    _db.session.add(InstagramWebhookEvento(tipos='messages', payload=f.dm('OBTENER GUIA', 'm1', ms(T0)), recibido_en=T0))
    _db.session.commit()

    servicio.procesar_pendientes(T0 + timedelta(minutes=61), lead.transporte)

    assert lead.transporte.enviados == []
    assert InstagramWebhookEvento.query.one().resultado == 'antiguo'


def test_un_evento_que_rompe_no_traba_a_los_siguientes(flujo, lead, monkeypatch):
    flujo()
    original = servicio.Motor.procesar

    def falla_con_el_primero(self, evento):
        if evento.mid == 'roto':
            raise RuntimeError('boom')
        return original(self, evento)

    monkeypatch.setattr(servicio.Motor, 'procesar', falla_con_el_primero)
    _db.session.add(InstagramWebhookEvento(tipos='m', payload=f.dm('OBTENER GUIA', 'roto', ms(T0)), recibido_en=T0))
    _db.session.add(InstagramWebhookEvento(tipos='m', payload=f.dm('OBTENER GUIA', 'sano', ms(T0)), recibido_en=T0))
    _db.session.commit()

    servicio.procesar_pendientes(T0, lead.transporte)

    resultados = [e.resultado for e in InstagramWebhookEvento.query.order_by(InstagramWebhookEvento.id)]
    assert resultados == ['error: boom', 'flujo_iniciado']
    assert lead.textos() == ['¿Cuál es tu perfil?']


# --- Publicación y versiones --------------------------------------------------------------------

def test_publicar_valida_y_congela_la_version(flujo, lead):
    guia = flujo()
    lead.escribe('OBTENER GUIA')

    nuevo = f.guia()
    nuevo['nodos'][0]['contenido'][0]['texto'] = '¿Qué perfil tenés?'
    guia.grafo = nuevo
    _db.session.commit()
    lead.escribe('estudiante')  # quien ya estaba sigue con la versión con la que entró
    assert lead.textos()[-2] == 'Recursos generales'

    assert servicio.publicar(guia, momento=lead.ahora) == []
    lead.escribe('OBTENER GUIA')
    assert lead.textos()[-1] == '¿Qué perfil tenés?'
    assert guia.version_publicada.numero == 2


def test_un_flujo_invalido_no_se_publica(db):
    roto = AutFlujo(nombre='Roto', grafo={'nodos': []})
    db.session.add(roto)
    db.session.commit()

    assert servicio.publicar(roto) == ['El flujo no tiene nodos']
    assert roto.version_publicada_id is None and roto.estado == AutFlujo.BORRADOR


def test_un_flujo_pausado_no_atrapa_a_nadie(flujo, lead):
    guia = flujo()
    guia.estado = AutFlujo.PAUSADO
    _db.session.commit()

    lead.escribe('OBTENER GUIA')

    assert lead.transporte.enviados == []


# --- Activación hacia adelante -------------------------------------------------------------------

def test_un_flujo_no_atrapa_mensajes_anteriores_a_su_activacion(db, lead):
    guia = AutFlujo(nombre='Guía', grafo=f.guia())
    db.session.add(guia)
    db.session.commit()
    servicio.publicar(guia, momento=T0 + timedelta(minutes=5))

    # Escrito antes de activarlo, procesado después (p. ej. llegó con demora).
    lead.ahora = T0 + timedelta(minutes=6)
    lead.llega(f.dm('OBTENER GUIA', 'viejo', ms(T0)))
    assert lead.transporte.enviados == []

    lead.escribe('OBTENER GUIA')
    assert lead.textos() == ['¿Cuál es tu perfil?']


def test_reactivar_un_flujo_pausado_tampoco_es_retroactivo(flujo, lead):
    guia = flujo()
    guia.estado = AutFlujo.PAUSADO
    _db.session.commit()
    escrito_en_pausa = ms(lead.ahora)
    servicio.activar(guia, momento=lead.ahora + timedelta(minutes=1))

    lead.llega(f.dm('OBTENER GUIA', 'en-pausa', escrito_en_pausa), minutos=2)
    assert lead.transporte.enviados == []
    lead.escribe('OBTENER GUIA')
    assert lead.textos() == ['¿Cuál es tu perfil?']


def test_republicar_un_flujo_activo_no_le_cambia_el_inicio(flujo, lead):
    guia = flujo()
    inicio = guia.activo_desde

    servicio.publicar(guia, momento=T0 + timedelta(hours=1))

    assert guia.activo_desde == inicio


# --- Cómo se corre ------------------------------------------------------------------------------

def test_procesa_toda_la_cola_aunque_supere_el_lote(flujo, lead):
    flujo()
    for i in range(3):
        _db.session.add(InstagramWebhookEvento(tipos='m', payload=f.dm('hola', f'm{i}', ms(T0)), recibido_en=T0))
    _db.session.commit()

    assert servicio.procesar_pendientes(T0, lead.transporte, limite=1) == {'procesados': 3}
    assert InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None)).count() == 0


def test_lo_acumulado_se_marca_antiguo_de_una_vez_y_lo_nuevo_se_contesta(flujo, lead):
    flujo()
    for i in range(3):
        _db.session.add(InstagramWebhookEvento(tipos='m', payload=f.dm('OBTENER GUIA', f'v{i}', ms(T0)), recibido_en=T0))
    _db.session.commit()

    lead.ahora = T0 + timedelta(hours=3)
    lead.escribe('OBTENER GUIA')

    resultados = [e.resultado for e in InstagramWebhookEvento.query.order_by(InstagramWebhookEvento.id)]
    assert resultados == ['antiguo', 'antiguo', 'antiguo', 'flujo_iniciado']
    assert lead.textos() == ['¿Cuál es tu perfil?']


def test_apagado_el_reloj_no_corre_ni_arranca(monkeypatch):
    monkeypatch.delenv('IG_MOTOR_MODO', raising=False)
    monkeypatch.setattr(servicio, '_reloj', None)

    assert servicio.correr_una_vuelta() is None
    servicio.avisar(object())
    assert servicio._reloj is None


def test_una_vuelta_del_reloj_procesa_y_despierta(flujo, lead, monkeypatch):
    flujo()
    monkeypatch.setenv('IG_MOTOR_MODO', 'simulado')
    _db.session.add(InstagramWebhookEvento(tipos='m', payload=f.dm('OBTENER GUIA', 'r1', ms(servicio.ahora())),
                                           recibido_en=servicio.ahora()))
    _db.session.commit()

    assert servicio.correr_una_vuelta() == {'procesados': 1, 'despertadas': 0}
    assert InstagramWebhookEvento.query.one().resultado == 'flujo_iniciado'


# --- Transporte real ----------------------------------------------------------------------------

class SesionFalsa:
    def __init__(self, status, cuerpo):
        self.status, self.cuerpo, self.llamadas = status, cuerpo, []

    def post(self, url, json, headers, timeout):
        self.llamadas.append((url, json, headers))
        import json as _json

        class R:
            status_code = self.status
            content = _json.dumps(self.cuerpo).encode()

            def json(s):
                return self.cuerpo
        return R()


def test_el_transporte_de_meta_arma_la_llamada():
    sesion = SesionFalsa(200, {'recipient_id': f.LEAD, 'message_id': 'mid-real'})
    transporte = TransporteMeta(token='tok', cuenta_id=f.CUENTA, sesion=sesion)

    assert transporte.enviar({'id': f.LEAD}, {'text': 'hola'}) == 'mid-real'
    url, cuerpo, cabeceras = sesion.llamadas[0]
    assert url == f'https://graph.instagram.com/v24.0/{f.CUENTA}/messages'
    assert cuerpo == {'recipient': {'id': f.LEAD}, 'message': {'text': 'hola'}}
    assert cabeceras == {'Authorization': 'Bearer tok'}


@pytest.mark.parametrize('codigo, ventana', [(10, True), (551, True), (100, False)])
def test_los_errores_de_meta_dicen_si_es_por_la_ventana(codigo, ventana):
    sesion = SesionFalsa(400, {'error': {'message': 'no', 'code': codigo}})

    with pytest.raises(ErrorDeEnvio) as error:
        TransporteMeta(token='tok', cuenta_id=f.CUENTA, sesion=sesion).enviar({'id': f.LEAD}, {'text': 'x'})
    assert error.value.ventana_cerrada is ventana


def test_sin_id_de_cuenta_manda_por_me(monkeypatch):
    monkeypatch.delenv('IG_USER_ID', raising=False)
    sesion = SesionFalsa(200, {'message_id': 'mid-real'})

    TransporteMeta(token='tok', sesion=sesion).enviar({'id': f.LEAD}, {'text': 'hola'})

    assert sesion.llamadas[0][0] == 'https://graph.instagram.com/v24.0/me/messages'


def test_sin_token_no_intenta_mandar():
    with pytest.raises(ErrorDeEnvio):
        TransporteMeta(token=None, cuenta_id=None, sesion=SesionFalsa(200, {})).enviar({'id': f.LEAD}, {'text': 'x'})
