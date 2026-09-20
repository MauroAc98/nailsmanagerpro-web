'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import { profesionalPalette } from '@/theme/colors';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import PillToggle from '@/components/PillToggle';
import { SelectorServicios } from '@/components/SelectorServicios';
import WeekdayPicker from '@/components/WeekdayPicker';
import { diasAtencionParaGuardar } from '@/lib/diasAtencionParaGuardar';
import { LogoCropModal } from '@/components/perfil/LogoCropModal';

// Mismo límite que valida el backend (`image|max:5120` = 5MB) — mismo
// criterio y copy que HeroPerfil.MAX_LOGO_BYTES para el logo del negocio.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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

export default function EditarProfesionalPage() {
  const t = useTranslations('configuracion.EditarProfesionalPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { profesionales, fetchProfesionales, actualizarProfesional, subirAvatar, borrarAvatar } = useProfesionalStore();
  const { servicios, fetchServicios } = useServiciosStore();

  const [nombre,      setNombre]      = useState('');
  const [apellido,    setApellido]    = useState('');
  const [color,       setColor]       = useState<string>(profesionalPalette[0]);
  const [activo,      setActivo]      = useState(true);
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  // Archivo recién elegido, pendiente de recorte — mismo criterio que
  // HeroPerfil.archivoParaRecortar.
  const [archivoAvatarParaRecortar, setArchivoAvatarParaRecortar] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // `null` (atiende todos los días) se hidrata como `[]` en el picker —
  // WeekdayPicker no distingue "todos" de "ninguno" visualmente, ambos se
  // muestran sin chips marcados (ver diasAtencionParaGuardar al guardar).
  const [diasAtencion, setDiasAtencion] = useState<number[]>([]);
  const [servicioIds, setServicioIds] = useState<number[]>([]);
  const [errorNombre, setErrorNombre] = useState('');
  const [loadingProfesional, setLoadingProfesional] = useState(true);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    const cargar = async () => {
      if (servicios.length === 0) fetchServicios();

      let p = profesionales.find(x => x.id === id);
      if (!p) {
        await fetchProfesionales();
      }
      p = useProfesionalStore.getState().profesionales.find(x => x.id === id);

      if (!p) {
        await alertDialog(t('loadError'));
        router.push('/configuracion/profesionales');
        return;
      }

      setNombre(p.nombre);
      setApellido(p.apellido ?? '');
      setColor(p.color || profesionalPalette[0]);
      setActivo(p.activo);
      setAvatarUrl(p.avatar_url);
      setDiasAtencion(p.dias_atencion ?? []);
      // `p.servicios` viene de `->with('servicios')` en el backend, sin
      // filtrar por `activo` (ver Profesional::servicios / ProfesionalController@index) —
      // incluye servicios inactivos ya asignados. Semillar acá con TODOS
      // los ids (no solo los activos) es lo que le permite a
      // `SelectorServicios` preservarlos aunque no los muestre: el
      // componente filtra a activos solo para renderizar, pero cualquier id
      // fuera de ese subconjunto pasa intacto por sus mutaciones (ver su
      // prop `selectedIds`).
      setServicioIds(p.servicios.map(s => s.id));
      setLoadingProfesional(false);
    };
    if (id) cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }

    // Nombre completo (no solo 'nombre') — mismo criterio que la pantalla
    // de alta, ver Profesional::nombreCompleto en el backend.
    const nombreCompletoNormalizado = `${nombre.trim()} ${apellido.trim()}`.trim().toLowerCase();
    const duplicado = profesionales.find(p => p.nombre_completo.toLowerCase() === nombreCompletoNormalizado && p.id !== id);
    if (duplicado) {
      const msg = duplicado.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await actualizarProfesional(id, {
      nombre: nombre.trim(),
      apellido: apellido.trim() || null,
      color,
      activo,
      servicio_ids: servicioIds,
      dias_atencion: diasAtencionParaGuardar(diasAtencion),
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/profesionales');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  const handleSeleccionarAvatar = () => {
    if (subiendoAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleArchivoAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo si el intento anterior falló
    if (!archivo) return;

    if (archivo.size > MAX_AVATAR_BYTES) {
      await alertDialog(t('avatarTooLarge'));
      return;
    }

    setArchivoAvatarParaRecortar(archivo);
  };

  const handleRecorteAvatarConfirmado = async (archivoRecortado: File) => {
    setArchivoAvatarParaRecortar(null);
    setSubiendoAvatar(true);
    const result = await subirAvatar(id, archivoRecortado);
    setSubiendoAvatar(false);
    if (result.success) {
      setAvatarUrl(useProfesionalStore.getState().profesionales.find(p => p.id === id)?.avatar_url ?? null);
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  const handleQuitarAvatar = async () => {
    const confirmado = await confirmDialog(t('avatarRemoveConfirm'), {
      confirmText: t('avatarRemoveConfirmButton'),
      danger: true,
    });
    if (!confirmado) return;

    setSubiendoAvatar(true);
    const result = await borrarAvatar(id);
    setSubiendoAvatar(false);
    if (result.success) {
      setAvatarUrl(null);
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  if (loadingProfesional) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtext }}>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Avatar — circulo tappable con recorte 1:1 (reusa LogoCropModal
          generalizado con aspectRatio, mismo patron que HeroPerfil para el
          logo del negocio). Con avatar guardado aparece la insignia de
          quitar; sin avatar, la insignia de camara invita a subir uno. */}
      <div style={{ padding: '0 20px 4px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 84, height: 84 }}>
          <button
            type="button"
            onClick={handleSeleccionarAvatar}
            disabled={subiendoAvatar}
            aria-label={t('avatarChange')}
            style={{
              position: 'relative', width: '100%', height: '100%', padding: 0,
              background: 'none', border: 'none', cursor: subiendoAvatar ? 'default' : 'pointer',
            }}
          >
            <div style={{
              position: 'relative', width: '100%', height: '100%', borderRadius: 42,
              backgroundColor: colors.surface2, border: `2px solid ${colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 30, fontWeight: 700, color: colors.primaryDeep }}>
                  {nombre.trim().charAt(0).toUpperCase() || '?'}
                </span>
              )}
              {subiendoAvatar && (
                <div style={{
                  position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div className="loader-spinner" style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                  }} />
                </div>
              )}
            </div>
            {!subiendoAvatar && (
              <span
                aria-hidden
                style={{
                  position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: colors.primarySolid, border: `2px solid ${colors.background}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Camera size={12} color="#fff" strokeWidth={2.2} />
              </span>
            )}
          </button>
          {avatarUrl && !subiendoAvatar && (
            <button
              type="button"
              onClick={handleQuitarAvatar}
              aria-label={t('avatarRemove')}
              style={{
                position: 'absolute', top: -4, left: -4, width: 22, height: 22, borderRadius: '50%', padding: 0,
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                fontSize: 13, lineHeight: 1, color: colors.dangerBorder,
              }}
            >
              ×
            </button>
          )}
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleArchivoAvatar} />
      </div>

      {archivoAvatarParaRecortar && (
        <LogoCropModal
          archivo={archivoAvatarParaRecortar}
          aspectRatio={1}
          onCancelar={() => setArchivoAvatarParaRecortar(null)}
          onConfirmar={handleRecorteAvatarConfirmado}
        />
      )}

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Nombre */}
        <div>
          <label style={labelStyle}>{t('nameLabel')}</label>
          <input
            type="text"
            placeholder={t('namePlaceholder')}
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorNombre(''); }}
            style={{ ...inputStyle, borderColor: errorNombre ? colors.dangerBorder : colors.border }}
          />
          {errorNombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errorNombre}</p>}
        </div>

        {/* Apellido */}
        <div>
          <label style={labelStyle}>{t('lastNameLabel')}</label>
          <input
            type="text"
            placeholder={t('lastNamePlaceholder')}
            value={apellido}
            onChange={e => setApellido(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>{t('colorLabel')}</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>

        {/* Activo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('activeLabel')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {activo ? t('activeSubtitleOn') : t('activeSubtitleOff')}
            </p>
          </div>
          <PillToggle value={activo} onChange={setActivo} />
        </div>

        {/* Días que atiende */}
        <div>
          <label style={labelStyle}>{t('workingDaysLabel')}</label>
          <WeekdayPicker value={diasAtencion} onChange={setDiasAtencion} />
          <p style={{ margin: '6px 0 0 2px', fontSize: 12, color: colors.subtext }}>{t('workingDaysHint')}</p>
        </div>

        {/* Servicios */}
        <div>
          <label style={labelStyle}>{t('servicesLabel')}</label>
          <SelectorServicios
            servicios={servicios}
            mode="multi"
            selectedIds={servicioIds}
            onChange={setServicioIds}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: saving ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}
