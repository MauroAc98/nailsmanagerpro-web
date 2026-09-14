'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

interface Props {
  // La búsqueda real (geocoding + recentrar el mapa + mover el pin) vive en
  // `MapaPicker`, que es lo único con acceso a la instancia de Leaflet — acá
  // solo se inyecta como prop para que este componente (input + loading +
  // error) sea testeable en jsdom sin tocar el mapa real, mismo motivo por
  // el que `MapaPicker` se mockea entero en SheetDatosPersonales.test.tsx.
  // Resuelve `true` si encontró algo (el padre ya centró el mapa ahí),
  // `false` si no hay resultado.
  onBuscar: (query: string) => Promise<boolean>;
}

export function MapaBuscador({ onBuscar }: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);

  const buscar = async () => {
    const q = query.trim();
    if (q === '' || buscando) return;
    setBuscando(true);
    setSinResultados(false);
    try {
      const encontrado = await onBuscar(q);
      setSinResultados(!encontrado);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }}>
      <div style={{
        display: 'flex', gap: 8, backgroundColor: colors.surface,
        borderRadius: 14, boxShadow: shadows.card, padding: 6,
      }}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (sinResultados) setSinResultados(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') buscar();
          }}
          placeholder={t('mapSearchPlaceholder')}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: colors.text, padding: '8px 10px',
          }}
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || query.trim() === ''}
          aria-label={t('mapSearchButton')}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, border: 'none',
            backgroundColor: colors.primarySolid,
            opacity: buscando || query.trim() === '' ? 0.5 : 1,
            cursor: buscando || query.trim() === '' ? 'default' : 'pointer',
          }}
        >
          <Search size={18} color="#FFF" />
        </button>
      </div>
      {sinResultados && (
        <p style={{
          margin: '8px 0 0', padding: '8px 12px', borderRadius: 10,
          backgroundColor: colors.surface, boxShadow: shadows.card,
          fontSize: 12.5, color: colors.danger,
        }}>
          {t('mapSearchNotFound')}
        </p>
      )}
    </div>
  );
}
