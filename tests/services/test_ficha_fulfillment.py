"""El cruce NeurOPS -> Academia de la pestana Fulfillment.

Lo que se prueba aca es el cruce y el manejo de errores, no la API de la Academia: cada test
reemplaza `LearnationService` por un doble. Llamar a la API real desde la suite la volveria lenta,
dependiente de internet y de un token, y ademas gastaria del limite de 60 peticiones por minuto
que comparte con la aplicacion en produccion.

El caso central es el del email: el cruce es por correo y SOLO por correo (comprobado contra la
API real el 28/09/2026 — `check` con `phone` responde 422 y no existe endpoint de busqueda), y el
correo bueno no siempre es el del `Client`.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services import ficha_fulfillment_service as ful
from app.services.learnation_service import LearnationAPIError

RESUMEN = {
    'success': True,
    'student': {'id': 87, 'name': 'Andres Sierra', 'email': 'andres@x.com', 'phone': '3002558373',
                'role': 'student',
                'active_product': {'id': 1, 'name': 'Residency Roadmap', 'slug': 'residency-roadmap'}},
    'performance': {'streak_days': 4, 'progress_percentage': 31.5, 'completed_lessons': 11,
                    'total_lessons': 12, 'approval_rate': 56.7, 'open_support_tickets': 0},
}
PRODUCTOS = {'success': True, 'products': [
    {'assignment_id': 2561, 'product_name': 'Residency Roadmap', 'status': 'active',
     'is_active': True, 'expires_at': '2026-12-23T00:00:00+00:00', 'days_remaining': 85},
]}


def cliente(email='andres@x.com', phone='+57 300 255 8373', learnation_user_id=None):
    return SimpleNamespace(email=email, phone=phone, learnation_user_id=learnation_user_id)


def venta(mail):
    return SimpleNamespace(mail_cliente=mail)


@pytest.fixture()
def academia():
    """`LearnationService` con los tres endpoints de consulta dobles."""
    with patch.object(ful, 'LearnationService') as doble:
        doble.check_user.return_value = {'success': True, 'exists': False, 'user': None}
        doble.get_student_summary.return_value = RESUMEN
        doble.get_student_products.return_value = PRODUCTOS
        yield doble


# --- Que correos se prueban -------------------------------------------------------------------

def test_el_placeholder_que_inventa_neurops_no_se_pregunta():
    """Es un `exists: false` garantizado: preguntar por el gasta una peticion del limite."""
    assert ful.es_placeholder('no-email-2f3a4b5c@neurops.com')
    assert ful.es_placeholder('no_email_2f3a@neurops.com')
    assert ful.es_placeholder(None)
    assert not ful.es_placeholder('andres@x.com')


def test_el_correo_de_la_venta_entra_cuando_el_del_cliente_es_inventado():
    """El de la venta lo tipeo un humano para cobrarle; el del cliente puede ser sintetico."""
    candidatos = ful.emails_candidatos(cliente(email='no-email-99@neurops.com'),
                                       [venta('real@x.com')])

    assert candidatos == ['real@x.com']


def test_primero_el_del_cliente_y_despues_el_de_las_ventas_sin_repetir():
    candidatos = ful.emails_candidatos(cliente(email='Andres@X.com'),
                                       [venta('andres@x.com'), venta('otro@x.com')])

    assert candidatos == ['andres@x.com', 'otro@x.com']


def test_no_se_prueban_mas_correos_que_el_tope():
    """Un cliente con doce ventas no puede gastar doce peticiones del limite de la Academia."""
    ventas = [venta(f'v{i}@x.com') for i in range(12)]

    assert len(ful.emails_candidatos(cliente(email=None), ventas)) == ful.MAX_EMAILS


# --- Como se resuelve al alumno ---------------------------------------------------------------

def test_el_id_guardado_evita_la_busqueda_por_correo(academia):
    datos = ful.fulfillment(cliente(learnation_user_id=87), [])

    assert datos['vinculado'] is True
    academia.check_user.assert_not_called()
    academia.get_student_summary.assert_called_once_with(87)


def test_se_encuentra_al_alumno_por_el_segundo_correo(academia):
    academia.check_user.side_effect = [
        {'exists': False, 'user': None},
        {'exists': True, 'user': {'id': 87}},
    ]

    datos = ful.fulfillment(cliente(email='viejo@x.com'), [venta('real@x.com')])

    assert (datos['vinculado'], datos['email_usado']) == (True, 'real@x.com')
    assert datos['emails_probados'] == ['viejo@x.com', 'real@x.com']


def test_un_cliente_que_no_es_alumno_no_es_un_error(academia):
    """El caso normal de alguien a quien todavia nadie le dio el acceso."""
    datos = ful.fulfillment(cliente(), [])

    assert (datos['vinculado'], datos['error']) == (False, None)


def test_el_alumno_llega_con_su_desempeno_y_sus_productos(academia):
    datos = ful.fulfillment(cliente(learnation_user_id=87), [])

    assert datos['alumno']['nombre'] == 'Andres Sierra'
    assert datos['alumno']['producto_activo']['name'] == 'Residency Roadmap'
    assert datos['desempeno']['completed_lessons'] == 11
    assert datos['productos'][0]['days_remaining'] == 85


# --- El telefono, que no sirve para buscar pero si para comparar -------------------------------

def test_el_telefono_se_compara_por_los_ultimos_ocho_digitos(academia):
    datos = ful.fulfillment(cliente(phone='+57 300 255 8373', learnation_user_id=87), [])

    assert datos['telefono_coincide'] is True


def test_un_telefono_distinto_se_marca(academia):
    datos = ful.fulfillment(cliente(phone='+57 311 000 1111', learnation_user_id=87), [])

    assert datos['telefono_coincide'] is False


def test_sin_telefono_no_se_opina(academia):
    """"No sabemos" no es "no coinciden": una alerta ahi manda a arreglar algo que no esta roto."""
    datos = ful.fulfillment(cliente(phone=None, learnation_user_id=87), [])

    assert datos['telefono_coincide'] is None


# --- Los errores no rompen la ficha -----------------------------------------------------------

def test_un_token_revocado_vuelve_como_aviso_y_no_como_excepcion(academia):
    academia.check_user.side_effect = LearnationAPIError('Unauthenticated', status_code=401)

    datos = ful.fulfillment(cliente(), [])

    assert datos['error']['codigo'] == 401
    assert 'admin' in datos['error']['motivo']


def test_un_401_corta_la_busqueda_en_vez_de_probar_el_resto(academia):
    """Probar el correo siguiente con un token revocado es gastar peticiones para el mismo error."""
    academia.check_user.side_effect = LearnationAPIError('Unauthenticated', status_code=401)

    ful.fulfillment(cliente(email='uno@x.com'), [venta('dos@x.com')])

    assert academia.check_user.call_count == 1


def test_un_rate_limit_se_explica_en_castellano(academia):
    academia.get_student_summary.side_effect = LearnationAPIError('Too Many Requests',
                                                                  status_code=429)

    datos = ful.fulfillment(cliente(learnation_user_id=87), [])

    assert datos['error']['codigo'] == 429
    assert datos['vinculado'] is False


def test_sin_cliente_lo_dice_sin_llamar_a_la_academia(academia):
    datos = ful.fulfillment(None, [])

    assert datos['error']['codigo'] is None
    academia.check_user.assert_not_called()


# --- El producto que pago ---------------------------------------------------------------------
#
# La forma de los productos es la de la API real (30/09/2026). Los tres productos pagos traen el
# mismo `program_name` ("Bootcamp", el programa interno de la Academia) y todo alumno nuevo recibe
# `learnation-course` de regalo: ni el orden ni ese rotulo dicen cual es el que pago.

MAPEO = {'AL': 'ace-learners', 'RR': 'residency-roadmap', 'SI': 'residency-roadmap-for-steps'}


def asignacion(slug, activo=True, vence='2027-01-14T00:00:00+00:00', asignado='2026-09-14T21:18:38+00:00',
               id_=1):
    return {'assignment_id': id_, 'product_id': id_, 'product_name': slug.replace('-', ' ').title(),
            'product_slug': slug, 'program_name': 'Bootcamp', 'status': 'active' if activo else 'expired',
            'is_active': activo, 'is_deposit': False, 'expires_at': vence, 'days_remaining': 106 if activo else 0,
            'assigned_at': asignado}


BIENVENIDA = asignacion('learnation-course', vence=None, id_=4)
AL = asignacion('ace-learners', id_=3)
RR = asignacion('residency-roadmap', id_=1)


def test_el_producto_pagado_se_separa_del_de_bienvenida_y_de_otros_accesos():
    """El bug del pedido: la pestana mostraba como lo comprado un producto que no pago."""
    r = ful.resolver_producto('AL', MAPEO, [BIENVENIDA, RR, AL])

    assert r['producto_pagado'] is AL
    assert r['otros_productos'] == [BIENVENIDA, RR]
    assert r['programa'] == {'codigo': 'AL', 'nombre': 'Ace Learners', 'product_slug': 'ace-learners'}
    assert r['aviso_producto'] is None


def test_sin_programa_en_neurops_no_se_adivina_cual_pago():
    """Ni el primero ni el activo: cualquiera de los dos puede ser el de regalo."""
    r = ful.resolver_producto(None, MAPEO, [AL, BIENVENIDA])

    assert (r['programa'], r['producto_pagado']) == (None, None)
    assert r['otros_productos'] == [AL, BIENVENIDA]
    assert r['aviso_producto']['codigo'] == 'sin_programa'
    assert 'Acciones' in r['aviso_producto']['motivo']


def test_un_programa_sin_producto_vinculado_lo_arregla_un_admin():
    r = ful.resolver_producto('SI', {'AL': 'ace-learners'}, [AL])

    assert r['programa'] == {'codigo': 'SI', 'nombre': 'Specialist Initiative', 'product_slug': None}
    assert r['producto_pagado'] is None
    assert r['aviso_producto']['codigo'] == 'sin_vinculo'
    assert 'Integraciones' in r['aviso_producto']['motivo']


def test_la_academia_sin_el_producto_pagado_se_avisa_y_lo_demas_queda_como_otros():
    r = ful.resolver_producto('RR', MAPEO, [BIENVENIDA, AL])

    assert r['producto_pagado'] is None
    assert r['otros_productos'] == [BIENVENIDA, AL]
    assert r['aviso_producto']['codigo'] == 'sin_producto'
    assert 'Residency Roadmap' in r['aviso_producto']['motivo']


def test_de_dos_asignaciones_del_mismo_producto_gana_la_vigente():
    """Una renovacion deja la asignacion vieja archivada: la que da acceso hoy es la activa."""
    vieja = asignacion('ace-learners', activo=False, vence='2026-08-01T00:00:00+00:00', id_=10)
    nueva = asignacion('ace-learners', activo=True, vence='2027-01-14T00:00:00+00:00', id_=11)

    r = ful.resolver_producto('AL', MAPEO, [vieja, nueva])

    assert r['producto_pagado'] is nueva
    assert r['otros_productos'] == [vieja]


def test_el_slug_se_compara_sin_mayusculas_ni_espacios():
    r = ful.resolver_producto(' al ', {'AL': ' Ace-Learners '}, [AL])

    assert r['producto_pagado'] is AL


def test_el_payload_suma_el_producto_pagado_sin_perder_las_claves_de_siempre(academia):
    """`productos`, `alumno` y `desempeno` los leen otras pantallas: se agregan claves, no se
    renombra ninguna."""
    academia.get_student_products.return_value = {'products': [BIENVENIDA, AL]}
    with patch.object(ful, '_programa_y_mapeo', return_value=('AL', MAPEO)):
        datos = ful.fulfillment(cliente(learnation_user_id=87), [])

    assert {'vinculado', 'alumno', 'desempeno', 'productos', 'email_usado', 'emails_probados',
            'telefono_coincide', 'error'} <= set(datos)
    assert datos['productos'] == [BIENVENIDA, AL]
    assert datos['producto_pagado'] is AL
    assert datos['otros_productos'] == [BIENVENIDA]
    assert datos['programa']['codigo'] == 'AL'


def test_sin_alumno_igual_se_dice_que_programa_pago(academia):
    """Es el producto que habria que darle de alta."""
    with patch.object(ful, '_programa_y_mapeo', return_value=('RR', MAPEO)):
        datos = ful.fulfillment(cliente(), [])

    assert datos['vinculado'] is False
    assert datos['programa']['product_slug'] == 'residency-roadmap'
    assert (datos['producto_pagado'], datos['aviso_producto']) == (None, None)


def test_la_respuesta_dice_cuando_se_le_pregunto_a_la_academia(academia):
    from datetime import datetime

    datos = ful.fulfillment(cliente(learnation_user_id=87), [])

    # Con zona: la pestana lo pasa a la hora de quien mira.
    assert datetime.fromisoformat(datos['consultado_en']).utcoffset() is not None
