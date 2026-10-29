# Marketing y segmentos — modelo vigente

Cómo se cuenta hoy cada cifra de Marketing (Setting, Workshop, Todos) y cómo se parte por segmento A/B/C/D. Las decisiones que llevaron a esto, en [DECISIONS.md](../DECISIONS.md) (ADR-W015, ADR-W019, ADR-W020 y ADR-W021). Código principal: `app/services/anuncios_service.py`, `fuentes_service.py`, `fuentes_registros_service.py`, `segmentos_*.py`; pantallas en `frontend/src/pages/admin/marketing/`.

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

`segmentos_marketing_service.hechos` arma, para un período, los **hechos** de la vista: cada agenda (base alta, `conteo_agendas_service.personas`), cada cobro (`fuentes_service._cobros_para_sumar`) y cada lead de Setting (`anuncios_service.entradas_del_periodo`), con su segmento, su fuente, su origen y su closer. Todo lo demás son cuentas sobre esos hechos con `PERTENECE` (una sola definición de qué suma cada cifra): la celda, la comparación y la lista que se abre al tocarla, así que la lista suma exacto la celda (comprobado: 112 celdas de los cuatro cortes contra su lista, 0 diferencias). Se recuerdan 45 s por período.

- **Endpoint:** `GET /api/marketing/anuncios/segmentos?desde&hasta&corte&fuentes&segmento&comparar[&comparar_desde&comparar_hasta]` → `{corte, cortes, fuentes, segmentos, cuentas, grupos: [{key, label, filas (una por segmento), total}], comparacion}`. Ya no viaja en el tablero (`?segmentos=1` se quitó).
- **Corte («Agrupar por»):** `fuente` (Setting, Workshop y **Otras**), `origen`, `closer` o `ninguno` (todo junto). Origen = el setter (Setting), VSL / Momentum / Referido… (Otras) o «Workshop» (uno solo, en vivo y grabación juntos: `conteo_agendas_service.origen_de_agenda`). El origen de un cobro es el detalle de su procedencia. Los grupos de un corte suman el total; los segmentos de cada grupo, también.
- **Leads:** solo Setting. Un lead no tiene closer: en el corte por closer no hay leads (`None`, «—»). Si un grupo mezcla fuentes, tampoco. Workshop va con sus clics en el total y `None` por segmento.
- **Comparación (VS):** mismo cálculo sobre otro período (`prev`, `month`, `year` o fechas libres, con `ComercialService.rango_comparado`, las del VS de Analizar). Cada fila y total trae `previo` y `delta {abs, pct}` (`segmentos_cortes`), también las tasas (en puntos). Un grupo que solo existe en uno de los dos períodos sale igual.
- **Filtro de segmento:** lo aplica el backend (también el total y los `delta`); `cuentas` trae las agendas de todos los segmentos para los botones.
- **Listas:** `GET /api/marketing/anuncios/registros?segmento=…&metrica=&corte=&grupo=&fuentes=` (o `fuente=` / `origen=` de las vistas de siempre), con columnas de segmento y fuente, y closer en los cobros.
- **Leads de Workshop no se parten** y **costo por lead por segmento: no se calcula** (Leadership 839; ver [pendientes_santi.md](../pendientes_santi.md)).
- Pantalla: vista «Segmentos» de Todos (`todos/SegmentosVista.jsx`): pestañas de fuente (Todos, Setting, Workshop, Otras), «Agrupar por», «Ver como» (una tabla por grupo o el **cruce** grupo × segmento de una cifra, ordenable), VS, filtro de segmento y columnas. Todo se recuerda por usuario (`mk_segmentos_fuente`; el filtro y el VS en la URL: `segmento`, `vs`, `vd`, `vh`).

### El filtro de segmento en el resto de Marketing

`GET /api/marketing/anuncios?segmento=A,B` acota las cifras de las fuentes con `segmentos_marketing_service.acotar_fuentes` (la misma matriz, siempre por fecha de alta): Setting, Workshop y Otras (con sus orígenes). **Sin gasto por segmento**: el gasto, los costos y el ROAS quedan en `None` («—»), los leads de Workshop (clics) también, y la serie por día queda vacía. Lo usan Todos › Resumen y Métrica por métrica y Otras, con su filtro en la URL (`segmento=`, recordado con el período). **No admiten el filtro** y lo dicen en pantalla: Todos › Gasto en Meta (el gasto no conoce al lead) y la tabla de palabras clave de Setting (con un enlace a Segmentos). Workshop por taller no se filtra: sus leads son clics anónimos.

### Dashboard comercial (setters y closers)

`segmentos_comercial.py` reparte las MISMAS filas del dashboard (`ComercialService.agendas` para el closer, `generadas` para el setter):

- `GET /api/comercial/segmentos?corte=`: por grupo y segmento, agendas, con resultado, asistieron (show up), ventas (cierre) y sin reporte, con `previo` y `delta` si el VS del header compara (`compare`). `corte`: `closer`, `setter`, `fuente` (Setting, Workshop, Otras), `origen` o sin corte. Closer: show up y cierre; setter: las agendas del mes que generó. Mismo alcance que el resto (`alcance_de`). La clave de cada grupo (`_clave_de`) es la misma para el panel y para sus listas.
- `GET /api/comercial/segmentos/registros?metrica=&segmento=&corte=&grupo=[&previo=1]`: la lista de cada cifra (con `previo=1`, la del período comparado).
- Filtro `segmento` (`A,B,sin`): `/resumen` (KPIs del closer sobre esos leads; el reporte diario del setter viene de ManyChat y no tiene segmento), `/tabla` (Agendas, Agendas generadas y Ventas, con su faceta «Segmento» en Revisar) y `/segmentos` (también su total y sus diferencias).
- Pantalla: panel «Segmentos» de Analizar (`comercial/components/SegmentosPanel.jsx`, `SegmentosGrupo.jsx`; reutiliza `CruceSegmentos`, `Diferencia` y los controles de Marketing). El % de show up y de cierre dice su «N de M» en un tooltip. El filtro vive arriba de Analizar y Revisar (`BarraSegmento.jsx`; URL `seg=A,B`, recordado por usuario en `cm_segmento`) y cada pantalla dice qué filtra: KPIs del closer, listas y Segmentos sí; deuda por cobrar, fuentes, reporte del setter, Comparativas y Variabilidad no.

## Límites y pendientes

- Costo por lead por segmento (decisión 839).
- Leads de Workshop por segmento (hoy no hay a quién mirarle el formulario).
- Países en Marketing (pedido de Gabriela, 28/10).
- Backfill del segmento de las agendas viejas: `scripts/backfill_segmentos.py` (acción sobre producción, la confirma Kerwin, Leadership 840).
