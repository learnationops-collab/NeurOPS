"""Copia producción → la base local (SQLite) o la de staging (PostgreSQL de Railway).

    env/Scripts/python.exe -u scripts/actualizar_db.py --target local
    env/Scripts/python.exe -u scripts/actualizar_db.py --target staging

Producción se abre en SOLO LECTURA. El destino se reemplaza tabla por tabla, cada una en su propia
transacción: una tabla que no se pudo copiar queda como estaba, no vacía. Sale con código 1 si
alguna tabla falló o quedó vacía teniendo filas en producción.
"""
import glob
import os
import sqlite3
import sys
import tempfile
from datetime import datetime
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, select, text

# Añadir el directorio raíz al path para importar la app
current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

# `create_app()` arranca el scheduler de recordatorios por WhatsApp salvo que esto diga 'true', y
# el script lo llama dos veces (acá y en `normalizar_closers`). Correrlo sin la variable dejaba un
# scheduler vivo leyendo la copia recién hecha de producción: los seguimientos de clientes reales,
# con sus teléfonos. Hasta ahora dependía de acordarse de exportarla a mano.
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'

# BUG real encontrado (27/ago/2026): `config.py` calcula `SQLALCHEMY_DATABASE_URI` a nivel de
# módulo, en el momento en que se importa por primera vez — no en el momento en que Flask arma
# la app. `from app import create_app, db`, más abajo, dispara esa primera importación de
# `config.py` ANTES de que `actualizar()` llegue a pisar `DATABASE_URL` con el destino elegido
# (`--target staging`). Resultado: `--target staging` siempre terminaba escribiendo sobre la
# SQLite local, sin avisar. Se resuelve el target acá arriba, antes de cualquier import de `app`,
# para que `DATABASE_URL` ya tenga el valor correcto cuando `config.py` lo lea por primera vez.
load_dotenv()
_target_arg = 'local'
for _i, _a in enumerate(sys.argv):
    if _a == '--target' and _i + 1 < len(sys.argv):
        _target_arg = sys.argv[_i + 1]
    elif _a.startswith('--target='):
        _target_arg = _a.split('=', 1)[1]
if _target_arg in ('staging', 'testing'):
    _dest_url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
    if _dest_url:
        os.environ['DATABASE_URL'] = _dest_url

from app import create_app, db  # noqa: E402
from app import models as _modelos  # noqa: E402,F401  (registra todas las tablas en db.metadata)

# Filas por lote al copiar hacia SQLite: la tabla no se materializa entera en memoria.
LOTE = 2000
# Respaldos de la SQLite local que se conservan (el más viejo se borra).
RESPALDOS_A_CONSERVAR = 3


def safe(text):
    """Texto imprimible en la consola de Windows (cp1252). Los mensajes de error de SQLAlchemy
    incluyen las filas que fallaron, y ahí aparecen emojis y acentos de datos reales: sin esto
    el propio `print` del except revienta con UnicodeEncodeError y tapa el error original."""
    enc = (sys.stdout.encoding or 'utf-8')
    return str(text).encode(enc, errors='replace').decode(enc, errors='replace')


# Sin keepalives el proxy público de Railway corta las conexiones que tardan.
_KEEPALIVE = dict(keepalives=1, keepalives_idle=30, keepalives_interval=10,
                  keepalives_count=5, connect_timeout=30)
# Producción no se escribe nunca: cualquier INSERT/UPDATE/DELETE en esta sesión falla en el
# servidor, no depende de que el código se porte bien.
_SOLO_LECTURA = '-c default_transaction_read_only=on'


def _identidad(url):
    """(motor, host, puerto, base) de una URL, para comparar bases sin mirar credenciales."""
    u = urlparse(str(url))
    motor = u.scheme.split('+')[0]
    if motor == 'sqlite':
        ruta = str(url).split(':///', 1)[-1]
        return ('sqlite', os.path.normcase(os.path.abspath(ruta)) if ruta else ':memory:', None, None)
    motor = 'postgresql' if motor in ('postgres', 'postgresql') else motor
    return (motor, (u.hostname or '').lower(), u.port or 5432, u.path.lstrip('/'))


def _misma_base(url_a, url_b):
    return _identidad(url_a) == _identidad(url_b)


def _respaldar_sqlite(ruta):
    """Copia la SQLite local a `respaldos/` antes de pisarla y deja solo las últimas.

    La base local puede tener cosas que producción no (usuarios de prueba, datos a medio probar).
    Se usa la API de backup de SQLite y no una copia del archivo: es consistente aunque el
    servidor de desarrollo la tenga abierta.
    """
    carpeta = os.path.join(os.path.dirname(ruta), 'respaldos')
    os.makedirs(carpeta, exist_ok=True)
    base = os.path.splitext(os.path.basename(ruta))[0]
    destino = os.path.join(carpeta, f'{base}-{datetime.now():%Y%m%d-%H%M%S}.db')
    origen, copia = sqlite3.connect(ruta), sqlite3.connect(destino)
    try:
        origen.backup(copia)
    finally:
        copia.close()
        origen.close()
    for viejo in sorted(glob.glob(os.path.join(carpeta, f'{base}-*.db')))[:-RESPALDOS_A_CONSERVAR]:
        os.remove(viejo)
    return destino


def _columnas(conn, tabla):
    with conn.cursor() as cur:
        cur.execute("SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                    (tabla,))
        return [r[0] for r in cur.fetchall()]


class CopiadorPostgres:
    """Copia tablas entre dos PostgreSQL con COPY, reusando una conexión por punta.

    El camino por ORM (`query(Model).all()`) materializa la tabla entera en memoria del lado del
    cliente. Sobre el proxy público de Railway eso revienta con `server closed the connection
    unexpectedly` en cuanto la tabla es grande: el 23/09/2026 murió en landing_trackings (31k),
    manychat_leads (14k), lead_answers (15k) y financial_sales. COPY manda las filas por el
    socket sin materializarlas y con las mismas tablas no falló una sola vez.

    Las conexiones se abren una vez y se reusan. La primera versión abría un par por tabla: con
    85 tablas son 170 aperturas seguidas contra el proxy, que a mitad de camino empezó a
    rechazarlas con `timeout expired` y tumbó 9 tablas de la corrida.
    """

    def __init__(self, origen_url, destino_url):
        self.origen_url = origen_url
        self.destino_url = destino_url
        self.origen = None
        self.destino = None

    def _conectar(self):
        import psycopg2
        if self.origen is None or self.origen.closed:
            self.origen = psycopg2.connect(self.origen_url, options=_SOLO_LECTURA, **_KEEPALIVE)
            self.origen.set_session(readonly=True)
        if self.destino is None or self.destino.closed:
            self.destino = psycopg2.connect(self.destino_url, **_KEEPALIVE)
        return self.origen, self.destino

    def cerrar(self):
        for conn in (self.origen, self.destino):
            try:
                if conn is not None and not conn.closed:
                    conn.close()
            except Exception:
                pass
        self.origen = self.destino = None

    def copiar(self, tabla):
        """Devuelve cuántas filas quedaron en la tabla de destino."""
        import psycopg2
        # Que una conexión se haya caído entre tabla y tabla recién se descubre al usarla, así
        # que vale un reintento con conexiones nuevas antes de dar la tabla por perdida.
        for intento in (1, 2):
            try:
                return self._copiar(tabla)
            except psycopg2.Error:
                self.cerrar()
                if intento == 2:
                    raise

    def _copiar(self, tabla):
        import psycopg2
        origen, destino = self._conectar()
        try:
            cols_origen = _columnas(origen, tabla)
            cols_destino = _columnas(destino, tabla)
            # Intersección en el orden del destino: una columna que existe de un solo lado
            # (migración sin desplegar) no debe romper la copia de toda la tabla.
            cols = [c for c in cols_destino if c in cols_origen]
            if not cols:
                raise RuntimeError(f"{tabla}: sin columnas en común entre origen y destino")
            lista = ', '.join(f'"{c}"' for c in cols)

            with tempfile.TemporaryFile() as buf:
                with origen.cursor() as cur:
                    cur.copy_expert(
                        f'COPY (SELECT {lista} FROM "{tabla}") TO STDOUT WITH (FORMAT csv)', buf)
                origen.rollback()  # cierra la transacción de lectura; no deja nada abierto
                buf.seek(0)
                with destino.cursor() as cur:
                    # Apaga los triggers de FK durante la carga, así el orden entre tablas deja
                    # de importar. El rol `postgres` de Railway puede; si no, se sigue igual y el
                    # orden por dependencias de `db.metadata.sorted_tables` alcanza.
                    try:
                        cur.execute("SET session_replication_role = replica")
                    except psycopg2.Error:
                        destino.rollback()
                    # El borrado va en la misma transacción que la carga: si la copia falla, el
                    # rollback devuelve la tabla a como estaba en vez de dejarla vacía.
                    cur.execute(f'DELETE FROM "{tabla}"')
                    cur.copy_expert(f'COPY "{tabla}" ({lista}) FROM STDIN WITH (FORMAT csv)', buf)
                destino.commit()

            with destino.cursor() as cur:
                cur.execute(f'SELECT COUNT(*) FROM "{tabla}"')
                return cur.fetchone()[0]
        except Exception:
            try:
                destino.rollback()
            except Exception:
                pass
            raise


def _copiar_a_sqlite(prod_engine, tabla, cols_prod):
    """Reemplaza una tabla de la SQLite local con la de producción. Devuelve cuántas filas copió.

    Antes se leía con el ORM (`query(Model).all()`), que pide TODAS las columnas del modelo: una
    columna agregada en develop y todavía no desplegada hacía fallar la tabla entera, y como la
    limpieza global previa ya la había vaciado, quedaba vacía. Ahora se leen las columnas que
    existen de los dos lados (las nuevas toman su valor por defecto), en lotes, y el borrado y la
    carga van en la misma transacción: si algo falla, la tabla queda como estaba.

    Se pasa por las columnas de SQLAlchemy y no por SQL crudo porque son ellas las que convierten
    los tipos de Postgres a lo que SQLite guarda (fechas, JSON, booleanos, decimales).
    """
    comunes = [c for c in tabla.columns if c.name in cols_prod]
    if not comunes:
        raise RuntimeError(f'{tabla.name}: sin columnas en común entre producción y local')
    total = 0
    try:
        with prod_engine.connect() as origen:
            filas = origen.execution_options(stream_results=True, yield_per=LOTE).execute(
                select(*comunes))
            db.session.execute(tabla.delete())
            for lote in filas.mappings().partitions(LOTE):
                db.session.execute(tabla.insert(), [dict(f) for f in lote])
                total += len(lote)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return total


def _contar(conexion, nombre):
    return conexion.execute(text(f'SELECT COUNT(*) FROM "{nombre}"')).scalar()


def actualizar(target='local'):
    load_dotenv()
    prod_url = os.getenv('DATABASE_PRODUCTION')

    if not prod_url or "usuario:password" in prod_url:
        print("Error: DATABASE_PRODUCTION no está configurada correctamente en el archivo .env")
        return False

    if target in ('staging', 'testing'):
        dest_url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
        if not dest_url:
            print("Error: Configura DATABASE_STAGING en tu archivo .env con la URL de Postgres de Railway Testing.")
            return False
        os.environ['DATABASE_URL'] = dest_url
        target_name = "Railway Staging (PostgreSQL)"
    else:
        target_name = "Local"

    # Cada tabla que no se pudo copiar. El script solía terminar SIEMPRE con "finalizado con
    # éxito" aunque el bucle de copia hubiera impreso un `Error:` por tabla, así que una corrida
    # que dejó siete tablas vacías se leía igual que una corrida perfecta (pasó el 23/09/2026
    # contra staging). Ahora los fallos se juntan acá, se listan al final y el proceso sale con
    # código distinto de cero.
    fallos = []

    app = create_app()
    with app.app_context():
        destino_url = db.engine.url.render_as_string(hide_password=False)
        # El destino se vacía tabla por tabla: si por un .env mal copiado apunta a la misma base
        # que producción, esto borraría producción. Se compara host, puerto y base, no el texto
        # de la URL (la misma base puede escribirse con otro usuario o con `postgres://`).
        if _misma_base(destino_url, prod_url):
            print("Error: el destino es la MISMA base que producción. No se copia nada.")
            return False
        motor, host, _, base = _identidad(destino_url)
        print(f"--- Actualizando [{target_name}] desde producción ---")
        print(f"Destino: {motor} {host or ''} {base or ''}".rstrip())

        es_sqlite = db.engine.dialect.name == 'sqlite'
        if es_sqlite and db.engine.url.database:
            print(f"Respaldo previo de la base local: {_respaldar_sqlite(db.engine.url.database)}")

        try:
            from flask_migrate import upgrade as db_upgrade
            print("Asegurando estructura de tablas con migraciones...")
            db_upgrade()
        except Exception as mig_err:
            print(f"Advertencia al ejecutar migraciones previa a la sincronización: {mig_err}")

        prod_engine = create_engine(prod_url, pool_pre_ping=True,
                                    connect_args={'options': _SOLO_LECTURA, **_KEEPALIVE})

        # Todas las tablas de la app, ordenadas por dependencias (FK). Era una lista escrita a mano
        # que había que acordarse de actualizar con cada modelo nuevo: el 23/09 le faltaban 15 y
        # el 29/09, `ficha_opciones`. Incluye las tablas de asociación (`event_closers`).
        tablas = list(db.metadata.sorted_tables)

        # Solo se toca lo que se va a poder copiar: una tabla que existe acá pero todavía no en
        # producción (una migración desplegada en develop y no en main) se deja intacta.
        tablas_prod = set(inspect(prod_engine).get_table_names())
        ausentes = [t.name for t in tablas if t.name not in tablas_prod]
        if ausentes:
            print(f"Omitidas (no existen en producción, se dejan intactas): {', '.join(ausentes)}")
            tablas = [t for t in tablas if t.name in tablas_prod]

        if es_sqlite:
            insp = inspect(prod_engine)
            cols_prod = {t.name: {c['name'] for c in insp.get_columns(t.name)} for t in tablas}
            for t in tablas:
                print(f"Sincronizando {t.name}...", end=" ", flush=True)
                try:
                    print(f"Ok ({_copiar_a_sqlite(prod_engine, t, cols_prod[t.name])} registros)")
                except Exception as e:
                    fallos.append((t.name, safe(e)))
                    print(safe(f"Error: {e}"))
        else:
            copiador = CopiadorPostgres(prod_url, destino_url)
            try:
                for t in tablas:
                    print(f"Sincronizando {t.name}...", end=" ", flush=True)
                    try:
                        print(f"Ok ({copiador.copiar(t.name)} registros)")
                    except Exception as e:
                        fallos.append((t.name, safe(e)))
                        print(safe(f"Error: {e}"))
            finally:
                copiador.cerrar()

        # Contraste final contra producción: el log por tabla puede mentir por omisión (un error
        # entre ochenta líneas se pasa por alto). Se cuenta con `COUNT(*)` y no con el ORM, que
        # pide las columnas del modelo y falla en cuanto producción no tiene alguna.
        print("Verificando la copia contra producción...")
        with prod_engine.connect() as origen:
            for t in tablas:
                try:
                    n_prod = _contar(origen, t.name)
                    n_dest = _contar(db.session, t.name)
                except Exception as e:
                    db.session.rollback()
                    fallos.append((t.name, f"no se pudo verificar: {safe(e)}"))
                    continue
                if n_prod and not n_dest:
                    fallos.append((t.name, f"quedó VACÍA (producción tiene {n_prod})"))
                elif n_dest < n_prod:
                    # Producción sigue recibiendo datos mientras corre la copia, así que un
                    # faltante de unas pocas filas es deriva normal, no un fallo.
                    print(f"  {t.name}: {n_dest} de {n_prod} (faltan {n_prod - n_dest}, deriva en vivo)")
        prod_engine.dispose()

        # 3. Normalización post-sincronización de closers y alias
        try:
            from scripts.normalizar_closers import normalizar_closers
            normalizar_closers()
        except Exception as norm_err:
            print(f"Error al ejecutar normalización de closers: {norm_err}")

        # 4. Ajustar secuencias en PostgreSQL: las filas llegan con su `id`, así que la secuencia
        # queda atrás y el próximo INSERT chocaría con un id que ya existe.
        if not es_sqlite:
            print("Ajustando secuencias autonumeradas en PostgreSQL...")
            for t in tablas:
                if 'id' not in t.c:
                    continue
                try:
                    db.session.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{t.name}', 'id'), "
                        f"COALESCE(MAX(id), 1)) FROM \"{t.name}\""))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            print("Secuencias de PostgreSQL sincronizadas.")

        if fallos:
            print(f"--- Proceso finalizado CON {len(fallos)} ERROR(ES) ---")
            for tabla, err in fallos:
                print(f"  {tabla}: {err}")
            print("La base de destino NO es una copia fiel de producción. Revisá las tablas de arriba.")
            return False

        print("--- Proceso finalizado con éxito ---")
        return True


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Actualizar base de datos desde Producción hacia Local o Staging.")
    parser.add_argument('--target', choices=['local', 'staging', 'testing'], default='local',
                        help="Destino de la copia: 'local' (por defecto) o 'staging' (Railway Testing)")
    args = parser.parse_args()
    sys.exit(0 if actualizar(target=args.target) else 1)
