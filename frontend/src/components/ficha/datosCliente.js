/**
 * Los datos del lead que se corrigen desde la cabecera de la ficha, sin nada de React.
 *
 * Las claves son las de la lectura (`identidad.nombre`, `.telefono`, …) y las mismas que acepta
 * `PATCH /ficha/<id>/datos`: la escritura habla el idioma de la lectura, como el resto de la
 * ficha, así lo que se muestra se puede devolver sin traducir.
 *
 * El nombre no está en esta lista porque no vive en la franja: se edita en el lugar del título.
 */
export const CAMPOS_DATOS = [
    // El examen es de la AGENDA, no del cliente, y es texto libre: no hay vocabulario que ofrecer.
    // Placeholder corto: con la fuente son cinco columnas y el examen es la más angosta.
    { clave: 'examen', rotulo: 'Examen', placeholder: 'ENARM, MIR…' },
    { clave: 'telefono', rotulo: 'Teléfono', placeholder: '+52 55 1234 5678', tipo: 'tel' },
    { clave: 'email', rotulo: 'Correo', placeholder: 'nombre@correo.com', tipo: 'email' },
    { clave: 'instagram', rotulo: 'Instagram', placeholder: 'usuario', prefijo: '@' },
    // También de la AGENDA, y no texto libre: se elige del catálogo de `vocabulario[catalogo]`,
    // el mismo que ofrece el historial (pedido del 09/10/2026). Se guarda la clave cruda
    // (`identidad.fuente`), no la etiqueta que se lee en la franja.
    { clave: 'fuente', rotulo: 'Fuente', catalogo: 'fuentes' },
];

// Lo que la lectura pone en `nombre` cuando el cliente no tiene uno: no es un nombre que corregir.
const NOMBRES_DE_RELLENO = ['Sin nombre', 'Sin cliente', 'Lead sin nombre'];

/**
 * El correo que inventa `BookingService` cuando el lead llegó sin ninguno
 * (`no-email-<hex>@neurops.com`). Mostrarlo en el campo invitaría a "corregirlo" dejándolo
 * como está, y no identifica a nadie.
 */
const esCorreoInventado = (email) => /^no-email-[0-9a-f]+@neurops\.com$/i.test(email || '');

/** Lo que el editor muestra al abrirse: lo guardado, sin los rellenos de la lectura. */
export const valoresIniciales = (identidad) => {
    const id = identidad || {};
    const email = id.email || '';
    const nombre = id.nombre || '';
    return {
        // Sin `full_name` la lectura cae al correo: ese "nombre" es el correo repetido.
        nombre: (NOMBRES_DE_RELLENO.includes(nombre) || (email && nombre === email)) ? '' : nombre,
        telefono: id.telefono || '',
        email: esCorreoInventado(email) ? '' : email,
        // Se guarda sin la '@' (ver `normalizar_instagram`); el campo la muestra como prefijo.
        instagram: String(id.instagram || '').replace(/^@+/, ''),
        examen: id.examen || '',
        fuente: id.fuente || '',
    };
};

/**
 * Cómo compara el backend (`closer_service.normalizar_*`): el correo sin mayúsculas y el
 * instagram sin las '@' de los bordes. Sin esto, '@kevin.enc' sobre 'kevin.enc' o el mismo correo
 * en mayúsculas viajaban, el backend no veía ningún cambio y la ficha avisaba "Datos del lead
 * corregidos." sin haber guardado nada.
 */
const COMO_COMPARA = {
    email: (valor) => valor.toLowerCase(),
    instagram: (valor) => valor.replace(/^@+|@+$/g, ''),
};

const paraComparar = (clave, valor) => {
    const recortado = String(valor ?? '').trim();
    return COMO_COMPARA[clave] ? COMO_COMPARA[clave](recortado) : recortado;
};

/**
 * Solo lo que cambió, recortado. Mandar el resto reescribiría datos que nadie tocó y dejaría en
 * la bitácora del lead cambios que no ocurrieron. Viaja lo que se escribió; la normalización de
 * verdad la hace el backend.
 */
export const cambiosDe = (iniciales, borrador) => {
    const cambios = {};
    Object.keys(iniciales || {}).forEach((clave) => {
        const nuevo = String(borrador?.[clave] ?? '').trim();
        if (paraComparar(clave, nuevo) !== paraComparar(clave, iniciales[clave])) cambios[clave] = nuevo;
    });
    return cambios;
};
