import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmbudoFormulario from './EmbudoFormulario';
import { agruparPorBloque, masAbandonadas, seFueronSolas } from '../lib/embudoFormulario';

/**
 * El embudo del formulario muestra DÓNDE se queda la gente. Lo que importa: que agrupe por bloque
 * en el orden del formulario, que destaque las 3 preguntas con más abandono y que NO cuente como
 * abandono a quienes cortó el propio formulario por una respuesta excluyente.
 */

const e = (orden, campo, bloque, cantidad, abandonaron_aca = 0, descartadas_aca = 0) => ({
    orden, campo, etapa: `Pregunta ${campo}`, bloque, opcional: false, cantidad,
    pct_del_total: cantidad, abandonaron_aca, descartadas_aca,
    pct_abandono: cantidad ? Math.round((1000 * abandonaron_aca) / cantidad) / 10 : 0,
});

const ITEMS = [
    e(1, 'pais', 'Identificación', 100, 2),
    e(2, 'nombre', 'Identificación', 98, 3),
    e(3, 'equipo', 'Requisitos', 95, 20, 20), // todas cortadas por el formulario
    e(4, 'edad', 'Requisitos', 75, 10),
    e(5, 'remuneracion', 'Remuneración', 65, 25),
    e(6, 'cv', 'Video y CV', 40, 5),
];

describe('helpers', () => {
    it('seFueronSolas descuenta las que cortó el formulario', () => {
        expect(seFueronSolas(ITEMS[2])).toBe(0);
        expect(seFueronSolas(ITEMS[4])).toBe(25);
    });

    it('masAbandonadas devuelve las 3 con más abandono propio, ignorando las cortadas', () => {
        expect(masAbandonadas(ITEMS)).toEqual(['remuneracion', 'edad', 'cv']);
    });

    it('masAbandonadas no destaca preguntas sin bajas', () => {
        expect(masAbandonadas([e(1, 'pais', 'Identificación', 10, 0)])).toEqual([]);
    });

    it('agruparPorBloque respeta el orden del formulario', () => {
        const grupos = agruparPorBloque(ITEMS);
        expect(grupos.map((g) => g.bloque)).toEqual(['Identificación', 'Requisitos', 'Remuneración', 'Video y CV']);
        expect(grupos[0].items.map((x) => x.campo)).toEqual(['pais', 'nombre']);
    });
});

describe('EmbudoFormulario', () => {
    it('muestra un encabezado por bloque y una fila por pregunta', () => {
        render(<EmbudoFormulario items={ITEMS} />);

        ['Identificación', 'Requisitos', 'Remuneración', 'Video y CV'].forEach((b) => {
            expect(screen.getByText(b)).toBeInTheDocument();
        });
        ITEMS.forEach((x) => expect(screen.getByText(x.etapa)).toBeInTheDocument());
    });

    it('muestra cantidad y abandono junto a la barra', () => {
        render(<EmbudoFormulario items={ITEMS} />);

        expect(screen.getByText('−25 · 39 %')).toBeInTheDocument();
        expect(screen.getByText('−5 · 13 %')).toBeInTheDocument();
    });

    it('destaca con puestos 1, 2 y 3 las preguntas con más abandono', () => {
        render(<EmbudoFormulario items={ITEMS} />);

        expect(screen.getAllByLabelText(/Puesto \d en abandono/)).toHaveLength(3);
        const primero = screen.getByLabelText('Puesto 1 en abandono');
        expect(primero.parentElement).toHaveTextContent('Pregunta remuneracion');
    });

    it('sin postulaciones avisa que no hay datos', () => {
        render(<EmbudoFormulario items={[e(1, 'pais', 'Identificación', 0)]} />);
        expect(screen.getByText('Todavía sin datos.')).toBeInTheDocument();
    });

    it('tolera que el backend no mande el embudo', () => {
        render(<EmbudoFormulario items={undefined} />);
        expect(screen.getByText('Todavía sin datos.')).toBeInTheDocument();
    });
});
