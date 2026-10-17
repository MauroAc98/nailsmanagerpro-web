'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/Skeleton';
import { useProResumen } from '@/hooks/pro/useProResumen';
import { agendaColors, agendaShadows } from '@/theme/agendaColors';

interface Props {
  // Mes del resumen, "YYYY-MM": el de la fecha que se ve en la agenda.
  mes: string;
}

const divisor = `1px solid color-mix(in srgb, ${agendaColors.primary} 15%, transparent)`;

// Mismo panel que ResumenMesCard de la agenda de la titular, sin dinero ni
// clientes nuevos y sin navegación (el portal no tiene estadísticas completas).
const tarjetaStyle = {
  margin: '0 20px 12px',
  padding: '12px 14px',
  background: `linear-gradient(135deg, ${agendaColors.primarySoft}, ${agendaColors.surface})`,
  border: `1px solid color-mix(in srgb, ${agendaColors.primary} 25%, transparent)`,
  boxShadow: agendaShadows.card,
  borderRadius: 24,
  boxSizing: 'border-box',
  overflow: 'hidden',
} as const;

const numeroStyle = {
  display: 'block',
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.15,
  color: agendaColors.strong,
  fontVariantNumeric: 'tabular-nums',
} as const;

const rotuloStyle = {
  display: 'block',
  marginTop: 1,
  fontSize: 11,
  lineHeight: 1.25,
  color: agendaColors.sub,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

// Destellos del título (SVG propio: el portal no importa lucide-react).
function Destellos() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={agendaColors.primaryDeep}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.6 11 2l1.1 2.6a6 6 0 0 0 3.3 3.3L18 9l-2.6 1.1a6 6 0 0 0-3.3 3.3L11 16l-1.1-2.6a6 6 0 0 0-3.3-3.3L4 9l2.6-1.1a6 6 0 0 0 3.3-3.3Z" />
      <path d="M19 15v4M17 17h4" />
    </svg>
  );
}

// Resumen del mes de SU agenda: tres conteos y el servicio más pedido. Es
// opcional: si el mes no tiene turnos o el pedido falla, no se dibuja nada (un
// error acá no tiene que romper la agenda ni mostrar un aviso).
export function ResumenMesPro({ mes }: Props) {
  const t = useTranslations('profesionales.Resumen');
  const locale = useLocale();
  const { data, cargando, error } = useProResumen(mes);

  if (data === null && (error !== null || !cargando)) return null;
  if (data !== null && data.atendidos + data.por_venir + data.cancelados === 0) return null;

  // Date.UTC con partes numéricas: el nombre no depende de la zona del dispositivo.
  const nombreMes = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1)),
  );

  const numeros =
    data === null
      ? null
      : [
          { valor: data.atendidos, rotulo: t('atendidos', { count: data.atendidos }) },
          { valor: data.por_venir, rotulo: t('porVenir') },
          { valor: data.cancelados, rotulo: t('cancelados', { count: data.cancelados }) },
        ];

  return (
    <div
      aria-busy={data === null}
      data-testid={data === null ? 'resumen-mes-esqueleto' : undefined}
      style={tarjetaStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Destellos />
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: agendaColors.primaryDeep,
            textTransform: 'uppercase',
          }}
        >
          {t('titulo', { mes: nombreMes })}
        </p>
      </div>

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: divisor, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: '0 1 auto', minWidth: 0, ...(i > 0 ? { paddingLeft: 10, borderLeft: divisor } : {}) }}
          >
            {numeros === null ? (
              <>
                <Skeleton width={28} height={18} />
                <Skeleton width={56} height={11} style={{ marginTop: 3 }} />
              </>
            ) : (
              <>
                <span style={numeroStyle}>{numeros[i].valor}</span>
                <span style={rotuloStyle}>{numeros[i].rotulo}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {numeros === null && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: divisor }}>
          <Skeleton width="60%" height={13} />
        </div>
      )}
      {data?.mas_pedido != null && (
        <p
          style={{
            margin: '8px 0 0',
            paddingTop: 8,
            borderTop: divisor,
            fontSize: 13,
            lineHeight: 1.35,
            color: agendaColors.sub,
            overflowWrap: 'anywhere',
          }}
        >
          {t('masPedido')} <span style={{ fontWeight: 600, color: agendaColors.strong }}>{data.mas_pedido}</span>
        </p>
      )}
    </div>
  );
}
