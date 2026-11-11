"""La verificación de cada pago con su comprobante (04/11/2026, ADR-W088).

Que el closer declare un pago no lo hace cierto. El closer sube la evidencia (una captura, un PDF, un
CSV: cualquier archivo que la respalde), Learnito la lee y la compara con lo declarado, y el pago queda:

  · pending    — sin comprobante todavía;
  · verified   — el comprobante cuadra con lo declarado;
  · unverified — no cuadra (otro monto, otro pago, un comprobante ya usado) o no aparece al conciliar.

Un solo nivel: lo que valida Learnito queda verificado. Las incongruencias aparecen a fin de mes, cuando
la conciliación de Finanzas › Diferencias no encuentra el cobro.

El closer carga siempre el BRUTO (lo que pagó el cliente). El neto (`transaction_amount`) sale del
comprobante si lo muestra; si no, `comision_plataforma_service` lo estima con el promedio de la plataforma.

Piezas: `almacen` (los archivos en el volumen), `lector` (Claude extrae los datos), `validacion` (la
comparación y lo que se guarda en el pago). La nómina paga igual los pagos sin verificar, marcados.
"""
