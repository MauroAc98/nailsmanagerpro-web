'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { adminService } from '@/services/adminService';
import { colors, shadows } from '@/theme/colors';

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.errors?.dias_prueba_default?.[0] ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

export default function ConfiguracionPage() {
  const [diasPrueba, setDiasPrueba] = useState('10');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    adminService.obtenerSettings()
      .then((data) => setDiasPrueba(String(data.dias_prueba_default)))
      .catch((e) => setError(extraerMensajeError(e, 'No se pudo cargar la configuración.')))
      .finally(() => setCargando(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardado(false);

    const n = Number(diasPrueba);
    if (!Number.isInteger(n) || n < 1 || n > 90) {
      setError('Tiene que ser un número entero entre 1 y 90.');
      return;
    }

    setGuardando(true);
    try {
      await adminService.actualizarSettings({ dias_prueba_default: n });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e: unknown) {
      setError(extraerMensajeError(e, 'No se pudo guardar la configuración.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Configuración</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Ajustes globales del panel.</p>
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        {cargando ? (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Cargando…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="dias-prueba-default" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>
                Días de prueba por default
              </label>
              <p style={{ fontSize: 12, color: colors.subtext, margin: 0 }}>
                Se aplica a todo negocio nuevo que no marques como exento al darlo de alta.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 54,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card,
                  borderRadius: 16,
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
              >
                <input
                  id="dias-prueba-default"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={diasPrueba}
                  onChange={(e) => setDiasPrueba(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              style={{
                height: 54,
                borderRadius: 16,
                backgroundColor: guardando ? colors.primaryDisabled : colors.primarySolid,
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
                cursor: guardando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {guardado && <CircleCheck size={18} />}
              {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
