'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { NAV_CLEARANCE } from '@/constants/layout';
import { useClientesStore } from '@/store/useClienteStore';
import { alertDialog } from '@/store/useConfirmStore';
import { PAISES, phoneUtils } from '@/lib/phoneUtils';
import type { Cliente } from '@/services/clienteService';

// ─────────────────────────────────────────────
// AltaClienteRapidaSheet — alta de cliente sin salir del formulario de
// turno (nuevo/editar): hoy había que navegar a /clientes/nuevo y volver,
// un paso de más que perdía el turno que se estaba armando. Mismos campos
// y validación que app/(app)/clientes/nuevo/page.tsx (nombre, apellido,
// teléfono); onCreated recibe el Cliente ya creado para que quien lo usa
// lo seleccione de inmediato, sin tener que volver a buscarlo en la lista.
// ─────────────────────────────────────────────

export interface AltaClienteRapidaHandle {
  open: () => void;
}

interface Props {
  onCreated: (cliente: Cliente) => void;
}

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

export const AltaClienteRapidaSheet = forwardRef<AltaClienteRapidaHandle, Props>(
  function AltaClienteRapidaSheet({ onCreated }, ref) {
    const t = useTranslations('agenda.AltaClienteRapidaSheet');
    const sheetRef = useRef<BottomSheetHandle>(null);
    const { crearCliente } = useClientesStore();

    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [codigoPais, setCodigoPais] = useState('54');
    const [telefono, setTelefono] = useState('');
    const [errors, setErrors] = useState<{ nombre?: string; apellido?: string; telefono?: string }>({});
    const [saving, setSaving] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => {
        setNombre(''); setApellido(''); setCodigoPais('54'); setTelefono(''); setErrors({});
        sheetRef.current?.snapToIndex(0);
      },
    }));

    const validate = () => {
      const e: typeof errors = {};
      if (!nombre.trim()) e.nombre = t('nameRequired');
      if (!apellido.trim()) e.apellido = t('lastNameRequired');
      if (!telefono.trim()) e.telefono = t('phoneRequired');
      setErrors(e);
      return Object.keys(e).length === 0;
    };

    const aplicarTelefonoIngresado = (valorCrudo: string) => {
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
      if (result.success && result.cliente) {
        sheetRef.current?.close();
        onCreated(result.cliente);
      } else {
        await alertDialog(result.message ?? t('saveError'));
      }
    };

    // 0.7, no 0.55: con los 3 campos (nombre, apellido, país+teléfono) más
    // el botón, 0.55 dejaba el teléfono fuera de vista al abrir —
    // scrolleable igual (overflowY del BottomSheet), pero se leía como
    // "faltan campos" en vez de "hay que bajar". Mismo snap que usa
    // HistorialClienteSheetHost para un contenido de altura variable.
    // bottomOffset={NAV_CLEARANCE} es obligatorio acá: el <nav> fijo pinta
    // con un z-index más alto que el sheet (ver app/(app)/layout.tsx), así
    // que sin esto el botón "Guardar" queda tapado detrás de la barra en
    // vez de arriba — bug real, reportado al probarlo.
    return (
      <BottomSheet ref={sheetRef} snapPoints={[0.7]} initialIndex={-1} enablePanDownToClose bottomOffset={NAV_CLEARANCE}>
        <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 20, color: colors.textStrong, margin: 0 }}>
            {t('title')}
          </p>

          <div>
            <label style={labelStyle}>{t('nameLabel')}</label>
            <input
              type="text"
              placeholder={t('namePlaceholder')}
              value={nombre}
              onChange={e => { setNombre(e.target.value); setErrors(prev => ({ ...prev, nombre: undefined })); }}
              style={{ ...inputStyle, borderColor: errors.nombre ? colors.danger : colors.border }}
            />
            {errors.nombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.danger }}>{errors.nombre}</p>}
          </div>

          <div>
            <label style={labelStyle}>{t('lastNameLabel')}</label>
            <input
              type="text"
              placeholder={t('lastNamePlaceholder')}
              value={apellido}
              onChange={e => { setApellido(e.target.value); setErrors(prev => ({ ...prev, apellido: undefined })); }}
              style={{ ...inputStyle, borderColor: errors.apellido ? colors.danger : colors.border }}
            />
            {errors.apellido && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.danger }}>{errors.apellido}</p>}
          </div>

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
                // espacio y el guion tal cual (bug real, 2026-09-30: rompía
                // el envío de WhatsApp), y tipear un código de país embebido
                // (ej. "+5511...") quedaba duplicado con el selector de al
                // lado en vez de separarse como sí pasaba al pegar.
                onChange={e => { aplicarTelefonoIngresado(e.target.value); setErrors(prev => ({ ...prev, telefono: undefined })); }}
                onPaste={handlePasteTelefono}
                style={{ ...inputStyle, flex: 1, borderColor: errors.telefono ? colors.danger : colors.border }}
              />
            </div>
            {errors.telefono && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.danger }}>{errors.telefono}</p>}
          </div>

          <button
            onClick={handleGuardar}
            disabled={saving}
            style={{
              marginTop: 4, height: 52, borderRadius: 14,
              backgroundColor: saving ? colors.primarySoft : colors.primarySolid,
              color: colors.primaryFg, fontSize: 15, fontWeight: 700,
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? t('saving') : t('submit')}
          </button>
        </div>
      </BottomSheet>
    );
  },
);
