'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { CalendarioMensual } from '@/components/agenda/CalendarioMensual';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { NAV_CLEARANCE } from '@/constants/layout';
import { fechaDeHoy } from '@/lib/dateFormat';

export interface ElegirFechaBloqueHandle {
  abrir: () => void;
}

const primerDiaDelMes = (fecha: string) => {
  const [y, m] = fecha.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

// Hoja "Elegir fecha" (la misma de la agenda) para el día de cada turno de
// "Nuevo turno" con varios turnos. Tocar un día es la confirmación.
export const ElegirFechaBloqueSheet = forwardRef<ElegirFechaBloqueHandle, {
  fecha:    string;                      // día del turno que se está editando
  onSelect: (fecha: string) => void;
}>(function ElegirFechaBloqueSheet({ fecha, onSelect }, ref) {
  const t = useTranslations('agenda.ElegirFechaSheet');
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [viewDate, setViewDate] = useState<Date>(() => primerDiaDelMes(fecha));

  useImperativeHandle(ref, () => ({
    abrir: () => {
      setViewDate(primerDiaDelMes(fecha));
      sheetRef.current?.snapToIndex(0);
    },
  }), [fecha]);

  const hoy = fechaDeHoy();

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={[0.65]}
      initialIndex={-1}
      enablePanDownToClose
      handleColor={colors.border}
      backgroundColor={colors.surface}
      bottomOffset={NAV_CLEARANCE}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
        <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong }}>
          {t('title')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={() => setViewDate(primerDiaDelMes(hoy))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: colors.primaryDeep }}
          >
            {t('today')}
          </button>
          <button
            type="button"
            onClick={() => sheetRef.current?.close()}
            aria-label={t('close')}
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} color={colors.text} strokeWidth={2} />
          </button>
        </div>
      </div>
      <CalendarioMensual
        viewDate={viewDate}
        onMonthChange={setViewDate}
        fechaSeleccionada={fecha}
        turnosMes={[]}
        // No se agenda en el pasado (validarTurno lo rechazaría igual).
        diaDeshabilitado={dia => dia < hoy}
        onDayClick={dia => { onSelect(dia); sheetRef.current?.close(); }}
      />
    </BottomSheet>
  );
});
