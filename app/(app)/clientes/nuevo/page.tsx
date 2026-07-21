'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, shadows } from '@/theme/colors';
import { useClientesStore } from '@/store/useClienteStore';
import { alertDialog } from '@/store/useConfirmStore';
import { PAISES, phoneUtils } from '@/lib/phoneUtils';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  boxShadow: shadows.card, borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: colors.text,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: colors.textStrong,
  marginBottom: 7, display: 'block', marginLeft: 2,
};

export default function NuevoClientePage() {
  const router = useRouter();
  const { crearCliente } = useClientesStore();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [codigoPais, setCodigoPais] = useState('54');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState<{ nombre?: string; apellido?: string }>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: { nombre?: string; apellido?: string } = {};
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!apellido.trim()) e.apellido = 'El apellido es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePasteTelefono = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pegado = e.clipboardData.getData('text');
    const soloDigitos = phoneUtils.clean(pegado);
    if (!soloDigitos) return;
    e.preventDefault();

    // Si parece traer código de país (empieza con "+" o es más largo que un
    // número local), lo separamos automáticamente en vez de concatenarlo
    // crudo — evita que pegar el número completo desde el perfil de
    // WhatsApp de la clienta rompa el formato que esperan los mensajes
    // automáticos y semi-automáticos.
    const traeCodigoPais = pegado.trim().startsWith('+') || soloDigitos.length > 11;
    if (traeCodigoPais) {
      const { codigo, numero } = phoneUtils.splitCodigoPais(soloDigitos);
      setCodigoPais(codigo);
      setTelefono(numero);
    } else {
      setTelefono(soloDigitos);
    }
  };

  const handleGuardar = async () => {
    if (!validate()) return;
    setSaving(true);
    const result = await crearCliente({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim() ? `+${codigoPais}${telefono.trim()}` : '',
    });
    setSaving(false);
    if (result.success) {
      router.push('/clientes');
    } else {
      await alertDialog(result.message ?? 'No se pudo guardar el cliente.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.surfaceSubtle, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Nuevo cliente</h1>
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
            style={{ ...inputStyle, borderColor: errors.nombre ? colors.dangerBorder : colors.border }}
          />
          {errors.nombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errors.nombre}</p>}
        </div>

        {/* Apellido */}
        <div>
          <label style={labelStyle}>Apellido *</label>
          <input
            type="text"
            placeholder="Ej: Gomez"
            value={apellido}
            onChange={e => { setApellido(e.target.value); setErrors(prev => ({ ...prev, apellido: undefined })); }}
            style={{ ...inputStyle, borderColor: errors.apellido ? colors.dangerBorder : colors.border }}
          />
          {errors.apellido && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errors.apellido}</p>}
        </div>

        {/* Teléfono */}
        <div>
          <label style={labelStyle}>Teléfono</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={codigoPais}
              onChange={e => setCodigoPais(e.target.value)}
              style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                boxShadow: shadows.card, borderRadius: 12,
                padding: '14px 10px', fontSize: 14, color: colors.text,
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
              onPaste={handlePasteTelefono}
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
            backgroundColor: saving ? colors.primaryDisabled : colors.primary,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Registrar Cliente'}
        </button>
      </div>
    </div>
  );
}
