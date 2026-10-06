'use client';

import { CONTENT_BOTTOM_PADDING } from '@/constants/layout';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
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
  const t = useTranslations('clientes.NuevoClientePage');
  const router = useRouter();
  const { crearCliente } = useClientesStore();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [codigoPais, setCodigoPais] = useState('54');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState<{ nombre?: string; apellido?: string; telefono?: string }>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: { nombre?: string; apellido?: string; telefono?: string } = {};
    if (!nombre.trim()) e.nombre = t('nameRequired');
    if (!apellido.trim()) e.apellido = t('lastNameRequired');
    if (!telefono.trim()) e.telefono = t('phoneRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const aplicarTelefonoIngresado = (valorCrudo: string) => {
    // Si parece traer código de país (empieza con "+" o es más largo que un
    // número local), lo separamos automáticamente en vez de concatenarlo
    // crudo — evita que pegar o tipear el número completo desde el perfil de
    // WhatsApp de la cliente rompa el formato que esperan los mensajes
    // automáticos y semi-automáticos.
    const detectado = phoneUtils.detectarCodigoPaisEmbebido(valorCrudo);
    if (detectado) {
      setCodigoPais(detectado.codigo);
      setTelefono(detectado.numero);
    } else {
      setTelefono(phoneUtils.clean(valorCrudo));
    }
  };

  const handlePasteTelefono = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pegado = e.clipboardData.getData('text');
    if (!phoneUtils.clean(pegado)) return;
    e.preventDefault();
    aplicarTelefonoIngresado(pegado);
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
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: CONTENT_BOTTOM_PADDING }}>

      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Formulario */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Nombre */}
        <div>
          <label style={labelStyle}>{t('nameLabel')}</label>
          <input
            type="text"
            placeholder={t('namePlaceholder')}
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrors(prev => ({ ...prev, nombre: undefined })); }}
            style={{ ...inputStyle, borderColor: errors.nombre ? colors.dangerBorder : colors.border }}
          />
          {errors.nombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errors.nombre}</p>}
        </div>

        {/* Apellido */}
        <div>
          <label style={labelStyle}>{t('lastNameLabel')}</label>
          <input
            type="text"
            placeholder={t('lastNamePlaceholder')}
            value={apellido}
            onChange={e => { setApellido(e.target.value); setErrors(prev => ({ ...prev, apellido: undefined })); }}
            style={{ ...inputStyle, borderColor: errors.apellido ? colors.dangerBorder : colors.border }}
          />
          {errors.apellido && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errors.apellido}</p>}
        </div>

        {/* Teléfono */}
        <div>
          <label style={labelStyle}>{t('phoneLabel')}</label>
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
              placeholder={t('phonePlaceholder')}
              value={telefono}
              // aplicarTelefonoIngresado corre en cada tecla, no solo al
              // pegar — antes tipear "376 424-0951" a mano guardaba el
              // espacio y el guion tal cual (bug real, 2026-09-30), y tipear
              // un código de país embebido quedaba duplicado con el selector
              // de al lado en vez de separarse como pasaba al pegar.
              onChange={e => { aplicarTelefonoIngresado(e.target.value); setErrors(prev => ({ ...prev, telefono: undefined })); }}
              onPaste={handlePasteTelefono}
              style={{ ...inputStyle, flex: 1, borderColor: errors.telefono ? colors.dangerBorder : colors.border }}
            />
          </div>
          {errors.telefono && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errors.telefono}</p>}
        </div>

        {/* Botón */}
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
