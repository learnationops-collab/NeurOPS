import { money, pctTxt, r2, sum } from './modelo';

/**
 * El recibo de comisiones en PDF (A4): cabecera navy con la marca, la tabla de cobros y el resumen del
 * pago. jsPDF se carga recién al pedir el primer recibo.
 */
const pm = (n) => money(n).replace('−', '-');

export const descargarRecibo = async (p, d, titulo) => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 16, NAVY = [10, 14, 61], MAG = [255, 63, 164], GR = [110, 118, 150], INK = [10, 14, 61];
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 38, 'F');
    doc.setFillColor(...MAG); doc.triangle(M, 15, M + 4, 11, M + 8, 15, 'F'); doc.triangle(M, 15, M + 4, 19, M + 8, 15, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setCharSpace(0.9); doc.text('LEARNATION', M + 12, 16.6); doc.setCharSpace(0);
    doc.setFontSize(18); doc.text('Recibo de comisiones', W - M, 17, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(190, 196, 225);
    doc.text(titulo, W - M, 24, { align: 'right' });
    doc.setFillColor(...MAG); doc.rect(0, 38, W, 1.2, 'F');

    let y = 54;
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(p.n, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GR); doc.text(`${p.rol} · ${d.regla}`, M, y + 6.5);
    doc.setFontSize(9); doc.text('COMISIÓN DEL PERÍODO', W - M, y - 7, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...MAG); doc.text(pm(p.com), W - M, y + 1, { align: 'right' });

    const ok = d.rows.filter((r) => !r.fuera);
    autoTable(doc, {
        startY: y + 14, margin: { left: M, right: M },
        head: [[d.h1, 'Cliente', 'Tipo', 'Pagó', '%', 'Comisión']],
        body: d.rows.map((r) => [r.c1, r.cli + (r.sub ? `  · ${r.sub}` : ''), r.tipo, r.fuera ? 'No cuenta' : pm(r.pago), pctTxt(r.pct), r.fuera ? '-' : pm(r.com)]),
        foot: [['', 'Total', `${ok.length} cobros`, pm(sum(ok, (r) => r.pago)), '', pm(p.com)]],
        styles: { font: 'helvetica', fontSize: 8.6, cellPadding: { top: 2.4, bottom: 2.4, left: 2.6, right: 2.6 }, textColor: INK, lineColor: [228, 231, 242], lineWidth: { bottom: 0.2 } },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [245, 247, 251], textColor: INK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 251, 254] },
        columnStyles: { 0: { cellWidth: d.h1 === 'Fecha' ? 16 : 34 }, 3: { halign: 'right' }, 4: { halign: 'right', cellWidth: 13 }, 5: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (h) => {
            if ((h.section === 'head' || h.section === 'foot') && h.column.index >= 3) h.cell.styles.halign = 'right';
            if (h.section === 'body' && d.rows[h.row.index].fuera) {
                h.cell.styles.textColor = GR;
                if (h.column.index === 3) h.cell.styles.textColor = [214, 60, 60];
            }
        },
    });

    y = doc.lastAutoTable.finalY + 12;
    const L = [];
    if (p.base) L.push(['Base', pm(p.base)]);
    L.push(['Comisiones', pm(p.com)]);
    if (p.bonos) L.push(['Bonos', pm(p.bonos)]);
    if (p.recibio) L.push(['Recibido de un cliente', `-${pm(p.recibio)}`]);
    p.mov.filter((x) => x.t === 'desc').forEach((x) => L.push([`Descuento${x.n ? ` (${x.n})` : ''}`, `-${pm(x.m)}`]));
    p.mov.filter((x) => x.t === 'pago').forEach((x) => L.push([`Ya transferido${x.n ? ` (${x.n})` : ''}`, `-${pm(x.m)}`]));
    if (p.estado === 'pagado' && p.pag < p.neto) L.push([p.pag ? 'Ya transferido (resto)' : 'Ya transferido', `-${pm(r2(p.neto - p.pag))}`]);
    const fin = p.demas ? ['Transferido de más', pm(p.demas)] : ['Total a transferir', pm(p.falta)];
    const bw = 92, bx = W - M - bw, bh = 10 + L.length * 6.4 + 14;
    if (y + bh > 280) { doc.addPage(); y = 20; }
    doc.setFillColor(245, 247, 251); doc.roundedRect(bx, y, bw, bh, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GR);
    doc.setCharSpace(0.4); doc.text('RESUMEN DEL PAGO', bx + 6, y + 7); doc.setCharSpace(0);
    let yy = y + 14;
    doc.setFontSize(9.5);
    L.forEach(([a, b]) => {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...GR); doc.text(doc.splitTextToSize(a, bw - 40)[0], bx + 6, yy);
        doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.text(b, bx + bw - 6, yy, { align: 'right' });
        yy += 6.4;
    });
    doc.setDrawColor(210, 214, 230); doc.setLineWidth(0.3); doc.line(bx + 6, yy - 2.6, bx + bw - 6, yy - 2.6);
    doc.setFontSize(11); doc.setTextColor(...INK); doc.text(fin[0], bx + 6, yy + 4.4);
    doc.setTextColor(...MAG); doc.text(fin[1], bx + bw - 6, yy + 4.4, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR);
    doc.text(doc.splitTextToSize('Los montos son lo que llegó a Stripe y Hotmart después de la comisión de cada plataforma (o el estimado, si el pago todavía no está verificado). Un cobro que no llegó o que fue impugnado no genera comisión.', bx - M - 8), M, y + 6);
    const hoy = new Date();
    doc.text(`Emitido el ${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`, M, 290);
    doc.text('Learnation · Payroll', W - M, 290, { align: 'right' });
    doc.save(`Recibo comisiones ${p.n} - ${titulo}.pdf`);
};
