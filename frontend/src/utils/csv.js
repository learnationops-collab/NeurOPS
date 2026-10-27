// Un campo de CSV separado por comas. Un texto que empieza con =, +, -, @ la planilla lo corre como
// fórmula: se le antepone un apóstrofo (OWASP). Los números no: un -500 es un número.
const PARECE_FORMULA = /^[=+\-@\t\r]/;

export const campoCsv = (valor) => {
    if (valor === null || valor === undefined) return '';
    let texto = String(valor);
    if (typeof valor !== 'number' && PARECE_FORMULA.test(texto)) texto = `'${texto}`;
    return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};
