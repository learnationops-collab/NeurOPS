# Learnation Ops

Plataforma de operaciones y gestión de leads para Learnation.

## Guía de Instalación y Despliegue Local

Sigue estos pasos para configurar el proyecto en tu entorno local (Windows).

### 1. Clonar el Repositorio

Abre tu terminal (PowerShell o Git Bash) y ejecuta:

```bash
git clone https://github.com/learnationops-collab/NeurOPS.git
cd NeurOPS
```

### 2. Crear Entorno Virtual

Es recomendable usar un entorno virtual para aislar las dependencias de Python.

```bash
# Crear entorno llamado 'env'
python -m venv env

# Activar entorno (Windows)
env\Scripts\activate
```

### 3. Instalar Dependencias del Backend

Instala las librerías necesarias listadas en `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 4. Instalar Dependencias del Frontend

Navega a la carpeta del frontend (React/Vite) e instala sus dependencias:

```bash
cd frontend
npm install
```

### 5. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (junto a `run.py`) con el siguiente contenido base:

```env
SECRET_KEY=tu_clave_secreta_super_segura
# Para local (SQLite):
DATABASE_URL=sqlite:///local.db
# Para Producción (PostgreSQL example):
# DATABASE_URL=postgresql://user:password@host:5432/dbname
FLASK_APP=run.py
FLASK_ENV=development
```

### 6. Inicializar Base de Datos y Migraciones

El proyecto usa Flask-Migrate (Alembic) para la base de datos (SQLite en local).

```bash
# Inicializar carpeta de migraciones (solo si no existe)
flask db init

# Crear migración inicial (y en cada cambio de app/models.py)
flask db migrate -m "Initial migration"

# Aplicar cambios a la base de datos (crea las tablas en local.db)
flask db upgrade
```

### 7. Sincronización de Datos (Producción -> Local / Staging)

Para importar los datos actualizados desde Producción hacia tu base de datos local o de pruebas (asegúrate de tener el entorno virtual activo):

```bash
# 1. Sincronizar a base de datos local (SQLite):
python scripts/actualizar_db.py

# 2. Sincronizar a base de datos de Testing/Staging en Railway:
# Requiere configurar DATABASE_STAGING en tu archivo .env
python scripts/actualizar_db.py --target staging
```

### 8. Crear Usuario Administrador

Hemos incluido un script para facilitar esto. Ejecuta en la raíz:

```bash
python scripts/create_admin.py
```
Sigue las instrucciones en pantalla.

### 9. Ejecutar el Entorno de Desarrollo

Para trabajar en local, debes levantar ambos servicios:

**Backend (API Flask):**
```bash
# Verifica que el entorno virtual esté activo
python run.py
```
La API estará expuesta en `http://localhost:5000`

**Frontend (SPA React/Vite):**
```bash
# En una nueva terminal
cd frontend
npm run dev
```
La interfaz estará expuesta en `http://localhost:5173`

---

## Tests

Los tests del backend usan **pytest** y corren contra una base SQLite en memoria: nunca leen el `.env`
real, nunca tocan una base real y la red está bloqueada (ver `tests/conftest.py`).

```bash
# Una sola vez, con el entorno virtual activo (las dependencias de test NO van a producción)
pip install -r requirements-dev.txt

# Toda la suite (~50 s)
python -m pytest

# Un archivo, o solo los tests cuyo nombre contenga una palabra
python -m pytest tests/services/test_agenda_time_service.py
python -m pytest -k atribucion

# Con cobertura de los servicios
python -m pytest --cov=app/services --cov-report=term-missing:skip-covered
```

- Pasa la cobertura **por directorio** (`--cov=app/services`), no como módulo con puntos
  (`--cov=app.services.x`): así `coverage` no importa `app` antes del aislamiento de `conftest.py`.
- Los `xfail` con motivo `BUG:` documentan errores conocidos (los de seguridad dicen `BUG DE SEGURIDAD`
  o `BUG CRITICO`). Son `strict`: cuando alguien arregla el bug, el test pasa a fallar y hay que quitarle
  la marca `xfail`. `python -m pytest -rx` los lista con su motivo.
- Estructura: `tests/services/` (lógica de cada servicio), `tests/api/` (endpoints con el cliente de
  Flask), `tests/security/` (autenticación, permisos, CSRF/CORS y secretos) y `tests/contracts/`
  (invariantes que deben cumplirse en todo `app/`, p. ej. que no haya nombres sin definir: un import que
  falta solo revienta al llamar a la ruta; ese test usa `ruff`, incluido en `requirements-dev.txt`).
  Cada archivo de test respeta el límite de 500 líneas.
- Trinquetes: `tests/security/anonymous_surface.py` inventaría las rutas que responden sin autenticar y
  `test_hardcoded_secrets.py` los secretos escritos en el código. Una ruta o un secreto nuevo rompe el
  test; proteger o quitar uno existente obliga a actualizar la lista.
- El cliente de tests limpia `g` en cada petición (Flask-Login guarda ahí `current_user`); sin eso el
  usuario de la primera petición de un test se quedaría pegado en las siguientes.

## Estructura del Proyecto

*   `app/`: Código fuente del Backend (Python/Flask)
    *   `api/`: Blueprints de la API (JSON endpoints)
    *   `models.py`: Definición de bases de datos
    *   `__init__.py`: Factory de la aplicación Flask
*   `frontend/`: Código fuente del Frontend (React/Vite)
    *   `src/`: Componentes, Pages, Contexts
    *   `package.json`: Dependencias de Node
*   `migrations/`: Archivos de control de versiones de BD (Alembic)
*   `instance/`: Base de datos local (SQLite `local.db`)
*   `scripts/`: Scripts de utilidad.

## Arquitectura y Despliegue

*   **Backend**: Python, Flask, SQLAlchemy. Funciona como un Monolito API (API RESTful JSON).
*   **Frontend**: Single Page Application (SPA) con React, Vite, Tailwind CSS y ShadcnUI.
*   **Producción**: En el entorno productivo, el backend Flask sirve los archivos estáticos compilados desde `frontend/dist` en la ruta `/`.
*   **Mantenimiento**: Ver los guidelines en la memoria y archivos de reglas provistos para más información.

## Licencia
© 2026 LeadOps Automation. Todos los derechos reservados.
