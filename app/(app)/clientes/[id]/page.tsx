'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useClientesStore } from '@/store/useClienteStore';
import { clienteService } from '@/services/clienteService';

const PAISES = [
  { codigo: '54',  label: '🇦🇷 +54'  },
  { codigo: '598', label: '🇺🇾 +598' },
  { codigo: '595', label: '🇵🇾 +595' },
  { codigo: '56',  label: '🇨🇱 +56'  },
  { codigo: '591', label: '🇧🇴 +591' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: '#FFF', border: '1px solid #EEE',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: '#333',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#555',
  marginBottom: 7, display: 'block', marginLeft: 2,
};

const splitTelefono = (tel: string): { codigo: string; numero: string } => {
  if (!tel) return { codigo: '54', numero: '' };
  const raw = tel.startsWith('+') ? tel.slice(1) : tel;
  const prefijos = ['598', '595', '591', '54', '56'];
  for (const p of prefijos) {
    if (raw.startsWith(p)) return { codigo: p, numero: raw.slice(p.length) };
  }
  return { codigo: '54', numero: raw };
};

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { actualizarCliente } = useClientesStore();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [codigoPais, setCodigoPais] = useState('54');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState<{ nombre?: string; apellido?: string }>({});
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const cliente = await clienteService.getOne(id);
        setNombre(cliente.nombre);
        setApellido(cliente.apellido);
        const { codigo, numero } = splitTelefono(cliente.telefono);
        setCodigoPais(codigo);
        setTelefono(numero);
      } catch {
        alert('No se pudo cargar el cliente.');
        router.push('/clientes');
      } finally {
        setLoadingCliente(false);
      }
    };
    if (id) cargar();
  }, [id]);

  const validate = () => {
    const e: { nombre?: string; apellido?: string } = {};
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!apellido.trim()) e.apellido = 'El apellido es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validate()) return;
    setSaving(true);
    const result = await actualizarCliente(id, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim() ? `+${codigoPais}${telefono.trim()}` : '',
    });
    setSaving(false);
    if (result.success) {
      router.push('/clientes');
    } else {
      alert(result.message ?? 'No se pudo guardar el cliente.');
    }
  };

  if (loadingCliente) {
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
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#F5F5F5', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Editar cliente</h1>
      </div>

      {/* Formulario */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Nombre */}
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            placeholder="Ej: Carla"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrors(prev => ({ ...prev, nombre: undefined })); }}
            style={{ ...inputStyle, borderColor: errors.nombre ? '#e57373' : '#EEE' }}
          />
          {errors.nombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: '#e57373' }}>{errors.nombre}</p>}
        </div>

        {/* Apellido */}
        <div>
          <label style={labelStyle}>Apellido *</label>
          <input
            type="text"
            placeholder="Ej: Gomez"
            value={apellido}
            onChange={e => { setApellido(e.target.value); setErrors(prev => ({ ...prev, apellido: undefined })); }}
            style={{ ...inputStyle, borderColor: errors.apellido ? '#e57373' : '#EEE' }}
          />
          {errors.apellido && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: '#e57373' }}>{errors.apellido}</p>}
        </div>

        {/* Teléfono */}
        <div>
          <label style={labelStyle}>Teléfono</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={codigoPais}
              onChange={e => setCodigoPais(e.target.value)}
              style={{
                backgroundColor: '#FFF', border: '1px solid #EEE',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
                padding: '14px 10px', fontSize: 14, color: '#333',
                outline: 'none', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {PAISES.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.label}</option>
              ))}
            </select>
            <input
              type="tel"
              placeholder="Número sin código de país"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        {/* Botón */}
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
          {saving ? 'Guardando...' : 'Actualizar Datos'}
        </button>
      </div>
    </div>
  );
}
