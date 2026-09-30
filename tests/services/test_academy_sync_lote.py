"""El lote que renueva las fotos de la Academia: presupuesto, orden, cortes y el id que ahorra peticiones.

La Academia tiene un limite de 60 peticiones por minuto compartido con produccion y con la ficha.
Lo que se fija aca es que el lote nunca se pase del presupuesto que le dan, que se corte ante lo que
no mejora probando el cliente siguiente (token invalido, rate limit, red caida), que mire primero a
los mas desactualizados y que guarde el id del alumno para que la proxima vez cueste una peticion y
no varias.

`LearnationService` es siempre un doble (en los dos modulos que lo usan: la busqueda por correo es
la de la ficha, importada). Nunca se llama a la Academia real.
"""
from datetime import date, datetime, timedelta
from itertools import count
from unittest.mock import MagicMock, patch

import pytest

from app.models import AcademySnapshot, Client, FinancialSale
from app.services import academy_snapshot_service as snap
from app.services import ficha_fulfillment_service as ful
from app.services.learnation_service import LearnationAPIError

AHORA = datetime(2026, 9, 30, 12, 0)
_n = count(1)


class Academia:
    """Doble de la Academia: `alumnos` es {correo: id}; `telefonos` es {id: telefono}."""

    def __init__(self):
        self.alumnos, self.telefonos, self.fallas = {}, {}, {}
        self.doble = MagicMock()
        self.doble.check_user.side_effect = self._check
        self.doble.get_student_summary.side_effect = self._summary

    def _check(self, email):
        if email in self.fallas:
            raise self.fallas[email]
        alumno = self.alumnos.get(email)
        return {'exists': bool(alumno), 'user': {'id': alumno} if alumno else None}

    def _summary(self, alumno_id):
        if alumno_id in self.fallas:
            raise self.fallas[alumno_id]
        return {'student': {'id': alumno_id, 'phone': self.telefonos.get(alumno_id),
                            'active_product': {'name': 'Residency Roadmap'}},
                'performance': {'streak_days': 1, 'total_study_hours': 10, 'submitted_executions': 5}}

    @property
    def peticiones(self):
        return self.doble.check_user.call_count + self.doble.get_student_summary.call_count

    def resumenes_pedidos(self):
        return [c.args[0] for c in self.doble.get_student_summary.call_args_list]


@pytest.fixture()
def academia(monkeypatch):
    monkeypatch.setenv('ACADEMY_API_TOKEN', 'token-de-prueba')
    doble = Academia()
    with patch.object(ful, 'LearnationService', doble.doble), \
            patch.object(snap, 'LearnationService', doble.doble):
        yield doble


def comprador(db, email=None, *, venta_mail=None, phone=None, learnation_user_id=None):
    """Un cliente con una venta completada (los que el lote mira)."""
    n = next(_n)
    email = email or f'alumno{n}@x.com'
    c = Client(full_name=f'Alumno {n}', email=email, phone=phone, learnation_user_id=learnation_user_id)
    db.session.add(c)
    db.session.commit()
    db.session.add(FinancialSale(client_id=c.id, mail_cliente=venta_mail or email, tipo_pago='RR - Completo',
                                 monto=100.0, estado='Completada', date=date(2026, 9, 1),
                                 email_vendedor='vendedor@neuro.com'))
    db.session.commit()
    return c


def foto(cliente):
    return AcademySnapshot.query.filter_by(client_id=cliente.id).one_or_none()


def lote(**kwargs):
    kwargs.setdefault('ahora', AHORA)
    return snap.sincronizar_lote(**kwargs)


# --- El presupuesto -------------------------------------------------------------------------------

def test_sin_token_configurado_no_se_consulta_nada(db, academia, monkeypatch):
    monkeypatch.delenv('ACADEMY_API_TOKEN')
    comprador(db)

    resumen = lote()

    assert resumen['corte'] == 'sin_token'
    assert academia.peticiones == 0
    assert AcademySnapshot.query.count() == 0


def test_el_lote_nunca_se_pasa_del_presupuesto(db, academia):
    """Cada cliente sin id cuesta 2 (buscarlo + su resumen): con 7 entran 3 y el cuarto espera."""
    for _ in range(6):
        c = comprador(db)
        academia.alumnos[c.email] = 100 + c.id

    resumen = lote(presupuesto=7)

    assert academia.peticiones == resumen['peticiones'] == 6
    assert (resumen['procesados'], resumen['vinculados'], resumen['corte']) == (3, 3, 'presupuesto')
    assert AcademySnapshot.query.count() == 3


def test_el_presupuesto_se_reserva_por_lo_alto_con_varios_correos(db, academia):
    """Un cliente con dos correos puede costar 3: con 2 disponibles no se empieza."""
    comprador(db, 'propio@x.com', venta_mail='venta@x.com')

    resumen = lote(presupuesto=2)

    assert (academia.peticiones, resumen['procesados'], resumen['corte']) == (0, 0, 'presupuesto')


def test_el_presupuesto_pedido_se_acota(db, academia):
    assert lote(presupuesto=10_000)['presupuesto'] == snap.PRESUPUESTO_MAXIMO
    assert lote(presupuesto=0)['presupuesto'] == 1
    assert lote(presupuesto='x')['presupuesto'] == snap.PRESUPUESTO_POR_LOTE


def test_un_cliente_sin_ningun_correo_real_no_gasta_peticiones(db, academia):
    comprador(db, 'no-email-3f2a@neurops.com')

    resumen = lote()

    assert academia.peticiones == 0
    assert (resumen['sin_correo'], resumen['procesados']) == (1, 1)


def test_un_cliente_sin_venta_no_entra_al_lote(db, academia):
    db.session.add(Client(full_name='Sin compra', email='nada@x.com'))
    db.session.commit()

    assert lote()['clientes'] == 0
    assert academia.peticiones == 0


def test_el_tope_de_tiempo_corta_aunque_quede_presupuesto(db, academia):
    for _ in range(3):
        comprador(db, learnation_user_id=next(_n))
    marcas = iter([0, 0, 30, 30, 30])

    resumen = lote(presupuesto=20, tope_segundos=25, reloj=lambda: next(marcas))

    assert (resumen['procesados'], resumen['corte']) == (1, 'tiempo')


# --- Los cortes -----------------------------------------------------------------------------------

def test_un_429_corta_el_lote_y_deja_el_error_anotado(db, academia):
    primero, segundo, tercero = (comprador(db, learnation_user_id=i) for i in (901, 902, 903))
    academia.fallas[902] = LearnationAPIError('Too Many Requests', status_code=429)

    resumen = lote()

    # Los mas nuevos primero entre los que nunca se miraron: 903, despues 902 (que corta).
    assert academia.resumenes_pedidos() == [903, 902]
    assert resumen['corte'] == '429'
    assert (foto(segundo).resultado, foto(segundo).error_codigo) == ('error', 429)
    assert foto(primero) is None
    assert 'frenar' in resumen['mensaje']


def test_un_401_en_la_busqueda_por_correo_corta_el_lote(db, academia):
    comprador(db, 'uno@x.com')
    comprador(db, 'dos@x.com')
    academia.fallas['dos@x.com'] = LearnationAPIError('Unauthenticated', status_code=401)

    resumen = lote()

    assert resumen['corte'] == '401'
    assert academia.peticiones == 1
    assert 'admin' in resumen['mensaje']


def test_la_red_caida_corta_el_lote(db, academia):
    comprador(db, learnation_user_id=1)
    comprador(db, learnation_user_id=2)
    academia.fallas[2] = LearnationAPIError('Error de red al conectar con la Academia')

    assert lote()['corte'] == 'red'
    assert academia.peticiones == 1


def test_un_404_de_un_alumno_no_corta_el_lote(db, academia):
    comprador(db, learnation_user_id=1)
    comprador(db, learnation_user_id=2)
    academia.fallas[2] = LearnationAPIError('Not Found', status_code=404)

    resumen = lote()

    assert resumen['corte'] is None
    assert (resumen['procesados'], resumen['errores'], resumen['vinculados']) == (2, 1, 1)


# --- El orden -------------------------------------------------------------------------------------

def test_el_mas_desactualizado_primero(db, academia):
    """Los que nunca se miraron van primero; despues, del intento mas viejo al mas reciente."""
    ayer, hace_cinco, nunca = (comprador(db, learnation_user_id=i) for i in (11, 12, 13))
    for cliente, dias in ((ayer, 1), (hace_cinco, 5)):
        cuando = AHORA - timedelta(days=dias)
        db.session.add(AcademySnapshot(client_id=cliente.id, resultado='vinculado',
                                       learnation_user_id=cliente.learnation_user_id,
                                       intentado_at=cuando, synced_at=cuando))
    db.session.commit()

    lote(presupuesto=2)

    assert academia.resumenes_pedidos() == [13, 12]


def test_un_cliente_que_da_error_va_al_final_de_la_cola(db, academia):
    """Se ordena por el ultimo INTENTO y no por la ultima foto buena: si no, el que da error siempre
    tendria la foto mas vieja y se comeria el presupuesto de cada corrida con el mismo error."""
    roto, sano = comprador(db, learnation_user_id=21), comprador(db, learnation_user_id=22)
    db.session.add_all([
        AcademySnapshot(client_id=roto.id, learnation_user_id=21, resultado='error', error_codigo=500,
                        synced_at=AHORA - timedelta(days=5), intentado_at=AHORA - timedelta(hours=1)),
        AcademySnapshot(client_id=sano.id, learnation_user_id=22, resultado='vinculado',
                        synced_at=AHORA - timedelta(days=2), intentado_at=AHORA - timedelta(days=2)),
    ])
    db.session.commit()

    lote(presupuesto=1)

    assert academia.resumenes_pedidos() == [22]


def test_sin_acceso_no_se_vuelve_a_buscar_hasta_la_semana(db, academia):
    """Confirmar que alguien no tiene cuenta cuesta un correo por cada uno de los suyos, y cambia poco."""
    cliente = comprador(db)
    lote()
    assert foto(cliente).resultado == 'sin_acceso'

    lote(ahora=AHORA + timedelta(days=1))
    assert academia.doble.check_user.call_count == 1

    lote(ahora=AHORA + timedelta(days=snap.DIAS_RECHEQUEO_SIN_ACCESO, hours=1))
    assert academia.doble.check_user.call_count == 2


def test_al_que_le_dieron_el_acceso_se_lo_mira_enseguida(db, academia):
    cliente = comprador(db)
    lote()
    assert foto(cliente).resultado == 'sin_acceso'

    # El closer le dio el acceso desde NeurOPS (AcademyAccessService guarda el id).
    cliente.learnation_user_id = 77
    db.session.commit()
    lote(ahora=AHORA + timedelta(hours=1))

    assert academia.resumenes_pedidos() == [77]
    assert foto(cliente).resultado == 'vinculado'


# --- El id que ahorra peticiones ------------------------------------------------------------------

def test_encontrado_por_su_correo_el_id_queda_en_el_cliente_y_la_proxima_vez_cuesta_uno(db, academia):
    cliente = comprador(db, 'andres@x.com')
    academia.alumnos['andres@x.com'] = 87

    lote()
    assert db.session.get(Client, cliente.id).learnation_user_id == 87
    assert academia.peticiones == 2

    lote(ahora=AHORA + timedelta(hours=6))
    assert academia.peticiones == 3  # solo el resumen: ya no se busca por correo
    assert academia.doble.check_user.call_count == 1


def test_encontrado_por_el_correo_de_la_venta_sin_corroborar_se_reusa_desde_la_foto(db, academia):
    """No se escribe en el cliente (el cruce es dudoso), pero el lote no vuelve a buscarlo."""
    cliente = comprador(db, 'no-email-99@neurops.com', venta_mail='real@x.com', phone='+57 311 000 1111')
    academia.alumnos['real@x.com'] = 55
    academia.telefonos[55] = '3002558373'

    lote()
    assert db.session.get(Client, cliente.id).learnation_user_id is None
    assert (foto(cliente).learnation_user_id, foto(cliente).email_usado) == (55, 'real@x.com')

    lote(ahora=AHORA + timedelta(hours=6))
    assert academia.doble.check_user.call_count == 1
    assert academia.resumenes_pedidos() == [55, 55]


def test_encontrado_por_el_correo_de_la_venta_con_el_mismo_telefono_se_guarda(db, academia):
    cliente = comprador(db, 'no-email-98@neurops.com', venta_mail='real2@x.com', phone='+57 300 255 8373')
    academia.alumnos['real2@x.com'] = 56
    academia.telefonos[56] = '3002558373'

    lote()

    assert db.session.get(Client, cliente.id).learnation_user_id == 56


def test_si_el_id_de_la_foto_ya_no_existe_se_vuelve_a_buscar_por_correo(db, academia):
    cliente = comprador(db, 'no-email-97@neurops.com', venta_mail='real3@x.com')
    academia.alumnos['real3@x.com'] = 57
    lote()
    academia.fallas[57] = LearnationAPIError('Not Found', status_code=404)

    lote(ahora=AHORA + timedelta(hours=6))

    assert (foto(cliente).resultado, foto(cliente).learnation_user_id) == ('error', None)


def test_el_resumen_cuenta_lo_que_falta(db, academia):
    for i in range(3):
        comprador(db, learnation_user_id=300 + i)

    resumen = lote(presupuesto=2)

    assert (resumen['clientes'], resumen['procesados'], resumen['sin_datos']) == (3, 2, 1)
    assert 'Quedan 1 sin datos' in resumen['mensaje']
