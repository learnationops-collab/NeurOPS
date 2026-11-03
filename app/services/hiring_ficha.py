"""Secciones de la ficha de una postulación de Hiring (el modal del panel).

Salen del formulario con el que contestó: un bloque por sección, en su orden, y
cada pregunta con el tipo que ve quien edita (`email` y `dinero` incluidos), su
respuesta y si esa respuesta es la que corta la postulación. Así la ficha no
tiene que conocer las preguntas: si el formulario cambia, la ficha cambia sola.

Lo que la ficha muestra aparte (contacto, CV, lo que pide) no entra en las
secciones. Las respuestas a preguntas que su formulario ya no tiene van al
final, en «Formulario anterior».
"""
from app.models.assistant_application import (
    BLOQUES, CAMPOS_FORMULARIO, CAMPOS_LEGACY, ETIQUETAS_PREGUNTA, _partes, _vacio,
)
from app.models.hiring_form import COLUMNA_DE_PREGUNTA

# Van en la cabecera o en Contacto, no en las secciones.
EN_CABECERA = frozenset({
    'nombre', 'email', 'whatsapp', 'pais', 'ciudad', 'provincia', 'edad', 'cv',
    'remuneracion', 'video', 'video_verificado', 'listo',
})


def _tipo_visible(p):
    if p.get('tipo') == 'texto' and p.get('mail'):
        return 'email'
    if p.get('tipo') == 'numero' and (p.get('dinero') or p.get('ref') == 'brl'):
        return 'dinero'
    return p.get('tipo') or 'texto'


def _corta(p, valor):
    """Si esta respuesta es la que corta: una opción excluyente, una necesaria
    sin marcar o un número fuera del rango."""
    if _vacio(valor):
        return False
    dados = _partes(valor)
    opciones = [o for o in (p.get('o') or []) if isinstance(o, dict)]
    if any(o.get('ko') and str(o.get('t') or '').strip() in dados for o in opciones):
        return True
    if p.get('tipo') == 'check':
        necesarias = {str(o.get('t') or '').strip() for o in opciones if o.get('necesaria')}
        if necesarias and not necesarias <= dados:
            return True
    if p.get('tipo') == 'numero':
        digitos = ''.join(c for c in str(valor) if c.isdigit())
        if digitos:
            n = int(digitos)
            if (p.get('ko_min') is not None and n < p['ko_min']) or (p.get('ko_max') is not None and n > p['ko_max']):
                return True
    return False


def _pregunta(app_row, p):
    valor = app_row.respuesta(p['id'])
    return {
        "id": p['id'],
        "t": p.get('t') or ETIQUETAS_PREGUNTA.get(p['id']) or p['id'],
        "tipo": _tipo_visible(p),
        "valor": None if _vacio(valor) else valor,
        "unidad": p.get('unidad'),
        "corta": _corta(p, valor),
    }


def secciones(app_row):
    """[{titulo, preguntas: [{id, t, tipo, valor, unidad, corta}]}]."""
    form = app_row.formulario()
    salida = []
    vistos = set()
    if form is not None and form.preguntas:
        for p in form.preguntas:
            if not isinstance(p, dict) or not p.get('id') or p.get('tipo') == 'intro':
                continue
            vistos.add(COLUMNA_DE_PREGUNTA.get(p['id'], p['id']))
            if p['id'] in EN_CABECERA:
                continue
            item = _pregunta(app_row, p)
            # Una apagada solo se muestra si igual quedó respondida.
            if p.get('on') is False and item['valor'] is None:
                continue
            titulo = p.get('bloque') or 'Otras'
            if not salida or salida[-1]['titulo'] != titulo:
                salida.append({"titulo": titulo, "preguntas": []})
            salida[-1]['preguntas'].append(item)
    else:
        for titulo, campos in BLOQUES:
            preguntas = [
                _pregunta(app_row, {'id': c, 'tipo': 'texto'})
                for c in campos if c not in EN_CABECERA
            ]
            vistos.update(campos)
            if preguntas:
                salida.append({"titulo": titulo, "preguntas": preguntas})

    anteriores = [
        _pregunta(app_row, {'id': c, 'tipo': 'texto'})
        for c in CAMPOS_FORMULARIO + CAMPOS_LEGACY
        if c not in vistos and c not in EN_CABECERA and not _vacio(getattr(app_row, c, None))
    ]
    if anteriores:
        salida.append({"titulo": "Formulario anterior", "preguntas": anteriores})
    return salida
