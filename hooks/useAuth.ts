import { useAuthStore } from '@/store/useAuthStore';

export const useAuth = () => {
  const {
    user,
    token,
    loading,
    error,
    inicializado,
    debeCambiarPassword,
    emailPendiente,
    subscriptionExpired,
    supportInfo,
    daysLeft,
    subscriptionEndsAt,
    isExempt,
    mostrarBienvenida,
    esPrimerLogin,
    setSubscriptionExpired,
    setMostrarBienvenida,
    checkSubscription,
    login,
    cambiarPasswordObligatorio,
    logout,
    inicializar,
    updatePerfil,
    clearError,
    forgotPassword,
    resetPassword,
  } = useAuthStore();

  return {
    // Estado
    user,
    token,
    loading,
    error,
    inicializado,
    estaAutenticado: !!token,
    debeCambiarPassword,
    emailPendiente,
    subscriptionExpired,
    supportInfo,
    daysLeft,
    subscriptionEndsAt,
    isExempt,
    mostrarBienvenida,
    esPrimerLogin,

    // Acciones
    login,
    cambiarPasswordObligatorio,
    logout,
    inicializar,
    updatePerfil,
    clearError,
    forgotPassword,
    resetPassword,
    setSubscriptionExpired,
    setMostrarBienvenida,
    checkSubscription,

    // Datos derivados
    nombreEstudio: user?.name ?? '',
    slugAgenda: user?.slug ?? '',
    recordatorioAutomatico: user?.recordatorio_automatico ?? false,
    horaRecordatorio: user?.hora_recordatorio ?? '20:00',
    requiereEnvioManualWhatsapp: user?.whatsapp_requiere_envio_manual ?? false,
  };
};