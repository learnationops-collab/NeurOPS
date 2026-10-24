# Documentación de modelo

Mismo modelo que la Academia (`../academy/docs/MODELO/`), para que los dos proyectos se lean igual.

1. **Consultá primero `docs/MODELO/`**: antes de leer código de un subsistema que tiene archivo ahí (hoy, `LEARNITO.md`), leé ese archivo.
2. **Presente**: si cambiás un subsistema con modelo, actualizá su archivo en el mismo commit. Si creás un subsistema nuevo que lo amerite, creale su archivo y sumalo al índice (`docs/MODELO/README.md`).
3. **Pasado**: cada mejora de un subsistema con modelo suma una entrada `ADR-W###` en `docs/DECISIONS.md` (solo se agrega; contexto, decisión, consecuencias). Un arreglo puntual no; ese va solo a la bitácora.
4. **Learnito y la Academia**: antes de diseñar una mejora de Learnito, leé `../academy/docs/MODELO/LEARNITO_EQUIPO.md`. Lo que cruza sistemas (formato de plan, `agent/ask`, nombres y parámetros de herramientas) se mantiene igual en los dos. Si Work decide distinto, actualizá la tabla de paridad (`docs/MODELO/LEARNITO.md` §8) y escribí el porqué en el ADR.
