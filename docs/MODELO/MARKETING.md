# Marketing y segmentos — modelo vigente

Cómo se cuenta hoy cada cifra de Marketing (Setting, Workshop, Todos) y cómo se parte por segmento A/B/C/D. Las decisiones que llevaron a esto, en [DECISIONS.md](../DECISIONS.md) (ADR-W015, ADR-W019 y ADR-W020). Código principal: `app/services/anuncios_service.py`, `fuentes_service.py`, `fuentes_registros_service.py`, `segmentos_*.py`; pantallas en `frontend/src/pages/admin/marketing/`.

## Las dos fuentes

Cada fuente (Setting, Workshop) trae las mismas cifras para poder compararlas (`fuentes_service.resumen`):

| Cifra | Setting | Workshop |
|---|---|---|
| Leads | personas que escribieron una palabra clave de ManyChat (`anuncios_service.entradas_del_periodo`, sin las palabras archivadas) | clics al grupo de WhatsApp desde las landings de sus anuncios |
| Agendas | personas con `FinancialAgenda` creada en el período, una por persona (`conteo_agendas_service.personas`, base alta) | igual |
| Show up | asistió a alguna de sus agendas; % = asistieron ÷ citas con resultado | igual |
| Ventas / New Cash | pagos de venta nueva (completo o split) del período | igual |
| Cash total | todo lo cobrado del período de los clientes de la fuente (cuotas, upsells, renovaciones) | igual |
| Gasto | Meta Ads de los anuncios del embudo | igual |

Cada cifra abre la lista de lo que la suma (`fuentes_registros_service.registros`, `VerRegistros`): la lista sale del mismo código que la cifra.

## Segmentos A/B/C/D

El segmento de un lead lo calcula y guarda Thalamus (`segmento_service`, columnas `segmento*` de `clients` y `appointments`; plan en [plan_segmentos_triage.md](../plan_segmentos_triage.md)). Los tableros solo lo **leen**, con una regla única (`segmentos_lectura.py`):

1. el de la agenda más reciente de la persona que lo tenga;
2. si no, el de su cliente (último formulario);
3. si no, **«sin segmento»**: las agendas del flujo viejo (Calendly/n8n) que nunca pasaron por Thalamus y quienes no llenaron el formulario.

«Sin segmento» es un grupo más: A, B, C, D y «sin segmento» suman siempre el total.

### Marketing › Todos › Segmentos

`segmentos_marketing_service.por_segmento` devuelve, por fuente y por grupo: leads, agendas, citas con resultado, show up, ventas, New Cash y Cash total, con sus tasas (show up, cierre, ticket, % del cash). Sale en `GET /api/marketing/anuncios?segmentos=1` (`por_segmento`; cuesta ~3 s, por eso solo lo pide su vista). Las personas, los cobros y los leads son **los mismos** de las cifras de la fuente, repartidos por segmento, así que la suma de los grupos es la cifra de la fuente.

- **Leads de Workshop no se parten:** son clics anónimos, sin formulario. Su total va entero y por segmento queda en `None` («—»).
- **Costo por lead por segmento: no se calcula.** Meta no conoce el segmento. Decisión de negocio abierta (Leadership 839; ver [pendientes_santi.md](../pendientes_santi.md)).
- Las listas (`GET /api/marketing/anuncios/registros?...&segmento=A,B`) son las de siempre con una columna de segmento y solo ese grupo.
- Pantalla: vista «Segmentos» de Todos (`todos/SegmentosVista.jsx`); filtro de segmentos en la URL (`segmento=A,B`).

### Dashboard comercial (setters y closers)

`segmentos_comercial.py` reparte las MISMAS filas del dashboard (`ComercialService.agendas` para el closer, `generadas` para el setter):

- `GET /api/comercial/segmentos`: por grupo, agendas, con resultado, asistieron (show up), ventas (cierre) y sin reporte. Closer: show up y cierre; setter: las agendas del mes que generó. Mismo alcance que el resto (`alcance_de`).
- `GET /api/comercial/segmentos/registros?metrica=&segmento=`: la lista de cada cifra.
- Filtro `segmento` (`A,B,sin`): `/resumen` (KPIs del closer sobre esos leads; el reporte diario del setter viene de ManyChat y no tiene segmento), `/tabla` (Agendas, Agendas generadas y Ventas, con su faceta «Segmento» en Revisar) y `/segmentos`.
- Pantalla: panel «Segmentos» de Analizar (`comercial/components/SegmentosPanel.jsx`); filtro en la URL (`seg=A,B`).

## Límites y pendientes

- Costo por lead por segmento (decisión 839).
- Leads de Workshop por segmento (hoy no hay a quién mirarle el formulario).
- Países en Marketing (pedido de Gabriela, 28/10).
- Backfill del segmento de las agendas viejas: `scripts/backfill_segmentos.py` (acción sobre producción, la confirma Kerwin, Leadership 840).
