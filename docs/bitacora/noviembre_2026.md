# Bitácora - Noviembre 2026

- **2 de Noviembre de 2026 (Triage: el rol se llama «Triage» y descalificar pide el motivo en texto libre)** *([TeamManagementPage.jsx](../../frontend/src/pages/admin/team/TeamManagementPage.jsx), [SubDescalificar.jsx](../../frontend/src/components/ficha/tabs/confirmacion/SubDescalificar.jsx))*:
  - El rol `triage` ya no se muestra como «Call confirmer» en Equipo ni en el editor de cursos.
  - «Descalificar lead» en la confirmación deja de ser una lista cerrada de motivos: se escribe el porqué (mínimo 3 caracteres), igual que en el cierre del triage.
  - Reprogramar sigue ofreciendo solo horarios libres (sin cambios): la regla de bloquear el horario ocupado se mantiene.
- **2 de Noviembre de 2026 (Discord: la tarjeta de lo que el triage pasa al closer)** *([avisos_discord.py](../../app/agendas_v2/avisos_discord.py), [triage_service.py](../../app/services/triage_service.py))*: la agenda de closing que nace de una llamada de triage salía como «Nueva agenda» gris y vacía, porque nace sin formulario. Ahora es «Pasó de Triage a Closing»: lleva el segmento y las respuestas del formulario del lead, dice «Triage · quien la pasó» y trae la nota que le dejó al closer.
- **2 de Noviembre de 2026 (Santiago y Mario no aparecen a la dirección comercial)** *([user.py](../../app/models/user.py))*: quien es closer pero también admin u operador (Santiago por pruebas, Mario como dueño) sale del selector de miembros, del ranking de closers y del reporte del director. Sus agendas y ventas siguen contando en los totales.
