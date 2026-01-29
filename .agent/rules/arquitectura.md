---
trigger: always_on
---

1. Usa el entorno virtual para ejecutar comandos que usen las dependencias del proyecto.
2. La base de datos local es de SQLite (`instance/local.db`) y la base de datos en producción es PostgreSQL.
3. Siempre que se hagan modificaciones en los modelos de base de datos (`app/models.py`), debes crear migraciones con flask para mantener la consistencia: `flask db migrate -m "mensaje"`.
4. Mantén este archivo actualizado ante cualquier cambio en la estructura o tecnología del proyecto.

Arquitectura:
1. ESPECIFICACIONES TÉCNICAS
--------------------------------
Backend (Monolito API):
- Lenguaje: Python 3.9+
- Framework: Flask (Modularizado con Blueprints)
- ORM: SQLAlchemy (Flask-SQLAlchemy)
- Migraciones: Flask-Migrate (Alembic)
- Autenticación: Flask-Login, Google OAuth
- API: RESTful JSON API para comunicar con el frontend
- Integraciones: Google Calendar API, Webhooks (n8n/ManyChat)

Frontend (Single Page Application):
- Renderizado: Client-Side (React + Vite)
- Ubicación: Carpeta `frontend/`
- Servidor de Desarrollo: `npm run dev` (Puerto 5173 por defecto)
- Producción: El backend Flask sirve los archivos estáticos compilados desde `frontend/dist` en la ruta `/`.
- Estilos: Tailwind CSS (Clases utilitarias) + ShadcnUI (Componentes)
- Estado: React Context / Hooks

Estructura del Proyecto:
- `app/`: Código fuente del Backend (Python/Flask)
  - `api/`: Blueprints de la API (JSON endpoints)
  - `models.py`: Definición de bases de datos
  - `__init__.py`: Factory de la aplicación Flask
- `frontend/`: Código fuente del Frontend (React/Vite)
  - `src/`: Componentes, Pages, Contexts
  - `package.json`: Dependencias de Node
- `migrations/`: Archivos de control de versiones de BD (Alembic)
- `instance/`: Base de datos local (SQLite)

Flujo de Trabajo:
- Backend Dev: Ejecutar con entorno virtual activo.
- Frontend Dev: `cd frontend` -> `npm run dev`.
- Base de Datos: Modificar modelos -> `flask db migrate` -> `flask db upgrade`.
