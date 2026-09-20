import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import SelectorProfesional from './SelectorProfesional';

// Fila compartida de pills profesional — nueva capacidad opcional: mostrar
// una foto real (avatar) en vez de las iniciales, cuando el caller la pasa
// (ver reserva online HorarioScreen, que pasa salon.profesionales tal cual
// y ahora esas incluyen avatarUrl). Callers que no pasan avatarUrl (agenda,
// historia, historia-precios) siguen viendo exactamente las iniciales de
// siempre — este test cubre solo la capacidad nueva, aditiva.
describe('SelectorProfesional — avatarUrl', () => {
  const profesionales = [
    { id: 1, nombre: 'Ana', avatarUrl: 'https://cdn.test/ana.jpg' },
    { id: 2, nombre: 'Lucía' },
  ];

  it('con avatarUrl muestra la foto real en el pill', () => {
    renderWithProviders(
      <SelectorProfesional label="Profesional" profesionales={profesionales} selectedId={null} onSelect={() => {}} />,
    );
    expect(document.querySelector('img[src="https://cdn.test/ana.jpg"]')).not.toBeNull();
  });

  it('sin avatarUrl sigue mostrando las iniciales', () => {
    renderWithProviders(
      <SelectorProfesional label="Profesional" profesionales={profesionales} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText('LU')).toBeInTheDocument();
  });
});
