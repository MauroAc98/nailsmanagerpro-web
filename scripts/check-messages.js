// Verifica los catálogos de mensajes bajo messages/: paridad de keys y
// tokens de placeholder idénticos entre `es` (fuente de verdad) y cada
// locale traducido. Corre como parte de `npm run lint`.
//
// Un namespace/locale con el JSON vacío (`{}`) se considera "todavía no
// traducido" y se salta sin error — así el check no bloquea el lint
// durante las Fases 1-9, donde los catálogos pt-BR se completan
// incrementalmente namespace por namespace (ver design.md, "Migration /
// Rollout": pt-BR queda fuera de SUPPORTED hasta que su catálogo esté
// completo). Una vez que un namespace tiene AL MENOS una key traducida,
// sí se exige paridad completa con `es` para ese namespace — evita que un
// catálogo quede "a medias" sin que nadie lo note.
//
// `en` nunca se chequea: es scaffold estructural permanente que siempre
// cae al fallback de `es` (ver spec.md, "en Scaffold Only, es Fallback").

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const messagesDir = path.join(root, "messages");

const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "agenda",
  "clientes",
  "configuracion",
  "perfil",
  "whatsapp",
  "historia",
  "estadisticas",
  "legal",
  "validation",
];

const BASE_LOCALE = "es";
const CHECKED_LOCALES = ["pt-BR"];

function readJson(locale, ns) {
  const file = path.join(messagesDir, locale, `${ns}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path.relative(root, file)}: ${err.message}`);
  }
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, flatKey));
    } else {
      out[flatKey] = value;
    }
  }
  return out;
}

const TOKEN_RE = /\{[^}]+\}/g;
function tokens(value) {
  if (typeof value !== "string") return [];
  return (value.match(TOKEN_RE) ?? []).sort();
}

function main() {
  const errors = [];
  const skipped = [];

  for (const ns of NAMESPACES) {
    const base = readJson(BASE_LOCALE, ns);
    if (base === null) {
      errors.push(`Missing ${BASE_LOCALE}/${ns}.json`);
      continue;
    }
    const baseFlat = flatten(base);
    const baseKeys = Object.keys(baseFlat);

    for (const locale of CHECKED_LOCALES) {
      const target = readJson(locale, ns);
      if (target === null) {
        errors.push(`Missing ${locale}/${ns}.json`);
        continue;
      }
      const targetFlat = flatten(target);
      const targetKeys = Object.keys(targetFlat);

      if (targetKeys.length === 0) {
        skipped.push(`${locale}/${ns}.json (not yet translated)`);
        continue;
      }

      const missing = baseKeys.filter(k => !targetKeys.includes(k));
      const extra = targetKeys.filter(k => !baseKeys.includes(k));
      if (missing.length > 0) {
        errors.push(`${locale}/${ns}.json missing keys: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        errors.push(`${locale}/${ns}.json has extra keys not in ${BASE_LOCALE}: ${extra.join(", ")}`);
      }

      for (const key of baseKeys) {
        if (!(key in targetFlat)) continue;
        const baseTokens = tokens(baseFlat[key]);
        const targetTokens = tokens(targetFlat[key]);
        if (JSON.stringify(baseTokens) !== JSON.stringify(targetTokens)) {
          errors.push(
            `${locale}/${ns}.json key "${key}" placeholder mismatch: ` +
            `${BASE_LOCALE}=[${baseTokens.join(", ")}] ${locale}=[${targetTokens.join(", ")}]`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("check-messages: FAILED\n");
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`check-messages: OK (${NAMESPACES.length} namespaces checked, ${skipped.length} pending translation)`);
  if (skipped.length > 0) {
    skipped.forEach(s => console.log(`  - ${s}`));
  }
}

main();
