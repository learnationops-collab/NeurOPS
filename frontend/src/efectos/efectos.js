// Efectos visuales según lo que aguante la compu (Kerwin, 29/10/2026): el humo parpadeaba en las que no dan.
//
// Pone `data-efectos="bajo"` en <html> (ver `efectos.css`: sin nubes que se muevan) cuando:
//   · la persona lo eligió (`?efectos=bajo` en la URL; `?efectos=normal` lo vuelve a la medición), o
//   · pide menos movimiento (`prefers-reduced-motion`), o
//   · la compu es chica (2 núcleos o menos, 2 GB o menos de memoria), o
//   · una medición de ~1,5 s de cuadros (con el humo andando) da menos de ~30 por segundo.
// Lo medido se recuerda 14 días: no se vuelve a probar en cada carga, y no oscila de una visita a otra.

const CLAVE = 'neurops:efectos';
const DIAS = 14;
const MUESTRAS = 70;      // cuadros que se miden (~1,2 s a 60 fps)
const DESCARTADOS = 8;    // los primeros cuadros, mientras la página termina de pintarse
const MAX_MEDIANA_MS = 34; // por encima: menos de ~30 cuadros por segundo
const MAX_LENTOS = 0.3;   // o más de un 30% de cuadros que tardan más de 50 ms

const leer = () => {
    try {
        return JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
    } catch {
        return null;
    }
};
const guardar = (valor) => {
    try {
        window.localStorage.setItem(CLAVE, JSON.stringify(valor));
    } catch {
        // Sin almacenamiento solo se vuelve a medir en la próxima carga.
    }
};
const poner = (modo) => { document.documentElement.dataset.efectos = modo; };

/** ¿Estos cuadros (milisegundos entre uno y otro) dicen que la compu no da? */
export const noDa = (cuadros) => {
    if (cuadros.length < 20) return false;
    const orden = [...cuadros].sort((a, b) => a - b);
    const mediana = orden[Math.floor(orden.length / 2)];
    const lentos = cuadros.filter((c) => c > 50).length / cuadros.length;
    return mediana > MAX_MEDIANA_MS || lentos > MAX_LENTOS;
};

const medir = () => new Promise((resolver) => {
    const cuadros = [];
    let previo = null;
    const paso = (t) => {
        if (document.hidden) { resolver(null); return; } // con la pestaña oculta los cuadros no dicen nada
        if (previo !== null) cuadros.push(t - previo);
        previo = t;
        if (cuadros.length < MUESTRAS + DESCARTADOS) requestAnimationFrame(paso);
        else resolver(cuadros.slice(DESCARTADOS));
    };
    requestAnimationFrame(paso);
});

const probarCuandoSePueda = () => {
    const correr = async () => {
        const cuadros = await medir();
        if (cuadros === null) return; // se mide en otra visita
        if (noDa(cuadros)) {
            poner('bajo');
            guardar({ modo: 'bajo', manual: false, hasta: Date.now() + DIAS * 86400000 });
        }
    };
    const arrancar = () => window.setTimeout(correr, 1500);
    if (document.readyState === 'complete') arrancar();
    else window.addEventListener('load', arrancar, { once: true });
};

export const iniciarEfectos = () => {
    if (typeof window === 'undefined') return;
    const pedido = new URLSearchParams(window.location.search).get('efectos');
    if (pedido === 'bajo') { guardar({ modo: 'bajo', manual: true }); poner('bajo'); return; }
    if (pedido === 'normal') { guardar(null); poner('normal'); return; }

    const guardado = leer();
    if (guardado?.manual && guardado.modo === 'bajo') { poner('bajo'); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { poner('bajo'); return; }
    if (guardado?.modo === 'bajo' && guardado.hasta > Date.now()) { poner('bajo'); return; }

    const chica = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
        || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    if (chica) { poner('bajo'); return; }

    poner('normal');
    probarCuandoSePueda();
};
