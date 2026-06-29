'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useServiciosStore } from '@/store/useServicioStore';
import { servicioService } from '@/services/servicioService';
import DuracionPicker from '@/components/DuracionPicker';

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

export default function EditarServicioPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { servicios, actualizarServicio } = useServiciosStore();

  const [nombre,   setNombre]   = useState('');
  const [duracion, setDuracion] = useState(30);
  const [precio,   setPrecio]   = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [loadingServicio, setLoadingServicio] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const fromStore = servicios.find(s => s.id === id);
        const s = fromStore ?? await servicioService.getOne(id);
        setNombre(s.nombre);
        setDuracion(s.duracion_minutos);
        setPrecio(s.precio ?? '');
      } catch {
        alert('No se pudo cargar el servicio.');
        router.push('/configuracion/servicios');
      } finally {
        setLoadingServicio(false);
      }
    };
    if (id) cargar();
  }, [id]);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre('El nombre es obligatorio');
      return;
    }
    if (duracion <= 0) {
      alert('Ingresá una duración válida.');
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const duplicado = servicios.find(s => s.nombre.toLowerCase() === nombreNormalizado && s.id !== id);
    if (duplicado) {
      const msg = duplicado.activo
        ? 'Ya existe un servicio con ese nombre.'
        : 'Ya tenés un servicio con ese nombre (inactivo). Reactivalo desde el listado en vez de crear uno nuevo.';
      alert(msg);
      return;
    }

    setSaving(true);
    const result = await actualizarServicio(id, {
      nombre: nombre.trim(),
      duracion_minutos: duracion,
      precio: precio ? parseFloat(precio) : undefined,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/servicios');
    } else {
      alert(result.message ?? 'No se pudo guardar el servicio.');
    }
  };

  if (loadingServicio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#999' }}>Cargando...</p>
      </div>
    );
  }

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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Editar servicio</h1>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Nombre */}
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            placeholder="Ej: Kapping"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorNombre(''); }}
            style={{ ...inputStyle, borderColor: errorNombre ? '#e57373' : '#EEE' }}
          />
          {errorNombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: '#e57373' }}>{errorNombre}</p>}
        </div>

        {/* Duración */}
        <div>
          <label style={labelStyle}>Duración *</label>
          <DuracionPicker value={duracion} onChange={setDuracion} />
        </div>

        {/* Precio */}
        <div>
          <label style={labelStyle}>Precio (opcional)</label>
          <input
            type="number"
            placeholder="Ej: 5000"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            style={inputStyle}
            inputMode="decimal"
          />
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
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
