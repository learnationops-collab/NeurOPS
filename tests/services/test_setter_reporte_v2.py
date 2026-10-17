"""El reporte diario del setter v2: lo que se guarda, lo que se lee y que el v1 siga cuadrando.

El v2 carga por canal (anuncios / inbound) y suma las bienvenidas; los totales del v1 se siguen
llenando para que la Vista General de /admin/ventas, Discord y el historial no cambien de número.
"""
from datetime import date

from app.models import SetterDailyStats
from app.services import setter_reporte_v2 as rv2


def _payload():
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=10, no_lead=1, inabribles=0, ap_entrantes=3, ap_dolor=5, agendas=2)
    datos['inbound'].update(entrantes=6, no_lead=0, inabribles=1, ap_entrantes=1, ap_dolor=3, agendas=1)
    datos['bienvenidas'].update(hechas=12, respondidas=5, aperturas=4)
    datos['embudo'].update(dolor=10, oferta=7, link=5)
    datos['followups'].update(entrantes=9, dolor=5, oferta=3, link=3)
    datos['followups_respondidos'].update(entrantes=4, dolor=2, oferta=1, link=0)
    datos['reflexion'].update(flujo_trabajo='Abrí 40 conversaciones', win_del_dia='Agendó una fría')
    return datos


def _fila(**kwargs):
    return SetterDailyStats(setter_id=7, date=date(2026, 10, 10), **kwargs)


def test_escribir_guarda_los_canales_y_marca_version_2():
    stat = rv2.escribir(_fila(), _payload())

    assert stat.report_version == 2
    assert (stat.ads_entrantes, stat.ads_no_lead, stat.ads_ap_dolor, stat.ads_agendas) == (10, 1, 5, 2)
    assert (stat.inb_entrantes, stat.inb_inabribles, stat.inb_agendas) == (6, 1, 1)
    assert (stat.bnv_hechas, stat.bnv_respondidas, stat.bnv_aperturas) == (12, 5, 4)
    assert (stat.funnel_pain, stat.funnel_offer, stat.funnel_link) == (10, 7, 5)
    assert (stat.qualification_fu, stat.pain_fu, stat.offer_fu, stat.link_fu) == (9, 5, 3, 3)
    assert (stat.qualification_fur, stat.pain_fur, stat.offer_fur, stat.link_fur) == (4, 2, 1, 0)
    assert stat.reflections == {'flujo_trabajo': 'Abrí 40 conversaciones', 'win_del_dia': 'Agendó una fría'}


def test_escribir_llena_los_totales_del_v1_con_su_significado():
    stat = rv2.escribir(_fila(), _payload())

    # Cualificados: (10 − 1 − 0) + (6 − 0 − 1) = 14
    assert stat.inbox_entrantes == 16
    assert stat.not_lead == 1
    assert stat.inbox_inabribles == 1
    assert stat.inbox_leads == 14
    # El v1 calculaba los leads netos como «Cualificación» − no leads: tiene que dar los mismos 14.
    assert stat.funnel_qualification - stat.not_lead == 14
    assert stat.funnel_agenda == 3
    assert (stat.qualification_opening_submitted, stat.pain_opening_submitted, stat.opening_submitted) == (4, 8, 12)


def test_un_dia_del_v1_vuelto_a_mandar_con_el_v2_no_arrastra_lo_que_el_v2_no_pide():
    # El 09/10 se reportó con el formulario viejo: respuestas a follow-ups y aperturas, preguntas.
    fila = _fila(report_version=1, qualification_fur=12, pain_fur=4, agenda_fu=3, agenda_fur=2,
                 opening_responded=9, qualification_opening_responded=6, offer_opening_submitted=5,
                 link_opening_responded=1, q1_useful=3, q2_unuseful=2, stage_2_value=7,
                 answers={'4': 'respuesta vieja'})

    stat = rv2.escribir(fila, _payload())

    assert stat.report_version == 2
    for columna in rv2.SOLO_V1:
        assert getattr(stat, columna) == 0, columna
    assert stat.answers == {}
    # Lo que el v2 sí carga queda con lo nuevo: también los respondidos de los follow-ups.
    assert (stat.qualification_fu, stat.pain_opening_submitted) == (9, 8)
    assert (stat.qualification_fur, stat.pain_fur) == (4, 2)
    assert 'qualification_fur' not in rv2.SOLO_V1


def test_un_cliente_que_no_manda_respondidos_los_deja_en_cero():
    datos = _payload()
    del datos['followups_respondidos']
    stat = rv2.escribir(_fila(qualification_fur=7, link_fur=2), datos)

    assert (stat.qualification_fur, stat.pain_fur, stat.offer_fur, stat.link_fur) == (0, 0, 0, 0)


def test_como_v1_saca_los_canales_y_la_marca_de_version():
    stat = rv2.como_v1(rv2.escribir(_fila(), _payload()))

    assert stat.report_version == 1
    assert (stat.ads_entrantes, stat.inb_agendas, stat.bnv_hechas) == (0, 0, 0)
    assert rv2.leer(stat)['canales'] is None


def test_escribir_no_acepta_negativos_ni_basura():
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes='-4', no_lead='abc', agendas=None)
    stat = rv2.escribir(_fila(), datos)

    assert (stat.ads_entrantes, stat.ads_no_lead, stat.ads_agendas) == (0, 0, 0)


def test_cualificados_nunca_negativos():
    assert rv2.cualificados(3, 2, 5) == 0


def test_leer_un_v2_devuelve_canales_embudo_y_reflexion():
    lectura = rv2.leer(rv2.escribir(_fila(), _payload()))

    assert lectura['version'] == 2
    assert lectura['canales']['anuncios']['cualificados'] == 9
    assert lectura['canales']['inbound']['aperturas'] == 4
    assert lectura['totales']['entrantes'] == 16
    assert lectura['totales']['cualificados'] == 14
    assert lectura['embudo'] == {'cualificados': 14, 'dolor': 10, 'oferta': 7, 'link': 5, 'agendas': 3}
    assert lectura['followups'] == {'entrantes': 9, 'dolor': 5, 'oferta': 3, 'link': 3}
    assert lectura['followups_respondidos'] == {'entrantes': 4, 'dolor': 2, 'oferta': 1, 'link': 0}
    # Sin las respuestas a las aperturas (el payload es de antes del 15/10): None, no cero.
    assert lectura['bienvenidas'] == {'hechas': 12, 'respondidas': 5, 'aperturas': 4, 'aperturas_resp': None}
    assert lectura['reflexion']['win_del_dia'] == 'Agendó una fría'


def test_leer_un_v1_no_inventa_canales():
    fila = _fila(report_version=1, inbox_entrantes=20, not_lead=2, inbox_inabribles=3,
                 funnel_qualification=15, inbox_leads=None, funnel_pain=8, funnel_agenda=2, pain_fu=4,
                 pain_fur=3, agenda_fur=9, reflections={'1': 'texto viejo'})
    lectura = rv2.leer(fila)

    assert lectura['version'] == 1
    assert lectura['canales'] is None
    assert lectura['bienvenidas'] is None
    # Sin `inbox_leads` guardado, los cualificados salen como el v1: «Cualificación» − no leads.
    assert lectura['totales']['cualificados'] == 13
    assert lectura['embudo']['dolor'] == 8
    assert lectura['followups']['dolor'] == 4
    # El v1 ya guardaba los respondidos en las mismas columnas: vuelven igual (sin el post-agenda).
    assert lectura['followups_respondidos'] == {'entrantes': 0, 'dolor': 3, 'oferta': 0, 'link': 0}
    assert lectura['reflexion'] == {'flujo_trabajo': '', 'win_del_dia': ''}


def test_a_formulario_vuelve_a_la_forma_de_vacio_y_escribe_lo_mismo():
    stat = rv2.escribir(_fila(), _payload())
    form = rv2.a_formulario(rv2.leer(stat))

    assert set(form) == set(rv2.vacio()) | {'is_non_working_day'}
    assert form['anuncios'] == {**_payload()['anuncios'], 'leads': None, 'ap_entrantes_resp': None, 'ap_dolor_resp': None}
    assert form['embudo'] == {'dolor': 10, 'oferta': 7, 'link': 5}
    assert form['followups_respondidos'] == {'entrantes': 4, 'dolor': 2, 'oferta': 1, 'link': 0}
    assert rv2.leer(rv2.escribir(_fila(), form)) == rv2.leer(stat)


def test_a_formulario_de_un_v1_es_none():
    assert rv2.a_formulario(rv2.leer(_fila(report_version=1, inbox_entrantes=3))) is None


def test_avisos_de_un_dia_sin_problemas_es_lista_vacia():
    assert rv2.avisos(rv2.leer(rv2.escribir(_fila(), _payload()))) == []


def test_avisos_como_los_del_formulario():
    datos = _payload()
    datos['anuncios'].update(entrantes=5, no_lead=4, inabribles=2, ap_entrantes=4, ap_dolor=3)
    datos['bienvenidas'].update(hechas=2, respondidas=3, aperturas=4)
    datos['embudo'].update(dolor=3, oferta=4, link=1)

    avisos = rv2.avisos(rv2.leer(rv2.escribir(_fila(), datos)))

    assert [(a['paso'], a['nivel'], a['msg']) for a in avisos] == [
        ('aperturas', 'warn', 'Anuncios: más aperturas que entrantes (5)'),
        ('entrantes', 'warn', 'Bienvenidas: más respondidas que hechas'),
        ('aperturas', 'warn', 'Bienvenidas: más aperturas que respuestas (3)'),
        ('embudo', 'warn', 'Oferta supera a dolor (3)'),
        ('embudo', 'warn', 'Agendas supera a link (1)'),
        ('embudo', 'warn', 'Dolor es menor que las aperturas en dolor (6)'),
    ]


def test_aviso_si_respondieron_mas_que_los_follow_ups_enviados():
    datos = _payload()
    datos['followups_respondidos'].update(dolor=6, link=1)

    avisos = rv2.avisos(rv2.leer(rv2.escribir(_fila(), datos)))

    assert [(a['paso'], a['nivel'], a['msg']) for a in avisos] == [
        ('followups', 'warn', 'Dolor: más respuestas que follow-ups (5)'),
    ]


def test_un_v1_no_tiene_avisos():
    assert rv2.avisos(rv2.leer(_fila(report_version=1, inbox_entrantes=1, not_lead=5))) == []


def test_sumar_separa_lo_que_vino_sin_canal_y_salta_los_no_laborables():
    v2 = rv2.leer(rv2.escribir(_fila(), _payload()))
    v1 = rv2.leer(_fila(report_version=1, inbox_entrantes=20, not_lead=2, inbox_leads=13, funnel_agenda=2,
                        qualification_fu=6, qualification_fur=3))
    libre = rv2.leer(_fila(report_version=1, is_non_working_day=True, inbox_entrantes=99, qualification_fur=50))

    total = rv2.sumar([v2, v1, libre])

    assert (total['reportes'], total['reportes_v2'], total['no_laborables']) == (2, 1, 1)
    assert total['totales']['entrantes'] == 36
    assert total['canales']['anuncios']['entrantes'] == 10
    assert total['sin_canal']['entrantes'] == 20
    assert total['embudo']['agendas'] == 5
    assert total['bienvenidas']['hechas'] == 12
    # Los respondidos suman los dos formularios (el no laborable no entra).
    assert total['followups']['entrantes'] == 15
    assert total['followups_respondidos'] == {'entrantes': 7, 'dolor': 2, 'oferta': 1, 'link': 0}


def test_la_fila_v2_se_guarda_en_la_base(db, make_user):
    setter = make_user(role='setter', username='Elias')
    stat = rv2.escribir(SetterDailyStats(setter_id=setter.id, date=date(2026, 10, 10)), _payload())
    db.session.add(stat)
    db.session.commit()

    guardada = db.session.get(SetterDailyStats, stat.id)
    assert rv2.leer(guardada)['totales']['agendas'] == 3


# --- Correcciones del 15/10/2026: leads cargados y respuestas a las aperturas ---------------------

def _payload_con_leads():
    datos = _payload()
    # Anuncios: 10 mensajes = 1 no lead + 0 in-abribles + 6 leads + 3 que no contestaron.
    datos['anuncios'].update(leads=6, ap_entrantes_resp=1, ap_dolor_resp=4)
    # Inbound: 6 mensajes = 0 + 1 + 5 leads: todos contestaron.
    datos['inbound'].update(leads=5, ap_entrantes_resp=0, ap_dolor_resp=2)
    datos['bienvenidas'].update(aperturas_resp=3)
    return datos


def test_los_leads_cargados_son_los_cualificados_y_lo_que_sobra_no_contesto():
    stat = rv2.escribir(_fila(), _payload_con_leads())
    lectura = rv2.leer(stat)

    assert (stat.ads_leads, stat.inb_leads) == (6, 5)
    assert lectura['canales']['anuncios']['cualificados'] == 6
    assert lectura['canales']['anuncios']['no_contestaron'] == 3
    assert lectura['canales']['inbound']['no_contestaron'] == 0
    assert (lectura['totales']['cualificados'], lectura['totales']['no_contestaron']) == (11, 3)
    assert lectura['embudo']['cualificados'] == 11
    # Los totales del v1 con su significado: leads netos y «Cualificación» = los que respondieron.
    assert (stat.inbox_leads, stat.funnel_qualification) == (11, 12)


def test_sin_leads_cargados_queda_la_cuenta_de_antes():
    lectura = rv2.leer(rv2.escribir(_fila(), _payload()))

    assert lectura['canales']['anuncios']['leads'] is None
    assert lectura['canales']['anuncios']['cualificados'] == 9
    assert lectura['canales']['anuncios']['no_contestaron'] == 0


def test_las_respuestas_a_las_aperturas_se_guardan_y_llenan_las_columnas_del_v1():
    stat = rv2.escribir(_fila(), _payload_con_leads())
    lectura = rv2.leer(stat)

    assert (stat.ads_ap_entrantes_resp, stat.ads_ap_dolor_resp, stat.bnv_aperturas_resp) == (1, 4, 3)
    assert lectura['canales']['anuncios']['ap_respondidas'] == 5
    assert lectura['totales']['ap_respondidas'] == 7
    assert lectura['bienvenidas']['aperturas_resp'] == 3
    assert (stat.qualification_opening_responded, stat.pain_opening_responded, stat.opening_responded) == (1, 6, 7)


def test_a_formulario_conserva_los_campos_nuevos():
    stat = rv2.escribir(_fila(), _payload_con_leads())
    form = rv2.a_formulario(rv2.leer(stat))

    assert form['anuncios']['leads'] == 6
    assert form['bienvenidas']['aperturas_resp'] == 3
    assert rv2.leer(rv2.escribir(_fila(), form)) == rv2.leer(stat)


def test_avisos_de_leads_y_de_respuestas_a_las_aperturas():
    datos = _payload_con_leads()
    datos['anuncios'].update(leads=10, ap_dolor_resp=9)
    datos['bienvenidas'].update(aperturas_resp=5)
    msgs = [(a['paso'], a['nivel'], a['msg']) for a in rv2.avisos(rv2.leer(rv2.escribir(_fila(), datos)))]

    # Kerwin, 17/10/2026: cualificados + no leads + in-abribles por encima de los mensajes ya no avisa.
    assert not [m for m in msgs if m[1] == 'err']
    assert ('aperturas', 'warn', 'Anuncios: más respuestas que aperturas en dolor (5)') in msgs
    assert ('aperturas', 'warn', 'Bienvenidas: más respuestas que aperturas (4)') in msgs


def test_sumar_mide_la_respuesta_solo_con_los_reportes_que_la_cargaron():
    nuevo = rv2.leer(rv2.escribir(_fila(), _payload_con_leads()))
    viejo_v2 = rv2.leer(rv2.escribir(_fila(), _payload()))
    v1 = rv2.leer(_fila(report_version=1, inbox_entrantes=20, qualification_opening_submitted=4,
                        pain_opening_submitted=6, qualification_opening_responded=2, pain_opening_responded=3))

    r = rv2.sumar([nuevo, viejo_v2, v1])['respuesta_aperturas']

    # Anuncios: solo el reporte nuevo (8 aperturas, 5 respondidas); el v2 viejo no baja la tasa.
    assert r['anuncios'] == {'aperturas': 8, 'respondidas': 5}
    assert r['bienvenidas'] == {'aperturas': 4, 'respondidas': 3}
    # El v1 ya cargaba enviadas / respondidas: entra en el total y en «sin canal».
    assert r['sin_canal'] == {'aperturas': 10, 'respondidas': 5}
    assert r['total'] == {'aperturas': 12 + 10, 'respondidas': 7 + 5}
    assert rv2.sumar([viejo_v2])['respuesta_aperturas']['total'] == {'aperturas': 0, 'respondidas': None}


def test_una_fila_nueva_sin_tocar_es_version_1(db, make_user):
    setter = make_user(role='setter', username='Paula')
    stat = SetterDailyStats(setter_id=setter.id, date=date(2026, 10, 9), inbox_entrantes=5)
    db.session.add(stat)
    db.session.commit()

    assert db.session.get(SetterDailyStats, stat.id).report_version == 1
