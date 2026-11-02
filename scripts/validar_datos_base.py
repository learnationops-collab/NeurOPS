"""Base de `validar_datos.py`: la app mínima de solo lectura, el guardia y el informe (ver ese archivo)."""
import io
import os
import sys
import traceback
from collections import defaultdict
from datetime import date

from flask import Flask
from sqlalchemy import event, text

from app import db

_EMPIEZA_LECTURA = ('select', 'with', 'show', 'begin', 'rollback')
_KEEPALIVE = dict(keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5, connect_timeout=30)


def _url():
    url = os.environ.get('DATABASE_URL')
    if not url:
        sys.exit('Falta DATABASE_URL.')
    return url.replace('postgres://', 'postgresql://', 1)


def armar_app():
    app = Flask('validar_datos')
    es_pg = _url().startswith('postgresql')
    opciones = {'pool_pre_ping': True}
    if es_pg:
        opciones['connect_args'] = {**_KEEPALIVE, 'options': '-c default_transaction_read_only=on'}
    app.config.update(SQLALCHEMY_DATABASE_URI=_url(), SQLALCHEMY_TRACK_MODIFICATIONS=False,
                      SQLALCHEMY_ENGINE_OPTIONS=opciones, SECRET_KEY='solo-lectura')
    db.init_app(app)
    return app, es_pg


def poner_guardia(es_pg):
    @event.listens_for(db.engine, 'before_cursor_execute')
    def _solo_lectura(conn, cursor, statement, parameters, context, executemany):
        if not statement.lstrip().lower().startswith(_EMPIEZA_LECTURA):
            raise RuntimeError(f'Guardia de solo lectura: se rechazó {statement[:60]!r}')
    if es_pg:
        activo = db.session.execute(text('SHOW transaction_read_only')).scalar()
        if activo != 'on':
            sys.exit('La sesión no quedó en solo lectura: no sigo.')
        db.session.rollback()


# --- Informe ---------------------------------------------------------------------------------------------------

class Informe:
    def __init__(self):
        self.items = []

    def _agregar(self, **datos):
        self.items.append(datos)
        marca = {'OK': 'ok ', 'DIFERENCIA': 'DIF', 'INFO': 'inf', 'ERROR': 'ERR'}[datos['estado']]
        print(f"  [{marca}] {datos['grupo']} · {datos['titulo']}", file=sys.stderr)

    def cruce(self, grupo, titulo, a, b, rot_a, rot_b, tol=0.01, nota='', ejemplos=None, modo='=', periodo=''):
        """Compara dos cifras. modo '=': deben ser iguales; '<=': `a` no puede pasar de `b`."""
        dif = round((a or 0) - (b or 0), 2)
        malo = abs(dif) > tol if modo == '=' else dif > tol
        self._agregar(grupo=grupo, titulo=titulo, estado='DIFERENCIA' if malo else 'OK', a=a, b=b, rot_a=rot_a,
                      rot_b=rot_b, dif=dif, tol=tol, nota=nota, ejemplos=ejemplos or [], modo=modo, periodo=periodo)

    def cuenta(self, grupo, titulo, n, nota='', ejemplos=None, periodo='', dinero=None, info=False):
        """Un conteo de casos raros: 0 es lo esperado; más de 0 es una diferencia (o dato informativo)."""
        estado = 'OK' if not n else ('INFO' if info else 'DIFERENCIA')
        self._agregar(grupo=grupo, titulo=titulo, estado=estado, a=n, b=0, rot_a='casos', rot_b='esperado', dif=n,
                      tol=0, nota=nota, ejemplos=ejemplos or [], modo='=', periodo=periodo, dinero=dinero)

    def info(self, grupo, titulo, texto, periodo=''):
        self._agregar(grupo=grupo, titulo=titulo, estado='INFO', a=None, b=None, rot_a='', rot_b='', dif=0, tol=0,
                      nota=texto, ejemplos=[], modo='=', periodo=periodo)

    def error(self, grupo, titulo, exc, periodo=''):
        ultima = traceback.format_exception_only(type(exc), exc)[-1].strip()
        self._agregar(grupo=grupo, titulo=titulo, estado='ERROR', a=None, b=None, rot_a='', rot_b='', dif=0, tol=0,
                      nota=f'No se pudo correr: {ultima}', ejemplos=[], modo='=', periodo=periodo)


def chequeo(grupo, titulo):
    """Corre el cruce aislado: un error lo anota y sigue con el resto."""
    def envolver(fn):
        def correr(inf, *args):
            try:
                fn(inf, *args)
            except Exception as exc:  # noqa: BLE001  (se informa en el reporte, no se silencia)
                db.session.rollback()
                inf.error(grupo, titulo, exc, periodo=_etiqueta(args))
        correr.__name__ = fn.__name__
        return correr
    return envolver


def _etiqueta(args):
    fechas = [a for a in args if isinstance(a, date)]
    return f'{fechas[0]} → {fechas[1]}' if len(fechas) == 2 else ''


def _dinero(x):
    return f'{x:,.2f}' if isinstance(x, float) or (isinstance(x, int) and abs(x) > 99999) else str(x)


def renderizar(inf, periodos, inicio):
    salida = io.StringIO()
    p = lambda *a: print(*a, file=salida)  # noqa: E731
    cuenta = defaultdict(int)
    for it in inf.items:
        cuenta[it['estado']] += 1
    p(f'# Validación de datos · {inicio:%Y-%m-%d %H:%M} UTC')
    p(f"\nPeríodos: {', '.join(f'{d} → {h}' for d, h in periodos)}. Solo lectura. "
      f"**{cuenta['DIFERENCIA']} diferencias**, {cuenta['OK']} cruces que cierran, {cuenta['INFO']} datos informativos, "
      f"{cuenta['ERROR']} cruces que no corrieron.\n")
    peso = lambda it: (abs(it['dif']) / max(1.0, abs(it['a'] or 0), abs(it['b'] or 0)), abs(it['dif']))  # noqa: E731
    difs = sorted((i for i in inf.items if i['estado'] == 'DIFERENCIA'), key=peso, reverse=True)
    if difs:
        p('## Diferencias, de mayor a menor\n\n| # | Cruce | Período | A | B | Diferencia |\n|---|---|---|---|---|---|')
        for n, it in enumerate(difs, 1):
            p(f"| {n} | {it['grupo']} · {it['titulo']} | {it['periodo']} | {_dinero(it['a'])} | {_dinero(it['b'])} | {_dinero(it['dif'])} |")
    for grupo in sorted({i['grupo'] for i in inf.items}):
        p(f'\n## {grupo}')
        for it in (i for i in inf.items if i['grupo'] == grupo):
            p(f"\n### [{it['estado']}] {it['titulo']}" + (f" · {it['periodo']}" if it['periodo'] else ''))
            if it['a'] is not None and it['rot_a'] != 'casos':
                lim = '≤' if it['modo'] == '<=' else '='
                p(f"- **A** ({it['rot_a']}): {_dinero(it['a'])}\n- **B** ({it['rot_b']}): {_dinero(it['b'])}\n"
                  f"- Diferencia A − B: {_dinero(it['dif'])} (se espera A {lim} B, tolerancia {it['tol']})")
            elif it['a'] is not None:
                p(f"- Casos: {it['a']}" + (f" · monto ${it['dinero']:,.2f}" if it.get('dinero') is not None else ''))
            if it['nota']:
                p(f"- {it['nota']}")
            for e in it['ejemplos'][:30]:
                p(f'  - {e}')
    return salida.getvalue()
