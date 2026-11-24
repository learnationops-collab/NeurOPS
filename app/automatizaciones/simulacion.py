"""Simular una conversación completa desde Embudos (ADR-W204), sin mandar nada a Instagram.

El frontend manda la lista entera de acciones cada vez (escribir como el lead, tocar un botón, contestar
como setter, adelantar el reloj, mover de fase) y acá se vuelve a correr todo desde cero:

  · un lead de prueba nuevo, el motor de verdad (flujos publicados, campañas, reparto) con el transporte
    simulado, y la cadencia de seguimientos del borrador de la Guía que se está editando;
  · todo dentro de un SAVEPOINT que se deshace al final: no queda nada en la base. Ningún paso del motor
    hace commit (si alguno lo hiciera, rompería esto: mantenerlo así).

La cadencia se corre paso por paso (cada seguimiento a su hora), no con la tolerancia del reloj real.
"""
import uuid
from datetime import timedelta

from app import db
from app.automatizaciones import cadencias, embudos, escribir, fases, guia
from app.automatizaciones.motor import Motor
from app.automatizaciones.modelos import AutEjecucion, IgContacto, IgMensaje, ahora
from app.automatizaciones.nucleo import eventos as ev
from app.automatizaciones.transporte import TransporteSimulado

MAX_ACCIONES = 120
MAX_HORAS = 14 * 24


class SimulacionInvalida(ValueError):  # noqa: N818
    pass


class _Sim:
    def __init__(self, embudo, borrador):
        self.embudo, self.borrador = embudo, borrador
        self.transporte = TransporteSimulado()
        self.t0 = self.t = ahora()
        self.eventos, self.hechos, self.recibidos = [], set(), set()
        self.contacto = IgContacto(igsid=f'sim-{uuid.uuid4().hex[:12]}', username='lead.de.prueba',
                                   nombre='Valen Prueba', variables={}, creado_en=self.t0,
                                   embudo_id=embudos.id_guardado(embudo))
        db.session.add(self.contacto)
        db.session.flush()

    def motor(self):
        return Motor(self.transporte, self.t, pausar_ante_ecos=False)

    def evento(self, texto, tipo='info'):
        self.eventos.append({'tipo': 'evento', 'clase': tipo, 'texto': texto, 'en': self.t})

    def donde(self):
        e = embudos.de_contacto(self.contacto)
        return e, cadencias._fases(e, [self.contacto], self.t).get(self.contacto.id)

    def cadencia(self, embudo):
        if self.borrador is not None and embudo.id == self.embudo.id:
            contenido = self.borrador
        else:
            contenido = guia.vigente(embudo)[1]
        etapas = contenido.get('etapas') or {}
        return {f: e.get('seguimientos') for f, e in etapas.items() if e.get('seguimientos') and f not in fases.SALIDAS}

    # --- Acciones -------------------------------------------------------------------------------

    def lead(self, texto=None, payload=None, titulo=None, rapida=False):
        tipo = ev.MENSAJE if (rapida or not payload) else ev.BOTON
        evento = ev.Evento(tipo, self.contacto.igsid, self.t, mid=f'sim-in-{uuid.uuid4().hex[:10]}',
                           texto=(titulo if payload else texto) or '', payload=payload)
        self._con_cambios(lambda: self.motor().procesar(evento))

    def setter(self, texto, clave_guia=None):
        try:
            self._con_cambios(lambda: escribir.enviar(self.motor(), self.contacto, None, texto=texto,
                                                      guia=guia.clave_valida(clave_guia)))
        except Exception as error:  # ventana cerrada, texto vacío: se muestra en la conversación
            self.evento(f'No sale: {error}', 'error')

    def mover(self, fase, slug=None):
        destino = embudos.por_slug(slug) if slug else embudos.de_contacto(self.contacto)
        if destino is None or fase not in embudos.ids_de(destino):
            destino = embudos.conversion() if fase in fases.TODAS else None
        if destino is None:
            raise SimulacionInvalida('Esa fase no existe')
        self._con_cambios(lambda: (embudos.mover_a(self.contacto, destino),
                                   fases.mover(self.contacto, fase, None, None)))

    def reloj(self, horas):
        hasta = min(self.t + timedelta(hours=max(0.0, horas)), self.t0 + timedelta(hours=MAX_HORAS))
        for _ in range(40):
            proximo = self._proximo(hasta)
            if proximo is None:
                break
            self.t = max(self.t, proximo[0])
            proximo[1]()
        self.t = hasta

    # --- Lo que pasa solo ---------------------------------------------------------------------

    def _proximo(self, hasta):
        """(cuándo, qué hacer) de lo próximo que pasa solo antes de `hasta`: una espera de flujo o un seguimiento."""
        candidatos = []
        e = (AutEjecucion.query.filter(AutEjecucion.contacto_id == self.contacto.id,
                                       AutEjecucion.estado.in_(AutEjecucion.ABIERTOS),
                                       AutEjecucion.despertar_en.isnot(None)).order_by(AutEjecucion.despertar_en).first())
        if e and e.despertar_en <= hasta:
            candidatos.append((e.despertar_en, lambda: self._con_cambios(
                lambda: self.motor().despertar_vencidas(self.contacto.id))))
        paso = self._paso_pendiente()
        if paso and paso[0] <= hasta:
            candidatos.append(paso)
        return min(candidatos, key=lambda c: c[0]) if candidatos else None

    def _paso_pendiente(self):
        ciclo = self.contacto.ultimo_entrante_en
        if not ciclo or not self._en_silencio():
            return None
        embudo, fase = self.donde()
        for numero, p in enumerate(self.cadencia(embudo).get(fase) or [], start=1):
            cad = cadencias.clave(embudo, fase, p)
            if (cad, ciclo) not in self.hechos:
                return ciclo + timedelta(hours=p['h']), lambda: self._seguimiento(embudo, fase, numero, p, cad, ciclo)
        return None

    def _en_silencio(self):
        ultimo = (db.session.query(db.func.max(IgMensaje.enviado_en))
                  .filter(IgMensaje.contacto_id == self.contacto.id, IgMensaje.direccion == IgMensaje.SALIENTE).scalar())
        return bool(ultimo and ultimo >= self.contacto.ultimo_entrante_en)

    def _seguimiento(self, embudo, fase, numero, paso, cad, ciclo):
        self.hechos.add((cad, ciclo))
        if paso['quien'] == 'setter':
            return self.evento(f'Toca seguimiento {numero}: aviso al setter'
                               + ('' if self.t - ciclo < cadencias.VENTANA_AUTO else ' (ventana cerrada: solo puede escribir él)'),
                               'aviso')
        if self.t - ciclo >= cadencias.VENTANA_AUTO:
            return self.evento(f'Seguimiento {numero} no sale: ventana de 24 h cerrada', 'error')
        if paso.get('unaVez') and cad in self.recibidos:
            return self.evento(f'Seguimiento {numero} no sale: ya lo recibió antes', 'error')
        if cadencias._ocupado_en_flujo(self.contacto.id):
            return self.evento(f'Seguimiento {numero} no sale: está en medio de un flujo', 'error')
        try:
            cuerpo = cadencias.cuerpo(paso, cadencias.variables_de(self.contacto, embudo))
        except ValueError as error:
            return self.evento(f'Seguimiento {numero} no sale: {error}', 'error')
        mid = self.transporte.enviar({'id': self.contacto.igsid}, cuerpo)
        texto = cuerpo.get('text') or cuerpo['attachment']['payload']['text']
        db.session.add(IgMensaje(contacto_id=self.contacto.id, mid=mid, direccion=IgMensaje.SALIENTE,
                                 origen=IgMensaje.MOTOR, texto=texto, contenido=cuerpo, enviado_en=self.t,
                                 nodo_id='seguimiento'))
        db.session.flush()
        self.recibidos.add(cad)

    def _con_cambios(self, hacer):
        """Corre `hacer` y anota si el lead cambió de embudo o de fase, o si arrancó un flujo."""
        antes_e, antes_f = self.donde()
        ult = db.session.query(db.func.max(AutEjecucion.id)).filter(AutEjecucion.contacto_id == self.contacto.id).scalar()
        hacer()
        db.session.flush()
        nueva = (AutEjecucion.query.filter(AutEjecucion.contacto_id == self.contacto.id, AutEjecucion.id > (ult or 0))
                 .order_by(AutEjecucion.id).first())
        if nueva:
            self.evento(f'Arrancó el flujo «{nueva.version.flujo.nombre}»', 'flujo')
        despues_e, despues_f = self.donde()
        if despues_e.id != antes_e.id:
            self.evento(f'Pasa al embudo {despues_e.nombre}', 'fase')
        if despues_f != antes_f or despues_e.id != antes_e.id:
            nombres = {f['id']: f['nombre'] for f in embudos.fases_de(despues_e)}
            self.evento(f'Fase: {nombres.get(despues_f) or fases.NOMBRES.get(despues_f, despues_f)}', 'fase')

    # --- Salida ---------------------------------------------------------------------------------

    def _botones(self, contenido):
        adjunto = (contenido or {}).get('attachment') or {}
        if adjunto.get('type') == 'template':
            return [{'titulo': b.get('title'), 'payload': b.get('payload'), 'url': b.get('url')}
                    for b in adjunto['payload'].get('buttons') or []]
        return [{'titulo': q.get('title'), 'payload': q.get('payload'), 'rapida': True}
                for q in (contenido or {}).get('quick_replies') or []]

    def _horas(self, momento):
        return round((momento - self.t0).total_seconds() / 3600, 2)

    def resultado(self):
        mensajes = (IgMensaje.query.filter_by(contacto_id=self.contacto.id)
                    .order_by(IgMensaje.enviado_en, IgMensaje.id).all())
        items = []
        for m in mensajes:
            if m.direccion == IgMensaje.ENTRANTE:
                tipo = 'lead'
            elif m.origen == IgMensaje.MOTOR:
                tipo = 'auto' if m.nodo_id == 'seguimiento' else 'bot'
            else:
                tipo = 'setter'
            items.append({'tipo': tipo, 'texto': m.texto, 'botones': self._botones(m.contenido), 'en': m.enviado_en})
        items += self.eventos
        items.sort(key=lambda x: (x['en'], x['tipo'] == 'evento'))
        embudo, fase = self.donde()
        ciclo = self.contacto.ultimo_entrante_en
        pendiente = self._paso_pendiente()
        proximo = {'en': self._horas(pendiente[0])} if pendiente else None
        return {
            'items': [{**x, 'en': self._horas(x['en'])} for x in items],
            'estado': {'embudo': embudo.slug, 'embudo_nombre': embudo.nombre, 'fase': fase, 'ahora': self._horas(self.t),
                       'sin_contestar': self._horas(self.t) - self._horas(ciclo) if ciclo else None,
                       'en_silencio': bool(ciclo and self._en_silencio()), 'proximo': proximo,
                       'bot_pausado': bool(self.contacto.bot_pausado_hasta and self.contacto.bot_pausado_hasta > self.t)},
        }


def simular(embudo, acciones, borrador=None):
    """Corre las acciones y devuelve la conversación. No deja nada en la base."""
    if not isinstance(acciones, list) or len(acciones) > MAX_ACCIONES:
        raise SimulacionInvalida(f'La simulación admite hasta {MAX_ACCIONES} acciones')
    if borrador is not None:
        try:
            borrador = guia.validar(borrador, embudo)
        except guia.GuiaInvalida as error:
            raise SimulacionInvalida(str(error))
    punto = db.session.begin_nested()
    try:
        sim = _Sim(embudo, borrador)
        for a in acciones:
            a = a if isinstance(a, dict) else {}
            tipo = a.get('tipo')
            if tipo == 'lead':
                sim.lead(texto=str(a.get('texto') or '')[:1000])
            elif tipo == 'boton':
                sim.lead(payload=str(a.get('payload') or ''), titulo=str(a.get('titulo') or ''), rapida=bool(a.get('rapida')))
            elif tipo == 'setter':
                sim.setter(str(a.get('texto') or '')[:1000], a.get('guia'))
            elif tipo == 'reloj':
                sim.reloj(float(a.get('horas') or 0))
            elif tipo == 'fase':
                sim.mover(str(a.get('fase') or ''), a.get('embudo'))
        return sim.resultado()
    finally:
        punto.rollback()
        db.session.rollback()
