'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useWhatsappStore } from '@/store/useWhatsappStore';
import { confirmDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';

function downloadQR(qrBase64: string) {
  const base64 = qrBase64.includes(',') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
  const a = document.createElement('a');
  a.href = base64;
  a.download = `whatsapp_qr_${Date.now()}.png`;
  a.click();
}

// Mismo patrón que compartirImagen en agenda/historia: intenta el share
// nativo con el archivo adjunto, y si no está disponible cae al mismo
// comportamiento que "Descargar".
async function shareQR(qrBase64: string) {
  const base64 = qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`;

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare) {
    try {
      const res  = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], `whatsapp_qr_${Date.now()}.png`, { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Código QR de WhatsApp' });
        } catch {
          // usuario canceló o compartir falló — no-op silencioso
        }
        return;
      }
    } catch {
      // fetch/blob falló — cae al fallback de abajo
    }
  }

  downloadQR(qrBase64);
}

export default function WhatsappPage() {
  const router = useRouter();
  const {
    estado, qrBase64, loading, polling, error, expirado,
    conectar, consultarEstado, desconectar, detenerPolling, reset,
  } = useWhatsappStore();

  const estaConectado = estado === 'conectado';
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      setVerificando(true);
      await consultarEstado();
      if (activo) setVerificando(false);
    })();
    return () => {
      activo = false;
      detenerPolling();
    };
  }, []);

  useEffect(() => {
    if (!verificando && !estaConectado && !qrBase64) {
      conectar();
    }
  }, [verificando, estaConectado]);

  const handleDesconectar = async () => {
    const ok = await confirmDialog(
      '¿Desvincular WhatsApp? Vas a dejar de recibir mensajes automáticos de confirmación hasta que vuelvas a conectar.',
      { confirmText: 'Desvincular', danger: true },
    );
    if (!ok) return;
    desconectar().then(() => {
      reset();
      showToast('WhatsApp desvinculado');
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Vincular WhatsApp</h1>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

        {/* Subtitle row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#F0FFF4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <p style={{ flex: 1, fontSize: 13, color: colors.subtext, lineHeight: 1.5, margin: 0 }}>
            Los mensajes de confirmación se enviarán automáticamente desde tu propio WhatsApp.
          </p>
        </div>

        {/* Error banner — falla de red/API al conectar o desconectar */}
        {error && (
          <div style={{
            width: '100%', backgroundColor: '#FFF5F5', border: '1px solid #FDDCDC',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: colors.danger }}>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {(verificando || loading) && (
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              border: `3px solid ${colors.primary}`,
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: colors.subtext, fontSize: 14 }}>
              {verificando ? 'Verificando estado...' : 'Generando código QR...'}
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Connected state */}
        {!verificando && !loading && estaConectado && (
          <div style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            backgroundColor: '#F9F9F9', borderRadius: 16, padding: 28,
            border: '1px solid #EEE',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#222', marginTop: 12, marginBottom: 6 }}>
              Tu WhatsApp ya está vinculado
            </p>
            <p style={{ fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: 20 }}>
              Los turnos nuevos van a enviar el mensaje de confirmación automáticamente.
            </p>
            <button
              onClick={handleDesconectar}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#FFF5F5', border: '1px solid #FDDCDC',
                borderRadius: 16, padding: '14px', cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                <line x1="5" y1="5" x2="19" y2="19"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.danger }}>Desvincular</span>
            </button>
          </div>
        )}

        {/* Expirado — pasaron MAX_POLLING_MS sin que se escanee el QR */}
        {!verificando && !loading && !estaConectado && expirado && (
          <div style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            backgroundColor: '#F9F9F9', borderRadius: 16, padding: 28,
            border: '1px solid #EEE',
          }}>
            <p style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 18 }}>
              El código expiró sin confirmarse. Generá uno nuevo cuando estés listo para escanearlo.
            </p>
            <button
              onClick={() => conectar()}
              style={{
                width: '100%', height: 48, borderRadius: 14,
                backgroundColor: colors.primary, color: '#fff',
                fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              Generar código QR
            </button>
          </div>
        )}

        {/* QR state */}
        {!verificando && !loading && !estaConectado && !expirado && qrBase64 && (
          <div style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            backgroundColor: '#F8F8F8', borderRadius: 16, padding: 20,
            border: '1px solid #EFEFEF',
          }}>
            <img
              src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="QR WhatsApp"
              style={{ width: 220, height: 220, objectFit: 'contain', marginBottom: 16 }}
            />

            <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {[
                '1. Abrí WhatsApp en el teléfono donde querés usarlo',
                '2. Configuración → Dispositivos vinculados',
                '3. Vincular un dispositivo',
                '4. Escaneá este código con la cámara',
              ].map(paso => (
                <p key={paso} style={{ margin: 0, fontSize: 13, color: '#555' }}>{paso}</p>
              ))}
            </div>

            <p style={{ fontSize: 12, color: colors.subtext, textAlign: 'center', marginBottom: 16, marginTop: 4 }}>
              ¿Usás el mismo teléfono para esta app? Descargá el QR y abrilo desde otro dispositivo para escanearlo.
            </p>

            <div style={{ width: '100%', display: 'flex', gap: 10, marginBottom: 12 }}>
              <button
                onClick={() => downloadQR(qrBase64)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE', cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Descargar</span>
              </button>

              <button
                onClick={() => shareQR(qrBase64)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE', cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Compartir</span>
              </button>

              <button
                onClick={() => { reset(); conectar(); }}
                disabled={loading}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 0', borderRadius: 14, background: '#fff', border: '1.5px solid #EEE',
                  cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>Generar otro</span>
              </button>
            </div>

            {polling && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7,
                  border: `2px solid ${colors.primary}`, borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: 12, color: colors.primary, fontWeight: 600 }}>
                  Esperando confirmación...
                </span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>
        )}

        {/* Disconnected state — no QR yet */}
        {!verificando && !loading && !estaConectado && !expirado && !qrBase64 && (
          <button
            onClick={() => conectar()}
            disabled={loading}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              backgroundColor: colors.primary, color: '#fff',
              fontSize: 16, fontWeight: 600, border: 'none',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            Generar código QR
          </button>
        )}
      </div>
    </div>
  );
}
