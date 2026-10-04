'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useServiciosStore } from '@/store/useServicioStore';
import { servicioService, type AlineacionSlots, type ModoPromo, type ProblemaPromo } from '@/services/servicioService';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { SelectorCategoriaServicio } from '@/components/configuracion/SelectorCategoriaServicio';
import DuracionPicker from '@/components/DuracionPicker';
import { alertDialog } from '@/store/useConfirmStore';
import PillToggle from '@/components/PillToggle';
import { EntradaFotosServicio } from '@/components/reservaOnline/EntradaFotosServicio';
import ComponentesPromoSection from '@/components/servicios/ComponentesPromoSection';
import EstadoReservaOnlineCard from '@/components/servicios/EstadoReservaOnlineCard';
import { estadoReservaOnline } from '@/lib/promoEstadoOnline';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  draftsDesdeDetalle, duracionDerivada, erroresGuardarComponentes, hayFilaIncompleta, paraleloDisponible,
  payloadComponentes, precioAGuardar, precioInicialComponentes, resumenComponentes, serviciosComponibles, sumaComponentes,
  type ComponenteDraft, type ProblemaFila,
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

export default function EditarServicioPage() {
  const t = useTranslations('configuracion.EditarServicioPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { servicios, actualizarServicio } = useServiciosStore();
  // El selector (SelectorCategoriaServicio) es dueño de su propio fetch de
  // categorías (design D4) — esta página solo sigue leyendo `loading` para
  // el guard de submit compartido (mismo criterio que nuevo/page.tsx).
  const { loading: categoriasLoading } = useCategoriasServicioStore();

  const [nombre,   setNombre]   = useState('');
  const [duracion, setDuracion] = useState(30);
  const [precio,   setPrecio]   = useState('');
  const [esPromo,  setEsPromo]  = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [errorNombre, setErrorNombre] = useState('');
  const [loadingServicio, setLoadingServicio] = useState(true);
  const [saving, setSaving] = useState(false);

  // Componentes de la promo (multi-profesional). `iniciales` es lo que hay
  // guardado en el backend: solo si el draft difiere se llama al PUT
  // componentes — una promo legacy sin tocar nunca lo dispara.
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { user } = useAuthStore();
  const [componentes, setComponentes] = useState<ComponenteDraft[]>([]);
  const [iniciales, setIniciales] = useState<ComponenteDraft[]>([]);
  const [modoPromo, setModoPromo] = useState<ModoPromo>('secuencia');
  const [modoInicial, setModoInicial] = useState<ModoPromo>('secuencia');
  // Precio override dedicado — NUNCA reusar el `precio` legacy de arriba:
  // una promo que pasa de 0 a su primer componente heredaría el precio
  // legacy viejo como si fuera un override falso (ver precioAGuardar).
  const [precioComponentes, setPrecioComponentes] = useState('');
  const [precioComponentesInicial, setPrecioComponentesInicial] = useState('');
  // Problemas de configuración guardados (inactiva/desvinculado) más los que
  // devuelve un intento de guardado fallido, unidos por fila (item 3 + 4).
  const [problemas, setProblemas] = useState<ProblemaPromo[]>([]);
  const [alineacion, setAlineacion] = useState<AlineacionSlots>({ inicios_validos: [], descartados: [] });
  const [erroresFila, setErroresFila] = useState<Record<number, string>>({});
  const [modoError, setModoError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const fromStore = servicios.find(s => s.id === id);
        const s = fromStore ?? await servicioService.getOne(id);
        setNombre(s.nombre);
        setDuracion(s.duracion_minutos);
        setPrecio(s.precio ?? '');
        setEsPromo(s.es_promo);
        setCategoriaId(s.categoria_id);
        if (s.es_promo) {
          // El listado no trae los componentes: solo el GET-one.
          const detalle = s.componentes ? s : await servicioService.getOne(id);
          const drafts = draftsDesdeDetalle(detalle.componentes);
          setComponentes(drafts);
          setIniciales(drafts);
          setModoPromo(detalle.modo_promo ?? 'secuencia');
          setModoInicial(detalle.modo_promo ?? 'secuencia');
          setProblemas(detalle.problemas ?? []);
          setAlineacion(detalle.alineacion_slots ?? { inicios_validos: [], descartados: [] });
          const precioInicial = precioInicialComponentes(detalle);
          setPrecioComponentes(precioInicial);
          setPrecioComponentesInicial(precioInicial);
        }
      } catch {
        await alertDialog(t('loadError'));
        router.push('/configuracion/servicios');
      } finally {
        setLoadingServicio(false);
      }
    };
    if (id) cargar();
  }, [id]);

  // Solo las promos necesitan el roster; una servicio común no paga la llamada.
  useEffect(() => {
    if (esPromo && profesionales.length === 0) fetchProfesionales();
  }, [esPromo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nada nuevo aparece si no hace falta: con una sola profesional activa la
  // sección queda oculta salvo que la promo ya tenga componentes guardados.
  const activas = profesionales.filter(p => p.activo).length;
  const mostrarComponentes = esPromo && (activas > 1 || componentes.length > 0);
  // Filas completas (no solo "algún servicio elegido"): recién ahí hay una
  // promo con componentes lista para guardar y para reemplazar los campos
  // legacy de duración/precio de arriba.
  const { aGuardar, tieneComponentes, sumaActual, precioOverride } =
    resumenComponentes(componentes, servicios, precioComponentes);
  const paraleloHabilitado = paraleloDisponible(user?.atiende_en_paralelo, activas);
  const precioOverrideInicial = iniciales.length > 0
    ? precioAGuardar(precioComponentesInicial, sumaComponentes(iniciales, servicios))
    : null;
  const dtoActual = { modo_promo: modoPromo, precio: precioOverride, componentes: aGuardar };
  const dtoInicial = { modo_promo: modoInicial, precio: precioOverrideInicial, componentes: payloadComponentes(iniciales) };
  const componentesCambiaron = mostrarComponentes && JSON.stringify(dtoActual) !== JSON.stringify(dtoInicial);
  // Se está apagando una promo que YA tenía componentes guardados: el
  // backend exige que el servicio siga siendo es_promo mientras corre el
  // PUT que los vacía, así que ese PUT debe ir ANTES de apagar es_promo.
  const apagandoPromoConComponentes = !esPromo && iniciales.length > 0;
  // Errores del último intento de guardado, por fila (la sección solo
  // muestra una línea neutra: nunca el texto crudo del backend).
  const problemasFila: ProblemaFila[] = Object.entries(erroresFila)
    .map(([idx, mensaje]) => ({ orden: Number(idx) + 1, mensaje }));
  // Estado de la reserva online, armado desde datos estructurados del último
  // guardado (nunca desde el `mensaje` del backend).
  const estadoOnline = estadoReservaOnline({ componentes: iniciales, profesionales, servicios, problemas, alineacion });

  const handleGuardar = async () => {
    setErroresFila({});
    setModoError('');

    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }
    if (duracion <= 0) {
      await alertDialog(t('invalidDuration'));
      return;
    }
    if (mostrarComponentes && hayFilaIncompleta(componentes)) {
      await alertDialog(t('incompleteRow'));
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const duplicado = servicios.find(s => s.nombre.toLowerCase() === nombreNormalizado && s.id !== id);
    if (duplicado) {
      const msg = duplicado.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);

    if (apagandoPromoConComponentes) {
      // Va ANTES del update: el backend exige que el servicio siga siendo
      // es_promo mientras corre este PUT, así que hay que vaciar los
      // componentes antes de que es_promo pase a false.
      try {
        await servicioService.guardarComponentes(id, { modo_promo: modoInicial, precio: null, componentes: [] });
      } catch (e) {
        setSaving(false);
        await alertDialog(erroresGuardarComponentes(e).general ?? t('saveError'));
        return;
      }
    }

    const result = await actualizarServicio(id, {
      nombre: nombre.trim(),
      duracion_minutos: duracion,
      // null (no undefined) cuando el campo queda vacío: undefined se cae
      // del JSON al serializar y el PUT saldría sin la clave `precio`, así
      // que borrar el precio nunca llegaba a impactar en el backend.
      precio: precio ? parseFloat(precio) : null,
      es_promo: esPromo,
      categoria_id: categoriaId ?? null,
    });
    if (result.success && !apagandoPromoConComponentes && componentesCambiaron) {
      // Va DESPUÉS del update: el PUT componentes exige que la promo ya sea
      // es_promo en el backend, y pisa duración/precio con los derivados.
      try {
        await servicioService.guardarComponentes(id, {
          modo_promo: modoPromo,
          precio: precioOverride,
          componentes: aGuardar,
        });
        await useServiciosStore.getState().fetchServicios();
      } catch (e) {
        setSaving(false);
        // 422 por fila (componentes.{i}.servicio_id|profesional_id) se
        // muestra junto a esa fila; paralelo_no_habilitado junto al selector
        // de modo; cualquier otro error cae al diálogo genérico.
        const errores = erroresGuardarComponentes(e);
        if (Object.keys(errores.porFila).length > 0) {
          setErroresFila(errores.porFila);
        } else if (errores.modoHint) {
          setModoError(errores.modoHint);
        } else {
          await alertDialog(errores.general ?? t('saveError'));
        }
        return;
      }
    }
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/servicios');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  if (loadingServicio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtext }}>{t('loading')}</p>
      </div>
    );
  }

  return (
    // AgendaThemeScope vive en app/(app)/configuracion/servicios/layout.tsx
    // (segmento completo migrado — listado + nuevo + [id]), no acá.
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Categoría — primer campo, idéntico orden a nuevo/page.tsx (spec:
            "Edit form matches create form field order"). */}
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

        {/* Duración y precio: ocultos una vez que la promo tiene componentes
            completos — ComponentesPromoSection muestra la duración derivada
            (solo lectura) y el precio override en su lugar. */}
        {!tieneComponentes && (
          <>
            <div>
              <label style={labelStyle}>{t('durationLabel')}</label>
              <DuracionPicker value={duracion} onChange={setDuracion} />
            </div>

            <div>
              <label style={labelStyle}>{t('priceLabel')}</label>
              <input
                type="number"
                placeholder={t('pricePlaceholder')}
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                style={inputStyle}
                inputMode="decimal"
              />
            </div>
          </>
        )}

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
          <PillToggle value={esPromo} onChange={setEsPromo} />
        </div>

        {mostrarComponentes && estadoOnline && (
          <EstadoReservaOnlineCard estado={estadoOnline} onIrAHorarios={() => router.push('/configuracion/slots')} />
        )}

        {mostrarComponentes && (
          <ComponentesPromoSection
            componentes={componentes}
            onChange={setComponentes}
            servicios={serviciosComponibles(servicios, id)}
            profesionales={profesionales}
            problemas={problemasFila}
            modo={modoPromo}
            onModoChange={setModoPromo}
            paraleloHabilitado={paraleloHabilitado}
            modoError={modoError || undefined}
            duracionDerivada={duracionDerivada(modoPromo, componentes, servicios)}
            sumaComponentes={sumaActual}
            precioComponentes={precioComponentes}
            onPrecioComponentesChange={setPrecioComponentes}
          />
        )}

        {/* Fotos de trabajos (reserva online): la fila se oculta con la flag apagada. */}
        <EntradaFotosServicio servicioId={id} onAbrir={() => router.push(`/configuracion/servicios/${id}/fotos`)} />

        {/* Button */}
        {/* categoriasLoading también deshabilita: fetchCategorias() (ahora
            disparado dentro de SelectorCategoriaServicio) y
            actualizarServicio() comparten el mismo withGlobalLoader
            booleano (no contador, ver comentario en useServicioStore.ts) —
            si el submit dispara mientras la categoría todavía está en
            vuelo, el finally que termine primero apaga el spinner con la
            otra operación todavía en curso. Bloquear el submit hasta que
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
