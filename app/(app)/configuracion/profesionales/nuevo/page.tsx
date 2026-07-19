'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import { profesionalPalette } from '@/theme/colors';
import { alertDialog } from '@/store/useConfirmStore';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: '#FFF', border: '1px solid #EEE',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: '#333', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#555',
  marginBottom: 7, display: 'block', marginLeft: 2,
};

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
      border: `2px solid ${checked ? colors.primary : '#DDD'}`,
      backgroundColor: checked ? colors.primary : '#FFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

export default function NuevoProfesionalPage() {
  const router = useRouter();
  const { profesionales, agregarProfesional } = useProfesionalStore();
  const { servicios, fetchServicios } = useServiciosStore();

  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<string>(profesionalPalette[0]);
  const [servicioIds, setServicioIds] = useState<number[]>([]);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (servicios.length === 0) fetchServicios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleServicio = (id: number) => {
    setServicioIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre('El nombre es obligatorio');
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const existente = profesionales.find(p => p.nombre.toLowerCase() === nombreNormalizado);
    if (existente) {
      const msg = existente.activo
        ? 'Ya existe una profesional con ese nombre.'
        : 'Ya tenés una profesional con ese nombre (inactiva). Reactivala desde el listado en vez de crear una nueva.';
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await agregarProfesional({
      nombre: nombre.trim(),
      color,
      servicio_ids: servicioIds,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/profesionales');
    } else {
      await alertDialog(result.message ?? 'No se pudo guardar la profesional.');
    }
  };

  const serviciosActivos = servicios.filter(s => s.activo);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Nueva profesional</h1>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Nombre */}
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            placeholder="Ej: Sofía"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorNombre(''); }}
            style={{ ...inputStyle, borderColor: errorNombre ? colors.dangerBorder : '#EEE' }}
          />
          {errorNombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errorNombre}</p>}
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>Color</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>

        {/* Servicios */}
        <div>
          <label style={labelStyle}>Servicios que puede realizar</label>
          {serviciosActivos.length === 0 ? (
            <p style={{ fontSize: 13, color: colors.subtext, margin: '4px 0 0 2px' }}>
              No hay servicios activos todavía. Cargalos primero en Configuración → Servicios.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {serviciosActivos.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleServicio(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: '#FFF', border: '1px solid #EEE',
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <Checkbox checked={servicioIds.includes(s.id)} />
                  <span style={{ flex: 1, fontSize: 14, color: '#333' }}>{s.nombre}</span>
                  <span style={{ fontSize: 12, color: colors.subtext }}>{s.duracion_minutos} min</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: saving ? '#e0c4c7' : colors.primary,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Agregar profesional'}
        </button>
      </div>
    </div>
  );
}
