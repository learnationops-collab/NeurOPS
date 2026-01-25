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

Es recomendable usar un entorno virtual para aislar las dependencias.

```bash
# Crear entorno llamado 'env'
python -m venv env

# Activar entorno (Windows)
.\env\Scripts\activate
```

### 3. Instalar Dependencias

Instala las librerías necesarias listadas en `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 4. Configurar Variables de Entorno

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

### 5. Inicializar Base de Datos y Migraciones

El proyecto usa Flask-Migrate (Alembic).

```bash
# Inicializar carpeta de migraciones (solo si no existe la carpeta 'migrations')
flask db init

# Crear migración inicial (si es nueva DB o hay cambios en modelos)
flask db migrate -m "Initial migration"

# Aplicar cambios a la base de datos (crea las tablas en local.db)
flask db upgrade
```

### 6. Crear Usuario Administrador

Hemos incluido un script para facilitar esto. Ejecuta:

```bash
python scripts/create_admin.py
```
Sigue las instrucciones en pantalla.
*   **Usuario por defecto sugerido:** `admin`
*   **Contraseña por defecto sugerida:** `admin123`

### 7. Ejecutar el Servidor

Inicia la aplicación:

```bash
python run.py
```
Accede en tu navegador a: `http://localhost:5000`

---

## Estructura del Proyecto

*   `app/`: Código fuente (Blueprints, Templates, Static).
    *   `admin/`: Rutas y lógica de administración.
    *   `closer/`: Rutas y lógica para closers.
    *   `models.py`: Modelos de base de datos (SQLAlchemy).
*   `migrations/`: Archivos de control de versiones de la BD.
*   `instance/`: Contiene la base de datos SQLite local (`local.db`).
*   `scripts/`: Scripts de utilidad (creación de usuarios, seeders).

## Despliegue

## Arquitectura y Mantenimiento

*   **Arquitectura Detallada**: Ver `arquitectura.txt` para especificaciones del stack y despliegue.
*   **Design System & IA Rules**: Para mantener la coherencia visual y técnica, consulta `ANTIGRAVITY_RULES.md`. Este archivo contiene las guías sobre el sistema de temas y componentes UI para desarrolladores y asistentes IA.

## Licencia
© 2026 LeadOps Automation. Todos los derechos reservados.
