"""Lista de clientes históricos para subir a Meta Ads como público personalizado
("customer list"). Dos alcances:

- 'ventas' (default): quien compró alguna vez — todas las ventas de
  `FinancialSale` (cualquier estado, reembolsos incluidos) y los clientes con
  una inscripción con pagos.
- 'todos': todo el que pasó por el sistema, haya comprado o no — además de lo
  anterior, toda la tabla `clients` y todas las agendas de `FinancialAgenda`.

Se deduplica por mail y, sin mail, por los últimos 8 dígitos del teléfono
(mismo criterio que `condiciones_de_identidad`).

El país no se guarda en ningún lado: se deduce del prefijo del teléfono y, si
no se puede, de la `zona_geografica` de alguna agenda de la misma persona. Si
ninguna de las dos es concluyente queda vacío en vez de adivinar.

Las columnas usan los nombres que Meta reconoce solo al subir la lista (email,
phone, fn, ln, country) — ver la ayuda de "Customer list" de Meta.
"""
import csv
import io

import pytz
from app.models import Client, Enrollment, Payment
from app.models.financial import FinancialAgenda, FinancialSale

# Prefijo -> (código ISO, cantidades de dígitos válidas con el prefijo incluido).
# El largo evita confundir un número local sin prefijo con otro país (ej. un
# celular mexicano de 10 dígitos que empieza con 55 no es de Brasil).
DIAL_CODES = {
    '54': ('AR', (12, 13)), '591': ('BO', (11,)), '55': ('BR', (12, 13)),
    '56': ('CL', (11,)), '57': ('CO', (12,)), '506': ('CR', (11,)),
    '53': ('CU', (10,)), '593': ('EC', (11, 12)), '503': ('SV', (11,)),
    '502': ('GT', (11,)), '504': ('HN', (11,)), '52': ('MX', (12, 13)),
    '505': ('NI', (11,)), '507': ('PA', (10, 11)), '595': ('PY', (12,)),
    '51': ('PE', (11,)), '598': ('UY', (11, 12)), '58': ('VE', (12,)),
    '34': ('ES', (11,)), '351': ('PT', (12,)), '39': ('IT', (11, 12, 13)),
    '33': ('FR', (11,)), '49': ('DE', (11, 12, 13, 14)), '44': ('GB', (12,)),
    '41': ('CH', (11,)), '31': ('NL', (11,)), '32': ('BE', (11,)),
    '61': ('AU', (11,)), '972': ('IL', (12,)),
}

# El prefijo 1 lo comparten EE.UU., Canadá, República Dominicana y Puerto Rico:
# se distinguen por el código de área.
NANP_AREA_CODES = {
    'DO': {'809', '829', '849'},
    'PR': {'787', '939'},
    'CA': {'204', '226', '236', '249', '250', '263', '289', '306', '343', '354',
           '365', '367', '368', '382', '403', '416', '418', '428', '431', '437',
           '438', '450', '460', '468', '474', '506', '514', '519', '548', '579',
           '581', '584', '587', '604', '613', '639', '647', '672', '683', '705',
           '709', '742', '753', '778', '780', '782', '807', '819', '825', '867',
           '873', '879', '902', '905'},
}

# Nombres de país tal como pueden venir escritos a mano en `zona_geografica`.
COUNTRY_NAMES = {
    'argentina': 'AR', 'bolivia': 'BO', 'brasil': 'BR', 'brazil': 'BR',
    'chile': 'CL', 'colombia': 'CO', 'costa rica': 'CR', 'cuba': 'CU',
    'ecuador': 'EC', 'el salvador': 'SV', 'guatemala': 'GT', 'honduras': 'HN',
    'mexico': 'MX', 'méxico': 'MX', 'nicaragua': 'NI', 'panama': 'PA',
    'panamá': 'PA', 'paraguay': 'PY', 'peru': 'PE', 'perú': 'PE',
    'uruguay': 'UY', 'venezuela': 'VE', 'españa': 'ES', 'spain': 'ES',
    'estados unidos': 'US', 'usa': 'US', 'eeuu': 'US', 'canada': 'CA',
    'canadá': 'CA', 'republica dominicana': 'DO', 'república dominicana': 'DO',
    'puerto rico': 'PR', 'portugal': 'PT', 'italia': 'IT', 'francia': 'FR',
    'alemania': 'DE',
}

# Zona horaria IANA -> país. Solo las zonas que pertenecen a un único país.
_TZ_TO_COUNTRY = {}
for _iso, _zonas in pytz.country_timezones.items():
    for _zona in _zonas:
        _TZ_TO_COUNTRY.setdefault(_zona.lower(), _iso)


def _clean(value):
    if value is None:
        return ''
    v = str(value).strip()
    return '' if v.lower() in ('n/a', 'none', 'null', 'desconocido', '-') else v


def _digits(phone):
    return ''.join(c for c in (phone or '') if c.isdigit())


def _phone_key(phone):
    d = _digits(phone)
    return d[-8:] if len(d) >= 8 else None


def country_from_phone(phone):
    d = _digits(phone)
    if d.startswith('00'):
        d = d[2:]
    if d.startswith('1') and len(d) == 11:
        area = d[1:4]
        for iso, codes in NANP_AREA_CODES.items():
            if area in codes:
                return iso
        return 'US'
    for size in (3, 2):
        match = DIAL_CODES.get(d[:size])
        if match and len(d) in match[1]:
            return match[0]
    return ''


def country_from_zone(zona):
    z = _clean(zona).lower()
    if not z:
        return ''
    return _TZ_TO_COUNTRY.get(z) or COUNTRY_NAMES.get(z, '')


class CustomerExportService:
    COLUMNS = ['email', 'phone', 'fn', 'ln', 'country']

    ALCANCES = ('ventas', 'todos')

    @staticmethod
    def _raw_customers(alcance):
        """Una fila por registro, sin deduplicar: (nombre, mail, teléfono)."""
        rows = []

        for s in FinancialSale.query.with_entities(
            FinancialSale.nombre_cliente, FinancialSale.mail_cliente, FinancialSale.telefono
        ):
            rows.append((_clean(s.nombre_cliente), _clean(s.mail_cliente), _clean(s.telefono)))

        clients = Client.query.with_entities(Client.full_name, Client.email, Client.phone)
        if alcance == 'ventas':
            clients = (
                clients.join(Enrollment, Enrollment.client_id == Client.id)
                .join(Payment, Payment.enrollment_id == Enrollment.id)
                .distinct()
            )
        for c in clients:
            rows.append((_clean(c.full_name), _clean(c.email), _clean(c.phone)))

        if alcance == 'todos':
            for a in FinancialAgenda.query.with_entities(
                FinancialAgenda.lead, FinancialAgenda.mail, FinancialAgenda.whatsapp
            ):
                # El nombre de la persona es `lead`; `nombre` a veces guarda al setter.
                rows.append((_clean(a.lead), _clean(a.mail), _clean(a.whatsapp)))

        return rows

    @staticmethod
    def get_customers(alcance='ventas'):
        customers = {}
        by_phone = {}

        for name, mail, phone in CustomerExportService._raw_customers(alcance):
            mail = mail.lower() if '@' in mail else ''
            pkey = _phone_key(phone)
            if not mail and not pkey:
                continue

            key = mail or by_phone.get(pkey) or f'tel:{pkey}'
            # La misma persona apareció antes solo con teléfono: pasa a indexarse por mail.
            previous = by_phone.get(pkey)
            if mail and previous and previous.startswith('tel:') and mail not in customers:
                customers[mail] = {**customers.pop(previous), 'email': mail}
                by_phone[pkey] = mail
            current = customers.setdefault(key, {'name': '', 'email': mail, 'phone': ''})
            # Completar lo que falte con lo que traiga la otra venta de la misma persona.
            current['name'] = current['name'] or name
            current['phone'] = current['phone'] or phone
            if pkey:
                by_phone.setdefault(pkey, key)

        # Respaldo para el país: la zona de alguna agenda de la misma persona.
        zone_by_mail, zone_by_phone = {}, {}
        agendas = FinancialAgenda.query.with_entities(
            FinancialAgenda.mail, FinancialAgenda.whatsapp, FinancialAgenda.zona_geografica
        ).filter(FinancialAgenda.zona_geografica.isnot(None)).all()
        for a_mail, a_phone, zona in agendas:
            iso = country_from_zone(zona)
            if not iso:
                continue
            if a_mail:
                zone_by_mail.setdefault(a_mail.strip().lower(), iso)
            pkey = _phone_key(a_phone)
            if pkey:
                zone_by_phone.setdefault(pkey, iso)

        result = []
        for c in customers.values():
            parts = c['name'].split()
            country = (
                country_from_phone(c['phone'])
                or zone_by_mail.get(c['email'])
                or zone_by_phone.get(_phone_key(c['phone']) or '')
                or ''
            )
            result.append({
                'email': c['email'],
                'phone': _digits(c['phone']),
                'fn': parts[0] if parts else '',
                'ln': ' '.join(parts[1:]),
                'country': country,
            })

        result.sort(key=lambda r: (r['country'] or 'ZZ', r['email'] or r['phone']))
        return result

    @staticmethod
    def to_csv(customers):
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=CustomerExportService.COLUMNS)
        writer.writeheader()
        writer.writerows(customers)
        # BOM para que Excel abra bien los acentos; Meta lo ignora.
        return '﻿' + out.getvalue()
