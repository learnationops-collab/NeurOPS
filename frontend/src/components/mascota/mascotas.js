/**
 * Los personajes que se pueden elegir de avatar (pedido del 08/10/2026). Son de page-mascot
 * (https://koboyo.com/page-mascot, MIT © Kamran Ahmed): dos hojas de 3×3 por personaje en
 * `hojas/` —hacia dónde mira y sus reacciones—, achicadas a 384 px (celdas de 128) porque acá se
 * ven a menos de 64. Vite las publica con hash, como el resto de los assets.
 *
 * La misma lista está en el backend (`MASCOTAS` en app/models/user.py), que solo acepta estas.
 */
const HOJAS = import.meta.glob('./hojas/*.webp', { eager: true, query: '?url', import: 'default' });

export const hojasDe = (id) => ({
    direcciones: HOJAS[`./hojas/${id}-directions.webp`],
    reacciones: HOJAS[`./hojas/${id}-reactions.webp`],
});

export const MASCOTAS = [
    { id: 'fox', nombre: 'Zorro' },
    { id: 'cat', nombre: 'Gato' },
    { id: 'panda', nombre: 'Panda' },
    { id: 'owl', nombre: 'Búho' },
    { id: 'penguin', nombre: 'Pingüino' },
    { id: 'redpanda', nombre: 'Panda rojo' },
    { id: 'koala', nombre: 'Koala' },
    { id: 'astronaut', nombre: 'Astronauta' },
    { id: 'wizard', nombre: 'Mago' },
    { id: 'gearbot', nombre: 'Robot' },
];

const IDS = MASCOTAS.map(m => m.id);

/** El personaje de la cuenta: el que eligió, o uno fijo según su id (o su nombre) mientras no elija. */
export const mascotaDe = (user, nombre = '') => {
    if (IDS.includes(user?.mascota)) return user.mascota;
    const semilla = Number.isInteger(user?.id)
        ? user.id
        : [...String(nombre)].reduce((n, c) => n + c.charCodeAt(0), 0);
    return IDS[Math.abs(semilla) % IDS.length];
};

export const nombreDeMascota = (id) => MASCOTAS.find(m => m.id === id)?.nombre || id;
