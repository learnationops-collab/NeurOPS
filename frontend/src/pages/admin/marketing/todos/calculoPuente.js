// El puente entre los dos ROAS de Workshop (Kerwin, 29/10/2026, ADR-W027): de «Todos» (todo lo cobrado del período de los
// clientes de Workshop ÷ gasto de Meta del período) a «Talleres» (lo que trajo la cohorte de los talleres del período ÷ lo
// invertido en ellos). Tres pasos, cada uno una cuenta que se puede comprobar:
//   1. se saca lo cobrado de ventas anteriores (cuotas, señas y upsells de quien no compró nada nuevo en el período);
//   2. el numerador pasa a ser solo lo que trajeron los talleres (`cash_collected` de cada uno: ventas, señas y primera cuota);
//   3. el denominador pasa a ser lo invertido en esos talleres, que arranca el día siguiente al taller anterior.
// La suma de los tres pasos es exactamente la diferencia entre las dos cifras.

const razon = (a, b) => (b > 0 ? a / b : 0);
const suma = (lista, campo) => lista.reduce((s, t) => s + (Number(t[campo]) || 0), 0);

/**
 * `todos`: { cash, anterior, gasto } de la fuente Workshop en Marketing (`anterior` null con un segmento elegido:
 * ahí no se parte y no hay puente). `talleres`: los talleres realizados del período (`workshop/events`).
 * Devuelve null si falta algo con qué dividir.
 */
export const puenteRoas = (todos, talleres) => {
    if (!todos || todos.anterior == null || !(todos.gasto > 0) || !talleres?.length) return null;
    const cobradoTalleres = suma(talleres, 'cash_collected');
    const invertido = suma(talleres, 'inversion');
    if (!(invertido > 0)) return null;
    const { cash, anterior, gasto } = todos;
    const delPeriodo = cash - anterior;
    const r0 = razon(cash, gasto);
    const r1 = razon(delPeriodo, gasto);
    const r2 = razon(cobradoTalleres, gasto);
    const r3 = razon(cobradoTalleres, invertido);
    return {
        todos: r0, talleres: r3, cobradoTalleres, invertido, cantidad: talleres.length,
        pasos: [
            { id: 'anterior', delta: r1 - r0, de: anterior, sobre: cash, lista: 'cash_anterior' },
            { id: 'cohorte', delta: r2 - r1, de: delPeriodo, a: cobradoTalleres },
            { id: 'gasto', delta: r3 - r2, de: gasto, a: invertido },
        ],
    };
};

/** Los talleres cuyo día cae en el período (inclusive). */
export const talleresDelPeriodo = (eventos, desde, hasta) => (eventos || [])
    .filter((e) => e.date && e.date.slice(0, 10) >= desde && e.date.slice(0, 10) <= hasta)
    .sort((a, b) => a.date.localeCompare(b.date));
