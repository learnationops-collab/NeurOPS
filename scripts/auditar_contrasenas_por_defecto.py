"""Audita que cuentas siguen con una contrasena por defecto CONOCIDA. SOLO LECTURA.

El codigo de NeurOPS uso, en distintos momentos, claves fijas para crear cuentas (la importacion de
closers y setters, el alta de usuarios sin clave, el endpoint fix-auth que ya no existe, scripts de
semilla). Esas claves siguen en el historial de git: cualquiera que lo haya visto puede entrar con ellas
a una cuenta que nunca las cambio. Este script las prueba contra cada cuenta de la tabla users.

Que hace y que NO hace:
  - Lee la tabla users con una conexion de SOLO LECTURA (una unica consulta SELECT; nunca escribe).
  - Imprime id, usuario, email, rol y estado de las cuentas afectadas y de donde salia la clave.
    NUNCA imprime claves ni hashes.
  - No importa la app: create_app() arranca el scheduler de WhatsApp. Usa SQLAlchemy directo.

Uso (con el entorno virtual activo):
    python scripts/auditar_contrasenas_por_defecto.py --url sqlite:///instance/local.db
    DATABASE_URL=postgresql://...  python scripts/auditar_contrasenas_por_defecto.py

Codigo de salida: 0 si ninguna cuenta tiene una clave por defecto; 1 si alguna la tiene; 2 si no pudo
leer la base. Si hay cuentas afectadas: cambiarles la clave desde Equipo (o desactivarlas) y volver a
correrlo hasta que salga 0.
"""
import argparse
import os
import sys

from sqlalchemy import create_engine, text
from werkzeug.security import check_password_hash

# Clave -> de donde salia. Todas estan en el historial de git, asi que se las da por conocidas.
CLAVES_POR_DEFECTO = {
    'NeurOPS2025!': 'importacion de agendas, ventas o setters (cuentas creadas por nombre)',
    '12345678': 'alta de usuario sin clave (UserService.create_user)',
    'admin123': 'fix-auth y scripts de semilla (cuenta admin)',
    'closer123': 'fix-auth y scripts de semilla (cuenta closer)',
    'salesadmin123': 'script create_sales_admin',
    'temporal123': 'importacion antigua de usuarios',
    'temp1234': 'importacion antigua de usuarios',
}
# Cuentas que creaba el endpoint fix-auth. Si existen y nadie las creo a proposito, hay que revisarlas
# aunque hoy su clave sea otra.
CUENTAS_DE_FIX_AUTH = ('admin@neurops.com', 'closer@neurops.com')

CONSULTA = 'SELECT id, username, email, role, is_active, password_hash FROM users ORDER BY id'


def buscar_cuentas_con_clave_conocida(filas, candidatas=None):
    """(afectadas, sin_clave, de_fix_auth) a partir de filas (id, username, email, role, is_active, hash).

    `afectadas`: una entrada por cuenta cuya clave es alguna candidata, con `origen` (de donde salia).
    `sin_clave`: cuantas cuentas no tienen clave guardada (no pueden entrar: solo informativo).
    `de_fix_auth`: cuentas con el email de las que creaba fix-auth, tengan la clave que tengan."""
    candidatas = CLAVES_POR_DEFECTO if candidatas is None else candidatas
    afectadas, de_fix_auth, sin_clave = [], [], 0
    for id_, username, email, role, is_active, password_hash in filas:
        cuenta = {'id': id_, 'username': username, 'email': email, 'role': role, 'is_active': is_active}
        if email in CUENTAS_DE_FIX_AUTH:
            de_fix_auth.append(cuenta)
        if not password_hash:
            sin_clave += 1
            continue
        for clave, origen in candidatas.items():
            if check_password_hash(password_hash, clave):
                afectadas.append({**cuenta, 'origen': origen})
                break
    return afectadas, sin_clave, de_fix_auth


def abrir_solo_lectura(url):
    """Conexion que no puede escribir aunque el codigo lo intentara: lo impone el propio motor."""
    if url.startswith('postgres://'):  # el esquema que a veces entrega Railway; SQLAlchemy 2 exige postgresql://
        url = 'postgresql://' + url[len('postgres://'):]
    motor = create_engine(url)
    conexion = motor.connect()
    if motor.dialect.name == 'postgresql':
        conexion.execute(text('SET TRANSACTION READ ONLY'))  # debe ser lo primero de la transaccion
    elif motor.dialect.name == 'sqlite':
        conexion.execute(text('PRAGMA query_only = ON'))
    return conexion


def _estado(cuenta):
    return 'activa' if cuenta['is_active'] or cuenta['is_active'] is None else 'DESACTIVADA'


def _linea(cuenta):
    return (f"  id={cuenta['id']}  usuario={cuenta['username']}  email={cuenta['email'] or '-'}  "
            f"rol={cuenta['role']}  {_estado(cuenta)}")


def main(argv=None, salida=None):
    salida = salida or sys.stdout
    analizador = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    analizador.add_argument('--url', default=os.environ.get('DATABASE_URL'),
                            help='URL de la base (por defecto, la variable de entorno DATABASE_URL)')
    argumentos = analizador.parse_args(argv)
    if not argumentos.url:
        print('Falta la base: pasa --url o define DATABASE_URL.', file=salida)
        return 2

    try:
        conexion = abrir_solo_lectura(argumentos.url)
        try:
            filas = [tuple(fila) for fila in conexion.execute(text(CONSULTA))]
        finally:
            conexion.rollback()  # nunca se confirma nada
            conexion.close()
    except Exception as error:  # noqa: BLE001 - se informa el tipo, sin la URL (lleva la clave de la base)
        print(f'No se pudo leer la base ({type(error).__name__}). Revisa la URL y la conexion.', file=salida)
        return 2

    afectadas, sin_clave, de_fix_auth = buscar_cuentas_con_clave_conocida(filas)

    print(f'Cuentas revisadas: {len(filas)}', file=salida)
    if afectadas:
        print(f'\nATENCION: {len(afectadas)} cuenta(s) con una clave por defecto conocida:', file=salida)
        for cuenta in afectadas:
            print(f"{_linea(cuenta)}\n      clave por defecto de: {cuenta['origen']}", file=salida)
        print('\nCambiales la clave (o desactivalas) y vuelve a correr este script.', file=salida)
    else:
        print('Ninguna cuenta tiene una clave por defecto conocida.', file=salida)
    if de_fix_auth:
        print('\nAviso: existen cuentas con el email de las que creaba el endpoint fix-auth. Si nadie las creo '
              'a proposito, revisalas:', file=salida)
        for cuenta in de_fix_auth:
            print(_linea(cuenta), file=salida)
    if sin_clave:
        print(f'\nInformativo: {sin_clave} cuenta(s) sin clave guardada (no pueden iniciar sesion).', file=salida)
    return 1 if afectadas else 0


if __name__ == '__main__':
    sys.exit(main())
