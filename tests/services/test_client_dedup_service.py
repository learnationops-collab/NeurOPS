"""ClientDedupService: detectar y fusionar clientes duplicados. La operación de datos más delicada
del sistema (repunta citas, ventas y pagos, y BORRA filas) — ver test_client_dedup_helpers.py para las
funciones puras de normalización que deciden qué cuenta como señal de duplicado.
"""
from datetime import date, datetime

import pytest

from app.models import (
    Appointment, Client, ClientComment, ClientMergeLog, CommentNotification, Enrollment, FinancialSale,
    InstallmentPlan, Program, SurveyAnswer, SurveyQuestion,
)
from app.services.client_dedup_service import ClientDedupService


def crear(db, full_name, email=None, instagram=None, phone=None, created_at=None):
    cliente = Client(full_name=full_name, email=email, instagram=instagram, phone=phone,
                     created_at=created_at or datetime.utcnow())
    db.session.add(cliente)
    db.session.commit()
    return cliente


def ids_de(grupo):
    return sorted(c.id for c in grupo)


# --- find_duplicate_groups: cada señal por separado --------------------------------------------

def test_mismo_email_normalizado_y_nombre_compatible_forma_un_grupo(db):
    a = crear(db, 'Ana Gomez', email='  Ana@X.com ')
    b = crear(db, 'ana gomez', email='ANA@X.COM')
    crear(db, 'Otra Persona', email='otra@x.com')

    grupos = ClientDedupService.find_duplicate_groups()

    assert len(grupos) == 1
    assert ids_de(grupos[0]) == ids_de([a, b])


def test_mismo_email_pero_nombres_incompatibles_no_se_agrupa(db):
    # El caso real que motivo el resguardo: alguien tipeo el email de OTRA persona. (Distinta
    # mayuscula/espacio en cada fila: el email es unique de verdad en la base, dos duplicados reales
    # llegan con la escritura literal un poco distinta, nunca con el mismo string exacto).
    crear(db, 'Isai Jimenz', email='macomef01@gmail.com')
    crear(db, 'Facundo Macome', email=' MacomeF01@Gmail.com')

    assert ClientDedupService.find_duplicate_groups() == []


def test_mismo_instagram_normalizado_agrupa(db):
    a = crear(db, 'Ana Gomez', instagram='@Ana_G')
    b = crear(db, 'Ana Gomez', instagram='ana_g')

    grupos = ClientDedupService.find_duplicate_groups()

    assert ids_de(grupos[0]) == ids_de([a, b])


def test_mismo_telefono_por_los_ultimos_8_digitos_agrupa(db):
    a = crear(db, 'Ana Gomez', phone='+58 412 555 1234')
    b = crear(db, 'Ana Gomez', phone='0412-5551234')

    grupos = ClientDedupService.find_duplicate_groups()

    assert ids_de(grupos[0]) == ids_de([a, b])


def test_un_nombre_generico_es_compatible_con_cualquiera_y_se_agrupa(db):
    a = crear(db, 'Cliente Nuevo', email='ana@x.com')
    b = crear(db, 'Ana Gomez', email='ANA@X.COM')

    grupos = ClientDedupService.find_duplicate_groups()

    assert ids_de(grupos[0]) == ids_de([a, b])


def test_placeholders_de_instagram_y_telefono_no_generan_falsos_positivos(db):
    crear(db, 'Ana', instagram='n/a', phone='n/a')
    crear(db, 'Beto', instagram='sin instagram', phone='no tiene')

    assert ClientDedupService.find_duplicate_groups() == []


def test_una_clave_compartida_por_mas_de_dos_clientes_se_descarta_como_placeholder(db):
    # Tres o mas clientes con el mismo email/telefono/instagram no es "duplicado real": es un dato
    # compartido (ej. un telefono de pruebas reusado), y fusionarlos mezclaria identidades distintas.
    crear(db, 'Ana', phone='12345678')
    crear(db, 'Beto', phone='12345678')
    crear(db, 'Caro', phone='12345678')

    assert ClientDedupService.find_duplicate_groups() == []


def test_un_cliente_sin_ninguna_senal_util_no_aparece_en_ningun_grupo(db):
    crear(db, 'Solo', email=None, instagram=None, phone=None)
    a = crear(db, 'Ana Gomez', email='ana@x.com')
    b = crear(db, 'Ana Gomez', email='ANA@X.COM')

    grupos = ClientDedupService.find_duplicate_groups()

    assert len(grupos) == 1
    assert ids_de(grupos[0]) == ids_de([a, b])


def test_sin_clientes_duplicados_no_hay_grupos(db):
    crear(db, 'Ana', email='ana@x.com')
    crear(db, 'Beto', email='beto@x.com')

    assert ClientDedupService.find_duplicate_groups() == []


def test_dos_senales_distintas_encadenan_a_tres_clientes_en_un_solo_grupo(db):
    # A y B comparten email; B y C comparten instagram: por transitividad (union-find) los tres
    # terminan en el mismo grupo, aunque A y C no compartan ninguna senal entre si.
    a = crear(db, 'Ana Gomez', email='ana@x.com')
    b = crear(db, 'Ana Gomez', email='ANA@X.COM', instagram='ana.g')
    c = crear(db, 'Ana Gomez', instagram='ana.g')

    grupos = ClientDedupService.find_duplicate_groups()

    assert len(grupos) == 1
    assert ids_de(grupos[0]) == ids_de([a, b, c])


# --- _pick_survivor -------------------------------------------------------------------------------

def test_pick_survivor_elige_a_quien_tiene_mas_registros_relacionados(db, make_user):
    # sin_historial se crea PRIMERO (mas vieja, id mas chico) para que el historial, y no la
    # antiguedad, sea lo unico que explique por que gana con_mas_historial.
    closer = make_user(role='closer')
    sin_historial = crear(db, 'Ana Gomez', email='ana@x.com', created_at=datetime(2026, 1, 1))
    con_mas_historial = crear(db, 'Ana Gomez', email='ANA@X.COM', created_at=datetime(2026, 6, 1))
    db.session.add(Appointment(closer_id=closer.id, client_id=con_mas_historial.id, start_time=datetime(2026, 1, 1)))
    db.session.commit()

    elegido = ClientDedupService._pick_survivor([con_mas_historial, sin_historial])

    assert elegido.id == con_mas_historial.id


def test_pick_survivor_desempata_por_el_mas_antiguo(db):
    viejo = crear(db, 'Ana', email='ana@x.com', created_at=datetime(2026, 1, 1))
    nuevo = crear(db, 'Ana', email='ANA@X.COM', created_at=datetime(2026, 6, 1))

    assert ClientDedupService._pick_survivor([nuevo, viejo]).id == viejo.id


# --- merge_clients ----------------------------------------------------------------------------

@pytest.fixture()
def cita_y_programa(db, make_user):
    closer = make_user(role='closer')
    programa = Program(name='AL', price=1000.0)
    db.session.add(programa)
    db.session.commit()
    return closer, programa


def test_merge_clients_repunta_cada_tabla_relacionada_y_borra_al_duplicado(db, cita_y_programa):
    closer, programa = cita_y_programa
    superviviente = crear(db, 'Ana Gomez', email='ana@x.com')
    duplicado = crear(db, 'Ana Gomez', instagram='ana.g')

    cita = Appointment(closer_id=closer.id, client_id=duplicado.id, start_time=datetime(2026, 1, 1))
    db.session.add(cita)
    db.session.commit()
    inscripcion = Enrollment(client_id=duplicado.id, program_id=programa.id, closer_id=closer.id)
    pregunta = SurveyQuestion(text='¿Meta?')
    db.session.add_all([inscripcion, pregunta])
    db.session.commit()
    respuesta = SurveyAnswer(client_id=duplicado.id, question_id=pregunta.id, answer='Vender mas')
    comentario = ClientComment(client_id=duplicado.id, author_id=closer.id, text='Interesado')
    db.session.add_all([respuesta, comentario])
    db.session.commit()
    aviso = CommentNotification(client_id=duplicado.id, user_id=closer.id, comment_id=comentario.id, sender_id=closer.id)
    venta = FinancialSale(client_id=duplicado.id, monto=500.0, setter='ana')
    plan = InstallmentPlan(appointment_id=cita.id, client_id=duplicado.id, numero_cuota=1, monto=500.0,
                           fecha_vencimiento=date(2026, 3, 1))
    db.session.add_all([aviso, venta, plan])
    db.session.commit()
    id_duplicado = duplicado.id  # merge_clients hace su propio commit: despues, el objeto queda expirado

    ClientDedupService.merge_clients(superviviente.id, [id_duplicado], matched_on='instagram')

    assert Client.query.get(id_duplicado) is None
    assert Client.query.count() == 1
    for modelo in (Appointment, Enrollment, SurveyAnswer, ClientComment, CommentNotification, FinancialSale,
                  InstallmentPlan):
        fila = modelo.query.one()
        assert fila.client_id == superviviente.id


def test_merge_clients_registra_la_fusion_en_el_log_de_auditoria(db):
    superviviente = crear(db, 'Ana Gomez', email='ana@x.com')
    duplicado = crear(db, 'Ana Gomez', instagram='ana.g')
    id_superviviente, id_duplicado = superviviente.id, duplicado.id

    ClientDedupService.merge_clients(id_superviviente, [id_duplicado], matched_on='instagram')

    registro = ClientMergeLog.query.one()
    assert (registro.survivor_client_id, registro.merged_client_id, registro.matched_on) == (
        id_superviviente, id_duplicado, 'instagram')


def test_merge_clients_completa_los_campos_vacios_del_superviviente(db):
    superviviente = crear(db, full_name=None, email=None, phone=None, instagram=None)
    duplicado = crear(db, 'Ana Gomez', email='ana@x.com', phone='12345678', instagram='ana.g')

    ClientDedupService.merge_clients(superviviente.id, [duplicado.id])

    db.session.refresh(superviviente)
    assert (superviviente.full_name, superviviente.email, superviviente.phone, superviviente.instagram) == (
        'Ana Gomez', 'ana@x.com', '12345678', 'ana.g')


def test_merge_clients_no_pisa_los_campos_que_el_superviviente_ya_tenia(db):
    superviviente = crear(db, 'Nombre Real', email='real@x.com', phone='111', instagram='real.ig')
    duplicado = crear(db, 'Otro Nombre', email='otro@x.com', phone='222', instagram='otro.ig')

    ClientDedupService.merge_clients(superviviente.id, [duplicado.id])

    db.session.refresh(superviviente)
    assert (superviviente.full_name, superviviente.email, superviviente.phone, superviviente.instagram) == (
        'Nombre Real', 'real@x.com', '111', 'real.ig')


@pytest.mark.parametrize('placeholder', ['no-email-abc123@neurops.com', 'no_email_1234567890@neurops.com'])
def test_merge_clients_reemplaza_un_email_sintetico_del_superviviente_con_uno_real(db, placeholder):
    # Antes solo reconocia el formato de BookingService ('no-email-...'): un superviviente con el
    # placeholder de la actualizacion de seguimiento ('no_email_...') se quedaba con el correo
    # sintetico en vez de adoptar el real del duplicado.
    superviviente = crear(db, 'Ana Gomez', email=placeholder)
    duplicado = crear(db, 'Ana Gomez', email='ana.real@x.com', instagram='ana.g')

    ClientDedupService.merge_clients(superviviente.id, [duplicado.id], matched_on='instagram')

    db.session.refresh(superviviente)
    assert superviviente.email == 'ana.real@x.com'


def test_merge_clients_no_adopta_el_email_sintetico_de_un_duplicado(db):
    superviviente = crear(db, 'Ana Gomez', email=None)
    duplicado = crear(db, 'Ana Gomez', email='no-email-xyz@neurops.com', instagram='ana.g')

    ClientDedupService.merge_clients(superviviente.id, [duplicado.id], matched_on='instagram')

    db.session.refresh(superviviente)
    assert superviviente.email is None


def test_merge_clients_con_varios_duplicados_los_fusiona_a_todos(db):
    superviviente = crear(db, 'Ana Gomez', email='ana@x.com')
    dup1 = crear(db, 'Ana Gomez', instagram='ana.g1')
    dup2 = crear(db, 'Ana Gomez', instagram='ana.g2')
    db.session.add_all([FinancialSale(client_id=dup1.id, monto=100.0, setter='x'),
                        FinancialSale(client_id=dup2.id, monto=200.0, setter='x')])
    db.session.commit()

    ClientDedupService.merge_clients(superviviente.id, [dup1.id, dup2.id], matched_on='instagram')

    assert Client.query.count() == 1
    assert sorted(v.monto for v in FinancialSale.query.all()) == [100.0, 200.0]
    assert ClientMergeLog.query.count() == 2


def test_merge_clients_ignora_el_superviviente_si_viene_en_la_lista_de_duplicados(db):
    superviviente = crear(db, 'Ana Gomez', email='ana@x.com')
    otro = crear(db, 'Ana Gomez', instagram='ana.g')

    ClientDedupService.merge_clients(superviviente.id, [superviviente.id, otro.id])

    assert Client.query.count() == 1
    assert Client.query.one().id == superviviente.id


def test_merge_clients_sin_duplicados_no_hace_nada(db):
    superviviente = crear(db, 'Ana Gomez', email='ana@x.com')

    ClientDedupService.merge_clients(superviviente.id, [superviviente.id])

    assert Client.query.count() == 1
    assert ClientMergeLog.query.count() == 0


def test_merge_clients_con_un_superviviente_inexistente_no_hace_nada(db):
    duplicado = crear(db, 'Ana Gomez', email='ana@x.com')

    ClientDedupService.merge_clients(9999, [duplicado.id])

    assert Client.query.count() == 1
    assert Client.query.one().id == duplicado.id


# --- run_full_dedup -----------------------------------------------------------------------------

def test_run_full_dedup_en_seco_solo_cuenta_sin_tocar_la_base(db):
    crear(db, 'Ana', email='ana@x.com')
    crear(db, 'Ana', email='ANA@X.COM')
    crear(db, 'Beto', email='beto@x.com')

    resultado = ClientDedupService.run_full_dedup(dry_run=True)

    assert resultado == {'groups_found': 1, 'clients_to_merge': 1}
    assert Client.query.count() == 3


def test_run_full_dedup_de_verdad_fusiona_cada_grupo(db):
    crear(db, 'Ana', email='ana@x.com')
    crear(db, 'Ana', email='ANA@X.COM')
    crear(db, 'Beto', instagram='beto.r')
    crear(db, 'Beto', instagram='beto.r')
    crear(db, 'Sin duplicado', email='sola@x.com')

    resultado = ClientDedupService.run_full_dedup(dry_run=False)

    assert resultado == {'groups_merged': 2, 'clients_merged': 2}
    assert Client.query.count() == 3
    assert ClientMergeLog.query.count() == 2


def test_run_full_dedup_sin_duplicados_no_fusiona_nada(db):
    crear(db, 'Ana', email='ana@x.com')
    crear(db, 'Beto', email='beto@x.com')

    assert ClientDedupService.run_full_dedup(dry_run=False) == {'groups_merged': 0, 'clients_merged': 0}
    assert Client.query.count() == 2
