import { useTranslations } from 'next-intl';

// Abreviaturas lunes-primero para el texto de días — reusa las mismas
// traducciones que WeekdayPicker (`*Full`, recortadas a 3 letras: "Lunes" ->
// "Lun") en vez de duplicar un set de claves nuevo solo para esto.
export function useAbreviaturasDias(): Record<number, string> {
  const t = useTranslations('common.WeekdayPicker');
  return {
    0: t('sunFull').slice(0, 3),
    1: t('monFull').slice(0, 3),
    2: t('tueFull').slice(0, 3),
    3: t('wedFull').slice(0, 3),
    4: t('thuFull').slice(0, 3),
    5: t('friFull').slice(0, 3),
    6: t('satFull').slice(0, 3),
  };
}
