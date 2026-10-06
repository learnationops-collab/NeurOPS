"""Catálogos fijos de Agendas 2.0. Port de core/catalogos.js: los mismos valores que el frontend.

Quedan afuera los que solo usa la pantalla (SECCIONES, ICO_EST, COLOR_EST).
"""

import re

from app.agendas_v2.nucleo.util import js_str

COLORES = ['azul', 'ambar', 'rosa', 'verde', 'violeta', 'turquesa']
PLANTILLAS_FUNNEL = ['Appointment Setting', 'Workshop', 'VSL', 'Webinar', 'Referidos', 'Reactivación']

# Zona por defecto del equipo y de los eventos: la misma que asume el backend actual
# (User.timezone y AGENDAS_SOURCE_TZ), para que una hora signifique lo mismo en los dos lados.
TZ_DEF = 'America/La_Paz'

TIPOS = [
    {'k': 'opciones', 'n': 'Opción única', 'ico': 'opciones', 'ph': ''},
    {'k': 'lista', 'n': 'Desplegable', 'ico': 'lista', 'ph': 'Escribí para buscar'},
    {'k': 'texto', 'n': 'Texto corto', 'ico': 'texto', 'ph': 'Escribí tu respuesta'},
    {'k': 'parrafo', 'n': 'Párrafo', 'ico': 'parrafo', 'ph': 'Escribí tu respuesta'},
]
TIPOS_CONTACTO = {'telefono': {'ph': ''}, 'email': {'ph': 'nombre@correo.com'}, 'instagram': {'ph': 'tu.usuario'}}


def tipo(k):
    t = next((t for t in TIPOS if t['k'] == k), None)
    return t or {
        'k': k,
        'n': k,
        'ico': 'texto',
        'ph': TIPOS_CONTACTO.get(k, {}).get('ph', '') if isinstance(k, str) else '',
    }


def con_opciones(k):
    return k == 'opciones' or k == 'lista'


# Datos de contacto: siempre se piden, en este orden. Solo se elige si son obligatorios.
CONTACTO = [
    {
        'k': 'nombre',
        'tipo': 'texto',
        'n': 'Nombre',
        'ico': 'user',
        'titulo': '¿Cómo te llamás?',
        'placeholder': 'Nombre y apellido',
    },
    {
        'k': 'telefono',
        'tipo': 'telefono',
        'n': 'WhatsApp',
        'ico': 'whatsapp',
        'titulo': '{nombre}, ¿a qué WhatsApp te escribimos?',
        'ayuda': 'Por ahí te confirmamos la llamada.',
    },
    {
        'k': 'email',
        'tipo': 'email',
        'n': 'Correo',
        'ico': 'mail',
        'titulo': '¿Cuál es tu correo?',
        'placeholder': 'nombre@correo.com',
    },
    {
        'k': 'instagram',
        'tipo': 'instagram',
        'n': 'Instagram',
        'ico': 'instagram',
        'titulo': '¿Cuál es tu Instagram?',
        'placeholder': 'tu.usuario',
    },
]
FIN_DEF = {
    'titulo': 'Gracias por tu sinceridad',
    'texto': 'Por ahora no vamos a agendar la sesión. Te mandamos por email la ruta para que sigas avanzando.',
}
DURACIONES = [15, 30, 45, 60, 90]
DIAS = [
    {'d': 1, 'c': 'L', 'n': 'lunes'},
    {'d': 2, 'c': 'M', 'n': 'martes'},
    {'d': 3, 'c': 'M', 'n': 'miércoles'},
    {'d': 4, 'c': 'J', 'n': 'jueves'},
    {'d': 5, 'c': 'V', 'n': 'viernes'},
    {'d': 6, 'c': 'S', 'n': 'sábado'},
    {'d': 0, 'c': 'D', 'n': 'domingo'},
]
HORAS = [f'{i:02d}:{m}' for i in range(24) for m in ('00', '30')] + ['24:00']


def a_min(h):
    """'HH:MM' → minutos. Solo se usa con valores de HORAS (ya normalizados)."""
    p = js_str(h).split(':')
    hh = int(p[0]) if p[0].isdigit() else 0
    mm = int(p[1]) if len(p) > 1 and p[1].isdigit() else 0
    return hh * 60 + mm


ESTRATEGIAS = {'llenar': 'Llenar en orden', 'horario': 'Por horario', 'repartir': 'Repartir parejo'}
MS_U = {'min': 60000, 'h': 3600000, 'd': 86400000}

PAISES = [
    {
        'c': 'AR',
        'n': 'Argentina',
        'd': '+54',
        'ej': '11 2345 6789',
        'z': [['America/Argentina/Buenos_Aires', 'Argentina', 'hora de Argentina']],
    },
    {
        'c': 'BO',
        'n': 'Bolivia',
        'd': '+591',
        'ej': '7123 4567',
        'z': [['America/La_Paz', 'Bolivia', 'hora de Bolivia']],
    },
    {
        'c': 'BR',
        'n': 'Brasil',
        'd': '+55',
        'ej': '11 91234 5678',
        'z': [
            ['America/Sao_Paulo', 'Brasília', 'hora de Brasília'],
            ['America/Manaus', 'Manaos', 'hora de Manaos'],
            ['America/Rio_Branco', 'Acre', 'hora de Acre'],
        ],
    },
    {'c': 'CL', 'n': 'Chile', 'd': '+56', 'ej': '9 1234 5678', 'z': [['America/Santiago', 'Chile', 'hora de Chile']]},
    {
        'c': 'CO',
        'n': 'Colombia',
        'd': '+57',
        'ej': '301 234 5678',
        'z': [['America/Bogota', 'Colombia', 'hora de Colombia']],
    },
    {
        'c': 'CR',
        'n': 'Costa Rica',
        'd': '+506',
        'ej': '8312 3456',
        'z': [['America/Costa_Rica', 'Costa Rica', 'hora de Costa Rica']],
    },
    {
        'c': 'EC',
        'n': 'Ecuador',
        'd': '+593',
        'ej': '99 123 4567',
        'z': [['America/Guayaquil', 'Ecuador', 'hora de Ecuador']],
    },
    {
        'c': 'MX',
        'n': 'México',
        'd': '+52',
        'ej': '55 1234 5678',
        'z': [
            ['America/Mexico_City', 'Centro', 'hora del centro de México'],
            ['America/Cancun', 'Quintana Roo', 'hora de Quintana Roo'],
            ['America/Mazatlan', 'Pacífico', 'hora del Pacífico mexicano'],
            ['America/Tijuana', 'Baja California', 'hora de Baja California'],
        ],
    },
    {
        'c': 'PY',
        'n': 'Paraguay',
        'd': '+595',
        'ej': '981 123 456',
        'z': [['America/Asuncion', 'Paraguay', 'hora de Paraguay']],
    },
    {'c': 'PE', 'n': 'Perú', 'd': '+51', 'ej': '912 345 678', 'z': [['America/Lima', 'Perú', 'hora de Perú']]},
    {
        'c': 'UY',
        'n': 'Uruguay',
        'd': '+598',
        'ej': '94 123 456',
        'z': [['America/Montevideo', 'Uruguay', 'hora de Uruguay']],
    },
    {
        'c': 'VE',
        'n': 'Venezuela',
        'd': '+58',
        'ej': '412 123 4567',
        'z': [['America/Caracas', 'Venezuela', 'hora de Venezuela']],
    },
    {
        'c': 'ES',
        'n': 'España',
        'd': '+34',
        'ej': '612 34 56 78',
        'z': [['Europe/Madrid', 'Península', 'hora de España'], ['Atlantic/Canary', 'Canarias', 'hora de Canarias']],
    },
    {
        'c': 'US',
        'n': 'Estados Unidos',
        'd': '+1',
        'ej': '(201) 555-0123',
        'z': [
            ['America/New_York', 'Este', 'hora del este de EE. UU.'],
            ['America/Chicago', 'Centro', 'hora del centro de EE. UU.'],
            ['America/Denver', 'Montaña', 'hora de la montaña de EE. UU.'],
            ['America/Los_Angeles', 'Pacífico', 'hora del Pacífico de EE. UU.'],
        ],
    },
]


def pais_de(c):
    return next((p for p in PAISES if p['c'] == c), PAISES[1])


ZONAS = [
    {'tz': z[0], 'c': p['c'], 'n': p['n'] + (' · ' + z[1] if len(p['z']) > 1 else '')} for p in PAISES for z in p['z']
]


def zona_valida(tz):
    return any(z['tz'] == tz for z in ZONAS)


def zona_por_telefono(numero):
    """La zona horaria del país del número (con código de país, con o sin +), o None. Si el país tiene
    varias zonas, la primera (la de su capital)."""
    digitos = re.sub(r'\D', '', str(numero or ''))
    pais = max(
        (p for p in PAISES if digitos and digitos.startswith(p['d'].lstrip('+'))),
        key=lambda p: len(p['d']),
        default=None,
    )
    return pais['z'][0][0] if pais else None


def zona_info(tz):
    for p in PAISES:
        for z in p['z']:
            if z[0] == tz:
                return {'c': p['c'], 'corto': z[1], 'largo': z[2]}
    ciudad = js_str(tz).split('/')[-1].replace('_', ' ')
    return {'c': '', 'corto': ciudad, 'largo': 'hora de ' + ciudad}


ALIAS_TZ = {
    'America/Monterrey': 'MX',
    'America/Merida': 'MX',
    'America/Chihuahua': 'MX',
    'America/Hermosillo': 'MX',
    'America/Bahia': 'BR',
    'America/Fortaleza': 'BR',
    'America/Recife': 'BR',
    'America/Belem': 'BR',
    'America/Maceio': 'BR',
    'America/Cuiaba': 'BR',
    'America/Campo_Grande': 'BR',
    'America/Porto_Velho': 'BR',
    'America/Phoenix': 'US',
    'America/Detroit': 'US',
}


def detectar_pais(tz=''):
    """País y zona del lead a partir de la zona de su navegador. Si no la reconoce, cae en la del equipo."""
    tz = tz if isinstance(tz, str) else ''
    if any(z['tz'] == tz for z in ZONAS):
        return {'c': next(z['c'] for z in ZONAS if z['tz'] == tz), 'tz': tz}
    if re.match(r'America/(Argentina/|Buenos_Aires)', tz):
        return {'c': 'AR', 'tz': 'America/Argentina/Buenos_Aires'}
    if tz in ALIAS_TZ:
        return {'c': ALIAS_TZ[tz], 'tz': pais_de(ALIAS_TZ[tz])['z'][0][0]}
    return {'c': 'BO', 'tz': TZ_DEF}


# Permisos por rol, agrupados por sección.
PERMISOS = [
    {
        'sec': 'forms',
        'n': 'Forms',
        'ico': 'pregunta',
        'items': [
            ['forms.ver', 'Ver formularios'],
            ['forms.editar', 'Crear y editar preguntas'],
            ['forms.ruteo', 'Editar el ruteo'],
        ],
    },
    {
        'sec': 'team',
        'n': 'Team',
        'ico': 'users',
        'items': [
            ['team.ver', 'Ver el equipo'],
            ['team.sumar', 'Sumar personas'],
            ['team.horarios', 'Cambiar horarios de otros'],
            ['team.prioridades', 'Editar prioridades'],
        ],
    },
    {
        'sec': 'events',
        'n': 'Events',
        'ico': 'calendar',
        'items': [
            ['events.ver', 'Ver eventos'],
            ['events.editar', 'Crear y editar eventos'],
            ['events.publicar', 'Publicar cambios'],
            ['events.links', 'Crear links'],
        ],
    },
    {'sec': 'stats', 'n': 'Stats', 'ico': 'chart', 'items': [['stats.ver', 'Ver estadísticas']]},
    {
        'sec': 'conf',
        'n': 'Configuración',
        'ico': 'ajustes',
        'items': [
            ['conf.miembros', 'Miembros y roles'],
            ['conf.funnels', 'Funnels'],
            ['conf.integraciones', 'Integraciones'],
        ],
    },
]
PERM_KEYS = [i[0] for g in PERMISOS for i in g['items']]
PERM_VIEJOS = {
    'preguntas': ['forms.ver', 'forms.editar', 'forms.ruteo'],
    'team': ['team.ver', 'team.sumar', 'team.horarios', 'team.prioridades'],
    'eventos': ['events.ver', 'events.editar', 'events.publicar', 'events.links'],
    'estadisticas': ['stats.ver'],
    'configuracion': ['conf.miembros', 'conf.funnels', 'conf.integraciones'],
}
ICONOS_ROL = [
    ['estrella', 'Estrella'],
    ['chart', 'Gráfico'],
    ['whatsapp', 'Mensaje'],
    ['rayo', 'Rayo'],
    ['user', 'Persona'],
    ['users', 'Equipo'],
    ['calendar', 'Agenda'],
    ['funnel', 'Funnel'],
    ['ajustes', 'Engranaje'],
    ['fuego', 'Fuego'],
]


def ico_nombre(n):
    n = (js_str(n) if n else '').lower()
    if re.search('ceo|chief exec', n):
        return 'estrella'
    if re.search('director|sales officer|cso', n):
        return 'chart'
    if 'setter' in n:
        return 'rayo'
    if 'closer' in n:
        return 'whatsapp'
    return 'user'


def accesos_por_nombre(nombre):
    """Accesos que trae un rol nuevo según su nombre."""
    n = (js_str(nombre) if nombre else '').lower()
    if re.search('ceo|director|chief', n):
        return {'accesos': PERM_KEYS[:], 'atiende': False}
    if 'closer' in n:
        return {'accesos': ['team.ver', 'events.ver', 'stats.ver'], 'atiende': True}
    if 'setter' in n:
        return {'accesos': ['events.ver', 'events.links', 'stats.ver'], 'atiende': False}
    return {'accesos': ['stats.ver'], 'atiende': False}


INTEG_DEF = {
    'gcal': {'activo': False, 'crear': True, 'ocupado': True},
    'meet': {'activo': False, 'link': True},
    'pixel': {'activo': False, 'id': '', 'lead': True, 'schedule': True, 'nocalifica': False},
    'meta': {'activo': False, 'dataset': '', 'capi': True},
}
