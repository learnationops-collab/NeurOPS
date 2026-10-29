# Modelo vigente — Work (NeurOPS)

> Lo que existe hoy, por subsistema. Se desactualiza con el código: quien cambia un subsistema que tiene archivo acá lo actualiza en el mismo commit.
> Mismo modelo de documentación que la Academia (`../academy/docs/MODELO/`), para que los dos proyectos se lean igual.

## Las tres bases

| Carpeta o archivo | Tiempo | Qué guarda |
|---|---|---|
| `docs/MODELO/` | Presente | Cómo funciona hoy cada subsistema: piezas, archivos, reglas, límites y lo que falta. Se consulta primero, antes de leer código. |
| `docs/DECISIONS.md` | Pasado | Una entrada por mejora hecha (append-only): contexto, decisión y consecuencias. Numeradas `ADR-W###` para no chocar con los ADR de la Academia. |
| `docs/bitacora/` | Pasado, por mes | Lo que se subió a producción, día por día (sin cambios: sigue la regla de `.agents/rules/workflow.md`). |

La diferencia entre las dos del pasado: la bitácora dice **qué se subió**; `DECISIONS.md` dice **por qué el subsistema quedó así**. Un arreglo puntual va solo a la bitácora.

## Archivos del modelo

- **[TABLAS.md](TABLAS.md)**: el motor de tablas (plan por claves, sin IA) y el diccionario de datos: significados, calculados `d.`, conceptos del equipo y el buscador `buscar_datos`.
- **[LEARNITO.md](LEARNITO.md)**: Learnito en Work, el copiloto con IA de closers y dirección: pantalla, herramientas por rol, motor de tablas, habilidades, agentes pares con la Academia, costo y tope. Incluye la tabla de paridad con el Learnito de la Academia y los pendientes.
- **[MARKETING.md](MARKETING.md)**: Marketing por fuente (Setting y Workshop) y por segmento A/B/C/D: de dónde sale cada cifra, la matriz de Todos › Segmentos, el panel de segmentos del dashboard de setters y closers, y lo que falta (costo por lead por segmento).
