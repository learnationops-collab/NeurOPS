"""El flujo como grafo: el mismo documento que dibuja el lienzo y que recorre el motor.

    {
      "disparadores": [{"id": "d1", "canal": "dm" | "comentario", "palabras": ["OBTENER GUIA"],
                        "coincidencia": "exacta" | "contiene", "publicacion_id": null}],
      "inicio": "n1",
      "nodos": [{"id": "n1", "tipo": "mensaje", "posicion": {"x": 0, "y": 0}, ...}],
      "conexiones": [{"id": "c1", "desde": "n1", "salida": "b1", "hacia": "n2"}]
    }

Tipos de nodo y sus salidas:
  · mensaje: `contenido` (texto, imagen, audio, video, archivo) y opcionalmente
      - `botones` [{id, titulo}] → una salida por botón (estilo "botones" hasta 3, "respuestas_rapidas" hasta 13), o
      - `espera` {guardar_en} → salida "respuesta" (el texto libre que conteste se guarda en esa variable).
    Si espera algo puede tener `sin_respuesta` {minutos} → salida "sin_respuesta". Si no espera nada → "siguiente".
    Cada contenido puede tener `escribiendo` (segundos, hasta 10): antes de mandarlo se ve «escribiendo…».
    `registro` {mensaje_id, etapa, califica} es lo que hoy manda ManyChat por webhook (tableros): el motor
    lo escribe en las mismas tablas (`registro.py`). `mensaje_id` es el id del catálogo de Conversaciones.
  · esperar: `minutos` → "siguiente".
  · condicion: `reglas` [{campo, operador, valor}] (todas deben cumplirse) → "si" / "no".
  · accion: `acciones` [{tipo: variable|etapa|califica|pausar_bot, ...}] → "siguiente".
  · fin: sin salidas.
"""
import re
import unicodedata

TIPOS = ('mensaje', 'esperar', 'condicion', 'accion', 'fin')
TIPOS_CONTENIDO = ('texto', 'imagen', 'audio', 'video', 'archivo')
ESTILOS_BOTONES = {'botones': 3, 'respuestas_rapidas': 13}
TIPOS_ACCION = ('variable', 'etapa', 'califica', 'pausar_bot')
OPERADORES = ('igual', 'distinto', 'contiene', 'no_contiene', 'existe', 'no_existe')

# Límites de Instagram.
LARGO_TEXTO = 1000
LARGO_TITULO_BOTON = 20
LARGO_TEXTO_CON_BOTONES = 640
MAX_MINUTOS_ESPERA = 24 * 60
# El motor manda de a un contacto por vez: una pausa larga demora a los que vienen detrás.
MAX_SEGUNDOS_ESCRIBIENDO = 10


def normalizar_texto(texto):
    """Minúsculas, sin acentos ni signos y con espacios simples: 'Obtener Guía!' == 'OBTENER GUIA'."""
    t = unicodedata.normalize('NFKD', str(texto or ''))
    t = ''.join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r'[^\w\s]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def nodos_por_id(grafo):
    return {n.get('id'): n for n in (grafo.get('nodos') or [])}


def destino(grafo, desde, salida):
    """El id del nodo al que lleva esa salida, o None si no está conectada."""
    for c in grafo.get('conexiones') or []:
        if c.get('desde') == desde and c.get('salida') == salida:
            return c.get('hacia')
    return None


def salidas(nodo):
    """Las salidas que ese nodo puede tener según su tipo."""
    tipo = nodo.get('tipo')
    if tipo == 'mensaje':
        if nodo.get('botones'):
            base = [b.get('id') for b in nodo['botones']]
        elif nodo.get('espera'):
            base = ['respuesta']
        else:
            return ['siguiente']
        return base + (['sin_respuesta'] if nodo.get('sin_respuesta') else [])
    if tipo == 'condicion':
        return ['si', 'no']
    if tipo in ('esperar', 'accion'):
        return ['siguiente']
    return []


def coincide(disparador, texto, canal, publicacion_id=None):
    """¿Este texto, llegado por este canal, activa el disparador?"""
    if disparador.get('canal', 'dm') != canal:
        return False
    if canal == 'comentario' and disparador.get('publicacion_id') and disparador['publicacion_id'] != publicacion_id:
        return False
    recibido = normalizar_texto(texto)
    if not recibido:
        return False
    for palabra in disparador.get('palabras') or []:
        buscada = normalizar_texto(palabra)
        if not buscada:
            continue
        if disparador.get('coincidencia', 'exacta') == 'contiene':
            if re.search(rf'(^| ){re.escape(buscada)}( |$)', recibido):
                return True
        elif recibido == buscada:
            return True
    return False


def _errores_nodo(nodo, ids):
    errores = []
    nid, tipo = nodo.get('id'), nodo.get('tipo')
    if tipo not in TIPOS:
        return [f'Nodo {nid}: tipo desconocido «{tipo}»']

    if tipo == 'mensaje':
        contenido = nodo.get('contenido') or []
        if not contenido:
            errores.append(f'Nodo {nid}: el mensaje no tiene contenido')
        for item in contenido:
            escribiendo = item.get('escribiendo')
            if escribiendo is not None and (isinstance(escribiendo, bool) or not isinstance(escribiendo, (int, float))
                                            or not 0 <= escribiendo <= MAX_SEGUNDOS_ESCRIBIENDO):
                errores.append(f'Nodo {nid}: «escribiendo» va de 0 a {MAX_SEGUNDOS_ESCRIBIENDO} segundos')
            if item.get('tipo') not in TIPOS_CONTENIDO:
                errores.append(f'Nodo {nid}: contenido de tipo desconocido «{item.get("tipo")}»')
            elif item['tipo'] == 'texto':
                if not (item.get('texto') or '').strip():
                    errores.append(f'Nodo {nid}: hay un texto vacío')
                elif len(item['texto']) > LARGO_TEXTO:
                    errores.append(f'Nodo {nid}: un texto supera los {LARGO_TEXTO} caracteres')
            elif not (item.get('url') or '').startswith('https://'):
                errores.append(f'Nodo {nid}: el {item["tipo"]} necesita una URL https')

        botones = nodo.get('botones') or []
        if botones and nodo.get('espera'):
            errores.append(f'Nodo {nid}: un mensaje espera botones o texto libre, no las dos cosas')
        if botones:
            estilo = nodo.get('estilo_botones', 'botones')
            if estilo not in ESTILOS_BOTONES:
                errores.append(f'Nodo {nid}: estilo de botones desconocido «{estilo}»')
            elif len(botones) > ESTILOS_BOTONES[estilo]:
                errores.append(f'Nodo {nid}: Instagram admite hasta {ESTILOS_BOTONES[estilo]} botones con ese estilo')
            ultimo = contenido[-1] if contenido else {}
            if ultimo.get('tipo') != 'texto':
                errores.append(f'Nodo {nid}: los botones van debajo de un texto (el último contenido debe ser texto)')
            elif estilo == 'botones' and len(ultimo.get('texto') or '') > LARGO_TEXTO_CON_BOTONES:
                errores.append(f'Nodo {nid}: el texto con botones no puede superar {LARGO_TEXTO_CON_BOTONES} caracteres')
            ids_botones = [b.get('id') for b in botones]
            if len(set(ids_botones)) != len(ids_botones) or not all(ids_botones):
                errores.append(f'Nodo {nid}: cada botón necesita un id único')
            for b in botones:
                titulo = (b.get('titulo') or '').strip()
                if not titulo:
                    errores.append(f'Nodo {nid}: hay un botón sin título')
                elif len(titulo) > LARGO_TITULO_BOTON:
                    errores.append(f'Nodo {nid}: el botón «{titulo}» supera los {LARGO_TITULO_BOTON} caracteres')
        if nodo.get('espera') is not None and not (nodo['espera'].get('guardar_en') or '').strip():
            errores.append(f'Nodo {nid}: falta la variable donde guardar la respuesta')
        registro = nodo.get('registro')
        if registro is not None:
            if not isinstance(registro, dict) or not str(registro.get('mensaje_id') or '').strip():
                errores.append(f'Nodo {nid}: el registro necesita el id del mensaje del catálogo')
            elif registro.get('califica') is not None and not isinstance(registro['califica'], bool):
                errores.append(f'Nodo {nid}: «califica» del registro es sí o no')
            elif registro.get('etapa') is not None and not str(registro['etapa']).isdigit():
                errores.append(f'Nodo {nid}: la etapa del registro es un número')
        sin_respuesta = nodo.get('sin_respuesta')
        if sin_respuesta:
            if not (botones or nodo.get('espera')):
                errores.append(f'Nodo {nid}: «sin respuesta» solo aplica si el mensaje espera algo')
            errores += _errores_minutos(nid, sin_respuesta.get('minutos'))

    elif tipo == 'esperar':
        errores += _errores_minutos(nid, nodo.get('minutos'))

    elif tipo == 'condicion':
        reglas = nodo.get('reglas') or []
        if not reglas:
            errores.append(f'Nodo {nid}: la condición no tiene reglas')
        for r in reglas:
            if not (r.get('campo') or '').strip():
                errores.append(f'Nodo {nid}: una regla no dice qué campo mirar')
            if r.get('operador') not in OPERADORES:
                errores.append(f'Nodo {nid}: operador desconocido «{r.get("operador")}»')

    elif tipo == 'accion':
        acciones = nodo.get('acciones') or []
        if not acciones:
            errores.append(f'Nodo {nid}: la acción no hace nada')
        for a in acciones:
            if a.get('tipo') not in TIPOS_ACCION:
                errores.append(f'Nodo {nid}: acción desconocida «{a.get("tipo")}»')
            elif a['tipo'] == 'variable' and not (a.get('nombre') or '').strip():
                errores.append(f'Nodo {nid}: falta el nombre de la variable')
    return errores


def _errores_minutos(nid, minutos):
    if not isinstance(minutos, (int, float)) or isinstance(minutos, bool) or not 1 <= minutos <= MAX_MINUTOS_ESPERA:
        return [f'Nodo {nid}: la espera debe ser de 1 a {MAX_MINUTOS_ESPERA} minutos (la ventana de Instagram es de 24 h)']
    return []


def validar(grafo):
    """Lista de errores en castellano; vacía si el flujo se puede publicar."""
    if not isinstance(grafo, dict):
        return ['El flujo no es un documento válido']
    errores = []
    nodos = grafo.get('nodos') or []
    ids = [n.get('id') for n in nodos]
    if not nodos:
        return ['El flujo no tiene nodos']
    if len(set(ids)) != len(ids) or not all(ids):
        errores.append('Cada nodo necesita un id único')
    por_id = nodos_por_id(grafo)

    disparadores = grafo.get('disparadores') or []
    if not disparadores:
        errores.append('El flujo no tiene disparadores: nadie podría entrar')
    for d in disparadores:
        if d.get('canal', 'dm') not in ('dm', 'comentario'):
            errores.append(f'Disparador {d.get("id")}: canal desconocido «{d.get("canal")}»')
        if d.get('coincidencia', 'exacta') not in ('exacta', 'contiene'):
            errores.append(f'Disparador {d.get("id")}: coincidencia desconocida «{d.get("coincidencia")}»')
        if not any(normalizar_texto(p) for p in d.get('palabras') or []):
            errores.append(f'Disparador {d.get("id")}: no tiene palabras clave')

    if grafo.get('inicio') not in por_id:
        errores.append('El flujo no indica en qué nodo empieza')
    elif any(d.get('canal') == 'comentario' for d in disparadores):
        primero = por_id[grafo['inicio']]
        if primero.get('tipo') != 'mensaje' or len(primero.get('contenido') or []) != 1:
            # Instagram admite UNA respuesta privada por comentario; el resto, cuando el contacto conteste.
            errores.append('Un flujo que arranca por comentario debe empezar con un mensaje de un solo contenido '
                           '(la respuesta privada al comentario)')

    for nodo in nodos:
        errores += _errores_nodo(nodo, ids)

    vistas = set()
    for c in grafo.get('conexiones') or []:
        origen, hacia = por_id.get(c.get('desde')), c.get('hacia')
        if origen is None or hacia not in por_id:
            errores.append(f'Conexión {c.get("id")}: une nodos que no existen')
            continue
        if c.get('salida') not in salidas(origen):
            errores.append(f'Conexión {c.get("id")}: el nodo {origen["id"]} no tiene la salida «{c.get("salida")}»')
        clave = (c.get('desde'), c.get('salida'))
        if clave in vistas:
            errores.append(f'Nodo {c.get("desde")}: la salida «{c.get("salida")}» está conectada dos veces')
        vistas.add(clave)
    return errores
