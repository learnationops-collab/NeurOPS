"""Agendamiento de un workshop de punta a punta, como lo recorre cada lead desde su link.

Un funnel de tipo workshop con sus links de Instagram y de la grabación, tres estrategias (una de cada
reparto) y un formulario que usa todas las salidas de la segmentación: una estrategia por regla, una
página por regla, «No califica» por regla, una respuesta que descalifica y «Todo lo demás». Cada lead
hace los mismos pedidos que la página pública (cargar el evento, avanzar, pedir horarios, agendar) y se
mira lo que queda: la agenda en la operación con su closer, el Calendar, el WhatsApp y Discord del
closer, la fuente que leen el panel del workshop y el mazo, y lo que cuenta ese panel.
Fecha fija: lunes 5 de octubre de 2026, 08:00 en La Paz (12:00 UTC).
"""

import calendar
from datetime import date, datetime, timezone

import pytest
import pytz
from freezegun import freeze_time

from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedIntento
from app.agendas_v2.nucleo.eventos import config_de
from app.models import Appointment, Client, GoogleCalendarToken
from app.models.financial import FinancialAgenda
from app.services.google_service import GoogleService

URL = '/api/agendas-v2/publico'
LINK = URL + '/eventos/workshop-octubre/llamada'
LA_PAZ = pytz.timezone('America/La_Paz')
LV9a12 = {str(d): [['09:00', '12:00']] for d in range(1, 6)}
# Los horarios del lunes (09:00, 10:00 y 11:00 en La Paz), en ms UTC.
H9, H10, H11 = (calendar.timegm(datetime(2026, 10, 5, h).timetuple()) * 1000 for h in (13, 14, 15))
FIN_LUNES = calendar.timegm(datetime(2026, 10, 6, 4).timetuple()) * 1000
ISO = {H9: '2026-10-05T13:00:00.000Z', H10: '2026-10-05T14:00:00.000Z', H11: '2026-10-05T15:00:00.000Z'}


def _iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


# Las respuestas de cada segmento (inv = ¿cuánto puede invertir?, sit = situación).
ALTA = {'inv': 'mas1000', 'sit': 'trabaja'}
MEDIA = {'inv': 'entre', 'sit': 'emprende'}
BAJA = {'inv': 'entre', 'sit': 'estudia'}           # ninguna regla: «Todo lo demás»
A_LA_ACADEMIA = {'inv': 'menos', 'sit': 'estudia'}  # una regla lo manda a otra página
NO_CALIFICA = {'inv': 'menos', 'sit': 'trabaja'}    # una regla lo manda a «No califica»
SIN_PLATA = {'inv': 'nada'}                         # la respuesta descalifica: el formulario se corta


@pytest.fixture(autouse=True)
def _reloj():
    servicio._google_cache.clear()
    with freeze_time('2026-10-05 12:00:00'):
        yield


@pytest.fixture(autouse=True)
def google(monkeypatch):
    llamadas = {'crear': []}

    def crear(user_id, inicio, fin, titulo, descripcion, invitado_email=None):
        llamadas['crear'].append({'user_id': user_id, 'inicio': inicio, 'fin': fin, 'invitado': invitado_email})
        return f'evt{len(llamadas["crear"])}', 'https://meet.google.com/abc-defg-hij'

    monkeypatch.setattr(GoogleService, 'crear_evento_con_meet', staticmethod(crear))
    monkeypatch.setattr(GoogleService, 'delete_event', staticmethod(lambda u, e: True))
    monkeypatch.setattr(GoogleService, 'evento_cancelado', staticmethod(lambda u, e: False))
    monkeypatch.setattr(GoogleService, 'franjas_ocupadas', staticmethod(lambda u, desde, hasta: []))
    return llamadas


@pytest.fixture(autouse=True)
def whatsapp(monkeypatch):
    from app.services.whatchimp_service import AvisoDeAgenda

    enviados = []
    monkeypatch.setattr(AvisoDeAgenda, 'enviar', staticmethod(lambda numero, **datos: enviados.append(numero)))
    return enviados


@pytest.fixture(autouse=True)
def discord(monkeypatch):
    enviados = []

    class Respuesta:
        status_code = 204

    def sin_chromium(d):
        raise RuntimeError('sin chromium')

    monkeypatch.setenv('DISCORD_AGENDAS_WEBHOOK', 'https://discord.test/webhook')
    monkeypatch.setattr('app.agendas_v2.avisos_discord.requests.post',
                        lambda url, json=None, timeout=None: enviados.append(json) or Respuesta())
    monkeypatch.setattr('app.services.report_image_service.ReportImageService.generate_agenda_v2_card', sin_chromium)
    return enviados


@pytest.fixture()
def closers(db, make_user):
    """Ana, Beto y Caro: cuentas reales con Calendar y WhatsApp (sin eso no reciben agendas)."""
    out = {}
    for i, n in enumerate(('ana', 'beto', 'caro')):
        u = make_user(role='closer', username=n, email=f'{n}@equipo.com')
        db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}'))
        u.two_chat_number = f'5917000000{i}'
        u.whatsapp_confirmado_en = datetime(2026, 10, 1)
        out[n] = u
    db.session.commit()
    return out


@pytest.fixture()
def workshop(closers):
    g = servicio.guardar_doc
    g('roles', 'rc', {'nombre': 'Closer', 'atiende': True})
    for i, n in enumerate(('ana', 'beto', 'caro')):
        g('personas', n, {'nombre': n.capitalize(), 'email': f'{n}@equipo.com', 'rol': 'rc', 'tz': 'America/La_Paz',
                          'horario': LV9a12, 'orden': i + 1})
    g('grupos', 'alta', {'nombre': 'Alta', 'estrategia': 'horario', 'miembros': ['ana', 'beto'], 'orden': 1})
    g('grupos', 'media', {'nombre': 'Media', 'estrategia': 'repartir', 'miembros': ['beto', 'caro'], 'orden': 2})
    g('grupos', 'baja', {'nombre': 'Baja', 'estrategia': 'llenar', 'miembros': ['caro'], 'orden': 3})
    g('formularios', 'fw', {
        'nombre': 'Calificación workshop',
        'contacto': {'nombre': True, 'telefono': True, 'email': True, 'instagram': True},
        'preguntas': [
            {'id': 'inv', 'tipo': 'opciones', 'titulo': '¿Cuánto podés invertir?', 'peso': 2, 'opciones': [
                {'id': 'mas1000', 'texto': 'Más de 1000 USD', 'puntos': 10},
                {'id': 'entre', 'texto': 'Entre 500 y 1000 USD', 'puntos': 6},
                {'id': 'menos', 'texto': 'Menos de 500 USD', 'puntos': 2},
                {'id': 'nada', 'texto': 'Nada por ahora', 'descalifica': True},
            ]},
            {'id': 'sit', 'tipo': 'lista', 'titulo': '¿A qué te dedicás?', 'peso': 1, 'opciones': [
                {'id': 'emprende', 'texto': 'Emprendo', 'puntos': 10},
                {'id': 'trabaja', 'texto': 'Trabajo en relación de dependencia', 'puntos': 5},
                {'id': 'estudia', 'texto': 'Estudio', 'puntos': 2},
            ]},
        ],
        'reglas': [
            {'id': 'r1', 'grupo': 'alta', 'cond': [{'q': 'inv', 'ops': ['mas1000']}]},
            {'id': 'r2', 'grupo': 'media', 'cond': [{'q': 'inv', 'ops': ['entre']}, {'q': 'sit', 'ops': ['emprende']}]},
            {'id': 'r3', 'url': 'https://academy.thelearnation.com/', 'cond': [{'q': 'inv', 'ops': ['menos']},
                                                                             {'q': 'sit', 'ops': ['estudia']}]},
            {'id': 'r4', 'grupo': '__no', 'cond': [{'q': 'inv', 'ops': ['menos']}, {'q': 'sit', 'ops': ['trabaja']}]},
        ],
        'resto': 'baja',
        'fin': {'titulo': 'Gracias por tu sinceridad', 'texto': 'Te escribimos cuando sea un buen momento.'},
    })
    g('gracias', 'gw', {'nombre': 'Gracias workshop', 'video': {'url': 'https://www.loom.com/share/abc'}, 'casos': False})
    g('funnels', 'fw', {'nombre': 'Workshop octubre', 'slug': 'workshop-octubre', 'tipo': 'workshop',
                        'origenes': [{'id': 'oi', 'nombre': 'Instagram'}, {'id': 'og', 'nombre': 'Grabación'}]})
    g('eventos', 'ew', {'nombre': 'Llamada de diagnóstico', 'slug': 'llamada', 'funnel': 'fw', 'formulario': 'fw',
                        'duracion': 45, 'antel': {'n': 0, 'u': 'h'}, 'paso': {'n': 60, 'u': 'min'}, 'gracias': 'gw'})
    d = servicio.colecciones()
    e = next(x for x in d['eventos'] if x['id'] == 'ew')
    servicio.guardar_doc('eventos', 'ew', {'publicado': config_de(e, next(f for f in d['formularios'] if f['id'] == 'fw'))},
                         parcial=True)


class Lead:
    """Un lead en su navegador: hace los mismos pedidos que la página pública, en el mismo orden."""

    def __init__(self, client, n, origen='instagram'):
        self.client, self.origen = client, origen
        self.contacto = {'c-nombre': f'Lead {n}', 'c-telefono': f'7100000{n}', 'c-email': f'lead{n}@correo.com',
                         'c-instagram': f'lead{n}'}

    def abrir(self):
        r = self.client.get(LINK)
        assert r.status_code == 200
        return r.get_json()

    def responder(self, resp):
        """Deja sus datos y responde: cada paso queda registrado para Stats."""
        assert self.client.post(URL + '/eventos/ew/avance', json={'resp': self.contacto, 'origen': self.origen}).status_code == 204
        self.resp = {**self.contacto, **resp}
        assert self.client.post(URL + '/eventos/ew/avance',
                                json={'resp': self.resp, 'origen': self.origen, 'en_calendario': True}).status_code == 204

    def horarios(self, todos=False):
        """Los horarios que ve; sin `todos`, solo los del lunes (los de hoy)."""
        r = self.client.post(URL + '/eventos/ew/horarios', json={'resp': self.resp, 'tz': 'America/La_Paz', 'pais': 'BO'})
        assert r.status_code == 200
        slots = r.get_json()['slots']
        return slots if todos else [t for t in slots if t < FIN_LUNES]

    def agendar(self, t):
        return self.client.post(URL + '/reservas', json={'evento_id': 'ew', 'resp': self.resp, 'pais': 'BO',
                                                         'tz': 'America/La_Paz', 'inicio': _iso(t) if t else None,
                                                         'origen': self.origen})


def _agenda_de(email):
    return Appointment.query.join(Client).filter(Client.email == email).one()


def test_el_link_del_workshop_muestra_la_version_publicada_sin_datos_del_equipo(client, workshop):
    data = Lead(client, 1).abrir()
    assert data['funnel'] == {'nombre': 'Workshop octubre', 'slug': 'workshop-octubre'}
    assert data['evento']['nombre'] == 'Llamada de diagnóstico' and data['evento']['gracias'] == 'gw'
    assert [q['id'] for q in data['form']['preguntas']] == ['inv', 'sit']
    texto = str(data)
    assert '@equipo.com' not in texto and '5917000000' not in texto
    # La página de gracias a la que va después de agendar.
    assert client.get(URL + '/gracias/gw').status_code == 200


def test_cada_segmento_ve_los_horarios_de_su_estrategia(client, workshop, make_user, auth_headers):
    director = auth_headers(make_user(role='director_comercial', email='dir@equipo.com'))
    for resp, grupo in ((ALTA, 'alta'), (MEDIA, 'media'), (BAJA, 'baja')):
        lead = Lead(client, 1)
        lead.responder(resp)
        # Los horarios se encadenan (e95c8962): el día arranca a las 09:00 y sigue cada media sesión.
        assert lead.horarios()[0] == H9, grupo
        # La prueba por segmento de Thalamus muestra exactamente lo mismo que ve el lead.
        prueba = client.post('/api/agendas-v2/eventos/ew/prueba', json={'grupo': grupo}, headers=director).get_json()
        assert [s['t'] for s in prueba['slots']] == lead.horarios(todos=True) and prueba['grupo'] == grupo
    # Los que no agendan no ven horarios.
    for resp in (A_LA_ACADEMIA, NO_CALIFICA, SIN_PLATA):
        lead = Lead(client, 2)
        lead.responder(resp)
        assert lead.horarios(todos=True) == []


def test_un_workshop_completo(client, workshop, closers, google, whatsapp, discord):
    ids = {n: u.id for n, u in closers.items()}

    # 1. Alta desde Instagram: Máxima disponibilidad, el primero libre de la lista (Ana).
    l1 = Lead(client, 1)
    l1.abrir()
    l1.responder(ALTA)
    r = l1.agendar(H9)
    assert r.status_code == 201, r.get_json()
    assert r.get_json()['reserva']['consultor']['nombre']  # ve el nombre de su consultor
    a1 = _agenda_de('lead1@correo.com')
    assert a1.closer_id == ids['ana'] and a1.origin == 'workshop'
    assert a1.agenda_payload['segmento']['estrategia'] == 'Alta' and a1.agenda_payload['segmento']['regla'].startswith('si ')

    # 2. Otro Alta al mismo horario: Ana ya está ocupada, va a Beto.
    l2 = Lead(client, 2)
    l2.responder(ALTA)
    assert H9 in l2.horarios()
    assert l2.agendar(H9).status_code == 201
    assert _agenda_de('lead2@correo.com').closer_id == ids['beto']

    # 3. Un tercer Alta ya no ve las 09:00 (los dos están ocupados) y si la fuerza, se le avisa.
    l3 = Lead(client, 3)
    l3.responder(ALTA)
    h3 = l3.horarios()
    assert h3 and H9 not in h3
    assert l3.agendar(H9).status_code == 409
    assert l3.agendar(h3[0]).status_code == 201
    assert _agenda_de('lead3@correo.com').closer_id == ids['ana']

    # 4. Media desde la grabación: Distribuida entre Beto y Caro; Caro tiene menos agendas.
    l4 = Lead(client, 4, origen='grabacion')
    l4.responder(MEDIA)
    t4 = l4.horarios()[0]
    assert l4.agendar(t4).status_code == 201
    a4 = _agenda_de('lead4@correo.com')
    assert a4.closer_id == ids['caro'] and a4.origin == 'workshop_landing'
    assert a4.agenda_payload['segmento']['estrategia'] == 'Media'

    # 5. Ninguna regla: «Todo lo demás» → Baja (Caro, hasta llenarse). Lo que tomó el 4 ya está ocupado.
    l5 = Lead(client, 5)
    l5.responder(BAJA)
    h5 = l5.horarios()
    assert h5 and t4 not in h5
    assert l5.agendar(h5[-1]).status_code == 201
    a5 = _agenda_de('lead5@correo.com')
    assert a5.closer_id == ids['caro'] and a5.agenda_payload['segmento']['regla'] == 'el resto'

    # 6. Los que no agendan: la regla de la Academia, la de «No califica» y la respuesta que descalifica.
    l6 = Lead(client, 6)
    l6.responder(A_LA_ACADEMIA)
    assert l6.agendar(None).get_json() == {'descalificada': True, 'redirigir': 'https://academy.thelearnation.com/'}
    l7 = Lead(client, 7)
    l7.responder(NO_CALIFICA)
    assert l7.agendar(None).get_json() == {'descalificada': True}
    l8 = Lead(client, 8, origen='grabacion')
    l8.responder(SIN_PLATA)
    assert l8.agendar(None).get_json() == {'descalificada': True}
    # Aunque alguno fuerce un horario, no agenda.
    assert l7.agendar(H11).get_json() == {'descalificada': True}

    # --- Lo que quedó ---
    agendas = Appointment.query.all()
    assert len(agendas) == 5
    for a in agendas:
        p = a.agenda_payload
        assert p['funnel_tipo'] == 'workshop' and p['evento_slug'] == 'llamada' and p['duracion_min'] == 45
        assert p['descalificada'] is False and a.google_event_id and p['meet']
        assert a.client.formulario_payload['respuestas']
    # El registro de agendas espeja cada una con su fuente.
    assert sorted(f.nombre for f in FinancialAgenda.query.all()) == ['workshop'] * 4 + ['workshop_landing']
    # Un evento de Calendar por agenda, en el calendario de su closer, invitando al lead, de 45 minutos.
    assert len(google['crear']) == 5
    for evt in google['crear']:
        assert evt['invitado'].startswith('lead') and (evt['fin'] - evt['inicio']).seconds == 45 * 60
    assert sorted(e['user_id'] for e in google['crear']) == sorted([ids['ana'], ids['beto'], ids['ana'], ids['caro'], ids['caro']])
    # Cada closer recibe su aviso por WhatsApp y el equipo por Discord; los descalificados avisan solo a Discord.
    assert sorted(whatsapp) == sorted(['59170000000', '59170000001', '59170000000', '59170000002', '59170000002'])
    titulos = [m['embeds'][0]['title'] for m in discord]
    assert len([t for t in titulos if not t.startswith('No calificó')]) == 5
    # Los descalificados quedan como clientes con su formulario, sin agenda.
    for email in ('lead6@correo.com', 'lead7@correo.com', 'lead8@correo.com'):
        c = Client.query.filter_by(email=email).one()
        assert c.formulario_payload['descalificada'] is True and not Appointment.query.filter_by(client_id=c.id).count()
    # Los intentos se cierran: el que agendó se borra; el que no calificó queda como descalificado.
    assert SchedIntento.query.filter_by(estado='incompleta').count() == 0

    # --- El panel del workshop: aplicaciones y agendas, separadas en vivo y grabación ---
    from app.services.workshop_metrics_service import _agendas_por_embudo, _contar_aplicaciones

    dia = date(2026, 10, 5)
    assert _contar_aplicaciones(dia, dia, LA_PAZ) == {'vivo': 6, 'landing': 2}
    # La fecha de alta del registro de agendas sale del reloj real (su default no lo congela freezegun):
    # la ventana va del día del taller al día en que se dieron de alta.
    alta = max(f.created_at for f in FinancialAgenda.query.all())
    hasta = max(dia, pytz.UTC.localize(alta).astimezone(LA_PAZ).date())
    embudo = _agendas_por_embudo(dia, hasta, LA_PAZ)
    assert (len(embudo['vivo']), len(embudo['landing'])) == (4, 1)


def test_el_lead_que_vuelve_al_link_ve_su_agenda_y_no_duplica(client, workshop):
    l1 = Lead(client, 1)
    l1.responder(ALTA)
    assert l1.agendar(H9).status_code == 201
    # Vuelve a abrir el link: se lo reconoce por su correo y ve su próxima agenda.
    r = client.post(URL + '/eventos/ew/conocido', json={'email': 'lead1@correo.com'}).get_json()
    assert r['conocido'] is True and r['proxima']['inicio'] == ISO[H9]
    # Confirma dos veces el mismo horario (doble clic, reintento): una sola agenda.
    assert l1.agendar(H9).status_code in (200, 201)
    assert Appointment.query.count() == 1
    # Quiere otro horario: se le pregunta antes de tocar nada.
    r = l1.agendar(H10)
    assert r.status_code == 409 and r.get_json()['code'] == 'ya_tiene'
    assert Appointment.query.count() == 1


def test_un_cambio_sin_publicar_no_llega_al_lead(client, workshop):
    servicio.guardar_doc('eventos', 'ew', {'nombre': 'Cambiado', 'duracion': 30}, parcial=True)
    data = Lead(client, 1).abrir()
    assert data['evento']['nombre'] == 'Llamada de diagnóstico' and data['evento']['duracion'] == 45
    # Pausar el funnel corta el link.
    servicio.guardar_doc('funnels', 'fw', {'activo': False}, parcial=True)
    assert client.get(LINK).status_code == 404
