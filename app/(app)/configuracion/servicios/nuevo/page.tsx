'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useServiciosStore } from '@/store/useServicioStore';
import { servicioService, type ModoPromo } from '@/services/servicioService';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { SelectorCategoriaServicio } from '@/components/configuracion/SelectorCategoriaServicio';
import DuracionPicker from '@/components/DuracionPicker';
import { alertDialog } from '@/store/useConfirmStore';
import { parsearMonto } from '@/lib/parsearMonto';
import PillToggle from '@/components/PillToggle';
import SenaPreviewServicio from '@/components/servicios/SenaPreviewServicio';
import ComponentesPromoSection from '@/components/servicios/ComponentesPromoSection';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { consumirBorrador, guardarBorrador, limpiarBorrador } from '@/lib/servicioBorrador';
import {
  duracionDerivada, hayFilaIncompleta, paraleloDisponible, resumenComponentes, serviciosComponibles,
  type ComponenteDraft,
} from '@/lib/promoComponentes';

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

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
interface BorradorNuevo {
  categoriaId: number | null; nombre: string; duracion: number; precio: string; esPromo: boolean;
  componentes: ComponenteDraft[]; modoPromo: ModoPromo; precioComponentes: string;
}
const CLAVE_BORRADOR = 'nuevo';

function NuevoServicioContent() {
  const t = useTranslations('configuracion.NuevoServicioPage');
  const router = useRouter();
  const { servicios, agregarServicio } = useServiciosStore();
  // El selector (SelectorCategoriaServicio) es dueño de su propio fetch de
  // categorías (design D4) — esta página solo sigue leyendo `loading` para
  // el guard de submit compartido (ver comentario abajo, sin cambios de
  // criterio respecto a la versión previa).
  const { loading: categoriasLoading } = useCategoriasServicioStore();
  const searchParams = useSearchParams();

  // `?categoria={id}` es una SEED, no un binding (design D5): se lee una
  // sola vez acá, en el inicializador de useState, nunca en un efecto — un
  // efecto pisaría los taps posteriores del usuario en el selector. El
  // quick-add por categoría (Slice B, CategoriaHeader) es el único origen
  // que manda este param; el FAB global abre sin él.
  // Borrador de la ida a Horarios: se consume una sola vez al montar (si el
  // usuario vuelve de ahí); gana sobre la seed de la URL.
  const [borrador] = useState<BorradorNuevo | null>(() => consumirBorrador<BorradorNuevo>(CLAVE_BORRADOR));
  const [categoriaId, setCategoriaId] = useState<number | null>(() => {
    if (borrador) return borrador.categoriaId;
    const raw = searchParams.get('categoria');
    return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  });

  const [nombre,  setNombre]  = useState(borrador?.nombre ?? '');
  const [duracion, setDuracion] = useState(borrador?.duracion ?? 30);
  const [precio,  setPrecio]  = useState(borrador?.precio ?? '');
  const [esPromo, setEsPromo] = useState(borrador?.esPromo ?? false);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving,  setSaving]  = useState(false);

  // Componentes de la promo: la sección arranca vacía y solo se ofrece con
  // más de una persona activa (mismo criterio que la pantalla de edición).
  // Los componentes se guardan DESPUÉS de crear el servicio (necesitan su id).
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { user } = useAuthStore();
  const [componentes, setComponentes] = useState<ComponenteDraft[]>(borrador?.componentes ?? []);
  const [modoPromo, setModoPromo] = useState<ModoPromo>(borrador?.modoPromo ?? 'secuencia');
  const [precioComponentes, setPrecioComponentes] = useState(borrador?.precioComponentes ?? '');
  const [modoError, setModoError] = useState('');

  // Hasta que el roster responde no se sabe si la promo lleva componentes:
  // Duración/Precio se ocultan para que no aparezcan y desaparezcan.
  const [rosterIntentado, setRosterIntentado] = useState(false);
  useEffect(() => {
    if (esPromo && profesionales.length === 0) {
      Promise.resolve(fetchProfesionales()).finally(() => setRosterIntentado(true));
    }
  }, [esPromo]); // eslint-disable-line react-hooks/exhaustive-deps
  const esperandoRoster = esPromo && profesionales.length === 0 && !rosterIntentado;

  // Apagar el toggle descarta lo cargado en la sección.
  const handlePromoChange = (value: boolean) => {
    setEsPromo(value);
    if (!value) {
      setComponentes([]);
      setModoPromo('secuencia');
      setPrecioComponentes('');
      setModoError('');
    }
  };

  const activas = profesionales.filter(p => p.activo).length;
  const mostrarComponentes = esPromo && activas > 1;
  const { aGuardar, tieneComponentes, sumaActual, precioOverride } =
    resumenComponentes(componentes, servicios, precioComponentes);
  const paraleloHabilitado = paraleloDisponible(user?.atiende_en_paralelo, activas);

  const guardarBorradorActual = () => guardarBorrador(CLAVE_BORRADOR, {
    categoriaId, nombre, duracion, precio, esPromo, componentes, modoPromo, precioComponentes,
  } satisfies BorradorNuevo);

  const handleGuardar = async () => {
    setModoError('');
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }
    if (!mostrarComponentes && duracion <= 0) {
      await alertDialog(t('invalidDuration'));
      return;
    }
    const precioNumerico = precio.trim() && !mostrarComponentes ? parsearMonto(precio) : undefined;
    if (precioNumerico === null) {
      await alertDialog(t('invalidPrice'));
      return;
    }

    if (mostrarComponentes && hayFilaIncompleta(componentes)) {
      await alertDialog(t('incompleteRow'));
      return;
    }
    if (mostrarComponentes && !tieneComponentes) {
      await alertDialog(t('promoNeedsComponents'));
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const existente = servicios.find(s => s.nombre.toLowerCase() === nombreNormalizado);
    if (existente) {
      const msg = existente.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await agregarServicio({
      nombre: nombre.trim(),
      duracion_minutos: duracion,
      precio: precioNumerico,
      es_promo: esPromo,
      categoria_id: categoriaId,
    });

    if (result.success && mostrarComponentes && tieneComponentes && result.id !== undefined) {
      try {
        await servicioService.guardarComponentes(result.id, {
          modo_promo: modoPromo, precio: precioOverride, componentes: aGuardar,
        });
        await useServiciosStore.getState().fetchServicios();
      } catch {
        // El servicio ya existe: no se pierde. Se avisa en neutro y se lleva
        // a su pantalla de edición para reintentar los componentes ahí.
        setSaving(false);
        await alertDialog(t('componentsSaveError'));
        router.push(`/configuracion/servicios/${result.id}`);
        return;
      }
    }
    setSaving(false);

    if (result.success) {
      limpiarBorrador(CLAVE_BORRADOR);
      router.push('/configuracion/servicios');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    // AgendaThemeScope vive en app/(app)/configuracion/servicios/layout.tsx
    // (segmento completo migrado — listado + nuevo + [id]), no acá.
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton onClick={() => { limpiarBorrador(CLAVE_BORRADOR); router.back(); }} />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Categoría — primer campo (spec: service-category-assignment,
            "MUST always be visible and be the first field"), siempre
            visible incluso con cero categorías cargadas. */}
        <SelectorCategoriaServicio value={categoriaId} onChange={setCategoriaId} />

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

        {/* Promo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('promoLabel')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {t('promoHint')}
            </p>
          </div>
          <PillToggle value={esPromo} onChange={handlePromoChange} />
        </div>

        {mostrarComponentes && (
          <ComponentesPromoSection
            componentes={componentes}
            onChange={setComponentes}
            servicios={serviciosComponibles(servicios, -1)}
            profesionales={profesionales}
            problemas={[]}
            modo={modoPromo}
            onModoChange={setModoPromo}
            paraleloHabilitado={paraleloHabilitado}
            modoError={modoError || undefined}
            duracionDerivada={duracionDerivada(modoPromo, componentes, servicios)}
            sumaComponentes={sumaActual}
            precioComponentes={precioComponentes}
            onPrecioComponentesChange={setPrecioComponentes}
            onBeforeNavigate={guardarBorradorActual}
          />
        )}

        {/* Duración y precio: con la promo activa y 2+ personas en actividad se
            arman desde los componentes (la sección muestra la duración derivada
            y el precio), así que no se piden acá. */}
        {!mostrarComponentes && !esperandoRoster && (<>
        <div>
          <label style={labelStyle}>{t('durationLabel')}</label>
          <DuracionPicker value={duracion} onChange={setDuracion} />
        </div>

        {/* Precio */}
        <div>
          <label style={labelStyle}>{t('priceLabel')}</label>
          <input
            type="text"
            placeholder={t('pricePlaceholder')}
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            style={inputStyle}
            inputMode="decimal"
          />
        </div>
        <SenaPreviewServicio nombre={nombre} precio={precio} onUsarPrecio={setPrecio} />
        </>)}

        {/* Button */}
        {/* categoriasLoading también deshabilita: fetchCategorias() (ahora
            disparado dentro de SelectorCategoriaServicio) y
            agregarServicio() comparten el mismo withGlobalLoader booleano
            (no contador, ver comentario en useServicioStore.ts) — si el
            submit dispara mientras la categoría todavía está en vuelo, el
            finally que termine primero apaga el spinner con la otra
            operación todavía en curso. Bloquear el submit hasta que
            categorías resuelva evita el solape en vez de intentar arreglar
            el contador compartido. */}
        <button
          onClick={handleGuardar}
          disabled={saving || categoriasLoading}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: (saving || categoriasLoading) ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: (saving || categoriasLoading) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — wraps in Suspense for useSearchParams (mismo patrón que
// app/(app)/agenda/nuevo/page.tsx)
// ─────────────────────────────────────────────
export default function NuevoServicioPage() {
  const t = useTranslations('configuracion.NuevoServicioPage');
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: colors.subtext }}>{t('loading')}</div>}>
      <NuevoServicioContent />
    </Suspense>
  );
}
