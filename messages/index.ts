import type { Locale } from '@/lib/locale';

import esCommon from './es/common.json';
import esNav from './es/nav.json';
import esAuth from './es/auth.json';
import esAgenda from './es/agenda.json';
import esClientes from './es/clientes.json';
import esConfiguracion from './es/configuracion.json';
import esPerfil from './es/perfil.json';
import esWhatsapp from './es/whatsapp.json';
import esHistoria from './es/historia.json';
import esEstadisticas from './es/estadisticas.json';
import esLegal from './es/legal.json';
import esValidation from './es/validation.json';

// `es` se importa estático a propósito: además de ser el locale por
// defecto (mayoría de los usuarios), es el fallback de cualquier key
// faltante en otro locale — así que siempre viaja en el bundle igual.
export const es = {
  common: esCommon,
  nav: esNav,
  auth: esAuth,
  agenda: esAgenda,
  clientes: esClientes,
  configuracion: esConfiguracion,
  perfil: esPerfil,
  whatsapp: esWhatsapp,
  historia: esHistoria,
  estadisticas: esEstadisticas,
  legal: esLegal,
  validation: esValidation,
} as const;

export type Namespace = keyof typeof es;
export type Messages = Record<Namespace, Record<string, unknown>>;

const NAMESPACES = Object.keys(es) as Namespace[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, override: any): any {
  if (override === undefined || override === null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base) || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    merged[key] = deepMerge(base[key], override[key]);
  }
  return merged;
}

async function loadNamespace(locale: Exclude<Locale, 'es'>, ns: Namespace): Promise<Record<string, unknown>> {
  try {
    const mod = await import(`./${locale}/${ns}.json`);
    return (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    // Catálogo todavía no traducido para este namespace/locale — cae al
    // fallback de es (ver deepMerge en loadMessages).
    return {};
  }
}

/**
 * Devuelve el catálogo completo de mensajes para un locale, con cualquier
 * key faltante rellenada desde `es` (nunca hay strings en blanco ni
 * crashes por catálogos incompletos — ver spec "en Scaffold Only, es
 * Fallback").
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'es') return es;

  const overrides = await Promise.all(NAMESPACES.map(ns => loadNamespace(locale, ns)));

  const merged = {} as Messages;
  NAMESPACES.forEach((ns, i) => {
    merged[ns] = deepMerge(es[ns], overrides[i]);
  });
  return merged;
}
