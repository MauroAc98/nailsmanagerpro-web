'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '@/theme/colors';
import { User } from '@/services/authService';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { alertDialog } from '@/store/useConfirmStore';
import { ajustarLogoAProporcion } from '@/lib/logo';

interface Props {
  user: User;
}

// Mismo límite que valida el backend (`image|max:5120` = 5MB) — chequeado acá
// antes de subir para no gastar el upload completo en un archivo que el
// server va a rechazar igual.
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function HeroPerfil({ user }: Props) {
  const t = useTranslations('perfil.HeroPerfil');
  const { subirLogo } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const handleSeleccionar = () => {
    if (subiendo) return;
    inputRef.current?.click();
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo si el intento anterior falló
    if (!archivo) return;

    if (archivo.size > MAX_LOGO_BYTES) {
      await alertDialog(t('logoTooLarge'));
      return;
    }

    setSubiendo(true);
    try {
      const archivoAjustado = await ajustarLogoAProporcion(archivo);
      await subirLogo(archivoAjustado);
    } catch (err) {
      await alertDialog(extraerMensajeError(err));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      backgroundColor: withAlpha(colors.primary, '12'), borderRadius: 20, padding: 18,
    }}>
      <button
        type="button"
        onClick={handleSeleccionar}
        disabled={subiendo}
        aria-label={t('changeLogo')}
        style={{
          position: 'relative', width: 54, height: 54, padding: 0,
          background: 'none', border: 'none', flexShrink: 0,
          cursor: subiendo ? 'default' : 'pointer',
        }}
      >
        <div style={{
          position: 'relative', width: '100%', height: '100%', borderRadius: 27,
          backgroundColor: withAlpha(colors.primary, '33'), border: `2px solid ${colors.surface}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {user.logo_url ? (
            <Image src={user.logo_url} alt="" fill sizes="54px" style={{ objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.primary }}>
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          {subiendo && (
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="loader-spinner" style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
              }} />
            </div>
          )}
        </div>

        {/* Badge flotante — deja claro que el círculo es tocable y para qué,
            en vez de depender de que la usuaria lo intente sin ninguna
            pista. Se oculta mientras sube para no competir con el spinner. */}
        {!subiendo && (
          <span
            aria-hidden
            style={{
              position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
              backgroundColor: colors.primary, border: `2px solid ${colors.surface}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Camera size={11} color="#fff" strokeWidth={2.2} />
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleArchivo} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{user.name}</p>
        <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>{user.email}</p>
      </div>
    </div>
  );
}
