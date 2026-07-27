'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, shadows } from '@/theme/colors';

// ─────────────────────────────────────────────
// Contenido — texto plano por módulo, mantenerlo acá adentro (no hace
// falta CMS ni archivo aparte para esta escala; si crece mucho, separar).
// ─────────────────────────────────────────────
const SECCIONES = [
  {
    titulo: 'Primeros pasos',
    texto: `Ingresá con el email y la contraseña provisoria que te llegó por correo cuando se creó tu cuenta. La primera vez, la app te va a pedir que la cambies por una nueva antes de dejarte entrar — es un paso obligatorio, una sola vez.

Una vez adentro, la app se maneja con 4 secciones fijas abajo de la pantalla:

- Agenda: tus turnos, día por día. Es la pantalla principal.
- Clientes: la lista de tus clientes.
- Config: servicios, horarios, profesionales, WhatsApp, apariencia y esta Ayuda.
- Perfil: tus datos, la seña, y tu suscripción.`,
  },
  {
    titulo: 'Antes de empezar: qué configurar primero',
    texto: `Para poder cargar tu primer turno necesitás, en este orden:

1. Al menos un servicio activo (Configuración → Servicios) — sin esto no podés elegir qué se le va a hacer al cliente.
2. Al menos un horario de atención activo (Configuración → Horarios Disponibles) — sin esto la app no te deja guardar ningún turno, te avisa "No tenés horarios de atención configurados".
3. Al menos un cliente cargado (pestaña Clientes) — los turnos siempre se asignan a un cliente ya guardado, no se puede escribir el nombre al vuelo desde la agenda.

Con esos tres pasos ya podés cargar turnos.`,
  },
  {
    titulo: 'Cómo agendar un turno',
    texto: `1. Entrá a Agenda y tocá el botón + (abajo a la derecha, en un día que no sea pasado).
2. Elegí el cliente buscándolo por nombre.
3. Si trabajás con más de una profesional, elegí quién lo va a atender — los servicios que se muestran después se filtran a lo que esa persona sabe hacer.
4. Elegí uno o más servicios.
5. Elegí la hora. La app valida sola: no te deja elegir un horario fuera de tu horario de atención, ni uno que se superponga con otro turno del día.
6. Tocá "Confirmar Turno".

Para cancelar un turno: deslizalo hacia la izquierda en la lista de la agenda y tocá "Cancelar". Para editarlo: tocalo directamente.

Mientras se está atendiendo, la tarjeta muestra "EN CURSO" con un botón para finalizarlo a mano; una vez pasada la hora, se marca sola como finalizada y se ve atenuada. Para buscar un turno puntual (por cliente, servicio o fecha), usá el botón "Filtrar" arriba de la lista.`,
  },
  {
    titulo: 'Servicios',
    texto: `Configuración → Servicios.

Cargá cada servicio con su nombre y la duración en minutos — esa duración es la que usa la app para calcular cuánto ocupa un turno y evitar que se superpongan dos turnos.

Podés desactivar un servicio sin borrarlo si dejás de ofrecerlo por un tiempo; los turnos viejos que ya lo tenían no se ven afectados.`,
  },
  {
    titulo: 'Horarios Disponibles',
    texto: `Configuración → Horarios Disponibles.

Es la lista de horas en las que se puede reservar (por ejemplo 09:00, 09:30, 10:00...). Tocá + para agregar una hora nueva, y usá el interruptor para activarla o desactivarla sin borrarla.

Este paso es obligatorio: sin ningún horario activo, la app no te deja cargar turnos.

Si trabajás con más de una profesional, cada una tiene su propio horario — elegí su nombre en la fila de arriba de esta pantalla antes de cargar sus horas (ver la sección "Profesionales" para más detalle).`,
  },
  {
    titulo: 'Clientes',
    texto: `Pestaña Clientes.

Ahí cargás nombre, apellido y teléfono de cada una. El teléfono es el que se usa para el botón de WhatsApp que aparece en cada turno y para los mensajes automáticos.

Podés buscarlas por nombre y ver su historial de turnos. El interruptor en cada tarjeta la desactiva sin borrarla (por ejemplo si dejó de venir) — sus turnos anteriores quedan intactos, y podés reactivarla en cualquier momento con el mismo interruptor.`,
  },
  {
    titulo: 'Profesionales: cómo agregar una nueva',
    texto: `Esta sección solo importa si trabajás con más de una persona en el estudio. Si trabajás sola, no hace falta tocar nada acá.

1. Configuración → Profesionales → botón +.
2. Escribí su nombre y elegí un color para distinguirla en la agenda.
3. Tildá los servicios que sabe hacer — eso filtra lo que se le puede asignar al crear un turno para ella.
4. Guardá.
5. Importante: andá a Configuración → Horarios Disponibles, elegí su nombre en el selector de arriba, y cargale sus propios horarios de atención. Cada profesional tiene un horario independiente — si no se lo configurás, no va a tener ninguna hora disponible para agendar, aunque ya la hayas creado.

Para dar de baja a una profesional sin perder su historial de turnos, desactivala desde el listado (el interruptor) en vez de borrarla.`,
  },
  {
    titulo: 'Generar Historia de Instagram: todas las opciones',
    texto: `Se abre desde el botón COMPARTIR, arriba a la derecha en Agenda.

- Período: elegí Día, Semana o Mes. En Mes además elegís primera quincena (1 al 15) o segunda (16 al fin).
- Profesional: si trabajás con más de una, elegí de quién mostrar la disponibilidad — su nombre queda visible en la imagen generada (salvo que sea la dueña y coincida con el nombre del estudio, ya visible arriba: ahí no se repite).
- Fondo: botón "Fondo" para subir una foto de fondo para la imagen. Al elegirla, te pregunta si la querés guardar como fondo fijo (se reusa sola la próxima vez que generes una historia) o usarla solo por esta vez. Si guardaste una, aparece un link "Quitar fondo fijo guardado" para sacarla cuando quieras.
- Texto libre: escribí un texto y tocá + para agregarlo a la imagen. Podés ponerle emojis, arrastrarlo a la posición que quieras dentro de la imagen, y agrandarlo o achicarlo con los botones A- / A+ (o el tirador en la esquina, tocando y arrastrando).
- Editar qué se muestra: tocá un horario suelto en la lista de abajo para sacarlo de la imagen, o el ícono del ojo en un día para ocultarlo completo.
- Al final: "Guardar" descarga la imagen a tu dispositivo, "Compartir" abre el menú para mandarla directo (por ejemplo a Instagram o WhatsApp).`,
  },
  {
    titulo: 'Vincular WhatsApp',
    texto: `Configuración → Vincular WhatsApp.

Escaneá el código QR con el WhatsApp del teléfono que uses para el negocio: en ese teléfono, Configuración de WhatsApp → Dispositivos vinculados → Vincular un dispositivo, y apuntá la cámara al código.

Una vez conectado, los mensajes de confirmación se mandan solos cada vez que cargás un turno nuevo, sin que tengas que escribir nada. Podés desvincularlo en cualquier momento desde la misma pantalla.

Si se desconecta solo (por ejemplo, cerraste sesión de WhatsApp Web en el teléfono, o pasó mucho tiempo sin uso), esta pantalla te vuelve a mostrar el código QR — repetí el mismo paso para reconectarlo.`,
  },
  {
    titulo: 'Mensajes de WhatsApp',
    texto: `Perfil → Mensajes de WhatsApp.

Hay dos plantillas editables: "Recordatorio" y "Confirmación". Cada una se manda de una forma distinta:

- "Confirmación" es automática: se manda sola apenas cargás un turno nuevo, si tenés WhatsApp vinculado.
- "Recordatorio" tiene dos caminos: lo podés mandar vos a mano en cualquier momento, tocando el ícono de WhatsApp en una tarjeta de turno; y además, si activaste "Recordatorio automático" en Perfil, la app lo manda sola todos los días a la hora que elegiste, a cada clienta con turno confirmado para el día siguiente — sin que tengas que hacer nada.

Escribí el texto que quieras y usá las variables que te ofrece el editor (como {nombre}, {servicios}, {fecha}, {hora}) — se completan solas con los datos de cada turno al mandarse el mensaje.`,
  },
  {
    titulo: 'Mi Perfil',
    texto: `Pestaña Perfil.

Tus datos del estudio (nombre, teléfono, dirección), el estado de tu suscripción (activa o vencida, fecha de vencimiento y días restantes), y dos ajustes:

- Seña: un monto de referencia que guardás para tus turnos. Por ahora es solo informativo — todavía no se descuenta ni se cobra automáticamente en ningún lugar de la app.
- Recordatorio automático: activalo y elegí la hora — ver el detalle de qué manda exactamente en "Mensajes de WhatsApp".`,
  },
  {
    titulo: 'Apariencia',
    texto: `Configuración → Apariencia.

Elegí cómo se ve la app: Claro, Oscuro, o Sistema (sigue el modo que tengas configurado en tu celular o computadora). Se aplica al instante.`,
  },
];

function IconChevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2"
      style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function AyudaPage() {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Ayuda</h1>
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
          Una explicación corta de cada sección de la app. Tocá un módulo para ver el detalle.
        </p>
      </div>

      <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECCIONES.map(s => {
          const abierto = abierta === s.titulo;
          return (
            <div
              key={s.titulo}
              style={{
                backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                boxShadow: shadows.card, borderRadius: 14, overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setAbierta(abierto ? null : s.titulo)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '14px 16px', border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{s.titulo}</span>
                <IconChevron abierto={abierto} />
              </button>
              {abierto && (
                <p style={{
                  margin: 0, padding: '0 16px 16px', fontSize: 13.5, color: colors.subtext, lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}>
                  {s.texto}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
