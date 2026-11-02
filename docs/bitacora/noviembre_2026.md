# Bitácora - Noviembre 2026

- **2 de Noviembre de 2026 (Triage: el rol se llama «Triage» y descalificar pide el motivo en texto libre)** *([TeamManagementPage.jsx](../../frontend/src/pages/admin/team/TeamManagementPage.jsx), [SubDescalificar.jsx](../../frontend/src/components/ficha/tabs/confirmacion/SubDescalificar.jsx))*:
  - El rol `triage` ya no se muestra como «Call confirmer» en Equipo ni en el editor de cursos.
  - «Descalificar lead» en la confirmación deja de ser una lista cerrada de motivos: se escribe el porqué (mínimo 3 caracteres), igual que en el cierre del triage.
  - Reprogramar sigue ofreciendo solo horarios libres (sin cambios): la regla de bloquear el horario ocupado se mantiene.
