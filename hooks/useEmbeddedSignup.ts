import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useEmbeddedSignup — owns the Meta Embedded Signup (Coexistence) handshake.
//
// THE ORDERING HAZARD (do not rediscover this in QA):
// FB.login's callback and the window `message` FINISH event are TWO
// INDEPENDENT async channels with NO guaranteed order.
//   - FB.login callback  → carries `code` (ES exchange code, ~30s TTL)
//   - `message` FINISH   → carries `waba_id` (+ sometimes `phone_number_id`)
// Either can arrive first. The backend exchange needs BOTH `code` and
// `waba_id`, so this hook:
//   1. Registers the `message` listener BEFORE calling FB.login.
//   2. Filters event.origin against Meta origins BEFORE parsing, then checks
//      data.type === 'WA_EMBEDDED_SIGNUP'.
//   3. Holds `code` / `waba_id` / `phone_number_id` in refs and fires
//      onCompleto once BOTH `code` and `waba_id` are present (whichever
//      arrived second).
//   4. If `code` arrives and no FINISH follows within ~3s, burns the code and
//      surfaces a retryable error (the code would expire mid-exchange anyway).
//   5. Treats a popup closed with no authResponse as a clean `cancelado`, not
//      an error.
//   6. Runs ONE overall ~60s operation timeout that resolves to a retryable
//      error regardless of which ref is still empty — covers the mirror case
//      where FINISH arrives but the user closes the popup so FB.login's
//      callback never fires and the spinner would otherwise hang forever.
//
// The POST to the backend (and its own axios timeout, its 403/409/422 error
// mapping, and the "puede tardar hasta un minuto" in-flight copy) belongs to
// the caller — same split as suscripciones/page.tsx, where the screen owns the
// service call. This hook's job ends when it hands back { code, waba_id }.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGENES_META = ['https://www.facebook.com', 'https://web.facebook.com'];

// `code` arrived, still waiting on the FINISH message. Short — the code's TTL
// is ~30s and the server exchange itself needs most of that budget.
const TIMEOUT_SIN_FINISH_MS = 3000;

// Overall operation ceiling, independent of which channel is missing.
const TIMEOUT_OPERACION_MS = 60000;

const MSG_ERROR_GENERICO = 'No se pudo completar la conexión, reintentá.';
const MSG_SDK_NO_LISTO = 'El SDK de Facebook todavía no cargó. Reintentá en unos segundos.';

export type EstadoEmbeddedSignup = 'idle' | 'esperando' | 'cancelado' | 'error';

export interface DatosEmbeddedSignup {
  user_id: number;
  code: string;
  waba_id: string;
  phone_number_id?: string;
}

interface UseEmbeddedSignupParams {
  configId: string | null;
  sdkListo: boolean;
  onCompleto: (datos: DatosEmbeddedSignup) => void;
}

interface UseEmbeddedSignupResult {
  estado: EstadoEmbeddedSignup;
  error: string | null;
  iniciar: (userId: number) => void;
  reset: () => void;
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function useEmbeddedSignup({
  configId,
  sdkListo,
  onCompleto,
}: UseEmbeddedSignupParams): UseEmbeddedSignupResult {
  const [estado, setEstado] = useState<EstadoEmbeddedSignup>('idle');
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<string | null>(null);
  const wabaRef = useRef<string | null>(null);
  const phoneNumberIdRef = useRef<string | null>(null);
  const userIdRef = useRef<number | null>(null);
  const enCursoRef = useRef(false);

  const timerSinFinishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerOperacionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  // onCompleto is likely recreated every render — keep it in a ref so `iniciar`
  // stays stable and the FINISH handler always calls the latest closure.
  const onCompletoRef = useRef(onCompleto);
  useEffect(() => {
    onCompletoRef.current = onCompleto;
  }, [onCompleto]);

  const limpiar = useCallback(() => {
    enCursoRef.current = false;
    codeRef.current = null;
    wabaRef.current = null;
    phoneNumberIdRef.current = null;
    userIdRef.current = null;
    if (timerSinFinishRef.current) {
      clearTimeout(timerSinFinishRef.current);
      timerSinFinishRef.current = null;
    }
    if (timerOperacionRef.current) {
      clearTimeout(timerOperacionRef.current);
      timerOperacionRef.current = null;
    }
    if (listenerRef.current) {
      window.removeEventListener('message', listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  // Tear everything down if the screen unmounts mid-flow.
  useEffect(() => limpiar, [limpiar]);

  const fallar = useCallback(
    (mensaje: string) => {
      limpiar();
      setEstado('error');
      setError(mensaje);
    },
    [limpiar],
  );

  const cancelar = useCallback(() => {
    limpiar();
    setEstado('cancelado');
    setError(null);
  }, [limpiar]);

  const intentarCompletar = useCallback(() => {
    if (!codeRef.current || !wabaRef.current || userIdRef.current === null) return;
    const datos: DatosEmbeddedSignup = {
      user_id: userIdRef.current,
      code: codeRef.current,
      waba_id: wabaRef.current,
      ...(phoneNumberIdRef.current ? { phone_number_id: phoneNumberIdRef.current } : {}),
    };
    limpiar();
    setEstado('idle');
    setError(null);
    onCompletoRef.current(datos);
  }, [limpiar]);

  const iniciar = useCallback(
    (userId: number) => {
      if (enCursoRef.current) return;

      const fb = window.FB;
      if (!sdkListo || !fb || !configId) {
        setEstado('error');
        setError(MSG_SDK_NO_LISTO);
        return;
      }

      enCursoRef.current = true;
      codeRef.current = null;
      wabaRef.current = null;
      phoneNumberIdRef.current = null;
      userIdRef.current = userId;
      setEstado('esperando');
      setError(null);

      // 1. message listener FIRST — before FB.login.
      const onMessage = (e: MessageEvent) => {
        // origin filter BEFORE any parsing
        if (!ORIGENES_META.includes(e.origin)) return;

        let data: unknown;
        try {
          data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        } catch {
          return;
        }
        if (!esObjeto(data) || data.type !== 'WA_EMBEDDED_SIGNUP') return;

        const evento = typeof data.event === 'string' ? data.event : '';
        const payload = esObjeto(data.data) ? data.data : {};

        if (evento.startsWith('FINISH')) {
          const waba = payload.waba_id;
          const phone = payload.phone_number_id;
          if (typeof waba === 'string' && waba) wabaRef.current = waba;
          else if (typeof waba === 'number') wabaRef.current = String(waba);
          if (typeof phone === 'string' && phone) phoneNumberIdRef.current = phone;
          else if (typeof phone === 'number') phoneNumberIdRef.current = String(phone);

          if (timerSinFinishRef.current) {
            clearTimeout(timerSinFinishRef.current);
            timerSinFinishRef.current = null;
          }
          if (wabaRef.current) intentarCompletar();
          else fallar(MSG_ERROR_GENERICO);
        } else if (evento === 'CANCEL') {
          // user backed out inside the embedded flow
          cancelar();
        }
      };
      listenerRef.current = onMessage;
      window.addEventListener('message', onMessage);

      // 2. overall operation timeout — fires no matter which ref is empty.
      timerOperacionRef.current = setTimeout(() => {
        fallar(MSG_ERROR_GENERICO);
      }, TIMEOUT_OPERACION_MS);

      // 3. FB.login — v4 Coexistence option bag.
      // v4 (current, replaces v2/v3 — both deprecated Oct 2026) drops
      // `sessionInfoVersion` and `featureType`: which products the flow
      // offers (WhatsApp Business App Onboarding / Coexistence) is now
      // selected on the config_id's own Facebook Login for Business
      // configuration in the Meta dashboard, not in this options bag.
      // `extras.setup` is still sent per Meta's implementation guide for v4
      // (developers.facebook.com/documentation/business-messaging/whatsapp/
      // embedded-signup/implementation) even though the separate v4 versions
      // page shows a bare `extras: {}` — kept here as the lower-risk choice
      // since it was already present and does no known harm.
      fb.login(
        (response) => {
          const code = response?.authResponse?.code ?? null;
          if (!code) {
            // popup closed / dismissed with no authResponse → clean cancel
            cancelar();
            return;
          }
          codeRef.current = code;
          // code in hand; if FINISH has not landed yet, give it ~3s then burn
          // the code — it will not survive the server exchange otherwise.
          if (!wabaRef.current && !timerSinFinishRef.current) {
            timerSinFinishRef.current = setTimeout(() => {
              fallar(MSG_ERROR_GENERICO);
            }, TIMEOUT_SIN_FINISH_MS);
          }
          intentarCompletar();
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
          },
        },
      );
    },
    [sdkListo, configId, intentarCompletar, cancelar, fallar],
  );

  const reset = useCallback(() => {
    limpiar();
    setEstado('idle');
    setError(null);
  }, [limpiar]);

  return { estado, error, iniciar, reset };
}
