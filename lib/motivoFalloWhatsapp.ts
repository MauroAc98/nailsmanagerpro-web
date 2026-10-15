// Codigo de error de Meta (WhatsApp Cloud API) -> clave de mensaje (namespace
// common.MotivoFalloWhatsapp). Funcion pura; el texto vive en messages/.

export type MotivoFallo =
  | 'noPuedeRecibir'
  | 'limiteDeWhatsapp'
  | 'noQuiereMensajes'
  | 'demasiadosMensajes'
  | 'envioRestringido'
  | 'problemaCuenta'
  | 'mensajeNoDisponible'
  | 'errorTemporal'
  | 'generico';

const POR_CODIGO: Record<number, MotivoFallo> = {
  131026: 'noPuedeRecibir',
  131049: 'limiteDeWhatsapp',
  131050: 'noQuiereMensajes',
  131056: 'demasiadosMensajes',
  130429: 'demasiadosMensajes',
  131048: 'envioRestringido',
  131031: 'problemaCuenta',
  131042: 'problemaCuenta',
  133010: 'problemaCuenta',
  131037: 'problemaCuenta',
  132000: 'mensajeNoDisponible',
  132001: 'mensajeNoDisponible',
  132005: 'mensajeNoDisponible',
  132007: 'mensajeNoDisponible',
  132012: 'mensajeNoDisponible',
  132015: 'mensajeNoDisponible',
  132016: 'mensajeNoDisponible',
  131008: 'mensajeNoDisponible',
  131009: 'mensajeNoDisponible',
  131000: 'errorTemporal',
  133004: 'errorTemporal',
  135000: 'errorTemporal',
};

export function motivoFallo(code: number | null | undefined): MotivoFallo {
  if (code == null) return 'generico';
  return POR_CODIGO[code] ?? 'generico';
}
