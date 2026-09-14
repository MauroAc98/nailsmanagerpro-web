'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

// Red de seguridad para Leaflet: es la primera librería de este repo que
// manipula su propio DOM/canvas con animaciones y un estado interno
// (tiles, zoom) fuera del ciclo de React — un error ahí (ej. una carrera al
// recalcular tiles durante un zoom muy rápido, reportada por un usuario en
// producción) puede tirar una excepción no capturada que, sin este límite,
// se lleva puesto TODO el árbol de React montado arriba (el modal entero
// desaparece de golpe — "se cierra solo"). Con el boundary, solo se pierde
// el mapa: el footer con "Cancelar" (fuera de este boundary, en
// UbicacionMapaModal) sigue funcionando para salir de forma controlada.
// No hay ErrorBoundary en ningún otro lugar del repo — este es el primer
// caso que lo necesita.
interface Props {
  children: ReactNode;
}

interface State {
  crasheo: boolean;
}

class MapaErrorBoundaryClass extends Component<Props & { mensaje: string }, State> {
  state: State = { crasheo: false };

  static getDerivedStateFromError(): State {
    return { crasheo: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Única forma de capturar el stack real la próxima vez que pase; no hay
    // error tracking en el repo.
    console.error('[MapaErrorBoundary] Leaflet crasheó:', error, info.componentStack);
  }

  render() {
    if (this.state.crasheo) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 24, textAlign: 'center',
          backgroundColor: colors.bg,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: colors.sub, maxWidth: 260 }}>
            {this.props.mensaje}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MapaErrorBoundary({ children }: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
  return <MapaErrorBoundaryClass mensaje={t('mapCrashed')}>{children}</MapaErrorBoundaryClass>;
}
