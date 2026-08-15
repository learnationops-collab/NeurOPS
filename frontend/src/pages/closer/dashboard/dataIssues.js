/* Detección de datos que NO se pueden creer, con la acción concreta para arreglarlos.
 *
 * Regla de esta lista: solo entra lo que es demostrablemente un problema de captura de datos y
 * tiene una acción clara. Un pitch rate bajo o un show rate bajo NO entran — pueden ser un
 * problema real de performance, y marcarlos como "dato erróneo" enseñaría a ignorar los avisos.
 * Los problemas de negocio siguen viviendo en "Qué mirar esta semana".
 *
 * `view` es la pestaña del mazo del closer a la que lleva el botón ('report' | 'inbox'). Cuando el
 * dashboard se abre suelto (vista de admin) no hay adónde navegar y solo se muestran los pasos.
 *
 * `days` son los días concretos que hay que reportar: cada uno se renderiza como un acceso directo
 * que abre el reporte YA POSICIONADO en esa fecha, para no tener que descubrir a mano cuáles
 * faltan ni ir cambiando el selector de a uno.
 */

export const detectIssues = (data) => {
    if (!data) return [];

    const k = data.current?.kpis || {};
    const funnel = data.current?.funnel?.values || [];
    const cashMix = data.current?.cash_mix || {};
    const coverage = data.reports_coverage;

    const [slots = 0, agendas = 0, , asistencias = 0, presentaciones = 0] = funnel;
    const faltantes = coverage?.faltantes || 0;
    const issues = [];

    // 1. Close rate imposible. Desde que el embudo se lee de la bandeja esto ya no puede ser un
    //    desfase entre fuentes: es el check de "presentó la oferta" que no se está tildando.
    const closeRoto = k.close_rate_presentacion > 100 || k.close_rate_llamada > 100;
    if (closeRoto) {
        issues.push({
            id: 'close_rate_imposible',
            severity: 'danger',
            icon: '📉',
            title: `Close rate por encima del 100% (${Math.max(k.close_rate_presentacion || 0, k.close_rate_llamada || 0)}%)`,
            affects: 'Close rate s/ llamada · Close rate s/ presentación · Embudo',
            why: `Hay ${k.ventas} venta(s) contra ${presentaciones} presentación(es) registrada(s). No se puede vender sin presentar: el paso "Presentaciones" solo cuenta las llamadas donde se tildó "presentó la oferta" al registrar el resultado.`,
            fix: 'Revisá en la bandeja las llamadas de esas ventas y marcales la oferta presentada.',
            view: 'inbox',
            actionLabel: 'Ir a la bandeja',
            steps: [
                'Abrí la Bandeja y andá a la pestaña "② Llamadas".',
                'Buscá las llamadas de los clientes que compraron en el período.',
                'Confirmá que estén como "Show up" y tildá "presentó la oferta".',
                'El close rate se recalcula solo con lo que quede en la bandeja.'
            ]
        });
    }

    // 2. Cupos de agenda sin cargar: lo ÚNICO que el dashboard no puede deducir de la bandeja.
    //    Que haya más agendas que cupos es imposible — un cupo agendado sigue siendo un cupo.
    if (faltantes > 0 && slots < agendas) {
        issues.push({
            id: 'slots_faltantes',
            severity: 'warning',
            icon: '📅',
            title: `Faltan los cupos de agenda de ${faltantes} día(s)`,
            affects: 'Slots · primer paso del embudo · ocupación de agenda',
            why: `Hay ${agendas} agenda(s) contra ${slots} cupo(s) declarado(s), que no puede ser: un cupo que se agendó sigue contando. Los cupos son el único dato que el sistema no puede sacar solo de la bandeja — todo el resto del embudo ya sale de ahí.`,
            fix: 'Cargá los cupos totales de los días que faltan desde el aviso del dashboard.',
            view: 'report',
            actionLabel: 'Cargar los cupos que faltan',
            days: coverage?.dias_faltantes || [],
            steps: [
                'Son los cupos TOTALES del día: los que se agendaron más los que quedaron libres.',
                'Ejemplo: abriste 10, se agendaron 6 y 4 quedaron vacíos → cargás 10, no 4 ni 6.',
                'Nunca puede ser menor que tus agendas de ese día.'
            ]
        });
    }

    // 3. Slots por debajo de las agendas: imposible por definición (un cupo agendado sigue
    //    siendo un cupo). Casi siempre es que se escribieron los cupos que sobraron.
    if (slots > 0 && agendas > slots) {
        issues.push({
            id: 'slots_menores_a_agendas',
            severity: 'warning',
            icon: '📅',
            title: `Hay más agendas (${agendas}) que slots disponibles (${slots})`,
            affects: 'Slots · primer paso del embudo',
            why: 'Un cupo que se agendó sigue contando como cupo: la agenda no lo elimina, lo ocupa. Que las agendas superen a los slots casi siempre significa que se anotaron los cupos que quedaron LIBRES en vez de la capacidad total del día.',
            fix: 'Corregí el número de slots en los reportes de esos días: cupos ocupados + cupos libres.',
            view: 'report',
            actionLabel: 'Ir a corregir los slots',
            steps: [
                'Abrí "Reporte del día" y elegí el día a corregir.',
                'En la tarjeta "Slots disponibles" escribí la CAPACIDAD TOTAL del día, no los huecos que sobraron.',
                'La cuenta es: cupos que se agendaron + cupos que quedaron vacíos.',
                'Ejemplo: abriste 10 cupos, se agendaron 6 y 4 quedaron libres → escribís 10, no 4 ni 6.',
                'Reenviá el reporte: actualiza el del día en vez de duplicarlo.'
            ]
        });
    }

    // 4. Llamadas asistidas sin ninguna oferta marcada: el check no se está tildando.
    if (asistencias > 0 && presentaciones === 0) {
        issues.push({
            id: 'presentaciones_sin_marcar',
            severity: 'danger',
            icon: '🎤',
            title: `${asistencias} llamada(s) asistidas y ninguna presentación registrada`,
            affects: 'Pitch rate · Close rate s/ presentación · Embudo',
            why: 'Las presentaciones se cuentan por el check de "presentó la oferta" que se marca al registrar el resultado de la llamada. Si nadie lo tilda, el paso queda en cero y el close rate sobre presentación no se puede calcular.',
            fix: 'Al cerrar cada llamada con "Show up", marcá si llegaste a presentar la oferta.',
            view: 'inbox',
            actionLabel: 'Ir a la bandeja',
            steps: [
                'Abrí la Bandeja y andá a la pestaña "② Llamadas".',
                'Entrá a cada llamada que ya pasó y registrá su resultado.',
                'Si el lead asistió, marcá "Show up" y tildá si presentaste la oferta.',
                'Ese tilde es lo único que alimenta el paso "Presentaciones" del embudo.'
            ]
        });
    }

    // 5. Pagos con etiquetas que el parser no reconoce. El closer no puede arreglarlo solo.
    const otros = cashMix.otros || {};
    if (otros.count > 0) {
        issues.push({
            id: 'pagos_sin_clasificar',
            severity: 'warning',
            icon: '🏷️',
            title: `${otros.count} pago(s) con un tipo que el sistema no reconoce`,
            affects: 'Ventas cerradas · Ticket promedio · Composición del cash',
            why: 'El "tipo de pago" de esos cobros no coincide con ninguna categoría conocida (completo, parcial, seña, cuota, upsell, renovación). Suman al cash total pero no cuentan como venta, así que el ticket promedio y las ventas quedan por debajo de lo real.',
            fix: 'Avisá a Operaciones para normalizar esas etiquetas en el registro de ventas.',
            view: null,
            actionLabel: null,
            steps: [
                'Esto no se corrige desde el panel del closer: la etiqueta viene del registro de ventas.',
                'Pasale a Operaciones el período y el monto que aparece en "Sin clasificar" (sección Dinero).',
                'Una vez normalizada la etiqueta en el origen, el dato se recalcula solo.'
            ]
        });
    }

    return issues;
};
