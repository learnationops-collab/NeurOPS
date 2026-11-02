// La segmentación avisa lo que no cierra.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { normalForm } from '../../core/normalizar';
import Ruteo from './Ruteo';

const d = { funnels: [], formularios: [], personas: [], eventos: [], roles: [], grupos: [{ id: 'g1', nombre: 'Ultra', miembros: [], estrategia: 'llenar', orden: 1 }, { id: 'g2', nombre: 'Media', miembros: [], estrategia: 'llenar', orden: 2 }] };
const f = normalForm('f', {
    preguntas: [{ id: 'q1', tipo: 'opciones', titulo: '¿Cuánto?', opciones: [{ id: 'a', texto: 'Mucho' }, { id: 'b', texto: 'Poco' }] }],
    reglas: [{ id: 'r1', grupo: 'g1', cond: [{ q: 'q1', ops: ['a', 'b'] }] }, { id: 'r2', grupo: 'g2', cond: [{ q: 'q1', ops: ['a'] }] }],
    resto: 'g2',
});
const envolver = (el) => <div className="thalamus thalamus-app">{el}</div>;

describe('Ruteo', () => {
    it('avisa la regla que nunca decide', () => {
        render(envolver(<Ruteo f={f} d={d} modo="reglas" msel={null} />));
        expect(screen.getByText(/La regla 2 nunca decide: sus casos ya los toma la regla 1/)).toBeInTheDocument();
    });
    it('sin problemas lo dice', () => {
        const ok = normalForm('f', { ...f, reglas: [f.reglas[0]] });
        render(envolver(<Ruteo f={{ ...ok, preguntas: f.preguntas }} d={d} modo="reglas" msel={null} />));
        expect(screen.getByText('Cada combinación de respuestas tiene un solo destino.')).toBeInTheDocument();
    });
});
