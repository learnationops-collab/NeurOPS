---
trigger: always_on
---

1. Usa el entorno virtual para ejecutar comandos que usen las dependencias del proyecto
2. La base de datos local es de SQLite y la base de datos en produccion es PostgreSQL
3. Siempre que se hagan modificaciones en la base de datos debes crear migraciones con flask para que al desplegarse en Railway se actualice la base de datos

Arquitectura:
1. ESPECIFICACIONES TÉCNICAS
--------------------------------
Backend:
- Lenguaje: Python 3.9+
- Framework: Flask (Modularizado con Blueprints)
- ORM: SQLAlchemy (Flask-SQLAlchemy)
- Migraciones: Flask-Migrate (Alembic)
- Autenticación: Flask-Login, Google OAuth
- Formularios: Flask-WTF
- Integraciones: Google Calendar API, Webhooks (n8n/Make)

Frontend:
- Renderizado: Server-Side (Jinja2)
- Estilos: Tailwind CSS (Clases utilitarias) + CSS Vanilla (`main.css`)
- Scripting: Javascript Vanilla (para modales, AJAX simple)

Base de Datos:
- Desarrollo Local: SQLite (`instance/local.db`)
- Producción: PostgreSQL

Manten actualizado el archivo "arquitectura.txt" con las especificaciones del proyecto, sobre todo la estructura de los archivos 
