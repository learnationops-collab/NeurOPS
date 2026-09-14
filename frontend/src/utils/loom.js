// Le pedimos al admin/director de marketing el ID del video de Loom, pero es
// mucho mas natural pegar el link completo que copiar a mano el ID de 32
// caracteres de la URL. Esto acepta cualquiera de los dos: si lo que llega
// tiene forma de link de Loom (share o embed, con o sin querystring como
// ?sid=... o ?source=embed) le extrae el ID; si no matchea nada (ya era el ID
// suelto, o cualquier otro texto) lo deja pasar tal cual, sin romper nada.
export function extractLoomId(valor) {
    if (!valor) return '';
    const limpio = valor.trim();
    const match = limpio.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    return match ? match[1] : limpio;
}
