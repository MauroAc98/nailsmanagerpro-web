'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import SelectorOpciones from '@/components/SelectorOpciones';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useLocaleStore, setLocale } from '@/store/useLocaleStore';
import { SUPPORTED, LOCALE_LABELS, type Locale } from '@/lib/locale';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/store/useToastStore';

// Estructuralmente calcada de configuracion/apariencia/page.tsx (ambas
// comparten SelectorOpciones, ver components/SelectorOpciones.tsx). A
// diferencia de Apariencia (preferencia 100% local), acá cada elección se
// persiste en el backend vía PUT /api/perfil — ver design.md "Switch (no
// reload)".
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

  const OPCIONES = SUPPORTED.map(opcion => ({ value: opcion, title: LOCALE_LABELS[opcion] }));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 100 }}>
      {/* Header — mismo patrón que apariencia/page.tsx */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        {t('subtitle')}
      </p>

      <SelectorOpciones opciones={OPCIONES} selected={locale} onSelect={handleSelect} loadingValue={guardando} />
    </div>
  );
}
