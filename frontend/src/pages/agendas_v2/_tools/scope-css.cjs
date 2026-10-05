/* global process */
// Convierte la hoja del prototipo Thalamus en una hoja encapsulada: los tokens viven en .thalamus
// (la raíz de la app y las capas flotantes) y los estilos de página en .thalamus-app.
const fs = require('fs');
const postcss = require('postcss');
const [, , src, out] = process.argv;
const lines = fs.readFileSync(src, 'utf8').split('\n');
const css = lines.slice(7, 1414).join('\n'); // entre <style> (línea 7) y </style> (línea 1415)
const root = postcss.parse(css);
function map(sel) {
  sel = sel.trim();
  if (sel === 'html,body' || sel === 'html' ) return null;
  if (/^:root/.test(sel)) return sel.replace(/^:root/, '.thalamus');
  if (sel === 'body') return '.thalamus-app';
  if (/^body[.\s]/.test(sel)) return sel.replace(/^body/, '.thalamus');
  if (sel.startsWith('*') || sel.startsWith('::')) return '.thalamus ' + sel;
  return '.thalamus ' + sel;
}
root.walkRules(rule => {
  if (rule.parent && rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
  const sels = rule.selectors.flatMap(s => {
    if (s.trim() === '*' ) return ['.thalamus', '.thalamus *'];
    const m = map(s); return m ? [m] : [];
  });
  if (!sels.length) rule.remove(); else rule.selectors = [...new Set(sels)];
});
fs.writeFileSync(out, '/* Generado desde el prototipo Learnation Thalamus con _tools/scope-css.cjs. Todo vive bajo .thalamus. */\n' + root.toString());
