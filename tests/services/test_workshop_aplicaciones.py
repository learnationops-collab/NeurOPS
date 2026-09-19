"""Aplicaciones al formulario de un workshop: a quien cuenta el panel del embudo.

`_contar_aplicaciones` cuenta los clientes cuyo formulario cae en la ventana del taller. Contaba solo
por `Client.created_at`, pero el endpoint del formulario NO crea un cliente nuevo si la persona ya esta
en la base (la busca por mail, instagram, telefono o nombre): le actualiza el `form_data`. Quien ya
existia y volvia a anotarse en el taller nuevo quedaba sin contar. El 19/sep/2026 el panel mostraba 8
aplicaciones con 15 formularios enviados.

Ahora entra el cliente creado en la ventana O con el formulario enviado en la ventana. Se mantienen las
dos fechas a proposito: `submitted_at` se pisa en cada envio, asi que solo con el envio el taller viejo
perderia a quien se volvio a anotar despues (con datos reales de produccion, julio bajaba de 19 a 12).
"""
from datetime import date, datetime

import pytest
import pytz

from app.models import Client, WorkshopEvent
from app.services.workshop_metrics_service import _contar_aplicaciones, calcular_prefill

LA_PAZ = pytz.timezone('America/La_Paz')

# Un dia local en La Paz (UTC-4) va de las 04:00 UTC de ese dia a las 03:59:59.999999 UTC del siguiente.
DIA = date(2026, 9, 19)
DENTRO = datetime(2026, 9, 19, 22, 14, 9)
ANTES = datetime(2026, 8, 22, 21, 3, 52)

_correlativo = iter(range(1, 10_000))


def cliente(db, *, creado, fuente_form='Workshop', enviado=None, con_formulario=True, **extra_form):
    """Un Client. `enviado` es el submitted_at del formulario; sin el, es un formulario viejo."""
    n = next(_correlativo)
    form = None
    if con_formulario:
        form = {'nombre': f'Persona {n}', 'fuente_form': fuente_form, **extra_form}
        if enviado is not None:
            form['submitted_at'] = enviado.isoformat()
    fila = Client(full_name=f'Persona {n}', email=f'persona{n}@test.local', instagram=f'ig{n}',
                  created_at=creado, form_data=form)
    db.session.add(fila)
    db.session.commit()
    return fila


def contar(desde=DIA, hasta=None):
    return _contar_aplicaciones(desde, hasta or desde, LA_PAZ)


def test_cuenta_al_cliente_que_el_formulario_creo_en_la_ventana(db):
    cliente(db, creado=DENTRO, enviado=DENTRO)

    assert contar() == {'vivo': 1, 'landing': 0}


def test_cuenta_al_que_ya_existia_y_volvio_a_llenar_el_formulario(db):
    # El bug: el cliente es de agosto, el formulario de este taller llego el 19/sep.
    cliente(db, creado=ANTES, enviado=DENTRO)

    assert contar() == {'vivo': 1, 'landing': 0}


def test_el_caso_real_del_19_sep_nuevos_y_reaplicados_suman(db):
    # Fotografia de produccion: 8 clientes creados por el formulario + 7 que ya existian.
    for _ in range(8):
        cliente(db, creado=DENTRO, enviado=DENTRO)
    for _ in range(7):
        cliente(db, creado=ANTES, enviado=DENTRO)

    assert contar() == {'vivo': 15, 'landing': 0}


def test_un_cliente_que_cumple_las_dos_fechas_cuenta_una_sola_vez(db):
    cliente(db, creado=DENTRO, enviado=DENTRO)

    assert sum(contar().values()) == 1


def test_el_taller_viejo_no_pierde_a_quien_se_volvio_a_anotar_despues(db):
    # Entro con el formulario en la ventana del 12/sep y el 19/sep volvio a anotarse: submitted_at
    # ahora es del 19. Sigue siendo una aplicacion del 12 (created_at) Y una del 19 (submitted_at).
    cliente(db, creado=datetime(2026, 9, 12, 22, 0, 0), enviado=DENTRO)

    assert contar(date(2026, 9, 12), date(2026, 9, 18)) == {'vivo': 1, 'landing': 0}
    assert contar() == {'vivo': 1, 'landing': 0}


def test_un_formulario_anterior_a_submitted_at_cuenta_solo_por_created_at(db):
    # Los clientes de antes de junio de 2026 tienen fuente_form pero no submitted_at.
    cliente(db, creado=DENTRO, enviado=None)
    cliente(db, creado=ANTES, enviado=None)

    assert contar() == {'vivo': 1, 'landing': 0}


@pytest.mark.parametrize('form_data', [None, {}])
def test_no_cuenta_a_quien_nunca_lleno_el_formulario(db, form_data):
    # Clientes que creo el sync de agendas: existen, pero no respondieron el cuestionario.
    fila = Client(full_name='Sync', email='sync@test.local', created_at=DENTRO, form_data=form_data)
    db.session.add(fila)
    db.session.commit()

    assert contar() == {'vivo': 0, 'landing': 0}


def test_no_cuenta_el_formulario_de_un_setter(db):
    # 'Elias' es la fuente del link de un setter, no un formulario del workshop.
    cliente(db, creado=DENTRO, fuente_form='Elias', enviado=DENTRO)
    cliente(db, creado=ANTES, fuente_form='Elias', enviado=DENTRO)

    assert contar() == {'vivo': 0, 'landing': 0}


def test_separa_el_vivo_de_la_grabacion_tambien_para_quien_se_volvio_a_anotar(db):
    cliente(db, creado=ANTES, fuente_form='Workshop', enviado=DENTRO)
    cliente(db, creado=ANTES, fuente_form='workshop landing', enviado=DENTRO)
    cliente(db, creado=DENTRO, fuente_form='workshop_landing', enviado=DENTRO)

    assert contar() == {'vivo': 1, 'landing': 2}


def test_un_formulario_sin_fuente_conocida_cuenta_del_lado_del_vivo(db):
    # Regla del 12/sep: el formulario esta completo, solo fallo el tag de la pagina de origen.
    cliente(db, creado=ANTES, fuente_form='No identificado', enviado=DENTRO)

    assert contar() == {'vivo': 1, 'landing': 0}


def test_los_bordes_de_la_ventana_son_los_del_dia_local(db):
    # 19/sep en La Paz = [2026-09-19 04:00:00, 2026-09-20 03:59:59.999999] UTC.
    cliente(db, creado=ANTES, enviado=datetime(2026, 9, 19, 4, 0, 0))            # primer instante
    cliente(db, creado=ANTES, enviado=datetime(2026, 9, 20, 3, 59, 59, 999999))  # ultimo instante
    cliente(db, creado=ANTES, enviado=datetime(2026, 9, 19, 3, 59, 59, 999999))  # aun es el 18 local
    cliente(db, creado=ANTES, enviado=datetime(2026, 9, 20, 4, 0, 0))            # ya es el 20 local

    assert contar() == {'vivo': 2, 'landing': 0}


def test_un_formulario_de_la_noche_UTC_es_del_dia_local_anterior(db):
    # 02:00 UTC del 19 son las 22:00 del 18 en La Paz.
    cliente(db, creado=ANTES, enviado=datetime(2026, 9, 19, 2, 0, 0))

    assert contar(date(2026, 9, 18)) == {'vivo': 1, 'landing': 0}
    assert contar(DIA) == {'vivo': 0, 'landing': 0}


def test_un_submitted_at_ilegible_no_rompe_el_conteo(db):
    dentro = cliente(db, creado=DENTRO, enviado=None, submitted_at='no es una fecha')
    cliente(db, creado=ANTES, enviado=None, submitted_at='no es una fecha')

    assert contar() == {'vivo': 1, 'landing': 0}
    assert dentro.id is not None


def test_el_prefill_del_taller_suma_a_quien_se_volvio_a_anotar(db):
    # De punta a punta: es el numero que el panel muestra como "aplicaciones al formulario".
    db.session.add_all([
        WorkshopEvent(date=DIA, name='WEBINAR 19 DE SEPTIEMBRE 2026'),
        WorkshopEvent(date=date(2026, 9, 26), name='WEBINAR 26 DE SEPTIEMBRE 2026'),  # cierra la ventana
    ])
    db.session.commit()
    cliente(db, creado=DENTRO, enviado=DENTRO)
    cliente(db, creado=ANTES, enviado=DENTRO)
    cliente(db, creado=ANTES, fuente_form='workshop landing', enviado=DENTRO)

    datos = calcular_prefill(DIA)

    assert datos['aplicaciones_form'] == 3
    assert datos['desglose']['vivo']['aplicaciones_form'] == 2
    assert datos['desglose']['landing']['aplicaciones_form'] == 1
