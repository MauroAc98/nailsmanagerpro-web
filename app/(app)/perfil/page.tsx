'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { HeroPerfil } from '@/components/perfil/HeroPerfil';
import { CardSeccion } from '@/components/perfil/CardSeccion';
import { FilaDato } from '@/components/perfil/FilaDato';
import { SheetDatosPersonales } from '@/components/perfil/SheetDatosPersonales';
import { SheetNegocio } from '@/components/perfil/SheetNegocio';
import { SheetPassword } from '@/components/perfil/SheetPassword';
import { SheetMensajeWhatsapp } from '@/components/perfil/SheetMensajeWhatsapp';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';

const NAV_HEIGHT = 78; // must match the bottom tab bar height in app/(app)/layout.tsx

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type Sheet = 'personal' | 'negocio' | 'password' | 'mensaje' | null;

const SNAP_POINTS: Record<Exclude<Sheet, null>, number[]> = {
  personal: [0.75],
  negocio: [0.8],
  password: [0.6],
  mensaje: [0.92],
};

function IconStore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconWhatsapp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.9 7.3L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8.5 10.5c.3 2.5 2.5 4.7 5 5" />
    </svg>
  );
}

function IconSuscripcion() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, updatePerfil, logout, subscriptionExpired, daysLeft, subscriptionEndsAt, isExempt } = useAuth();

  const sheetRef = useRef<BottomSheetHandle>(null);
  const [sheetActivo, setSheetActivo] = useState<Sheet>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombreEstudio, setNombreEstudio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [senaMonto, setSenaMonto] = useState('');
  const [recordatorioAutomatico, setRecordatorioAutomatico] = useState(false);
  const [horaRecordatorio, setHoraRecordatorio] = useState('20:00');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (sheetActivo) {
      sheetRef.current?.snapToIndex(0);
    }
  }, [sheetActivo]);

  if (!user) return null;

  const abrirSheet = (sheet: Exclude<Sheet, null>) => {
    setNombreEstudio(user.name ?? '');
    setTelefono(user.telefono ?? '');
    setDireccion(user.direccion ?? '');
    setSenaMonto(user.sena_monto != null ? String(user.sena_monto) : '');
    setRecordatorioAutomatico(user.recordatorio_automatico ?? false);
    setHoraRecordatorio(user.hora_recordatorio ?? '20:00');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordError(null);
    setSheetActivo(sheet);
  };

  const cerrarSheet = () => {
    sheetRef.current?.close();
  };

  const handleSheetChange = (index: number) => {
    if (index === -1) {
      setSheetActivo(null);
      setPassword('');
      setPasswordConfirmation('');
    }
  };

  const handleGuardar = async () => {
    if (!sheetActivo || sheetActivo === 'mensaje') return;

    if (sheetActivo === 'password' && password !== passwordConfirmation) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      if (sheetActivo === 'personal') {
        await updatePerfil({ name: nombreEstudio, telefono, direccion });
      } else if (sheetActivo === 'negocio') {
        await updatePerfil({
          sena_monto: parseFloat(senaMonto) || undefined,
          recordatorio_automatico: recordatorioAutomatico,
          hora_recordatorio: horaRecordatorio,
        });
      } else if (sheetActivo === 'password') {
        setPasswordError(null);
        await updatePerfil({ password, password_confirmation: passwordConfirmation });
        setPassword('');
        setPasswordConfirmation('');
      }
      showToast(
        sheetActivo === 'password' ? 'Contraseña actualizada' :
        sheetActivo === 'negocio'  ? 'Cambios guardados' :
        'Datos guardados'
      );
      cerrarSheet();
    } catch (e) {
      const mensaje = extraerMensajeError(e);
      if (sheetActivo === 'password') {
        setPasswordError(mensaje);
      } else {
        await alertDialog(mensaje);
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleLogout = async () => {
    if (await confirmDialog('¿Seguro que querés salir?', { confirmText: 'Salir' })) {
      await logout();
      router.push('/login');
    }
  };

  const renderSheetContent = () => {
    switch (sheetActivo) {
      case 'personal':
        return (
          <SheetDatosPersonales
            nombreEstudio={nombreEstudio}
            setNombreEstudio={setNombreEstudio}
            telefono={telefono}
            setTelefono={setTelefono}
            direccion={direccion}
            setDireccion={setDireccion}
            onGuardar={handleGuardar}
            guardando={guardando}
            onClose={cerrarSheet}
          />
        );
      case 'negocio':
        return (
          <SheetNegocio
            senaMonto={senaMonto}
            setSenaMonto={setSenaMonto}
            recordatorioAutomatico={recordatorioAutomatico}
            setRecordatorioAutomatico={setRecordatorioAutomatico}
            horaRecordatorio={horaRecordatorio}
            setHoraRecordatorio={setHoraRecordatorio}
            onGuardar={handleGuardar}
            guardando={guardando}
            onClose={cerrarSheet}
          />
        );
      case 'password':
        return (
          <SheetPassword
            password={password}
            setPassword={setPassword}
            passwordConfirmation={passwordConfirmation}
            setPasswordConfirmation={setPasswordConfirmation}
            onGuardar={handleGuardar}
            guardando={guardando}
            error={passwordError}
            onClose={cerrarSheet}
          />
        );
      case 'mensaje':
        return <SheetMensajeWhatsapp onClose={cerrarSheet} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F7F9', paddingBottom: 24 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>Perfil</h1>
      </div>

      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroPerfil user={user} />

        <CardSeccion titulo="Datos personales" icono={<IconStore />} onEditar={() => abrirSheet('personal')}>
          <FilaDato label="Nombre del estudio" valor={user.name} />
          <FilaDato label="Teléfono" valor={user.telefono} />
          <FilaDato label="Dirección" valor={user.direccion} />
        </CardSeccion>

        <CardSeccion titulo="Mi negocio" icono={<IconBriefcase />} onEditar={() => abrirSheet('negocio')}>
          <FilaDato label="Monto de seña" valor={user.sena_monto != null ? `$${user.sena_monto}` : null} />
          <FilaDato label="Recordatorio automático" valor={user.recordatorio_automatico ? 'Sí' : 'No'} />
          {user.recordatorio_automatico && (
            <FilaDato label="Hora de recordatorio" valor={user.hora_recordatorio} />
          )}
        </CardSeccion>

        <CardSeccion titulo="Suscripción" icono={<IconSuscripcion />}>
          {isExempt ? (
            <FilaDato label="Estado" valor="Cuenta exenta" />
          ) : (
            <>
              <FilaDato label="Estado" valor={subscriptionExpired ? 'Vencida' : 'Activa'} />
              <FilaDato
                label="Vence el"
                valor={subscriptionEndsAt ? formatFechaCorta(subscriptionEndsAt) : null}
              />
              {!subscriptionExpired && daysLeft != null && (
                <FilaDato label="Días restantes" valor={String(daysLeft)} />
              )}
            </>
          )}
        </CardSeccion>

        <button
          onClick={() => abrirSheet('mensaje')}
          style={{
            display: 'flex', alignItems: 'center', gap: 15,
            backgroundColor: '#FFF', border: '1px solid #EEE',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 40, height: 40, backgroundColor: '#F9F9F9',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconWhatsapp />
          </div>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: colors.text }}>Mensajes de WhatsApp</span>
          <IconChevronRight />
        </button>

        <button
          onClick={() => abrirSheet('password')}
          style={{
            display: 'flex', alignItems: 'center', gap: 15,
            backgroundColor: '#FFF', border: '1px solid #EEE',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 40, height: 40, backgroundColor: '#F9F9F9',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconLock />
          </div>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: colors.text }}>Cambiar contraseña</span>
          <IconChevronRight />
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: '#FFF5F5', border: '1px solid #FDDCDC', borderRadius: 14,
            padding: '14px', textAlign: 'center', cursor: 'pointer',
            color: colors.danger, fontSize: 15, fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <BottomSheet
        ref={sheetRef}
        snapPoints={sheetActivo ? SNAP_POINTS[sheetActivo] : [0.75]}
        initialIndex={-1}
        enablePanDownToClose
        onChange={handleSheetChange}
        handleColor={colors.primary}
        bottomOffset={NAV_HEIGHT}
      >
        {renderSheetContent()}
      </BottomSheet>
    </div>
  );
}
