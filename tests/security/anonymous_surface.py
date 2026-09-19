"""Inventario de las rutas que responden a un visitante ANONIMO (sin cookie ni token).

Sale de pedir cada ruta registrada, con cada metodo, sin ninguna credencial: las que no devuelven 401/403
estan abiertas (las de /api/external/*, los crons y los webhooks quedan cerradas porque exigen su propio
secreto). Es un trinquete: una ruta nueva sin autenticacion rompe el test y hay que decidirla a
conciencia; proteger una existente obliga a quitarla de aca.
"""

# Deben funcionar sin sesion: arranque de la sesion, captacion de leads y reservas desde las paginas
# publicas, telemetria de la landing y callbacks de terceros.
PUBLICAS_POR_DISENO = frozenset({
    ('GET', '/api/auth/csrf-token'),
    ('GET', '/api/auth/debug'),
    ('POST', '/api/auth/login'),
    ('POST', '/api/auth/logout'),
    ('GET', '/api/health'),
    ('GET', '/api/manychat-webhook'),
    ('POST', '/api/manychat-webhook'),
    ('POST', '/api/public/assistant-applications'),
    ('POST', '/api/public/book'),
    # Pagina publica de reservas (BookingPage): el visitante carga el evento con sus preguntas y horarios y
    # comprueba si ya lo conocemos por email o Instagram para precargar el formulario. La comprobacion solo
    # devuelve las respuestas de la encuesta a un usuario o a un sistema con secreto, no a un anonimo.
    ('GET', '/api/public/funnel/<string:utm_source>'),
    ('POST', '/api/public/clients/check'),
    ('POST', '/api/public/job-applications'),
    ('POST', '/api/public/landing-session'),
    ('GET', '/api/public/slots'),
    ('POST', '/api/public/submit-lead'),
    ('POST', '/api/public/submit-survey'),
    ('POST', '/api/public/workshop-lead'),
    ('GET', '/api/public/workshop-lead/replay-config'),
    # Contador de prueba social de la landing: devuelve SOLO totales (total y ultimas 24 h).
    ('GET', '/api/public/workshop-lead/stats'),
    ('POST', '/api/v1/metrics/track-visit'),
    ('POST', '/api/workshop/interaction'),
    ('POST', '/api/workshop/plantilla-sent'),
    ('GET', '/google/callback'),
})

# Rutas de la herramienta interna que responden a CUALQUIERA en internet y no deberian. Estuvo llena: 91
# rutas (lecturas de ventas, nomina y clientes; altas, ediciones y BORRADOS de agendas, ventas, campanas y
# reportes; mantenimiento como repair-db, cleanup-*, migrate y records/clear; y la ingesta de n8n, que no
# llevaba ningun secreto) porque todo el blueprint `public` estaba sin autenticacion. Ahora la politica de
# app/access_policy.py exige sesion con rol o el secreto de ingesta. Debe seguir VACIA: una ruta nueva que
# responda a un anonimo se declara publica por diseno (arriba) o se agrega a la politica.
EXPUESTAS_SIN_AUTENTICACION = frozenset()
