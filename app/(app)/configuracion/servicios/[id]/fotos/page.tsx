'use client';

import { notFound, useParams } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { FotosServicioEditor } from '@/components/reservaOnline/FotosServicioEditor';
import { reservaOnlineHabilitada } from '@/lib/reservaOnline/flag';
import { useServiciosStore } from '@/store/useServicioStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

// Configuracion > Servicios > editar > Fotos de tus trabajos (mockup
// FotosServicio). Con la flag apagada la ruta responde 404, igual que el resto
// de la reserva online. El AgendaThemeScope lo pone el layout de /servicios.
export default function FotosServicioPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const nombre = useServiciosStore((s) => s.servicios.find((x) => x.id === id)?.nombre);
  if (!reservaOnlineHabilitada()) notFound();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 8px' }}>
        <BackButton />
        <h1 style={{ margin: 0, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 22, color: colors.textStrong }}>
          {nombre ?? ''}
        </h1>
      </div>
      <div style={{ padding: '8px 20px 0' }}>{id > 0 && <FotosServicioEditor servicioId={id} />}</div>
    </div>
  );
}
