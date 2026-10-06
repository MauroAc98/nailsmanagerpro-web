'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { Spinner } from '@/components/Spinner';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { showToast } from '@/store/useToastStore';
import {
  agregarCategoria,
  renombrarCategoria,
  normalizarCategoria,
  MAX_LARGO_CATEGORIA,
  type ErrorCategoria,
} from '@/lib/categoriasMovimiento';

export type TipoMovimiento = 'gasto' | 'ingreso';

interface Props {
  tipo: TipoMovimiento;
  // null = alta. Con valor = edición de esa categoría (se identifica por nombre:
  // las categorías de movimientos son strings del perfil, sin id, y las
  // duplicadas ya se rechazan).
  nombreOriginal: string | null;
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

// Formulario de alta/edición de una categoría de gastos o de ingresos — mismo
// patrón que las páginas nuevo/[id] del resto de la app (campo de nombre +
// botón grande), en vez de la edición en línea que tenía la lista.
export default function CategoriaMovimientoForm({ tipo, nombreOriginal }: Props) {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const router = useRouter();
  const { user, updatePerfil } = useAuth();

  const [nombre, setNombre] = useState(nombreOriginal ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const volver = `/configuracion/categorias-movimientos?tab=${tipo}`;
  const lista = user ? (tipo === 'gasto' ? user.categorias_gasto : user.categorias_ingreso) : null;
  const index = lista && nombreOriginal !== null ? lista.indexOf(nombreOriginal) : -1;
  const editando = nombreOriginal !== null;

  const mostrarError = (e: ErrorCategoria) => setError(t(`error_${e}`));

  // La categoría a editar ya no existe (borrada, nombre inválido en la URL):
  // volver a la lista. `saving` evita pisar la navegación de un guardado
  // exitoso, cuando el perfil actualizado deja de tener el nombre viejo.
  useEffect(() => {
    if (lista && editando && index === -1 && !saving) router.replace(volver);
  }, [lista, editando, index, saving, router, volver]);

  const handleGuardar = async () => {
    if (!lista) return;

    // Edición sin cambio real: volver sin validar (evita un falso "duplicada"
    // contra sí misma) ni un request de más.
    if (editando && normalizarCategoria(nombre) === nombreOriginal) {
      router.push(volver);
      return;
    }

    const r = editando
      ? renombrarCategoria(lista, index, nombre)
      : agregarCategoria(lista, nombre);
    if (!r.ok) return mostrarError(r.error);

    setSaving(true);
    setError(null);
    try {
      await updatePerfil(
        tipo === 'gasto' ? { categorias_gasto: r.categorias } : { categorias_ingreso: r.categorias },
      );
      showToast(t('saved'));
      router.push(volver);
    } catch (e) {
      setError(extraerMensajeError(e));
      setSaving(false);
    }
  };

  // El usuario todavía no hidrató — o la categoría que se quiere editar ya no existe.
  if (!lista) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label={t('loading')} />
      </div>
    );
  }
  if (editando && index === -1) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {editando ? t('editTitle') : t('newTitle')}
        </h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="categoria-nombre" style={labelStyle}>{t('nameLabel')}</label>
          <input
            id="categoria-nombre"
            type="text"
            autoFocus
            placeholder={t('namePlaceholder')}
            value={nombre}
            maxLength={MAX_LARGO_CATEGORIA}
            disabled={saving}
            onChange={e => { setNombre(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleGuardar(); }}
            style={{ ...inputStyle, borderColor: error ? colors.dangerBorder : colors.border }}
          />
          {error && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{error}</p>}
        </div>

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
