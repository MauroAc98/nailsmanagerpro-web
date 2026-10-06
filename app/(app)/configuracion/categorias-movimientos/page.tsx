'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { Spinner } from '@/components/Spinner';
import CategoriaRow from '@/components/configuracion/CategoriaRow';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { showToast } from '@/store/useToastStore';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { eliminarCategoria, type ErrorCategoria } from '@/lib/categoriasMovimiento';

type Tab = 'gasto' | 'ingreso';

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function CategoriasMovimientosContent() {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const router = useRouter();
  const { user, updatePerfil } = useAuth();
  const searchParams = useSearchParams();

  // `?tab={gasto|ingreso}` es una SEED, no un binding (mismo patrón que
  // `?categoria={id}` en servicios/nuevo/page.tsx): se lee una sola vez acá,
  // en el inicializador de useState, nunca en un efecto. Los entry points de
  // Gastos e Ingresos son quienes mandan este param; sin él (o con un valor
  // inesperado) arranca en 'gasto', el default histórico.
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'ingreso' ? 'ingreso' : 'gasto'));

  const lista = user
    ? (tab === 'gasto' ? user.categorias_gasto : user.categorias_ingreso)
    : [];

  // Borrado con confirmación previa — mismo patrón que todo otro borrado en
  // la app. Persiste inmediatamente (sin botón "Guardar" aparte).
  const handleEliminar = async (index: number) => {
    const nombre = lista[index];
    const confirmado = await confirmDialog(
      t('deleteConfirm', { nombre }),
      { confirmText: t('deleteConfirmButton'), danger: true },
    );
    if (!confirmado) return;

    const r = eliminarCategoria(lista, index);
    if (!r.ok) {
      await alertDialog(t(`error_${r.error satisfies ErrorCategoria}`));
      return;
    }
    try {
      await updatePerfil(
        tab === 'gasto' ? { categorias_gasto: r.categorias } : { categorias_ingreso: r.categorias },
      );
      showToast(t('saved'));
    } catch (e) {
      await alertDialog(extraerMensajeError(e));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: NAV_CLEARANCE + 40 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 14px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
        {user && (
          <p style={{ margin: '4px 0 0', fontSize: 14, color: colors.subtext }}>
            {t(tab === 'gasto' ? 'summaryGastos' : 'summaryIngresos', { count: lista.length })}
          </p>
        )}
      </div>

      {/* FAB — alta en su propia página, igual que el resto de las listas. */}
      <button
        aria-label={t('newTitle')}
        onClick={() => router.push(`/configuracion/categorias-movimientos/nuevo?tab=${tab}`)}
        style={{
          position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Gastos / Otros ingresos — pastillas, igual que los filtros de Servicios. */}
        <div role="group" style={{ display: 'flex', gap: 8 }}>
          {([['gasto', t('tabGastos')], ['ingreso', t('tabIngresos')]] as const).map(([valor, label]) => {
            const activo = tab === valor;
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setTab(valor)}
                style={{
                  padding: '6px 14px', minHeight: 32, borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
                  backgroundColor: activo ? colors.primarySolid : colors.surface,
                  color: activo ? '#FFF' : colors.text,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {!user ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <Spinner label={t('loading')} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lista.map((cat, index) => (
                <CategoriaRow
                  key={cat}
                  nombre={cat}
                  onOpen={() => router.push(
                    `/configuracion/categorias-movimientos/editar?tab=${tab}&nombre=${encodeURIComponent(cat)}`,
                  )}
                  onDelete={() => handleEliminar(index)}
                />
              ))}
            </div>

            {/* Renombrar/borrar no reescribe los movimientos ya cargados */}
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.45, color: colors.placeholder, textAlign: 'center' }}>
              {t('footnote')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — wraps in Suspense for useSearchParams (mismo patrón que
// app/(app)/configuracion/servicios/nuevo/page.tsx)
// ─────────────────────────────────────────────
export default function CategoriasMovimientosPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>}>
      <CategoriasMovimientosContent />
    </Suspense>
  );
}
