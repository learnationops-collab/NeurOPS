import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Embudo, Estados, Tarjetas } from './TriagePaneles';

const M = {
    agendas: 11, asistencias: 5, no_show: 1, canceladas: 1, reagendadas: 1, sin_reporte: 1, por_ocurrir: 1, fuera: 1,
    calificados: 2, descalificados: 1, en_seguimiento: 1, sin_calificar: 1, pitch_low_ticket: 1, cerrado: 0,
    pasaron: 2, closer_asistieron: 1, closer_no_asistieron: 0, closer_cerraron: 1, closer_pendientes: 1,
    closer_por_venir: 1, closer_sin_reporte: 0, closer_senas: 0, closer_cobrado: 0,
};

describe('Triage › Estados (ADR-W145)', () => {
    it('reparte la base del show up, deja aparte lo que no cuenta y cada cifra abre su lista', () => {
        const onVer = vi.fn();
        const { container } = render(<Estados m={M} onVer={onVer} />);

        expect(screen.getByText('56%')).toBeInTheDocument();
        expect(screen.getByText('5 de 9')).toBeInTheDocument();
        ['Se presentó', 'No show', 'Canceló', 'Reprogramó', 'Sin reportar'].forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());

        fireEvent.click(screen.getByText('Reprogramó'));
        fireEvent.click(screen.getByRole('button', { name: '1 otros' }));
        fireEvent.click(screen.getByRole('button', { name: '1 aún no ocurren' }));
        expect(onVer.mock.calls.map(([clave]) => clave)).toEqual(['reagendadas', 'fuera', 'por_ocurrir']);

        const desglose = container.querySelector('.tg-desglose');
        expect(within(desglose).getAllByRole('button')).toHaveLength(4);
        fireEvent.click(within(desglose).getByText('sin calificar'));
        expect(onVer).toHaveBeenLastCalledWith('sin_calificar');
    });

    it('sin nada fuera de la base no muestra la tira «No cuentan»', () => {
        render(<Estados m={{ ...M, por_ocurrir: 0, fuera: 0, agendas: 9 }} onVer={() => {}} />);
        expect(screen.queryByText('NO CUENTAN')).not.toBeInTheDocument();
    });
});

describe('Triage › Embudo de seis pasos', () => {
    it('muestra los seis pasos con su cuenta y «pasaron» partido por closer', () => {
        const onVer = vi.fn();
        const closers = [{ id: 4, nombre: 'Jean Carlo', pasaron: 2, asistieron: 1, cerraron: 1 }];
        render(<Embudo m={M} onVer={onVer} closers={closers} colores={{ 4: '#4E8BD8' }} />);

        ['AGENDAS', 'CUALIFICADAS', 'PASARON', 'CERRARON'].forEach((r) => expect(screen.getByText(r)).toBeInTheDocument());
        expect(screen.getAllByText('ASISTIERON')).toHaveLength(2);
        expect(screen.getByText('5 de 9 con destino')).toBeInTheDocument();
        expect(screen.getByText('2 de 2 cualificadas')).toBeInTheDocument();
        expect(screen.getByText('CUELLO DE BOTELLA · CUALIFICADAS')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Jean Carlo · 2'));
        expect(onVer).toHaveBeenLastCalledWith('cl:4:pasaron');
    });
});

describe('Triage › tarjeta Asistencia', () => {
    it('dice la cuenta sobre las agendas con destino y lo que no cuenta', () => {
        const onVer = vi.fn();
        render(<Tarjetas m={M} onVer={onVer} />);

        fireEvent.click(screen.getByRole('button', { name: '9 con destino' }));
        fireEvent.click(screen.getByRole('button', { name: '1 reprogramó' }));
        expect(onVer.mock.calls.map(([clave]) => clave)).toEqual(['base', 'reagendadas']);
        expect(screen.getByText(/No cuentan:/)).toBeInTheDocument();
    });
});
