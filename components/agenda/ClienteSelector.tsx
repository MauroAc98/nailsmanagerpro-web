'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, User, X } from 'lucide-react';
import { List, type RowComponentProps } from 'react-window';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useClientesStore } from '@/store/useClienteStore';
import type { Cliente } from '@/services/clienteService';
import { ClienteConTelefono } from '@/components/agenda/ClienteConTelefono';
import { Spinner } from '@/components/Spinner';

// Alto fijo de fila (nombre + teléfono debajo) — requisito de react-window.
const ROW_HEIGHT = 56;
// Cuántas filas se ven a la vez antes de scrollear dentro del desplegable.
const FILAS_VISIBLES = 4;
// Espera tras la última tecla antes de buscar en el servidor.
const DEBOUNCE_MS = 300;

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

interface FilaProps {
  items: Cliente[];
  onElegir: (cliente: Cliente) => void;
}

function FilaCliente({ index, style, items, onElegir }: RowComponentProps<FilaProps>) {
  const cliente = items[index];
  return (
    <div
      style={{
        ...style, boxSizing: 'border-box', padding: '0 14px', display: 'flex', alignItems: 'center',
        cursor: 'pointer', borderBottom: `1px solid ${colors.hairline}`,
      }}
    >
      <div role="option" aria-selected={false} onClick={() => onElegir(cliente)} style={{ flex: 1, minWidth: 0 }}>
        <ClienteConTelefono cliente={cliente} variante="fila" />
      </div>
    </div>
  );
}

// ClienteSelector — el selector de cliente de TODA la app: campo que abre una
// lista con buscador (por nombre, apellido o teléfono). La lista es la misma
// paginada del servidor que usa la pantalla Clientes (useClientesStore:
// páginas de 30, búsqueda en el servidor, scroll virtualizado), así que no
// carga todos los clientes de la cuenta ni se degrada cuando crecen. Lo usan
// "nuevo turno" y el filtro de la agenda para que se vean y se comporten igual.
export function ClienteSelector({ value, onChange, labels, onNuevo, allowClear = false }: Props) {
  const {
    clientesPagina, cargandoPagina, cargandoMasPagina, error,
    cargarPrimeraPagina, cargarSiguientePagina,
  } = useClientesStore();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const cancelarTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const alternar = () => {
    cancelarTimer();
    if (!abierto) {
      // La lista paginada es compartida con la pantalla Clientes: se arranca
      // siempre desde la primera página, solo activos y sin búsqueda previa.
      setBusqueda('');
      cargarPrimeraPagina('', 'activos');
    }
    setAbierto(prev => !prev);
  };

  const cambiarBusqueda = (texto: string) => {
    setBusqueda(texto);
    cancelarTimer();
    timerRef.current = setTimeout(() => cargarPrimeraPagina(texto.trim(), 'activos'), DEBOUNCE_MS);
  };

  const elegir = (cliente: Cliente | null) => {
    cancelarTimer();
    onChange(cliente);
    setAbierto(false);
    setBusqueda('');
  };

  const alturaLista = Math.min(clientesPagina.length, FILAS_VISIBLES) * ROW_HEIGHT;

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={alternar}
        style={{
          backgroundColor: colors.surfaceSubtle, border: `1px solid ${abierto ? colors.primaryDeep : colors.fieldBorder}`,
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
        }}>
          <input
            autoFocus
            placeholder={labels.searchByName}
            value={busqueda}
            onChange={e => cambiarBusqueda(e.target.value)}
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
          {cargandoPagina ? (
            <div style={{ padding: 14, display: 'flex', justifyContent: 'center' }}>
              <Spinner size={24} label={labels.loading} />
            </div>
          ) : error && clientesPagina.length === 0 ? (
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: colors.dangerBorder }}>{error}</p>
              <button
                onClick={() => cargarPrimeraPagina(busqueda.trim(), 'activos')}
                style={{
                  border: `1px solid ${colors.border}`, borderRadius: 10, padding: '6px 14px',
                  background: 'transparent', color: colors.text, fontSize: 13, cursor: 'pointer',
                }}
              >
                {labels.retry}
              </button>
            </div>
          ) : clientesPagina.length === 0 ? (
            <p style={{ padding: '14px', margin: 0, fontSize: 14, color: colors.subtext, textAlign: 'center' }}>
              {labels.noResults}
            </p>
          ) : (
            <div role="listbox">
              <List
                rowComponent={FilaCliente}
                rowCount={clientesPagina.length}
                rowHeight={ROW_HEIGHT}
                rowProps={{ items: clientesPagina, onElegir: elegir }}
                onRowsRendered={visible => {
                  if (visible.stopIndex >= clientesPagina.length - 3) cargarSiguientePagina();
                }}
                style={{ height: alturaLista, width: '100%' }}
              />
              {cargandoMasPagina && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                  <Spinner size={20} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
