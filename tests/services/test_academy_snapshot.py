"""La foto de la Academia de cada cliente: que se guarda, como se deduce la actividad y que lee la tabla.

La Academia no informa cuando estudio el alumno por ultima vez, asi que "activo" se deduce
comparando fotos (ver `academy_snapshot_service`). Lo que estos tests fijan es justamente esa
deduccion, y las dos reglas que evitan mostrar datos que no son del cliente: los numeros de una
cuenta que ya no es la suya no se muestran, y el id del alumno solo se escribe en el cliente cuando
el cruce es confiable.

Ningun test llama a la Academia: la foto se arma con el payload que ya devolvio la ficha.
"""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from app.models import AcademySnapshot, Client
from app.services import academy_snapshot_service as snap

AHORA = datetime(2026, 9, 30, 12, 0)
DESEMPENO = {'streak_days': 0, 'total_study_hours': 12, 'pomodoro_sessions': 3,
             'progress_percentage': 31.5, 'completed_lessons': 11, 'total_lessons': 12,
             'lesson_views': 347, 'submitted_executions': 67, 'approval_rate': 56.7,
             'group_sessions_attended': 5, 'individual_sessions_attended': 1,
             'open_support_tickets': 0}


@pytest.fixture()
def cliente(db):
    c = Client(full_name='Andres Sierra', email='andres@x.com', phone='+57 300 255 8373')
    db.session.add(c)
    db.session.commit()
    return c


def vinculado(desempeno=None, *, alumno_id=87, email_usado='andres@x.com', telefono='3002558373',
              **cambios):
    """El payload de `fulfillment()` para un alumno encontrado, con el desempeno pedido."""
    return {'vinculado': True, 'email_usado': email_usado, 'emails_probados': [email_usado],
            'error': None, 'productos': [],
            'alumno': {'id': alumno_id, 'telefono': telefono,
                       'producto_activo': {'id': 1, 'name': 'Residency Roadmap'}},
            'desempeno': {**DESEMPENO, **(desempeno or {}), **cambios}}


def foto_de(cliente):
    return AcademySnapshot.query.filter_by(client_id=cliente.id).one()


# --- Que se guarda ------------------------------------------------------------------------------

def test_la_foto_guarda_las_metricas_con_nombres_propios(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA)

    foto = foto_de(cliente)
    assert (foto.horas_estudio, foto.progreso, foto.lecciones_completadas, foto.lecciones_totales,
            foto.ejecuciones, foto.racha_dias) == (12, 31.5, 11, 12, 67, 0)
    assert (foto.resultado, foto.learnation_user_id, foto.producto_activo) == (
        'vinculado', 87, 'Residency Roadmap')
    assert foto.synced_at == foto.intentado_at == AHORA
    # El crudo tambien, para no perder un campo que todavia no tiene columna.
    assert foto.datos['performance']['lesson_views'] == 347


def test_volver_a_guardar_actualiza_la_misma_foto(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA)
    snap.guardar_desde_fulfillment(cliente, vinculado(submitted_executions=70),
                                   ahora=AHORA + timedelta(hours=3))

    assert AcademySnapshot.query.count() == 1
    assert foto_de(cliente).ejecuciones == 70


def test_un_numero_que_llega_como_texto_o_vacio_no_rompe(db, cliente):
    snap.guardar_desde_fulfillment(
        cliente, vinculado(total_study_hours='14', submitted_executions=None, streak_days=True),
        ahora=AHORA)

    foto = foto_de(cliente)
    assert (foto.horas_estudio, foto.ejecuciones, foto.racha_dias) == (14, None, None)


def test_guardar_nunca_le_rompe_la_pestana_al_closer(db, cliente, monkeypatch):
    def explota():
        raise RuntimeError('la base se cayo')

    monkeypatch.setattr(snap.db.session, 'commit', explota)

    assert snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA) is None


def test_sin_cliente_no_hay_foto(db):
    assert snap.guardar_desde_fulfillment(None, vinculado(), ahora=AHORA) is None
    assert AcademySnapshot.query.count() == 0


# --- Los tres casos sin numeros -------------------------------------------------------------------

def test_sin_cuenta_en_la_academia_es_sin_acceso(db, cliente):
    snap.guardar_desde_fulfillment(cliente, {'vinculado': False, 'emails_probados': ['andres@x.com'],
                                             'error': None}, ahora=AHORA)

    assert snap.estado_de(foto_de(cliente), AHORA) == 'sin_acceso'


def test_sin_ningun_correo_real_es_sin_correo(db, cliente):
    snap.guardar_desde_fulfillment(cliente, {'vinculado': False, 'emails_probados': [],
                                             'error': None}, ahora=AHORA)

    assert snap.estado_de(foto_de(cliente), AHORA) == 'sin_correo'


def test_un_error_sin_datos_previos_es_sin_datos_y_guarda_el_motivo(db, cliente):
    error = {'codigo': 429, 'motivo': 'La Academia recibió demasiadas consultas por minuto.'}
    snap.guardar_desde_fulfillment(cliente, {'vinculado': False, 'error': error}, ahora=AHORA)

    foto = foto_de(cliente)
    assert snap.estado_de(foto, AHORA) == 'sin_datos'
    assert (foto.error_codigo, snap.bloque_de(foto, AHORA)['error']) == (429, error['motivo'])


def test_un_error_despues_de_una_foto_buena_conserva_los_numeros(db, cliente):
    """Una foto vieja con su fecha dice mas que ninguna: el error no borra lo que ya se sabia."""
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=2), ahora=AHORA)
    snap.guardar_desde_fulfillment(cliente, {'vinculado': False, 'error': {'codigo': 500, 'motivo': 'x'}},
                                   ahora=AHORA + timedelta(hours=1))

    bloque = snap.bloque_de(foto_de(cliente), AHORA + timedelta(hours=1))
    assert (bloque['estado']['key'], bloque['ejecuciones'], bloque['error']) == ('activo', 67, 'x')
    assert bloque['sincronizado'] == f'{AHORA.isoformat()}Z'


# --- La actividad se deduce comparando fotos -------------------------------------------------------

def test_con_racha_la_actividad_es_de_ahora(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=4), ahora=AHORA)

    assert foto_de(cliente).actividad_vista_at == AHORA
    assert snap.estado_de(foto_de(cliente), AHORA) == 'activo'


def test_la_primera_foto_sin_racha_no_inventa_actividad(db, cliente):
    """Sin una foto anterior no hay con que comparar: no se sabe cuando estudio por ultima vez."""
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA)

    assert foto_de(cliente).actividad_vista_at is None
    assert snap.estado_de(foto_de(cliente), AHORA) == 'inactivo'


def test_un_contador_que_sube_marca_actividad_desde_la_foto_anterior(db, cliente):
    """La cota segura: se movio en algun momento DESPUES de la foto anterior, no necesariamente ahora."""
    antes = AHORA - timedelta(days=2)
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=antes)
    snap.guardar_desde_fulfillment(cliente, vinculado(submitted_executions=68), ahora=AHORA)

    assert foto_de(cliente).actividad_vista_at == antes
    assert snap.estado_de(foto_de(cliente), AHORA) == 'activo'


def test_si_la_foto_anterior_es_muy_vieja_el_cambio_no_alcanza_para_decir_activo(db, cliente):
    """Entrego algo en los ultimos veinte dias, pero no se puede afirmar que fue esta semana."""
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA - timedelta(days=20))
    snap.guardar_desde_fulfillment(cliente, vinculado(submitted_executions=68), ahora=AHORA)

    assert snap.estado_de(foto_de(cliente), AHORA) == 'inactivo'


def test_la_aprobacion_o_los_tickets_que_cambian_no_son_actividad(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA - timedelta(days=1))
    snap.guardar_desde_fulfillment(cliente, vinculado(approval_rate=80.0, open_support_tickets=2),
                                   ahora=AHORA)

    assert foto_de(cliente).actividad_vista_at is None


def test_activo_vence_a_los_siete_dias_sin_movimiento(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=1), ahora=AHORA)
    foto = foto_de(cliente)

    assert snap.estado_de(foto, AHORA + timedelta(days=snap.DIAS_ACTIVO)) == 'activo'
    assert snap.estado_de(foto, AHORA + timedelta(days=snap.DIAS_ACTIVO, minutes=1)) == 'inactivo'


def test_una_foto_sin_movimiento_no_borra_la_actividad_ya_vista(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=3), ahora=AHORA - timedelta(days=2))
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=0), ahora=AHORA)

    assert foto_de(cliente).actividad_vista_at == AHORA - timedelta(days=2)


# --- Cuando se escribe el id del alumno en el cliente ------------------------------------------

def test_encontrado_con_el_correo_del_propio_cliente_se_guarda_en_el_cliente(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(telefono=None), ahora=AHORA)

    assert db.session.get(Client, cliente.id).learnation_user_id == 87


def test_encontrado_con_el_correo_de_una_venta_y_el_mismo_telefono_se_guarda(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(email_usado='otro@x.com', telefono='300 255 8373'),
                                   ahora=AHORA)

    assert db.session.get(Client, cliente.id).learnation_user_id == 87


def test_encontrado_con_el_correo_de_una_venta_sin_corroborar_queda_solo_en_la_foto(db, cliente):
    """Un cruce dudoso pegado al cliente para siempre no tendria como corregirse."""
    snap.guardar_desde_fulfillment(cliente, vinculado(email_usado='otro@x.com', telefono='3110001111'),
                                   ahora=AHORA)

    assert db.session.get(Client, cliente.id).learnation_user_id is None
    assert (foto_de(cliente).learnation_user_id, foto_de(cliente).email_usado) == (87, 'otro@x.com')


def test_un_id_ya_guardado_no_se_pisa(db, cliente):
    cliente.learnation_user_id = 5
    db.session.commit()

    snap.guardar_desde_fulfillment(cliente, vinculado(alumno_id=87), ahora=AHORA)

    assert db.session.get(Client, cliente.id).learnation_user_id == 5


# --- Lo que lee la tabla ------------------------------------------------------------------------

def test_sin_foto_el_bloque_dice_sin_datos_y_no_trae_numeros(db):
    bloque = snap.bloque_de(None, AHORA)

    assert bloque['estado'] == {'key': 'sin_datos', 'label': 'Sin datos', 'tone': 'idle'}
    assert bloque['horas'] is None and bloque['sincronizado'] is None


def test_sin_acceso_no_muestra_los_numeros_de_una_cuenta_que_ya_no_es_la_suya(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(), ahora=AHORA - timedelta(days=3))
    snap.guardar_desde_fulfillment(cliente, {'vinculado': False, 'emails_probados': ['x@x.com'],
                                             'error': None}, ahora=AHORA)

    bloque = snap.bloque_de(foto_de(cliente), AHORA)
    assert bloque['estado']['key'] == 'sin_acceso'
    assert (bloque['horas'], bloque['ejecuciones']) == (None, None)


def test_el_bloque_trae_las_metricas_que_la_tabla_ordena(db, cliente):
    snap.guardar_desde_fulfillment(cliente, vinculado(streak_days=4), ahora=AHORA)

    bloque = snap.bloque_de(foto_de(cliente), AHORA)
    assert {k: bloque[k] for k in ('horas', 'progreso', 'lecciones', 'lecciones_total',
                                   'ejecuciones', 'racha', 'sesiones')} == {
        'horas': 12, 'progreso': 31.5, 'lecciones': 11, 'lecciones_total': 12,
        'ejecuciones': 67, 'racha': 4, 'sesiones': 6}
    assert bloque['ultima_actividad'] == bloque['sincronizado'] == f'{AHORA.isoformat()}Z'


def test_los_bloques_de_una_tabla_se_leen_en_una_sola_consulta(db):
    def contar(ids):
        consultas = []

        def anotar(*_a, **_k):
            consultas.append(1)

        motor = db.session.get_bind()
        event.listen(motor, 'before_cursor_execute', anotar)
        try:
            bloques = snap.bloques_por_cliente(ids, AHORA)
        finally:
            event.remove(motor, 'before_cursor_execute', anotar)
        return bloques, len(consultas)

    clientes = [Client(full_name=f'C{i}', email=f'c{i}@x.com') for i in range(12)]
    db.session.add_all(clientes)
    db.session.commit()
    for c in clientes:
        snap.guardar_desde_fulfillment(c, vinculado(email_usado=c.email), ahora=AHORA)

    _, pocas = contar([c.id for c in clientes[:2]])
    bloques, muchas = contar([c.id for c in clientes] + [None])

    assert pocas == muchas == 1
    assert len(bloques) == 12
