'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { HeroPerfil } from '@/components/perfil/HeroPerfil';
import { CardSeccion } from '@/components/perfil/CardSeccion';
import { FilaDato } from '@/components/perfil/FilaDato';
import { SheetDatosPersonales } from '@/components/perfil/SheetDatosPersonales';
import { SheetNegocio } from '@/components/perfil/SheetNegocio';
import { SheetPassword } from '@/components/perfil/SheetPassword';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { phoneUtils } from '@/lib/phoneUtils';

// Acepta coma decimal (convención es-AR/pt-BR, ej. "150,50") además de
// punto. Antes `parseFloat(senaMonto) || undefined` convertía cualquier
// entrada inválida (vacío, coma, texto) en `undefined` sin avisar — la
// seña quedaba sin guardar mientras la UI mostraba "cambios guardados".
// null = inválido (hay que avisar), undefined = vacío a propósito (sin seña).
function parsearSenaMonto(texto: string): { valor: number | undefined } | null {
  const limpio = texto.trim();
  if (limpio === '') return { valor: undefined };

  // Exige el shape exacto de un monto: dígitos, con a lo sumo un separador
  // decimal (coma o punto) seguido de 1-2 dígitos. Rechaza en vez de
  // adivinar los casos ambiguos que antes se colaban:
  // - "1.500" (¿mil quinientos, o uno coma cinco?) — sin coma de por
  //   medio no hay forma de saber si el punto es de miles o decimal.
  // - "150," / "150." (separador sin dígitos después, entrada a medio
  //   escribir) — antes Number() los aceptaba igual como 150.
  if (!/^\d+([.,]\d{1,2})?$/.test(limpio)) return null;

  const numero = Number(limpio.replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return null;
  return { valor: numero };
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type Sheet = 'personal' | 'negocio' | 'password' | null;

const SNAP_POINTS: Record<Exclude<Sheet, null>, number[]> = {
  personal: [0.75],
  negocio: [0.8],
  password: [0.6],
};

function IconStore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconSuscripcion() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function PerfilPage() {
  const t = useTranslations('perfil.PerfilPage');
  const router = useRouter();
  const { user, updatePerfil, logout, subscriptionExpired, daysLeft, subscriptionEndsAt, isExempt } = useAuth();

  const sheetRef = useRef<BottomSheetHandle>(null);
  const [sheetActivo, setSheetActivo] = useState<Sheet>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombreEstudio, setNombreEstudio] = useState('');
  const [codigoPais, setCodigoPais] = useState('54');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [senaMonto, setSenaMonto] = useState('');
  const [confirmacionAutomatica, setConfirmacionAutomatica] = useState(true);
  const [recordatorioAutomatico, setRecordatorioAutomatico] = useState(false);
  const [horaRecordatorio, setHoraRecordatorio] = useState('20:00');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [senaMontoError, setSenaMontoError] = useState<string | null>(null);

  useEffect(() => {
    if (sheetActivo) {
      sheetRef.current?.snapToIndex(0);
    }
  }, [sheetActivo]);

  if (!user) return null;

  const abrirSheet = (sheet: Exclude<Sheet, null>) => {
    setNombreEstudio(user.name ?? '');
    const { codigo, numero } = phoneUtils.splitCodigoPais(user.telefono ?? '');
    setCodigoPais(codigo);
    setTelefono(numero);
    setDireccion(user.direccion ?? '');
    setSenaMonto(user.sena_monto != null ? String(user.sena_monto) : '');
    setConfirmacionAutomatica(user.confirmacion_automatica ?? true);
    setRecordatorioAutomatico(user.recordatorio_automatico ?? false);
    setHoraRecordatorio(user.hora_recordatorio ?? '20:00');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordError(null);
    setSenaMontoError(null);
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

  const handlePasteTelefono = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pegado = e.clipboardData.getData('text');
    const soloDigitos = phoneUtils.clean(pegado);
    if (!soloDigitos) return;
    e.preventDefault();

    const traeCodigoPais = pegado.trim().startsWith('+') || soloDigitos.length > 11;
    if (traeCodigoPais) {
      const { codigo, numero } = phoneUtils.splitCodigoPais(soloDigitos);
      setCodigoPais(codigo);
      setTelefono(numero);
    } else {
      setTelefono(soloDigitos);
    }
  };

  const handleGuardar = async () => {
    if (!sheetActivo) return;

    if (sheetActivo === 'password' && password !== passwordConfirmation) {
      setPasswordError(t('passwordsDontMatch'));
      return;
    }

    let senaMontoParseada: number | undefined;
    if (sheetActivo === 'negocio') {
      const resultado = parsearSenaMonto(senaMonto);
      if (!resultado) {
        setSenaMontoError(t('depositAmountInvalid'));
        return;
      }
      setSenaMontoError(null);
      senaMontoParseada = resultado.valor;
    }

    setGuardando(true);
    try {
      if (sheetActivo === 'personal') {
        await updatePerfil({
          name: nombreEstudio,
          telefono: telefono.trim() ? `+${codigoPais}${telefono.trim()}` : '',
          direccion,
        });
      } else if (sheetActivo === 'negocio') {
        await updatePerfil({
          sena_monto: senaMontoParseada,
          confirmacion_automatica: confirmacionAutomatica,
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
        sheetActivo === 'password' ? t('passwordUpdated') :
        sheetActivo === 'negocio'  ? t('changesSaved') :
        t('dataSaved')
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
    if (await confirmDialog(t('logoutConfirm'), { confirmText: t('logoutConfirmButton'), danger: true })) {
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
            codigoPais={codigoPais}
            setCodigoPais={setCodigoPais}
            telefono={telefono}
            setTelefono={setTelefono}
            onPasteTelefono={handlePasteTelefono}
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
            confirmacionAutomatica={confirmacionAutomatica}
            setConfirmacionAutomatica={setConfirmacionAutomatica}
            recordatorioAutomatico={recordatorioAutomatico}
            setRecordatorioAutomatico={setRecordatorioAutomatico}
            horaRecordatorio={horaRecordatorio}
            setHoraRecordatorio={setHoraRecordatorio}
            nombreNegocio={user.name ?? ''}
            telefonoContacto={user.telefono ?? ''}
            direccionNegocio={user.direccion ?? ''}
            onGuardar={handleGuardar}
            guardando={guardando}
            error={senaMontoError}
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
      default:
        return null;
    }
  };

  return (
    // Sin BackButton (raíz de tab), mismo patrón que clientes/page.tsx.
    // AgendaThemeScope viene del layout.tsx propio del segmento (perfil no
    // tiene rutas hijas), no envuelto acá.
    <div style={{ minHeight: '100vh', backgroundColor: colors.surfaceSubtle, paddingBottom: 24 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroPerfil user={user} />

        <CardSeccion titulo={t('sectionPersonalData')} icono={<IconStore />} onEditar={() => abrirSheet('personal')}>
          <FilaDato label={t('studioName')} valor={user.name} />
          <FilaDato label={t('phone')} valor={user.telefono} />
          <FilaDato label={t('address')} valor={user.direccion} />
        </CardSeccion>

        <CardSeccion titulo={t('sectionBusiness')} icono={<IconBriefcase />} onEditar={() => abrirSheet('negocio')}>
          <FilaDato label={t('depositAmount')} valor={user.sena_monto != null ? `$${user.sena_monto}` : null} />
          <FilaDato label={t('autoConfirmation')} valor={user.confirmacion_automatica ? t('yes') : t('no')} />
          <FilaDato label={t('autoReminder')} valor={user.recordatorio_automatico ? t('yes') : t('no')} />
          {user.recordatorio_automatico && (
            <FilaDato label={t('reminderTime')} valor={user.hora_recordatorio} />
          )}
        </CardSeccion>

        <CardSeccion titulo={t('sectionSubscription')} icono={<IconSuscripcion />}>
          {isExempt ? (
            <FilaDato label={t('status')} valor={t('exemptAccount')} />
          ) : (
            <>
              <FilaDato label={t('status')} valor={subscriptionExpired ? t('expired') : t('active')} />
              <FilaDato
                label={t('expiresOn')}
                valor={subscriptionEndsAt ? formatFechaCorta(subscriptionEndsAt) : null}
              />
              {!subscriptionExpired && daysLeft != null && (
                <FilaDato label={t('daysLeft')} valor={String(daysLeft)} />
              )}
            </>
          )}
        </CardSeccion>

        <button
          onClick={() => abrirSheet('password')}
          style={{
            display: 'flex', alignItems: 'center', gap: 15,
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 40, height: 40, backgroundColor: colors.surfaceSubtle,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconLock />
          </div>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: colors.text }}>{t('changePassword')}</span>
          <IconChevronRight />
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, borderRadius: 14,
            padding: '14px', textAlign: 'center', cursor: 'pointer',
            color: colors.danger, fontSize: 15, fontWeight: 600,
          }}
        >
          {t('logout')}
        </button>
      </div>

      <BottomSheet
        ref={sheetRef}
        snapPoints={sheetActivo ? SNAP_POINTS[sheetActivo] : [0.75]}
        initialIndex={-1}
        enablePanDownToClose
        onChange={handleSheetChange}
        handleColor={colors.primary}
        bottomOffset={NAV_CLEARANCE}
      >
        {renderSheetContent()}
      </BottomSheet>
    </div>
  );
}
