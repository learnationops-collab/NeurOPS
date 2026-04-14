# Handoff: Sistema de Notificaciones y Estado de Agendas

Este documento resume el estado actual y los problemas identificados para continuar la tarea en una nueva sesión.

## 1. Bug Crítico: Notificaciones no visibles
Se ha identificado por qué las notificaciones no aparecen en el Dashboard:
- **Archivo:** `app/api/closer.py`
- **Función:** `get_notifications` (líneas ~687-734)
- **Causa:** Hay un error de indentación. El bloque que construye el objeto de respuesta (`filtered.append(...)`) está dentro de un `elif isinstance(targets, str):`.
- **Efecto:** Si `target_users` se guarda correctamente como una lista `[ID]`, entra en el bloque `elif isinstance(targets, list):`, pone `is_target = True`, pero luego **se salta** el bloque donde está el `append`.
- **Solución pendiente:** Mover el bloque de construcción de la respuesta (líneas ~717-732) fuera de la cadena `if/elif` y envolverlo simplemente en `if is_target:`.

## 2. Estado "Nueva" en Agendas
- **Archivo:** `app/services/booking_service.py`
- **Cambio realizado:** Se actualizó `create_appointment` para que todas las nuevas agendas creadas desde el Funnel tengan `last_stage='Nueva'` por defecto.
- **Verificación:** El código está aplicado. Faltaría realizar un agendamiento de prueba para confirmar la aparición en el Kanban.

## 3. Herramientas de Debugging
- `debug_notifications.py`: Se creó un script en la raíz que crea una notificación manual. Este script funciona, confirmando que la base de datos y los modelos están bien. El problema es solo visual/de api en el punto 1.

---
**Próximos pasos para el siguiente agente:**
1. Arreglar la indentación en `app/api/closer.py`.
2. Verificar que las notificaciones aparezcan en el Dashboard.
3. Testear el flujo de agendamiento para ver el estado "Nueva".
