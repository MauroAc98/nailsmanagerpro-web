'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { fechaDeHoy, nombreDia, nombreMes } from '@/lib/dateFormat';
import { alertDialog } from '@/store/useConfirmStore';

type Duracion = 'todoElDia' | 'horarioPuntual';

// "Vie 25 dic" — versión corta (mismo Intl que nombreDia/nombreMes, formato
// 'short') para el resumen de la vista previa, que no necesita el nombre
// completo del día como sí lo usa la lista de bloqueos.
function formatFechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${nombreDia(d, 'short')} ${d.getDate()} ${nombreMes(d, 'short')}`;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  boxShadow: shadows.card, borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: colors.text, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: colors.textStrong,
  marginBottom: 7, display: 'block', marginLeft: 2,
};

export default function NuevoBloqueoPage() {
  const t = useTranslations('configuracion.NuevoBloqueoPage');
  const router = useRouter();
  const { agregarBloqueo } = useBloqueosAgendaStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  useEffect(() => { if (profesionales.length === 0) fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProfesionales = profesionales.filter(p => p.activo);

  const [fecha, setFecha] = useState(fechaDeHoy());
  // `null` = "Todo el salón" (default) — mismo significado que
  // profesional_id ausente/null en el POST.
  const [profesionalId, setProfesionalId] = useState<number | null>(null);
  // El toggle reemplaza el viejo estado ambiguo "ambos vacíos o ambos
  // cargados" por una elección explícita — `horaDesde`/`horaHasta` solo
  // importan cuando `duracion === 'horarioPuntual'`; en 'todoElDia' se
  // fuerzan a '' antes de armar el payload, sin importar lo que haya
  // quedado tipeado en los inputs ocultos.
  const [duracion, setDuracion] = useState<Duracion>('todoElDia');
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorHorario, setErrorHorario] = useState('');
  const [saving, setSaving] = useState(false);

  const esHorarioPuntual = duracion === 'horarioPuntual';
  const rangoCompleto = Boolean(horaDesde && horaHasta);
  // Con el toggle explícito el único caso pendiente de resolver en submit es
  // un rango parcial (una punta cargada, la otra no) — "ambos vacíos" ya no
  // es alcanzable estando en 'horarioPuntual' porque el botón queda inactivo.
  const puedeGuardar = !esHorarioPuntual || rangoCompleto;

  const profesionalSeleccionada = activeProfesionales.find(p => p.id === profesionalId);
  const nombrePreview = profesionalSeleccionada?.nombre_completo ?? t('allSalonOption');
  const horarioPreview = esHorarioPuntual && rangoCompleto
    ? `${horaDesde} - ${horaHasta}`
    : t('durationLabel.allDayOption');

  const handleGuardar = async () => {
    if (!fecha || !puedeGuardar) return;

    const desde = esHorarioPuntual ? horaDesde : '';
    const hasta = esHorarioPuntual ? horaHasta : '';

    // Mismo invariante que valida el backend (BloqueoAgendaController::store)
    // — chequeado acá primero para no gastar un round-trip en un 422 evitable.
    // Con el toggle explícito solo puede dispararse si el usuario todavía no
    // completó las dos puntas del rango.
    if ((desde && !hasta) || (!desde && hasta)) {
      setErrorHorario(t('incompleteRange'));
      return;
    }
    if (desde && hasta && hasta <= desde) {
      setErrorHorario(t('invalidRange'));
      return;
    }
    setErrorHorario('');

    setSaving(true);
    const result = await agregarBloqueo({
      profesional_id: profesionalId,
      fecha,
      hora_desde: desde || null,
      hora_hasta: hasta || null,
      motivo: motivo.trim() || null,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/bloqueos');
    } else {
      // Cubre tanto 422 (rango/fecha inválidos que igual pasaron el
      // pre-check, ej. reloj desincronizado) como 409 (bloqueo duplicado) —
      // ambos ya vienen como texto listo desde extraerMensajeError.
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.subtext }}>{t('subtitle')}</p>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Fecha */}
        <div>
          <label style={labelStyle}>{t('dateLabel')}</label>
          <input
            type="date"
            min={fechaDeHoy()}
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Profesional — chips, "Todo el salón" primero (default). Mismo
            patrón visual que el selector de profesional de agenda/nuevo. */}
        <div>
          <label style={labelStyle}>{t('whoAffectsLabel')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setProfesionalId(null)}
              style={{
                borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${profesionalId === null ? colors.primarySolid : colors.border}`,
                backgroundColor: profesionalId === null ? colors.primarySolid : colors.surface,
                color: profesionalId === null ? colors.primaryFg : colors.text,
              }}
            >
              {t('allSalonOption')}
            </button>
            {activeProfesionales.map(p => {
              const selected = profesionalId === p.id;
              const color = p.color || colors.primary;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfesionalId(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${selected ? color : colors.border}`,
                    backgroundColor: selected ? color : colors.surface,
                    color: selected ? colors.primaryFg : colors.text,
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800,
                    backgroundColor: selected ? withAlpha(colors.primaryFg, '3D') : withAlpha(color, '26'),
                    color: selected ? colors.primaryFg : color,
                  }}>
                    {inicialesProfesional(p.nombre, p.apellido)}
                  </span>
                  {p.nombre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duración — toggle explícito en vez del viejo "vacío = día
            completo" implícito en un label. Mismo patrón visual que el
            toggle Gastos/Ingresos de categorias-movimientos/page.tsx, pero
            con la celda activa en primarySolid (elección más "fuerte" que
            una simple pestaña de vista). */}
        <div>
          <div style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 12,
            backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`,
          }}>
            <button
              type="button"
              onClick={() => { setDuracion('todoElDia'); setHoraDesde(''); setHoraHasta(''); setErrorHorario(''); }}
              style={{
                flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: 'none', borderRadius: 9,
                backgroundColor: !esHorarioPuntual ? colors.primarySolid : 'transparent',
                color: !esHorarioPuntual ? colors.primaryFg : colors.subtext,
              }}
            >
              {t('durationLabel.allDayOption')}
            </button>
            <button
              type="button"
              onClick={() => setDuracion('horarioPuntual')}
              style={{
                flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: 'none', borderRadius: 9,
                backgroundColor: esHorarioPuntual ? colors.primarySolid : 'transparent',
                color: esHorarioPuntual ? colors.primaryFg : colors.subtext,
              }}
            >
              {t('durationLabel.specificHoursOption')}
            </button>
          </div>
          <p style={{ margin: '6px 0 0 2px', fontSize: 12, color: colors.subtext }}>{t('durationHelp')}</p>

          {esHorarioPuntual && (
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="bloqueo-hora-desde" style={{ ...labelStyle, fontWeight: 400, fontSize: 12 }}>{t('hourFromLabel')}</label>
                <input
                  id="bloqueo-hora-desde"
                  type="time"
                  value={horaDesde}
                  onChange={e => { setHoraDesde(e.target.value); setErrorHorario(''); }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="bloqueo-hora-hasta" style={{ ...labelStyle, fontWeight: 400, fontSize: 12 }}>{t('hourToLabel')}</label>
                <input
                  id="bloqueo-hora-hasta"
                  type="time"
                  value={horaHasta}
                  onChange={e => { setHoraHasta(e.target.value); setErrorHorario(''); }}
                  style={inputStyle}
                />
              </div>
            </div>
          )}
          {errorHorario && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errorHorario}</p>}
        </div>

        {/* Motivo (opcional) */}
        <div>
          <label style={labelStyle}>{t('motivoLabel')}</label>
          <input
            type="text"
            placeholder={t('motivoPlaceholder')}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Vista previa — resumen de una línea que se actualiza en vivo con
            el estado actual del form, para que quede clarísimo qué se va a
            bloquear antes de confirmar. */}
        <div
          data-testid="preview-bloqueo"
          style={{
            padding: '12px 16px', borderRadius: 12,
            backgroundColor: colors.primarySoft, border: `1px solid ${withAlpha(colors.primary, '4D')}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: colors.textStrong }}>{t('previewLabel')}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: colors.text }}>
            {nombrePreview} · {formatFechaCorta(fecha)} · {horarioPreview}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleGuardar}
          disabled={saving || !puedeGuardar}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: (saving || !puedeGuardar) ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: (saving || !puedeGuardar) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}
