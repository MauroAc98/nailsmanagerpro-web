import Link from 'next/link';
import { colors } from '@/theme/colors';

export default function LegalPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link
          href="/login"
          style={{ fontSize: 13, color: colors.primary, fontWeight: 600, textDecoration: 'none' }}
        >
          ← Volver
        </Link>

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: colors.text, marginTop: 24, marginBottom: 8 }}>
          Términos y Condiciones
        </h1>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>
          Última actualización: julio de 2026
        </p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Titularidad
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            Nailsmanagerpro es el nombre comercial bajo el cual Mauro Hernan Acosta,
            monotributista registrado ante ARCA (ex AFIP), ofrece un sistema de gestión
            de turnos y clientes para profesionales de la industria de la belleza.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Datos del responsable
          </h2>
          <div style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.9 }}>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>Nombre legal:</strong> Mauro Hernan Acosta</p>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>Marca comercial:</strong> Nailsmanagerpro</p>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>Condición fiscal:</strong> Monotributista (ARCA)</p>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Uso del servicio
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            El acceso a Nailsmanagerpro está sujeto a una suscripción activa. Los datos
            cargados por cada usuario (clientes, turnos, historial) son de su exclusiva
            responsabilidad y se utilizan únicamente para el funcionamiento del servicio.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Contacto
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            Para consultas sobre estos términos, soporte técnico o cualquier otro tema
            relacionado con el servicio, podés escribir a{' '}
            <a href="mailto:nailsmanagerpro.app@gmail.com" style={{ color: colors.primary, fontWeight: 600 }}>
              nailsmanagerpro.app@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
