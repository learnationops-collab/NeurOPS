"""El gancho de sincronizacion en vivo: que cambios recalculan el snapshot de un WorkshopEvent.

`workshop_live_sync` recalcula el WorkshopEvent dueño del dia de lo que se acaba de guardar. Solo miraba
agendas y ventas, asi que un formulario no movia las aplicaciones del panel hasta que llegara la
siguiente agenda: con el taller en vivo, "Recargar eventos" mostraba el numero viejo (19/sep/2026).

Para saber si un evento se recalculo, cada test le deja valores centinela (99, sin `synced_at`) con un
UPDATE masivo, que no pasa por el gancho, y despues mira si cambiaron. Ojo con el orden: guardar un
cliente con formulario o un taller tambien dispara el gancho, asi que el centinela va SIEMPRE despues de
armar los datos y antes de lo que se prueba.
"""
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.orm.attributes import flag_modified

from app.models import Client, FinancialAgenda, WorkshopEvent

TOKEN = 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres'
URL_FORMULARIO = '/api/public/financial-agendas-form'
CENTINELA = 99

DIA = date(2026, 9, 19)
SIGUIENTE = date(2026, 9, 26)          # cierra la ventana del taller del 19: del 19 al 25
DENTRO = datetime(2026, 9, 21, 15, 0, 0)
ANTES = datetime(2026, 8, 22, 21, 3, 52)

_correlativo = iter(range(1, 10_000))


def crear_talleres(db, *dias):
    for dia in dias:
        db.session.add(WorkshopEvent(date=dia, name=f'WEBINAR {dia}'))
    db.session.commit()
    return [WorkshopEvent.query.filter_by(date=dia).one().id for dia in dias]


def con_centinela(db):
    """Deja las metricas de todos los talleres en el valor centinela, sin pasar por el gancho."""
    WorkshopEvent.query.update({
        'aplicaciones_form': CENTINELA, 'agendas_exitosas': CENTINELA, 'show_up_sales_call': CENTINELA,
        'sales': CENTINELA, 'cash_collected': 0.0, 'synced_at': None,
    })
    db.session.commit()


def leer(db, id_taller):
    db.session.expire_all()
    return db.session.get(WorkshopEvent, id_taller)


def sin_recalcular(evento):
    return evento.synced_at is None and evento.aplicaciones_form == CENTINELA


def formulario(enviado, fuente_form='Workshop'):
    return {'nombre': 'Persona', 'fuente_form': fuente_form, 'submitted_at': enviado.isoformat()}


def cliente(db, *, creado, form_data=None):
    n = next(_correlativo)
    fila = Client(full_name=f'Persona {n}', email=f'persona{n}@test.local', instagram=f'ig{n}',
                  created_at=creado, form_data=form_data)
    db.session.add(fila)
    db.session.commit()
    return fila


def volver_a_anotar(db, cliente_existente, enviado):
    """Lo que hace el endpoint del formulario con quien ya esta en la base: le pisa el form_data."""
    datos = dict(cliente_existente.form_data or {})
    datos.update(formulario(enviado))
    cliente_existente.form_data = datos
    flag_modified(cliente_existente, 'form_data')
    db.session.commit()


# --- Lo que SI recalcula -----------------------------------------------------------------------

def test_un_formulario_de_un_cliente_nuevo_refresca_el_taller(db):
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    cliente(db, creado=DENTRO, form_data=formulario(DENTRO))

    evento = leer(db, taller)
    assert evento.aplicaciones_form == 1
    assert evento.agendas_exitosas == 0          # se recalculo todo, no solo las aplicaciones
    assert evento.synced_at is not None


def test_el_formulario_de_un_cliente_que_ya_existia_refresca_el_taller(db):
    # El caso que el panel contaba mal: es de agosto y vuelve a llenar el formulario del taller nuevo.
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    existente = cliente(db, creado=ANTES, form_data=formulario(ANTES))
    con_centinela(db)

    volver_a_anotar(db, existente, DENTRO)

    evento = leer(db, taller)
    assert evento.aplicaciones_form == 1
    assert evento.synced_at is not None


def test_un_cliente_que_ya_existia_sin_formulario_y_lo_llena_refresca_el_taller(db):
    # Lo crea el sync de agendas (sin form_data); el formulario le llega despues.
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    existente = cliente(db, creado=ANTES)
    con_centinela(db)

    volver_a_anotar(db, existente, DENTRO)

    assert leer(db, taller).aplicaciones_form == 1


def test_un_formulario_con_fecha_ilegible_usa_la_del_alta(db):
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    cliente(db, creado=DENTRO, form_data={'fuente_form': 'Workshop', 'submitted_at': 'no es una fecha'})

    evento = leer(db, taller)
    assert evento.synced_at is not None
    assert evento.aplicaciones_form == 1


def test_una_agenda_nueva_sigue_refrescando_el_taller(db):
    # Lo que el gancho ya hacia: no se puede perder por agregar los formularios.
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    db.session.add(FinancialAgenda(nombre='workshop', lead='Ana Gomez', mail='ana@x.com', created_at=DENTRO, date=DENTRO))
    db.session.commit()

    evento = leer(db, taller)
    assert evento.agendas_exitosas == 1
    assert evento.synced_at is not None


# --- Lo que NO debe recalcular -----------------------------------------------------------------

def test_un_cambio_que_no_toca_el_formulario_no_recalcula(db):
    # Seguimiento, telefono, monto...: recalcular por eso reescribiria talleres viejos sin motivo.
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    existente = cliente(db, creado=DENTRO, form_data=formulario(DENTRO))
    con_centinela(db)

    existente.follow_up_status = 'Contactado'
    existente.phone = '+58 412 0000000'
    existente.total_amount = 1000.0
    db.session.commit()

    assert sin_recalcular(leer(db, taller))


@pytest.mark.parametrize('form_data', [None, {}])
def test_un_cliente_sin_formulario_no_recalcula(db, form_data):
    # Los que crea el sync de agendas: existen, pero no respondieron el cuestionario.
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    cliente(db, creado=DENTRO, form_data=form_data)

    assert sin_recalcular(leer(db, taller))


def test_solo_se_refresca_el_taller_dueno_del_dia_del_formulario(db):
    anterior, actual, _ = crear_talleres(db, date(2026, 9, 12), DIA, SIGUIENTE)
    con_centinela(db)

    cliente(db, creado=datetime(2026, 9, 14, 15, 0, 0), form_data=formulario(datetime(2026, 9, 14, 15, 0, 0)))

    assert leer(db, anterior).aplicaciones_form == 1
    assert sin_recalcular(leer(db, actual))


def test_un_formulario_anterior_a_todos_los_talleres_no_falla(db):
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    cliente(db, creado=ANTES, form_data=formulario(ANTES))

    assert sin_recalcular(leer(db, taller))


def test_lo_que_se_revierte_no_deja_marcas_para_el_proximo_commit(db):
    taller, _ = crear_talleres(db, DIA, SIGUIENTE)
    con_centinela(db)

    db.session.add(Client(full_name='Revertida', email='revertida@test.local', created_at=DENTRO,
                          form_data=formulario(DENTRO)))
    db.session.flush()                      # aqui el gancho anota el dia del formulario
    db.session.rollback()
    cliente(db, creado=DENTRO)              # un commit cualquiera, sin formulario ni agenda

    assert sin_recalcular(leer(db, taller))


# --- De punta a punta: el endpoint real que llama n8n --------------------------------------------

@pytest.mark.parametrize('ya_existia', [True, False])
def test_un_formulario_que_llega_por_el_endpoint_refresca_el_taller(client, db, monkeypatch, ya_existia):
    monkeypatch.setenv('INGEST_API_TOKEN', TOKEN)
    hoy = datetime.utcnow().date()
    taller = crear_talleres(db, hoy - timedelta(days=2))[0]
    if ya_existia:
        # Esta en la base desde hace semanas, sin formulario: el endpoint la encuentra por su mail.
        db.session.add(Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', created_at=ANTES))
        db.session.commit()
    con_centinela(db)

    respuesta = client.post(URL_FORMULARIO, headers={'X-Api-Token': TOKEN}, json={
        'nombre': 'Ana Gomez', 'telefono': '+58 412 1234567', 'instagram': 'ana.g', 'mail': 'ana@x.com',
        'fuente_form': 'Workshop', 'profesion': 'Enfermera'})

    assert respuesta.status_code == 201
    evento = leer(db, taller)
    assert evento.aplicaciones_form == 1
    assert evento.synced_at is not None
