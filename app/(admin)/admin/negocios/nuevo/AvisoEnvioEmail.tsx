import { colors } from '@/theme/colors';

// Pie de la pantalla "Negocio creado". El backend responde `email_enviado: false`
// (con 201) cuando el negocio quedó creado pero el mail con la contraseña
// provisoria falló; ausente = backend anterior, se trata como enviado.
export function AvisoEnvioEmail({ email, enviado }: { email: string; enviado?: boolean }) {
  if (enviado === false) {
    return (
      <p
        role="alert"
        style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.45, margin: 0, textAlign: 'center',
          padding: '12px 14px', borderRadius: 12, backgroundColor: colors.warningBg, color: colors.warningFg,
        }}
      >
        No se pudo enviar el email a {email}. Pasale la contraseña provisoria a la persona titular por otro medio.
      </p>
    );
  }

  return (
    <p style={{ fontSize: 12, color: colors.subtext, margin: 0, textAlign: 'center' }}>
      También se envió esta contraseña por email a {email} — esta pantalla queda como respaldo si el correo no llega.
    </p>
  );
}
