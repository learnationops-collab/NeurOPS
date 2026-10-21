"""Configuración de gunicorn (`gunicorn -c gunicorn.conf.py run:app`).

Hasta el 21/10/2026 Work corría con 1 proceso de 1 hilo: un pedido lento (Claude, Google, Meta) frenaba
Work para todos. Ahora son varios procesos con varios hilos. Las tareas de fondo arrancan en cada worker,
pero las que no pueden duplicarse corren en uno solo: el scheduler toma un candado de Postgres
(app/services/candado_pg.py) y el motor de Instagram tiene el suyo.

`WEB_CONCURRENCY` y `GUNICORN_THREADS` lo ajustan desde Railway sin deploy de código.
"""
import os

workers = int(os.environ.get('WEB_CONCURRENCY', 4))
threads = int(os.environ.get('GUNICORN_THREADS', 4))
timeout = 120
# Sin `preload_app`: los hilos del scheduler y de Instagram no sobreviven al fork del proceso maestro.
