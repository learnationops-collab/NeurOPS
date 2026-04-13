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

### 7. Crear Usuario Administrador

Hemos incluido un script para facilitar esto. Ejecuta en la raíz:

```bash
python scripts/create_admin.py
```
Sigue las instrucciones en pantalla.

### 8. Ejecutar el Entorno de Desarrollo

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
