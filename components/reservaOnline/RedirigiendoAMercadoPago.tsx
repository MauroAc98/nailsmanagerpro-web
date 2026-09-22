'use client';

import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';

// Se muestra en vez de TODA la pantalla de Resumen (header, boton volver,
// barra inferior incluidos) mientras se espera iniciarPago() y durante el
// hueco entre setear window.location.href y que el navegador efectivamente
// navegue a Mercado Pago — sin esto la pantalla se veia "congelada" (solo el
// texto del boton cambiaba) y el boton volver seguia tocable, dejando
// reprogramar/cancelar el hold a mitad de una navegacion ya en curso.
export function RedirigiendoAMercadoPago() {
  const t = useTranslations('reservaOnline.resumen');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '90px 12px 0' }}>
      <div
        className="loader-spinner"
        style={{
          width: 44, height: 44, borderRadius: 22,
          border: `4px solid ${colors.border}`,
          borderTopColor: colors.primaryDeep,
        }}
      />
      <h1 style={{ margin: '26px 0 8px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 24, color: colors.strong }}>
        {t('redirigiendoTitulo')}
      </h1>
      <div style={{ fontSize: 14.5, color: colors.sub, lineHeight: 1.5, maxWidth: 260 }}>{t('redirigiendoDetalle')}</div>
    </div>
  );
}
