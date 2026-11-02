# Bitácora · Noviembre 2026

- **1 de Noviembre de 2026 (Hiring: cada formulario tiene su propio link)** *([LinkFormulario.jsx](../../frontend/src/pages/admin/hiring/components/forms/LinkFormulario.jsx), [hiring_forms.py](../../app/api/hiring_forms.py), [ADR-W052](../DECISIONS.md))*:
  - Talent › Forms: la tarjeta y el editor muestran el link público del formulario (`institute.thelearnation.com/vacante/<slug>/`), con botones para copiarlo y para cambiar su parte final.
  - Puede haber varios formularios activos a la vez, cada uno en su link. Los nuevos y las copias toman el link de su nombre.
  - `GET /api/public/assistant-form?slug=` devuelve el formulario de ese link (inactivo o inexistente: búsqueda cerrada). Sin slug, el activo más antiguo (link viejo `/vacante-assistant/`).
  - Migración `b7d9f1a3c5e8`: columna `hiring_forms.slug` (única); el formulario actual queda con `assistant`.
  - Va junto con institute-site (`.htaccess` y `vacante-assistant/`), que sirve `/vacante/<slug>/` y pide ese formulario.

- **2 de Noviembre de 2026 (Triage: el rol se llama «Triage» y descalificar pide el motivo en texto libre)** *([TeamManagementPage.jsx](../../frontend/src/pages/admin/team/TeamManagementPage.jsx), [SubDescalificar.jsx](../../frontend/src/components/ficha/tabs/confirmacion/SubDescalificar.jsx))*:
  - El rol `triage` ya no se muestra como «Call confirmer» en Equipo ni en el editor de cursos.
  - «Descalificar lead» en la confirmación deja de ser una lista cerrada de motivos: se escribe el porqué (mínimo 3 caracteres), igual que en el cierre del triage.
  - Reprogramar sigue ofreciendo solo horarios libres (sin cambios): la regla de bloquear el horario ocupado se mantiene.
- **2 de Noviembre de 2026 (Discord: la tarjeta de lo que el triage pasa al closer)** *([avisos_discord.py](../../app/agendas_v2/avisos_discord.py), [triage_service.py](../../app/services/triage_service.py))*: la agenda de closing que nace de una llamada de triage salía como «Nueva agenda» gris y vacía, porque nace sin formulario. Ahora es «Pasó de Triage a Closing»: lleva el segmento y las respuestas del formulario del lead, dice «Triage · quien la pasó» y trae la nota que le dejó al closer.
- **2 de Noviembre de 2026 (Santiago y Mario no aparecen a la dirección comercial)** *([user.py](../../app/models/user.py))*: quien es closer pero también admin u operador (Santiago por pruebas, Mario como dueño) sale del selector de miembros, del ranking de closers y del reporte del director. Sus agendas y ventas siguen contando en los totales.
