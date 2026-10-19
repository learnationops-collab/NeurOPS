"""El motor: recibe eventos ya leídos y lleva a cada contacto por el grafo del flujo.

Reglas que garantiza:
  · Un contacto tiene a lo sumo UNA ejecución abierta. Una palabra clave nueva cancela la anterior.
  · Prioridad ante un mensaje: botón propio > palabra clave de una campaña vigente > disparador propio
    del flujo > respuesta a lo que se estaba esperando.
  · Si la cuenta manda algo que no salió de este motor (una persona del equipo), el bot se pausa
    para ese contacto y se cancela lo que tenía abierto.
  · Nunca escribe fuera de la ventana de 24 h, salvo la respuesta privada a un comentario.
  · Un flujo solo atrapa mensajes posteriores a su activación.
  · Un `mid` se procesa una sola vez, así reprocesar un evento no duplica nada.
"""
from datetime import timedelta

from app import db
from app.automatizaciones import campanas
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, AutFlujoVersion, IgContacto, IgMensaje
from app.automatizaciones.nucleo import eventos as ev
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import mensajes
from app.automatizaciones.transporte import ErrorDeEnvio

VENTANA = timedelta(hours=24)
# En las variables del contacto: el motor tomó el control de la conversación y tiene que devolverlo.
CONTROL_TOMADO = '_control_tomado'
HORAS_DE_PAUSA = 24
MAX_PASOS = 50  # corta un grafo con un ciclo sin esperas


class Motor:
    def __init__(self, transporte, ahora, pausar_ante_ecos=True):
        self.transporte = transporte
        self.ahora = ahora
        self.pausar_ante_ecos = pausar_ante_ecos

    # --- Entrada ------------------------------------------------------------------------------

    def procesar(self, evento):
        contacto = self._contacto(evento)
        if evento.tipo == ev.ECO:
            return self._eco(contacto, evento)
        if not self._registrar_entrante(contacto, evento):
            return 'repetido'
        if contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > self.ahora:
            return 'bot_pausado'

        if evento.payload:
            datos = mensajes.leer_payload(evento.payload)
            if datos:
                return self._boton(contacto, *datos)

        canal = 'comentario' if evento.tipo == ev.COMENTARIO else 'dm'
        if canal == 'dm':
            version, campana, clave = self._version_de_campana(evento.texto, evento.momento)
            if version:
                self._iniciar(contacto, version, campana=campana, clave=clave)
                return 'flujo_iniciado'
        version = self._version_disparada(evento.texto, canal, evento.publicacion_id, evento.momento)
        if version:
            self._iniciar(contacto, version, comentario_id=evento.comentario_id)
            return 'flujo_iniciado'

        if evento.tipo == ev.COMENTARIO:
            return 'sin_disparador'
        abierta = self._abierta(contacto)
        if abierta and abierta.estado == AutEjecucion.ESPERANDO_RESPUESTA:
            return self._respuesta(abierta, evento)
        return 'sin_disparador'

    def despertar_vencidas(self):
        """Las esperas que ya vencieron: un nodo «esperar» o el «sin respuesta» de un mensaje."""
        vencidas = (AutEjecucion.query
                    .filter(AutEjecucion.estado.in_((AutEjecucion.ESPERANDO_TIEMPO, AutEjecucion.ESPERANDO_RESPUESTA)),
                            AutEjecucion.despertar_en.isnot(None), AutEjecucion.despertar_en <= self.ahora)
                    .order_by(AutEjecucion.despertar_en).all())
        for ejecucion in vencidas:
            contacto = ejecucion.contacto
            if contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > self.ahora:
                self._cerrar(ejecucion, AutEjecucion.CANCELADA, 'Bot pausado: escribió una persona')
                continue
            salida = 'siguiente' if ejecucion.estado == AutEjecucion.ESPERANDO_TIEMPO else 'sin_respuesta'
            self._avanzar(ejecucion, salida)
        return len(vencidas)

    # --- Contacto e historial -----------------------------------------------------------------

    def _contacto(self, evento):
        contacto = IgContacto.query.filter_by(igsid=evento.igsid).first()
        if contacto is None:
            contacto = IgContacto(igsid=evento.igsid, variables={}, creado_en=self.ahora)
            db.session.add(contacto)
            db.session.flush()
        if evento.username and not contacto.username:
            contacto.username = evento.username
        return contacto

    def _registrar_entrante(self, contacto, evento):
        """False si ese mensaje ya se había procesado."""
        mid = evento.mid or (f'comentario:{evento.comentario_id}' if evento.comentario_id else None)
        if mid and IgMensaje.query.filter_by(mid=mid).first():
            return False
        contenido = {'adjuntos': evento.adjuntos} if evento.adjuntos else None
        if evento.payload:
            contenido = {**(contenido or {}), 'payload': evento.payload}
        if evento.tipo == ev.COMENTARIO:
            contenido = {'comentario_id': evento.comentario_id, 'publicacion_id': evento.publicacion_id}
        db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.ENTRANTE, origen=IgMensaje.LEAD,
                                 texto=evento.texto, contenido=contenido, enviado_en=evento.momento))
        # Un comentario no abre la ventana de mensajes; un DM o un botón sí.
        if evento.tipo != ev.COMENTARIO and (not contacto.ultimo_entrante_en or evento.momento > contacto.ultimo_entrante_en):
            contacto.ultimo_entrante_en = evento.momento
        db.session.flush()
        return True

    def _eco(self, contacto, evento):
        if evento.mid and IgMensaje.query.filter_by(mid=evento.mid).first():
            return 'eco_propio'
        db.session.add(IgMensaje(contacto_id=contacto.id, mid=evento.mid, direccion=IgMensaje.SALIENTE,
                                 origen=IgMensaje.OTRO, texto=evento.texto,
                                 contenido={'adjuntos': evento.adjuntos} if evento.adjuntos else None,
                                 enviado_en=evento.momento))
        if self.pausar_ante_ecos:
            contacto.bot_pausado_hasta = self.ahora + timedelta(hours=HORAS_DE_PAUSA)
            abierta = self._abierta(contacto)
            if abierta:
                self._cerrar(abierta, AutEjecucion.CANCELADA, 'Escribió una persona del equipo')
        db.session.flush()
        return 'eco_ajeno'

    # --- Ejecuciones --------------------------------------------------------------------------

    def _abierta(self, contacto):
        return (AutEjecucion.query.filter(AutEjecucion.contacto_id == contacto.id,
                                          AutEjecucion.estado.in_(AutEjecucion.ABIERTOS))
                .order_by(AutEjecucion.id.desc()).first())

    def _version_disparada(self, texto, canal, publicacion_id, momento):
        activos = (AutFlujo.query.filter(AutFlujo.estado == AutFlujo.ACTIVO, AutFlujo.version_publicada_id.isnot(None))
                   .order_by(AutFlujo.id).all())
        for flujo in activos:
            if flujo.activo_desde and momento < flujo.activo_desde:
                continue  # el mensaje es anterior a la activación: no es retroactiva
            version = flujo.version_publicada
            for disparador in version.grafo.get('disparadores') or []:
                if g.coincide(disparador, texto, canal, publicacion_id):
                    return version
        return None

    def _version_de_campana(self, texto, momento):
        """(versión, campaña, clave) si el mensaje es una palabra clave de una campaña vigente cuyo
        flujo está activo desde antes del mensaje; si no, (None, None, None)."""
        campana, clave = campanas.campana_de(texto, momento)
        flujo = campana.flujo if campana else None
        if flujo is None or flujo.estado != AutFlujo.ACTIVO or flujo.version_publicada is None:
            return None, None, None
        if flujo.activo_desde and momento < flujo.activo_desde:
            return None, None, None
        return flujo.version_publicada, campana, clave

    def _iniciar(self, contacto, version, comentario_id=None, nodo=None, campana=None, clave=None):
        abierta = self._abierta(contacto)
        if abierta:
            self._cerrar(abierta, AutEjecucion.CANCELADA, 'Entró a otro flujo', liberar=False)
        ejecucion = AutEjecucion(contacto=contacto, version=version, estado=AutEjecucion.EN_CURSO,
                                 nodo_actual=nodo or version.grafo.get('inicio'), comentario_id=comentario_id,
                                 iniciada_en=self.ahora, campana_id=campana.id if campana else None, clave=clave)
        db.session.add(ejecucion)
        db.session.flush()
        self._correr(ejecucion)
        return ejecucion

    def _boton(self, contacto, version_id, nodo_id, boton_id):
        version = db.session.get(AutFlujoVersion, version_id)
        if version is None:
            return 'boton_desconocido'
        nodo = g.nodos_por_id(version.grafo).get(nodo_id)
        boton = next((b for b in (nodo or {}).get('botones') or [] if b.get('id') == boton_id), None)
        if boton is None:
            return 'boton_desconocido'
        self._guardar(contacto, {'ultimo_boton': boton.get('titulo')})
        abierta = self._abierta(contacto)
        if abierta and abierta.version_id == version_id and abierta.nodo_actual == nodo_id \
                and abierta.estado == AutEjecucion.ESPERANDO_RESPUESTA:
            self._avanzar(abierta, boton_id)
            return 'boton'
        # Un botón de un mensaje viejo: retoma el flujo desde donde lleva ese botón.
        hacia = g.destino(version.grafo, nodo_id, boton_id)
        if hacia is None:
            return 'boton_sin_destino'
        self._iniciar(contacto, version, nodo=hacia)
        return 'boton_reanuda'

    def _respuesta(self, ejecucion, evento):
        nodo = g.nodos_por_id(ejecucion.version.grafo).get(ejecucion.nodo_actual) or {}
        if nodo.get('botones'):
            # Escribió en vez de tocar: vale si el texto es el título de un botón.
            escrito = g.normalizar_texto(evento.texto)
            boton = next((b for b in nodo['botones'] if g.normalizar_texto(b.get('titulo')) == escrito), None)
            if boton is None:
                return 'ignorado'
            self._guardar(ejecucion.contacto, {'ultimo_boton': boton.get('titulo')})
            self._avanzar(ejecucion, boton['id'])
            return 'boton_por_texto'
        if nodo.get('espera') and evento.texto:
            self._guardar(ejecucion.contacto, {nodo['espera']['guardar_en']: evento.texto})
            self._avanzar(ejecucion, 'respuesta')
            return 'respuesta'
        return 'ignorado'

    def _avanzar(self, ejecucion, salida):
        hacia = g.destino(ejecucion.version.grafo, ejecucion.nodo_actual, salida)
        if hacia is None:
            self._cerrar(ejecucion, AutEjecucion.TERMINADA)
            return
        ejecucion.nodo_actual = hacia
        ejecucion.estado = AutEjecucion.EN_CURSO
        ejecucion.despertar_en = None
        self._correr(ejecucion)

    def _cerrar(self, ejecucion, estado, detalle=None, liberar=True):
        ejecucion.estado = estado
        ejecucion.despertar_en = None
        ejecucion.detalle = (detalle or '')[:300] or None
        if liberar:
            self._liberar_control(ejecucion.contacto)
        db.session.flush()

    def _liberar_control(self, contacto):
        """Devuelve la conversación a la app predeterminada si el motor la había tomado."""
        if not (contacto.variables or {}).get(CONTROL_TOMADO):
            return
        try:
            self.transporte.liberar_control(contacto.igsid)
        except ErrorDeEnvio:
            pass  # el control vence solo a las 24 h sin actividad
        contacto.variables = {k: v for k, v in contacto.variables.items() if k != CONTROL_TOMADO}

    def _correr(self, ejecucion):
        """Ejecuta nodos hasta llegar a una espera o al final."""
        grafo = ejecucion.version.grafo
        nodos = g.nodos_por_id(grafo)
        for _ in range(MAX_PASOS):
            nodo = nodos.get(ejecucion.nodo_actual)
            if nodo is None:
                return self._cerrar(ejecucion, AutEjecucion.ERROR, f'El nodo {ejecucion.nodo_actual} no existe')
            tipo = nodo['tipo']
            if tipo == 'fin':
                return self._cerrar(ejecucion, AutEjecucion.TERMINADA)
            if tipo == 'mensaje':
                if not self._enviar(ejecucion, nodo):
                    return
                if nodo.get('botones') or nodo.get('espera'):
                    ejecucion.estado = AutEjecucion.ESPERANDO_RESPUESTA
                    minutos = (nodo.get('sin_respuesta') or {}).get('minutos')
                    ejecucion.despertar_en = self.ahora + timedelta(minutes=minutos) if minutos else None
                    db.session.flush()
                    return
                salida = 'siguiente'
            elif tipo == 'esperar':
                ejecucion.estado = AutEjecucion.ESPERANDO_TIEMPO
                ejecucion.despertar_en = self.ahora + timedelta(minutes=nodo['minutos'])
                db.session.flush()
                return
            elif tipo == 'condicion':
                salida = 'si' if self._cumple(ejecucion.contacto, nodo.get('reglas') or []) else 'no'
            else:  # accion
                self._aplicar(ejecucion.contacto, nodo.get('acciones') or [])
                salida = 'siguiente'
            hacia = g.destino(grafo, nodo['id'], salida)
            if hacia is None:
                return self._cerrar(ejecucion, AutEjecucion.TERMINADA)
            ejecucion.nodo_actual = hacia
        return self._cerrar(ejecucion, AutEjecucion.ERROR, f'Más de {MAX_PASOS} pasos sin esperar: ¿hay un ciclo?')

    # --- Nodos --------------------------------------------------------------------------------

    def _enviar(self, ejecucion, nodo):
        """Manda el mensaje del nodo. False si no se pudo (y deja la ejecución cerrada)."""
        contacto = ejecucion.contacto
        dentro_de_ventana = contacto.ultimo_entrante_en and self.ahora - contacto.ultimo_entrante_en < VENTANA
        if not dentro_de_ventana and not ejecucion.comentario_id:
            self._cerrar(ejecucion, AutEjecucion.VENTANA_VENCIDA, 'Pasaron más de 24 h desde el último mensaje del contacto')
            return False
        variables = {**(contacto.variables or {}), 'nombre': contacto.nombre or '', 'usuario': contacto.username or ''}
        for cuerpo in mensajes.construir(nodo, variables, ejecucion.version_id):
            if ejecucion.comentario_id:
                # Respuesta privada al comentario: Instagram permite UNA; después hace falta que conteste.
                destinatario = {'comment_id': ejecucion.comentario_id}
                ejecucion.comentario_id = None
            else:
                destinatario = {'id': contacto.igsid}
            try:
                mid = self._enviar_con_control(contacto, destinatario, cuerpo)
            except ErrorDeEnvio as error:
                estado = AutEjecucion.VENTANA_VENCIDA if error.ventana_cerrada else AutEjecucion.ERROR
                self._cerrar(ejecucion, estado, f'Meta rechazó el mensaje: {error}')
                return False
            db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE,
                                     origen=IgMensaje.MOTOR, texto=mensajes.texto_visible(cuerpo), contenido=cuerpo,
                                     ejecucion_id=ejecucion.id, nodo_id=nodo['id'], enviado_en=self.ahora))
            db.session.flush()
        return True

    def _enviar_con_control(self, contacto, destinatario, cuerpo):
        """Si la conversación es de otra app, toma el control una vez y reintenta."""
        try:
            return self.transporte.enviar(destinatario, cuerpo)
        except ErrorDeEnvio as error:
            if not error.sin_control or 'id' not in destinatario:
                raise
            if not self.transporte.tomar_control(contacto.igsid):
                raise
            self._guardar(contacto, {CONTROL_TOMADO: True})
            return self.transporte.enviar(destinatario, cuerpo)

    def _guardar(self, contacto, nuevas):
        contacto.variables = {**(contacto.variables or {}), **nuevas}

    def _valor(self, contacto, campo):
        if campo == 'usuario':
            return contacto.username
        if campo == 'nombre':
            return contacto.nombre
        return (contacto.variables or {}).get(campo)

    def _cumple(self, contacto, reglas):
        for regla in reglas:
            valor = self._valor(contacto, regla.get('campo'))
            actual, esperado = g.normalizar_texto(valor), g.normalizar_texto(regla.get('valor'))
            ok = {
                'igual': actual == esperado,
                'distinto': actual != esperado,
                'contiene': bool(esperado) and esperado in actual,
                'no_contiene': not esperado or esperado not in actual,
                'existe': bool(actual),
                'no_existe': not actual,
            }[regla['operador']]
            if not ok:
                return False
        return True

    def _aplicar(self, contacto, acciones):
        for accion in acciones:
            tipo = accion['tipo']
            if tipo == 'variable':
                self._guardar(contacto, {accion['nombre']: accion.get('valor')})
            elif tipo == 'etapa':
                self._guardar(contacto, {'_etapa': accion.get('valor')})
            elif tipo == 'califica':
                self._guardar(contacto, {'_califica': bool(accion.get('valor'))})
            elif tipo == 'pausar_bot':
                contacto.bot_pausado_hasta = self.ahora + timedelta(hours=accion.get('horas') or HORAS_DE_PAUSA)
