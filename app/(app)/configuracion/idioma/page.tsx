'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useLocaleStore, setLocale } from '@/store/useLocaleStore';
import { SUPPORTED, LOCALE_LABELS, type Locale } from '@/lib/locale';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/store/useToastStore';

// Estructuralmente calcada de configuracion/apariencia/page.tsx (mismo
// layout de lista de opciones seleccionables). A diferencia de Apariencia
// (preferencia 100% local), acá cada elección se persiste en el backend
// vía PUT /api/perfil — ver design.md "Switch (no reload)".
export default function IdiomaPage() {
  const t = useTranslations('configuracion.IdiomaPage');
  const locale = useLocaleStore(state => state.locale);
  const { updatePerfil } = useAuth();
  const [guardando, setGuardando] = useState<Locale | null>(null);

  const handleSelect = async (nuevoLocale: Locale) => {
    if (nuevoLocale === locale || guardando) return;

    setGuardando(nuevoLocale);
    try {
      // Optimista: cambia la UI y persiste localStorage/cookie/<html lang>
      // de inmediato, sin esperar la respuesta del backend (ver
      // store/useLocaleStore.ts). NextIntlClientProvider re-renderiza todo
      // el árbol con el catálogo nuevo, sin reload.
      await setLocale(nuevoLocale);
      // authService.updatePerfil ya reescribe localStorage.auth_user
      // completo con la respuesta del server, así que un refresh no
      // regresiona a un locale viejo.
      await updatePerfil({ locale: nuevoLocale });
    } catch {
      // No revertimos el cambio local — queda aplicado en este
      // dispositivo aunque no se haya podido persistir en el backend.
      showToast(t('persistFailedWarning'));
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        {t('subtitle')}
      </p>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SUPPORTED.map(opcion => {
          const selected = locale === opcion;
          return (
            <button
              key={opcion}
              onClick={() => handleSelect(opcion)}
              disabled={guardando !== null}
              style={{
                display: 'flex', alignItems: 'center', gap: 15,
                backgroundColor: selected ? withAlpha(colors.primary, '12') : colors.surface,
                border: `1px solid ${selected ? colors.primaryDeep : colors.border}`,
                boxShadow: shadows.card, borderRadius: 14,
                padding: '14px 16px', cursor: guardando !== null ? 'not-allowed' : 'pointer', textAlign: 'left',
                opacity: guardando !== null && guardando !== opcion ? 0.6 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>{LOCALE_LABELS[opcion]}</p>
              </div>
              {selected && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
