'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { BottomSheet, BottomSheetHandle } from '@/components/BottomSheet';
import { HeroPerfil } from '@/components/perfil/HeroPerfil';
import { SheetDatosPersonales } from '@/components/perfil/SheetDatosPersonales';
import { SheetNegocio } from '@/components/perfil/SheetNegocio';
import { SheetSenaYPagos } from '@/components/perfil/SheetSenaYPagos';
import { SheetPassword } from '@/components/perfil/SheetPassword';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { phoneUtils } from '@/lib/phoneUtils';
import { sanitizarLineaSimple, type SenaCampo } from '@/lib/senaConfig';

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

type Sheet = 'personal' | 'negocio' | 'senaYPagos' | 'password' | null;

const SNAP_POINTS: Record<Exclude<Sheet, null>, number[]> = {
  personal: [0.75],
  negocio: [0.8],
  senaYPagos: [0.65],
  password: [0.6],
};

function IconStore() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconGlobeReservas() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function IconCardPago() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconChatBubble() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconChartUp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
    </svg>
  );
}

function IconGlobeIdioma() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconSuscripcion() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Grupo de filas compactas con su eyebrow — mismo lenguaje visual que ya usa
// /configuracion (ver rediseño de Perfil, board 01-MiNegocio).
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: colors.subtext, margin: '0 0 6px 4px',
      }}>
        {titulo}
      </div>
      <div style={{
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: 14, overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function FilaNav({ icon, label, onClick, ultima }: {
  icon: React.ReactNode; label: string; onClick: () => void; ultima?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        backgroundColor: 'transparent', border: 'none',
        borderBottom: ultima ? 'none' : `1px solid ${colors.border}`,
        padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 32, height: 32, backgroundColor: colors.surfaceSubtle, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: colors.text }}>{label}</span>
      <IconChevronRight />
    </button>
  );
}

// Fila de solo lectura (Suscripción): no navega a ningún lado hoy, así que
// no lleva ni cursor de link ni chevron — solo el valor a la derecha.
function FilaInfo({ icon, label, valor, ultima }: {
  icon: React.ReactNode; label: string; valor: string; ultima?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
      borderBottom: ultima ? 'none' : `1px solid ${colors.border}`,
    }}>
      <div style={{
        width: 32, height: 32, backgroundColor: colors.surfaceSubtle, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: colors.text }}>{label}</span>
      <span style={{ fontSize: 12, color: colors.subtext }}>{valor}</span>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const t = useTranslations('perfil.PerfilPage');
  const { user, updatePerfil, logout, subscriptionExpired, subscriptionEndsAt, isExempt } = useAuth();

  const sheetRef = useRef<BottomSheetHandle>(null);
  const [sheetActivo, setSheetActivo] = useState<Sheet>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombreEstudio, setNombreEstudio] = useState('');
  const [codigoPais, setCodigoPais] = useState('54');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  // Ubicación (Slice A) — seed desde `user.latitud/longitud` al abrir el
  // sheet, igual que `direccion`; `setUbicacion` es lo único que
  // `UbicacionMapaModal` (vía SheetDatosPersonales) puede llamar al confirmar.
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const setUbicacion = (lat: number, lng: number) => {
    setLatitud(lat);
    setLongitud(lng);
  };
  // Quitar es local hasta "Guardar cambios", igual que marcarla. Si los envíos
  // automáticos están activos el backend rechaza el guardado con un 422 en
  // `latitud`, que el sheet muestra junto a la tarjeta de ubicación.
  const quitarUbicacion = async () => {
    const confirmado = await confirmDialog(t('locationRemoveConfirm'), {
      confirmText: t('locationRemoveConfirmButton'), danger: true,
    });
    if (!confirmado) return;
    setLatitud(null);
    setLongitud(null);
  };
  const [senaMonto, setSenaMonto] = useState('');
  const [whatsappPideSena, setWhatsappPideSena] = useState(false);
  const [senaTitular, setSenaTitular] = useState('');
  const [senaEntidad, setSenaEntidad] = useState('');
  const [senaAlias, setSenaAlias] = useState('');
  const [senaCbu, setSenaCbu] = useState('');
  const [confirmacionAutomatica, setConfirmacionAutomatica] = useState(true);
  const [recordatorioAutomatico, setRecordatorioAutomatico] = useState(false);
  const [horaRecordatorio, setHoraRecordatorio] = useState('20:00');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [senaMontoError, setSenaMontoError] = useState<string | null>(null);
  // Errores 422 del backend para la seña, mapeados por campo. Compartido
  // entre "Mensajes automáticos" y "Seña y pagos" — el guard de `PUT /perfil`
  // valida el estado final sin importar desde qué sheet llegó el campo.
  const [erroresNegocio, setErroresNegocio] = useState<Partial<Record<SenaCampo, string>>>({});

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
    setLatitud(user.latitud);
    setLongitud(user.longitud);
    setErrorUbicacion(null);
    setSenaMonto(user.sena_monto != null ? String(user.sena_monto) : '');
    setWhatsappPideSena(user.whatsapp_pide_sena ?? false);
    setSenaTitular(user.whatsapp_sena_titular ?? '');
    setSenaEntidad(user.whatsapp_sena_entidad ?? '');
    setSenaAlias(user.whatsapp_sena_alias ?? '');
    setSenaCbu(user.whatsapp_sena_cbu ?? '');
    setConfirmacionAutomatica(user.confirmacion_automatica ?? true);
    setRecordatorioAutomatico(user.recordatorio_automatico ?? false);
    setHoraRecordatorio(user.hora_recordatorio ?? '20:00');
    setPassword('');
    setPasswordConfirmation('');
    setPasswordError(null);
    setSenaMontoError(null);
    setErroresNegocio({});
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
    if (sheetActivo === 'senaYPagos') {
      const resultado = parsearSenaMonto(senaMonto);
      if (!resultado) {
        setSenaMontoError(t('depositAmountInvalid'));
        return;
      }
      setSenaMontoError(null);
      setErroresNegocio({});
      senaMontoParseada = resultado.valor;
    }

    setGuardando(true);
    try {
      if (sheetActivo === 'personal') {
        setErrorUbicacion(null);
        await updatePerfil({
          name: nombreEstudio,
          telefono: telefono.trim() ? `+${codigoPais}${telefono.trim()}` : '',
          direccion,
          latitud,
          longitud,
        });
      } else if (sheetActivo === 'senaYPagos') {
        await updatePerfil({ sena_monto: senaMontoParseada });
      } else if (sheetActivo === 'negocio') {
        await updatePerfil({
          whatsapp_pide_sena: whatsappPideSena,
          // Espeja `WhatsappTemplate::unaLinea` del backend: sin `\r\n\t` ni
          // espacios interiores repetidos. String vacío -> null para no
          // guardar datos en blanco.
          whatsapp_sena_titular: sanitizarLineaSimple(senaTitular) || null,
          whatsapp_sena_entidad: sanitizarLineaSimple(senaEntidad) || null,
          whatsapp_sena_alias: sanitizarLineaSimple(senaAlias) || null,
          whatsapp_sena_cbu: sanitizarLineaSimple(senaCbu) || null,
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
        (sheetActivo === 'negocio' || sheetActivo === 'senaYPagos') ? t('changesSaved') :
        t('dataSaved')
      );
      cerrarSheet();
    } catch (e) {
      const mensaje = extraerMensajeError(e);
      if (sheetActivo === 'password') {
        setPasswordError(mensaje);
      } else if (sheetActivo === 'personal') {
        // El guard del backend devuelve cualquier error de coordenadas bajo
        // la key `latitud` (ver apply-progress A1) — se mapea al lado del
        // campo de ubicación, nunca como diálogo genérico.
        const errores = (e as { response?: { data?: { errors?: Record<string, string[]> } } })
          .response?.data?.errors ?? {};
        const primero = errores.latitud?.[0];
        if (primero) {
          setErrorUbicacion(primero);
        } else {
          await alertDialog(mensaje);
        }
      } else if (sheetActivo === 'negocio' || sheetActivo === 'senaYPagos') {
        // Mapea el 422 del guard de seña a errores por campo. Compartido
        // entre los dos sheets (ver erroresNegocio arriba): el guard valida
        // el estado final sin importar desde cuál de los dos llegó el 422.
        const errores = (e as { response?: { data?: { errors?: Record<string, string[]> } } })
          .response?.data?.errors ?? {};
        const campos: SenaCampo[] = ['sena_monto', 'direccion', 'whatsapp_sena_titular', 'whatsapp_sena_alias'];
        const mapa: Partial<Record<SenaCampo, string>> = {};
        for (const campo of campos) {
          const primero = errores[campo]?.[0];
          if (primero) mapa[campo] = primero;
        }
        if (Object.keys(mapa).length > 0) {
          setErroresNegocio(mapa);
        } else {
          await alertDialog(mensaje);
        }
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
      // Recarga completa, no router.push: `logout()` solo limpia
      // useAuthStore — el resto de los stores (turnos, servicios,
      // profesionales, clientes, etc.) son módulos en memoria que una
      // navegación de Next.js no reinicia. Sin esto, si otra cuenta inicia
      // sesión en el mismo tab sin refrescar a mano, ve datos cacheados del
      // negocio anterior hasta que cada pantalla vuelva a fetchear.
      window.location.href = '/login';
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
            latitud={latitud}
            longitud={longitud}
            setUbicacion={setUbicacion}
            onQuitarUbicacion={quitarUbicacion}
            errorUbicacion={errorUbicacion}
            onGuardar={handleGuardar}
            guardando={guardando}
            onClose={cerrarSheet}
          />
        );
      case 'senaYPagos':
        return (
          <SheetSenaYPagos
            senaMonto={senaMonto}
            setSenaMonto={setSenaMonto}
            error={senaMontoError}
            erroresServidor={erroresNegocio}
            onGuardar={handleGuardar}
            guardando={guardando}
            onClose={cerrarSheet}
          />
        );
      case 'negocio':
        return (
          <SheetNegocio
            senaMonto={senaMonto}
            whatsappPideSena={whatsappPideSena}
            setWhatsappPideSena={setWhatsappPideSena}
            senaTitular={senaTitular}
            setSenaTitular={setSenaTitular}
            senaEntidad={senaEntidad}
            setSenaEntidad={setSenaEntidad}
            senaAlias={senaAlias}
            setSenaAlias={setSenaAlias}
            senaCbu={senaCbu}
            setSenaCbu={setSenaCbu}
            erroresServidor={erroresNegocio}
            confirmacionAutomatica={confirmacionAutomatica}
            setConfirmacionAutomatica={setConfirmacionAutomatica}
            recordatorioAutomatico={recordatorioAutomatico}
            setRecordatorioAutomatico={setRecordatorioAutomatico}
            horaRecordatorio={horaRecordatorio}
            setHoraRecordatorio={setHoraRecordatorio}
            nombreNegocio={user.name ?? ''}
            telefonoContacto={user.telefono ?? ''}
            direccionNegocio={user.direccion ?? ''}
            latitudNegocio={user.latitud}
            longitudNegocio={user.longitud}
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
      default:
        return null;
    }
  };

  return (
    // Sin BackButton (raíz de tab), mismo patrón que clientes/page.tsx.
    // AgendaThemeScope viene del layout.tsx propio del segmento.
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <HeroPerfil user={user} />
        </div>

        <Grupo titulo={t('groupDatosNegocio')}>
          <FilaNav icon={<IconStore />} label={t('rowDatosNegocio')} onClick={() => abrirSheet('personal')} ultima />
        </Grupo>

        <Grupo titulo={t('groupReservasPagos')}>
          <FilaNav icon={<IconGlobeReservas />} label={t('rowReservasOnline')} onClick={() => router.push('/configuracion/reservas-online')} />
          <FilaNav icon={<IconCardPago />} label={t('rowSenaYPagos')} onClick={() => abrirSheet('senaYPagos')} ultima />
        </Grupo>

        <Grupo titulo={t('groupMensajes')}>
          <FilaNav icon={<IconChatBubble />} label={t('rowMensajes')} onClick={() => abrirSheet('negocio')} ultima />
        </Grupo>

        <Grupo titulo={t('groupFinanzas')}>
          <FilaNav icon={<IconChartUp />} label={t('rowFinanzas')} onClick={() => router.push('/perfil/finanzas')} ultima />
        </Grupo>

        <Grupo titulo={t('groupApariencia')}>
          <FilaNav icon={<IconSun />} label={t('rowApariencia')} onClick={() => router.push('/configuracion/apariencia')} />
          <FilaNav icon={<IconGlobeIdioma />} label={t('rowIdioma')} onClick={() => router.push('/configuracion/idioma')} ultima />
        </Grupo>

        <Grupo titulo={t('groupCuenta')}>
          <FilaInfo
            icon={<IconSuscripcion />}
            label={t('rowSuscripcion')}
            valor={
              isExempt ? t('exemptAccount') :
              subscriptionExpired ? t('expired') :
              subscriptionEndsAt ? `${t('active')} · ${formatFechaCorta(subscriptionEndsAt)}` : t('active')
            }
          />
          <FilaNav icon={<IconLock />} label={t('changePassword')} onClick={() => abrirSheet('password')} />
          <FilaNav icon={<IconHelp />} label={t('rowAyuda')} onClick={() => router.push('/configuracion/ayuda')} ultima />
        </Grupo>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, borderRadius: 14,
            padding: '14px', textAlign: 'center', cursor: 'pointer',
            color: colors.danger, fontSize: 15, fontWeight: 600, marginBottom: 16,
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
