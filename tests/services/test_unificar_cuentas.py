"""scripts/unificar_cuentas.py: dos cuentas de una persona pasan a UNA con varios roles."""
import importlib.util
import os
from datetime import date

from app import db
from app.models import CloserAlias, User
from app.models.closer_report import CloserDailyReport

RUTA = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'unificar_cuentas.py')


def _script():
    spec = importlib.util.spec_from_file_location('unificar_cuentas', RUTA)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _reporte(closer, dia):
    db.session.add(CloserDailyReport(closer_id=closer.id, date=dia))
    db.session.commit()


def _preparar(make_user):
    director = make_user(role='director_comercial', username='Marlon Garcia', email='marlongarcia@x.com')
    closer = make_user(role='closer', username='Marlon Closer', email='marlon@thelearnation.com')
    _reporte(closer, date(2026, 9, 1))
    _reporte(closer, date(2026, 9, 2))
    _reporte(director, date(2026, 9, 2))  # choca con el del closer: mismo día
    return director.id, closer.id


def test_el_ensayo_informa_los_choques_antes_de_aplicar(db, make_user):
    # El rollback del ensayo lo hace la transacción de la base (PostgreSQL en staging); pysqlite no emite
    # el BEGIN y confirma los savepoints solo, así que acá solo se comprueba el informe.
    destino, origen = _preparar(make_user)

    informe = _script().unificar(db.engine, destino, origen, aplicar=False)

    assert informe['movidas']['closer_daily_reports.closer_id'] == 1
    assert informe['conflictos'] == {'closer_daily_reports.closer_id': 1}
    assert informe['roles'] == ['director_comercial', 'closer']


def test_aplicar_une_las_cuentas_sin_perder_ni_pisar_filas(db, make_user):
    destino, origen = _preparar(make_user)

    informe = _script().unificar(db.engine, destino, origen, aplicar=True)
    db.session.expire_all()

    # El reporte que no chocaba pasa al destino; el del mismo día se queda (y se informa).
    assert CloserDailyReport.query.filter_by(closer_id=destino).count() == 2
    assert CloserDailyReport.query.filter_by(closer_id=origen).count() == 1
    assert informe['conflictos'] == {'closer_daily_reports.closer_id': 1}

    director, viejo = User.query.get(destino), User.query.get(origen)
    assert director.roles == ['director_comercial', 'closer']
    assert not viejo.is_active and viejo.username == f'fusionada_{origen}'
    alias = {a.alias_name: a.user_id for a in CloserAlias.query.all()}
    assert alias == {'Marlon Closer': destino, 'marlon@thelearnation.com': destino}


def test_despues_de_unir_el_nombre_viejo_resuelve_a_la_persona(db, make_user):
    from app.services.closer_name_service import resolver_nombre_closer

    destino, origen = _preparar(make_user)
    _script().unificar(db.engine, destino, origen, aplicar=True)
    db.session.expire_all()

    assert resolver_nombre_closer('marlon@thelearnation.com') == 'Marlon Garcia'
    assert resolver_nombre_closer('Marlon Closer') == 'Marlon Garcia'
    assert resolver_nombre_closer('marlongarcia@x.com') == 'Marlon Garcia'


def test_si_estaban_vinculadas_el_destino_queda_sin_grupo(db, make_user):
    destino, origen = _preparar(make_user)
    for uid in (destino, origen):
        User.query.get(uid).persona_id = 7
    db.session.commit()

    _script().unificar(db.engine, destino, origen, aplicar=True)
    db.session.expire_all()

    assert User.query.get(destino).persona_id is None and User.query.get(origen).persona_id is None


def test_el_informe_trae_lo_necesario_para_deshacer(db, make_user):
    destino, origen = _preparar(make_user)

    informe = _script().unificar(db.engine, destino, origen, aplicar=True)

    respaldo = informe['respaldo']
    assert respaldo['antes']['origen']['username'] == 'Marlon Closer' and respaldo['antes']['origen']['is_active'] is True
    assert respaldo['antes']['destino']['roles_extra'] is None
    # Las claves de TODAS las filas que apuntaban al origen, también la que chocó y no se movió.
    assert len(respaldo['filas']['closer_daily_reports.closer_id']['valores']) == 2


def test_hereda_finanzas_y_telefono_y_renombra_al_destino(db, make_user):
    operador = make_user(role='operator', username='Mario Opera', email='mario@x.com')
    admin = make_user(role='admin', username='Mario Administra', email='admin@x.com', can_view_finance=True)
    closer = make_user(role='closer', username='Mario Closer', email='buhler@x.com', two_chat_number='5541')
    s = _script()

    s.unificar(db.engine, operador.id, admin.id, aplicar=True, renombrar_destino='Mario Bühler')
    informe = s.unificar(db.engine, operador.id, closer.id, aplicar=True)
    db.session.expire_all()

    mario = User.query.get(operador.id)
    assert mario.username == 'Mario Bühler' and mario.role == 'operator'
    assert mario.roles == ['operator', 'admin', 'closer']
    assert mario.can_view_finance is True and mario.two_chat_number == '5541'
    assert informe['heredado'] == ['two_chat_number']
    alias = {a.alias_name: a.user_id for a in CloserAlias.query.all()}
    assert alias['Mario Opera'] == alias['Mario Closer'] == alias['buhler@x.com'] == mario.id


def test_no_renombra_a_un_usuario_que_ya_existe(db, make_user):
    import pytest

    destino = make_user(role='operator', username='Mario Opera')
    origen = make_user(role='closer', username='Mario Closer')
    make_user(role='setter', username='Mario Bühler')

    with pytest.raises(SystemExit):
        _script().unificar(db.engine, destino.id, origen.id, aplicar=False, renombrar_destino='Mario Bühler')
