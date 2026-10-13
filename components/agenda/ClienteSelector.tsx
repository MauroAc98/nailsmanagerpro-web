'use client';

import React, { useState } from 'react';
import { ChevronDown, User, X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useClientesStore } from '@/store/useClienteStore';
import type { Cliente } from '@/services/clienteService';
import { ClienteConTelefono } from '@/components/agenda/ClienteConTelefono';
import { Spinner } from '@/components/Spinner';

// Ignora acentos al comparar ("jose" matchea "José") — sin esto una búsqueda
// sin tilde no encontraba clientes con nombres acentuados.
function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface ClienteSelectorLabels {
  placeholder: string;
  searchByName: string;
  noResults: string;
  loading: string;
  retry: string;
  // Texto de la fila de alta rápida; solo se muestra si se pasa onNuevo.
  newClient?: string;
  // aria-label del botón de quitar la selección; solo si allowClear.
  clear?: string;
}

interface Props {
  value: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
  labels: ClienteSelectorLabels;
  // Alta rápida sin salir de la pantalla — arriba de todo la lista (con muchos
  // clientes había que scrollear hasta el final para llegar a esta opción).
  onNuevo?: () => void;
  // Muestra una X en el campo para volver a "sin cliente" (p. ej. el filtro).
  allowClear?: boolean;
}

// ClienteSelector — el selector de cliente de TODA la app: campo que abre una
// lista con buscador (por nombre, apellido o teléfono, sin acentos). Lo usan
// "nuevo turno" y el filtro de la agenda para que se vean y se comporten igual.
export function ClienteSelector({ value, onChange, labels, onNuevo, allowClear = false }: Props) {
  const { clientes, loading, error, fetchClientes } = useClientesStore();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const filtrados = clientes.filter(c =>
    c.activo && normalizarTexto(`${c.nombre} ${c.apellido} ${c.telefono ?? ''}`).includes(normalizarTexto(busqueda)),
  );

  const alternar = () => {
    // Abrir sin lista cargada (p. ej. el filtro, que no la pide al montar).
    if (!abierto && clientes.length === 0 && !loading) fetchClientes();
    setAbierto(prev => !prev);
  };

  const elegir = (cliente: Cliente | null) => {
    onChange(cliente);
    setAbierto(false);
    setBusqueda('');
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={alternar}
        style={{
          backgroundColor: colors.surfaceSubtle, border: `1px solid ${abierto ? colors.primaryDeep : colors.border}`,
          padding: '14px 16px', fontSize: 15, color: colors.text,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          borderRadius: abierto ? '12px 12px 0 0' : 12,
        }}
      >
        <User size={18} strokeWidth={1.8} color={colors.muted} style={{ flexShrink: 0 }} />
        {value ? (
          <ClienteConTelefono cliente={value} variante="campo" />
        ) : (
          <span style={{
            flex: 1, minWidth: 0, color: colors.placeholder, fontSize: 15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {labels.placeholder}
          </span>
        )}
        {allowClear && value && (
          <button
            type="button"
            aria-label={labels.clear}
            onClick={e => { e.stopPropagation(); elegir(null); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}
          >
            <X size={16} strokeWidth={2} color={colors.muted} />
          </button>
        )}
        <ChevronDown
          size={16} strokeWidth={2} color={colors.muted}
          style={{ flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </div>

      {abierto && (
        <div style={{
          border: `1px solid ${colors.border}`, borderTop: 'none',
          borderRadius: '0 0 12px 12px', backgroundColor: colors.surface,
          maxHeight: 220, overflowY: 'auto',
        }}>
          <input
            autoFocus
            placeholder={labels.searchByName}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              padding: '10px 14px', border: 'none', borderBottom: `1px solid ${colors.border}`,
              width: '100%', boxSizing: 'border-box', outline: 'none', fontSize: 14,
              backgroundColor: 'transparent', color: colors.text,
            }}
          />
          {onNuevo && labels.newClient && (
            <div
              onClick={() => { setAbierto(false); onNuevo(); }}
              style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: colors.primaryDeep, borderBottom: `1px solid ${colors.hairline}` }}
            >
              {labels.newClient}
            </div>
          )}
          {loading && clientes.length === 0 && (
            <div style={{ padding: 14, display: 'flex', justifyContent: 'center' }}>
              <Spinner size={24} label={labels.loading} />
            </div>
          )}
          {!loading && error && clientes.length === 0 && (
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: colors.dangerBorder }}>{error}</p>
              <button
                onClick={() => fetchClientes()}
                style={{
                  border: `1px solid ${colors.border}`, borderRadius: 10, padding: '6px 14px',
                  background: 'transparent', color: colors.text, fontSize: 13, cursor: 'pointer',
                }}
              >
                {labels.retry}
              </button>
            </div>
          )}
          {!loading && !error && clientes.length > 0 && filtrados.length === 0 && (
            <p style={{ padding: '14px', margin: 0, fontSize: 14, color: colors.subtext, textAlign: 'center' }}>
              {labels.noResults}
            </p>
          )}
          {filtrados.map(c => (
            <div
              key={c.id}
              onClick={() => elegir(c)}
              style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 15, color: colors.text, borderBottom: `1px solid ${colors.hairline}` }}
            >
              <ClienteConTelefono cliente={c} variante="fila" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
