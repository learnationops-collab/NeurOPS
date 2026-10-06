"""Reglas del núcleo de Agendas 2.0: los mismos casos que frontend/src/pages/agendas_v2/core/nucleo.test.js,
más los propios del port (limpiar_html, horario con claves de texto, redondeo de JS, JSON de publicación)."""

import json
import re

from app.agendas_v2.nucleo.asignacion import VENTANA_LLENAR_DIAS, asignacion
from app.agendas_v2.nucleo.disponibilidad import agenda_opt, dias_del_horizonte, slots_persona
from app.agendas_v2.nucleo.eventos import (
    campos_publicados,
    config_de,
    link_evento,
    resumen_agenda,
    revision,
    sin_publicar,
    version_publicada,
)
from app.agendas_v2.nucleo.formulario import (
    texto_regla,
    calificar,
    duplicar_form,
    grupo_por_reglas,
    personalizar,
    reglas_rotas,
    validar_respuesta,
)
from app.agendas_v2.nucleo.normalizar import (
    limpiar_html,
    normal_evento,
    normal_form,
    normal_grupo,
    normal_persona,
    normal_rol,
    preguntas_flujo,
)
from app.agendas_v2.nucleo.ocupacion import opciones_de_ocupacion
from app.agendas_v2.nucleo.reserva import armar_reserva, telefono_e164
from app.agendas_v2.nucleo.tiempo import date_utc, iso, zoned_to_utc
from app.agendas_v2.nucleo.util import entero, fmt, js_round

# Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4) = 12:00 UTC.
LUNES = date_utc(2026, 9, 5, 12, 0)
H = 3600000
LV9A12 = {d: [['09:00', '12:00']] for d in (1, 2, 3, 4, 5)}


def ag(reservas=None, antel=None, paso=None):
    return {
        'reservas': {'modo': 'dias', 'n': 30, 'tipo': 'corridos', 'desde': '', 'hasta': '', **(reservas or {})},
        'antel': {'n': 0, 'u': 'h', **(antel or {})},
        'paso': {'n': 60, 'u': 'min', **(paso or {})},
    }


def datos(personas=(), grupos=(), roles=()):
    return {
        'funnels': [],
        'formularios': [],
        'eventos': [],
        'roles': [normal_rol(r['id'], r) for r in roles],
        'personas': [normal_persona(p['id'], p) for p in personas],
        'grupos': [normal_grupo(g['id'], g) for g in grupos],
    }


# --- disponibilidad -------------------------------------------------------------------------------


def test_inicios_cada_paso_dentro_del_horario_en_la_zona_de_la_persona():
    p = normal_persona('ana', {'tz': 'America/La_Paz', 'horario': LV9A12})
    s = slots_persona(p, 45, agenda_opt(ag(reservas={'n': 0}), 45), ahora=LUNES)
    # 09:00, 10:00 y 11:00 en La Paz; 11:00 + 45 min termina 11:45, entra.
    assert s == [date_utc(2026, 9, 5, 13), date_utc(2026, 9, 5, 14), date_utc(2026, 9, 5, 15)]


def test_respeta_la_antelacion_minima():
    p = normal_persona('ana', {'tz': 'America/La_Paz', 'horario': LV9A12})
    # Son las 08:00: con 3 h de antelación, lo primero que se ofrece es 11:00.
    s = slots_persona(p, 45, agenda_opt(ag(reservas={'n': 0}, antel={'n': 3, 'u': 'h'}), 45), ahora=LUNES)
    assert s == [date_utc(2026, 9, 5, 15)]


def test_saltea_lo_ocupado():
    p = normal_persona('ana', {'tz': 'America/La_Paz', 'horario': LV9A12})

    def ocupado(pid, t, dur):
        return t == date_utc(2026, 9, 5, 14)

    assert len(slots_persona(p, 45, agenda_opt(ag(reservas={'n': 0}), 45), ahora=LUNES, ocupado=ocupado)) == 2


def test_dias_habiles_no_ofrece_sabados_ni_domingos():
    dias = dias_del_horizonte(agenda_opt(ag(reservas={'n': 5, 'tipo': 'habiles'}), 45), 'America/La_Paz', LUNES)
    assert [x['dow'] for x in dias] == [1, 2, 3, 4, 5, 1]


def test_dias_corridos_incluye_hoy_y_los_n_siguientes():
    assert len(dias_del_horizonte(agenda_opt(ag(reservas={'n': 3}), 45), 'America/La_Paz', LUNES)) == 4


def test_el_rango_de_fechas_corta_en_las_dos_puntas():
    o = agenda_opt(ag(reservas={'modo': 'rango', 'desde': '2026-10-07', 'hasta': '2026-10-09'}), 45)
    assert [x['clave'] for x in dias_del_horizonte(o, 'America/La_Paz', LUNES)] == [
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
    ]


# --- formulario -----------------------------------------------------------------------------------

F = normal_form(
    'f',
    {
        'preguntas': [
            {
                'id': 'q1',
                'tipo': 'opciones',
                'peso': 2,
                'opciones': [
                    {'id': 'a', 'texto': 'A', 'puntos': 10},
                    {'id': 'b', 'texto': 'B', 'puntos': 0},
                    {'id': 'x', 'texto': 'X', 'descalifica': True},
                ],
            },
            {
                'id': 'q2',
                'tipo': 'opciones',
                'peso': 1,
                'opciones': [{'id': 'c', 'texto': 'C', 'puntos': 5}, {'id': 'd', 'texto': 'D'}],
            },
        ],
        'reglas': [
            {'id': 'r1', 'grupo': 'g1', 'cond': [{'q': 'q1', 'ops': ['a']}, {'q': 'q2', 'ops': ['c', 'd']}]},
            {'id': 'r2', 'grupo': 'g2', 'cond': []},
        ],
        'resto': 'g3',
    },
)


def test_la_nota_pondera_puntos_por_peso_y_excluye_opciones_sin_puntos():
    assert calificar(F['preguntas'], {'q1': 'a', 'q2': 'c'}) == 8.3  # (20+5)/(20+10)
    assert calificar(F['preguntas'], {'q1': 'a', 'q2': 'd'}) == 10  # q2 sin puntos no cuenta
    assert calificar(F['preguntas'], {}) is None


def test_la_primera_regla_que_se_cumple_decide_y_si_no_va_a_resto():
    assert grupo_por_reglas(F, {'q1': 'a', 'q2': 'd'}) == {'grupo': 'g1', 'regla': 0}
    assert grupo_por_reglas(F, {'q1': 'b', 'q2': 'c'}) == {'grupo': 'g3', 'regla': None}


def test_detecta_reglas_que_apuntan_a_opciones_borradas():
    assert reglas_rotas({**F, 'reglas': [{'id': 'r', 'grupo': 'g', 'cond': [{'q': 'q1', 'ops': ['zz']}]}]}) == [0]
    assert reglas_rotas(F) == []


def test_duplicar_remapea_las_reglas_a_las_preguntas_y_opciones_nuevas():
    c = duplicar_form(F)
    assert c['reglas'][0]['cond'][0]['q'] == c['preguntas'][0]['id']
    assert c['reglas'][0]['cond'][0]['ops'] == [c['preguntas'][0]['opciones'][0]['id']]
    assert c['preguntas'][0]['id'] != 'q1'


def test_nombre_se_reemplaza_o_se_borra_con_su_coma():
    assert personalizar('{nombre}, ¿a qué WhatsApp te escribimos?', 'Ana') == 'Ana, ¿a qué WhatsApp te escribimos?'
    assert personalizar('{nombre}, ¿a qué WhatsApp te escribimos?', '') == '¿A qué WhatsApp te escribimos?'


def test_valida_correo_telefono_e_instagram():
    def q(tipo, obligatoria=True):
        return {'tipo': tipo, 'obligatoria': obligatoria}

    assert validar_respuesta(q('email'), 'ana@x') == 'Revisá el correo.'
    assert validar_respuesta(q('telefono'), '12 3') == 'El número parece incompleto.'
    assert validar_respuesta(q('instagram'), 'ana.b_1') == ''
    assert validar_respuesta(q('texto', False), '') == ''
    assert validar_respuesta(q('opciones'), '') == 'Elegí una opción.'


def test_los_datos_de_contacto_van_primero_y_en_orden_fijo():
    assert [q['id'] for q in preguntas_flujo(F)[:4]] == ['c-nombre', 'c-telefono', 'c-email', 'c-instagram']


# --- asignacion -----------------------------------------------------------------------------------

ROLES = [{'id': 'rc', 'nombre': 'Closer', 'atiende': True}]
ANA = {'id': 'ana', 'nombre': 'Ana', 'rol': 'rc', 'tz': 'America/La_Paz', 'horario': LV9A12}
BETO = {'id': 'beto', 'nombre': 'Beto', 'rol': 'rc', 'tz': 'America/La_Paz', 'horario': LV9A12}


def ctx(**o):
    return {'preguntas': [], 'resp': {}, 'dur': 45, 'ag': ag(), 'reglas': [], 'resto': 'g1', **o}


def test_llenar_en_orden_muestra_solo_al_primero_mientras_tenga_lugar():
    d = datos(
        roles=ROLES,
        personas=[ANA, BETO],
        grupos=[{'id': 'g1', 'nombre': 'Top', 'estrategia': 'llenar', 'miembros': ['ana', 'beto']}],
    )
    a = asignacion(ctx(), d, {'ahora': LUNES})
    assert {s['p'] for s in a['slots']} == {'ana'}


def test_llenar_en_orden_pasa_al_siguiente_si_el_primero_no_tiene_lugar():
    d = datos(
        roles=ROLES,
        personas=[ANA, BETO],
        grupos=[{'id': 'g1', 'nombre': 'Top', 'estrategia': 'llenar', 'miembros': ['ana', 'beto']}],
    )
    limite = LUNES + VENTANA_LLENAR_DIAS * 24 * H
    a = asignacion(ctx(), d, {'ahora': LUNES, 'ocupado': lambda pid, t, dur: pid == 'ana' and t < limite})
    assert a['slots'][0]['p'] == 'beto'
    assert re.search('anteriores están llenos', a['regla'])


def test_por_horario_cada_horario_va_al_primero_que_lo_tiene_libre():
    d = datos(
        roles=ROLES,
        personas=[ANA, BETO],
        grupos=[{'id': 'g1', 'nombre': 'Top', 'estrategia': 'horario', 'miembros': ['ana', 'beto']}],
    )
    t0 = date_utc(2026, 9, 5, 13)
    a = asignacion(ctx(), d, {'ahora': LUNES, 'ocupado': lambda pid, t, dur: pid == 'ana' and t == t0})
    assert next(s for s in a['slots'] if s['t'] == t0)['p'] == 'beto'
    assert next(s for s in a['slots'] if s['t'] == t0 + H)['p'] == 'ana'


def test_repartir_parejo_va_a_quien_tiene_menos_agendas_por_delante():
    d = datos(
        roles=ROLES,
        personas=[ANA, BETO],
        grupos=[{'id': 'g1', 'nombre': 'Top', 'estrategia': 'repartir', 'miembros': ['ana', 'beto']}],
    )
    a = asignacion(ctx(), d, {'ahora': LUNES, 'carga_de': lambda pid: 3 if pid == 'ana' else 1})
    assert {s['p'] for s in a['slots']} == {'beto'}


def test_distribuida_con_porcentajes_va_a_quien_esta_mas_lejos_de_su_parte():
    g = {'id': 'g1', 'nombre': 'Top', 'estrategia': 'repartir', 'miembros': ['ana', 'beto'], 'pesos': {'ana': 80, 'beto': 20}}
    a = asignacion(ctx(), datos(roles=ROLES, personas=[ANA, BETO], grupos=[g]), {'ahora': LUNES, 'carga_de': lambda pid: 3 if pid == 'ana' else 1})
    assert {s['p'] for s in a['slots']} == {'ana'}
    # Con 0% solo recibe si nadie más está libre.
    g0 = {**g, 'pesos': {'ana': 0, 'beto': 100}}
    b = asignacion(ctx(), datos(roles=ROLES, personas=[ANA, BETO], grupos=[g0]), {'ahora': LUNES, 'carga_de': lambda pid: 9 if pid == 'beto' else 0})
    assert {s['p'] for s in b['slots']} == {'beto'}


def test_texto_de_una_regla_de_segmentacion():
    fo = {
        'preguntas': [{'id': 'q1', 'titulo': '¿Cuánto?', 'opciones': [{'id': 'a', 'texto': 'Mucho'}, {'id': 'b', 'texto': 'Algo'}]}],
        'reglas': [{'cond': [{'q': 'q1', 'ops': ['a', 'b']}], 'grupo': 'g1'}],
    }
    assert texto_regla(fo, 0) == 'si "¿Cuánto?" es Mucho o Algo'
    assert texto_regla(fo, None) == 'el resto'


def test_desborde_pasa_a_la_siguiente_prioridad():
    d = datos(
        roles=ROLES,
        personas=[ANA, {**BETO, 'horario': {}}],
        grupos=[
            {'id': 'g1', 'nombre': 'Top', 'orden': 1, 'estrategia': 'llenar', 'miembros': ['beto']},
            {'id': 'g2', 'nombre': 'General', 'orden': 2, 'estrategia': 'repartir', 'miembros': ['ana']},
        ],
    )
    a = asignacion(ctx(), d, {'ahora': LUNES})
    assert a['grupo']['id'] == 'g2'
    assert a['desborde'] is True
    assert a['grupo_regla'] == 'g1'
    assert a['regla'] == 'Top sin lugar → Distribuida entre 1'


def test_persona_fija_solo_la_agenda_de_esa_persona():
    d = datos(roles=ROLES, personas=[ANA, BETO])
    assert {s['p'] for s in asignacion(ctx(persona='beto'), d, {'ahora': LUNES})['slots']} == {'beto'}


def test_sin_closers_con_horario_vacio_en_vivo_y_genericos_en_prueba():
    d = datos(
        roles=ROLES, personas=[{**ANA, 'horario': {}}], grupos=[{'id': 'g1', 'nombre': 'Top', 'miembros': ['ana']}]
    )
    assert asignacion(ctx(), d, {'ahora': LUNES})['slots'] == []
    p = asignacion(ctx(), d, {'ahora': LUNES, 'prueba': True})
    assert len(p['slots']) > 0
    assert p['slots'][0]['p'] is None
    assert p['aviso'] == 'Horarios de prueba: cargá horarios en Team.'


def test_las_reservas_ocupan_el_horario_del_closer_y_cuentan_como_carga():
    o = opciones_de_ocupacion(
        [{'estado': 'agendada', 'closer_id': 'ana', 'inicio_ms': LUNES + 2 * H, 'fin_ms': LUNES + 2.75 * H}], LUNES
    )
    assert o['ocupado']('ana', LUNES + 2.5 * H, 45) is True
    assert o['ocupado']('ana', LUNES + 3 * H, 45) is False
    assert o['carga_de']('ana') == 1


# --- eventos --------------------------------------------------------------------------------------

FORM = normal_form('f', {'nombre': 'F', 'preguntas': [{'id': 'q', 'tipo': 'texto', 'titulo': 'Hola'}]})
E0 = normal_evento('e', {'nombre': 'Llamada', 'funnel': 'fu', 'formulario': 'f'})


def test_publicar_guarda_el_evento_completo_y_una_copia_del_formulario():
    e = {**E0, 'publicado': config_de(E0, FORM)}
    assert sin_publicar(e, FORM) is False
    assert version_publicada(e)['form']['preguntas'][0]['titulo'] == 'Hola'
    form2 = {**FORM, 'preguntas': [{**FORM['preguntas'][0], 'titulo': 'Chau'}]}
    assert sin_publicar(e, form2) is True


def test_descartar_vuelve_tambien_los_campos_en_su_valor_por_defecto():
    e = {**E0, 'publicado': config_de(E0, FORM)}
    cambiado = {**e, 'antel': {'n': 9, 'u': 'd'}, 'persona': 'ana'}
    vuelta = {**cambiado, **campos_publicados(cambiado)}
    assert vuelta['antel'] == E0['antel']
    assert vuelta['persona'] == ''


def test_el_link_usa_el_slug_del_funnel_y_la_revision_avisa_si_esta_repetido():
    d = {
        'funnels': [{'id': 'fu', 'slug': 'workshop', 'nombre': 'W', 'activo': True}],
        'formularios': [FORM],
        'personas': [],
        'grupos': [],
        'roles': [],
        'eventos': [E0, {**E0, 'id': 'e2'}],
    }
    assert link_evento(d, E0) == '/agenda/workshop/llamada'
    assert next(r for r in revision(d, E0) if re.search('link', r[1], re.I))[0] == 0


# --- reserva --------------------------------------------------------------------------------------


def test_normaliza_el_telefono_a_formato_internacional():
    assert telefono_e164('BO', '7123 4567') == '+59171234567'
    assert telefono_e164('AR', '011 2345-6789') == '+541123456789'
    assert telefono_e164('MX', '+52 55 1234 5678') == '+525512345678'


def test_arma_el_contrato_con_copia_de_preguntas_y_respuestas():
    form = normal_form(
        'f',
        {
            'preguntas': [
                {
                    'id': 'q1',
                    'tipo': 'opciones',
                    'titulo': '¿Cuánto?',
                    'peso': 1,
                    'opciones': [{'id': 'a', 'texto': 'Mucho', 'puntos': 10}],
                }
            ]
        },
    )
    preguntas = preguntas_flujo(form)
    r = armar_reserva(
        lead={
            'preguntas': preguntas,
            'resp': {'c-nombre': 'Ana Paz', 'c-telefono': '71234567', 'c-email': 'ANA@x.com', 'q1': 'a'},
            'pais': 'BO',
            'tz': 'America/La_Paz',
        },
        evento=normal_evento('e', {'nombre': 'Llamada', 'duracion': 45}),
        funnel=None,
        form=form,
        asig={'grupo': {'id': 'g1'}, 'grupo_regla': 'g1', 'regla_idx': 0, 'desborde': False},
        slot={'t': LUNES, 'p': 'ana'},
        origen='juan',
    )
    assert {k: r['lead'][k] for k in ('nombre', 'telefono', 'email')} == {
        'nombre': 'Ana Paz',
        'telefono': '+59171234567',
        'email': 'ana@x.com',
    }
    assert len(r['respuestas']) == 1
    assert {k: r['respuestas'][0][k] for k in ('pregunta', 'respuesta', 'puntos')} == {
        'pregunta': '¿Cuánto?',
        'respuesta': 'Mucho',
        'puntos': 10,
    }
    assert {k: r[k] for k in ('closer_id', 'prioridad_id', 'nota', 'origen', 'inicio')} == {
        'closer_id': 'ana',
        'prioridad_id': 'g1',
        'nota': 10,
        'origen': 'juan',
        'inicio': '2026-10-05T12:00:00.000Z',
    }
    assert list(r) == [
        'version',
        'evento_id',
        'evento_slug',
        'funnel_id',
        'funnel_slug',
        'funnel_tipo',
        'formulario_id',
        'inicio',
        'duracion_min',
        'closer_id',
        'prioridad_id',
        'prioridad_regla_id',
        'regla_idx',
        'desborde',
        'nota',
        'descalificada',
        'origen',
        'setter_id',
        'lead',
        'respuestas',
    ]
    assert list(r['lead']) == ['nombre', 'telefono', 'email', 'instagram', 'pais', 'tz']


# --- Propios del port -----------------------------------------------------------------------------


def test_limpiar_html_deja_solo_el_formato_permitido():
    assert (
        limpiar_html('<b>Hola</b> <strong>che</strong> <em>x</em> <i>y</i> <u>z</u>')
        == '<b>Hola</b> <b>che</b> <i>x</i> <i>y</i> <u>z</u>'
    )
    assert (
        limpiar_html('<div>uno</div><div><br></div><ul><li>a</li><li>b</li></ul>')
        == '<div>uno</div><div><br></div><ul><li>a</li><li>b</li></ul>'
    )
    assert limpiar_html('<p>a<script>alert(1)</script><style>p{}</style>b</p>') == '<p>ab</p>'
    assert limpiar_html('<span style="color:red">rojo</span> <font>x</font>') == 'rojo x'
    assert (
        limpiar_html('<a href="https://x.com/?a=1&amp;b=2" onclick="y()">link</a>')
        == '<a href="https://x.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">link</a>'
    )
    assert (
        limpiar_html('<a href="mailto:a@b.com">m</a>')
        == '<a href="mailto:a@b.com" target="_blank" rel="noopener noreferrer">m</a>'
    )
    assert limpiar_html('<a href="javascript:alert(1)">no</a>') == 'no'
    assert limpiar_html('1 < 2 & "3" > \'0\'') == '1 &lt; 2 &amp; &quot;3&quot; &gt; &#39;0&#39;'
    assert limpiar_html('<iframe src="x"></iframe><object>o</object><template><b>t</b></template>') == ''
    assert limpiar_html('<br><br>') == ''
    assert limpiar_html('   ') == ''
    assert limpiar_html(None) == ''
    assert limpiar_html('<p>uno<p>dos') == '<p>uno</p><p>dos</p>'
    assert limpiar_html('<ul><li>a<li>b</ul>') == '<ul><li>a</li><li>b</li></ul>'
    assert limpiar_html('<b>sin cerrar') == '<b>sin cerrar</b>'
    assert limpiar_html('a</br>b') == 'a<br>b'
    assert limpiar_html('<!-- comentario -->texto') == 'texto'
    assert limpiar_html('&lt;b&gt; &aacute;') == '&lt;b&gt; á'


def test_horario_acepta_claves_de_texto():
    p = normal_persona('ana', {'tz': 'America/La_Paz', 'horario': {str(k): v for k, v in LV9A12.items()}})
    assert p['horario'][1] == [['09:00', '12:00']]
    assert p['horario'][0] == []
    # Una persona que vuelve de un JSON (claves '0'..'6') da los mismos horarios.
    p_json = json.loads(json.dumps(p))
    o = agenda_opt(ag(reservas={'n': 0}), 45)
    assert slots_persona(p_json, 45, o, ahora=LUNES) == slots_persona(p, 45, o, ahora=LUNES)
    assert len(slots_persona(p_json, 45, o, ahora=LUNES)) == 3


def test_redondeo_como_en_js():
    assert js_round(2.5) == 3
    assert js_round(0.5) == 1
    assert js_round(-2.5) == -2
    assert entero('2.5', 0, 10, None) == 3
    assert entero('', 0, 10, 7) == 7
    assert entero(None, 0, 10, 7) == 7
    assert entero('abc', 0, 10, 7) == 7
    assert entero(' 4 ', 0, 10, 7) == 4
    assert entero(99, 0, 10, 7) == 10
    assert fmt(2.25, 1) == '2,3'
    assert fmt(7.5, 1) == '7,5'
    assert fmt(8, 1) == '8'
    # (1×5 + 1×10... ) nota con .5 exacto: 0.85 → 8.5; 0.125*100 = 12.5 → 13 → 1.3
    qs = [
        {'id': 'q', 'tipo': 'opciones', 'peso': 4, 'opciones': [{'id': 'a', 'puntos': 0}]},
        {'id': 'r', 'tipo': 'opciones', 'peso': 1, 'opciones': [{'id': 'b', 'puntos': 5}]},
    ]
    assert calificar(qs, {'q': 'a', 'r': 'b'}) == 1  # 5/50*100 = 10 → 1
    qs[0]['peso'], qs[1]['opciones'][0]['puntos'] = 7, 1
    assert calificar(qs, {'q': 'a', 'r': 'b'}) == 0.1  # 1/80*100 = 1.25 → 1 → 0.1


def test_config_de_es_el_mismo_json_que_arma_el_frontend():
    # Sin espacios, con las claves en el orden del normalizador y enteros sin decimales.
    txt = config_de(E0, FORM)
    assert txt.startswith(
        '{"ev":{"nombre":"Llamada","slug":"llamada","funnel":"fu","formulario":"f","duracion":45,"activo":true,'
    )
    assert '"reservas":{"modo":"dias","n":30,"tipo":"corridos","desde":"","hasta":""}' in txt
    assert (
        '"form":{"id":"f","nombre":"F","contacto":{"nombre":true,"telefono":true,"email":true,"instagram":true}' in txt
    )


def test_zoned_to_utc_en_cambios_de_horario():
    # Valores sacados del JS (Intl). Nueva York: 8 mar 2026 02:30 no existe y el JS cae en 01:30 EST;
    # 1 nov 01:30 existe dos veces y el JS elige la primera (EDT). Santiago: 6 sep 00:30 no existe → 23:30 del 5.
    assert iso(zoned_to_utc(2026, 2, 8, 2, 30, 'America/New_York')) == '2026-03-08T06:30:00.000Z'
    assert iso(zoned_to_utc(2026, 10, 1, 1, 30, 'America/New_York')) == '2026-11-01T05:30:00.000Z'
    assert iso(zoned_to_utc(2026, 8, 6, 0, 30, 'America/Santiago')) == '2026-09-06T03:30:00.000Z'
    assert iso(zoned_to_utc(2026, 9, 5, 24, 0, 'America/La_Paz')) == '2026-10-06T04:00:00.000Z'


def test_resumen_agenda():
    e = normal_evento(
        'e', {'reservas': {'modo': 'rango', 'desde': '2026-09-05', 'hasta': '2026-10-05'}, 'paso': {'n': 2, 'u': 'h'}}
    )
    assert resumen_agenda(e) == '5 sept a 5 oct · 4 h antes · cada 2 h'
