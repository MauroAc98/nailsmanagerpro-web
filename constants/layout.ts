// Altura de contenido del bottom tab nav (sin el safe-area del home
// indicator, que se suma aparte vía env(safe-area-inset-bottom) donde
// corresponda). Un solo lugar para este valor evita que un elemento fixed
// nuevo (FAB, toast, sheet) se agregue sin sumar el safe-area y quede tapado
// por el nav en iPhones con home indicator — ver app/(app)/layout.tsx.
export const NAV_HEIGHT = 78;

// Margen lateral/inferior entre la barra y el borde de pantalla — 0 a
// propósito. Hubo una versión "flotante" (pill con margen, esquinas
// redondeadas los 4 lados) que generó una cadena de bugs de alineación:
// BottomSheet/FAB con offset desalineado tapando el bubble, franjas de
// fondo de página expuestas, un segundo contenedor full-width asomando por
// afuera del nav más angosto. Volver a bottom:0 + esquinas redondeadas SOLO
// arriba (ver borderRadius en app/(app)/layout.tsx) hace que el nav y
// cualquier BottomSheet/FAB debajo compartan la MISMA geometría — ninguno
// de esos bugs puede volver a pasar porque no hay dos anchos/offsets
// distintos que desalinear.
export const NAV_MARGIN = 0;

// Diámetro del círculo ("bubble") del tab activo y cuánto de ese círculo
// sobresale por ARRIBA del borde superior de la barra — app/(app)/layout.tsx
// lo usa para su propio -top.
export const NAV_BUBBLE_SIZE = 60;
export const NAV_BUBBLE_POKE = Math.round(NAV_BUBBLE_SIZE * 0.3);

// Distancia, desde el borde inferior de la pantalla, hasta el borde superior
// de la barra — el offset que cualquier fixed/sheet/toast que no deba
// superponerse con la barra tiene que usar. A propósito NO suma
// NAV_BUBBLE_POKE: sumarlo (probado) deja una franja de NAV_BUBBLE_POKE px
// de fondo de página expuesta entre el sheet/FAB y la barra en TODO el
// ancho salvo justo debajo del bubble — ahí se colaba el calendario al
// scrollear. En cambio, los sheets/FABs llegan hasta acá (flush con la
// barra) y es <nav> quien se pinta por ENCIMA de ellos (ver zIndex en
// app/(app)/layout.tsx) para que el bubble, al asomar, tape lo que haya
// debajo en vez de dejar un hueco.
export const NAV_CLEARANCE = NAV_HEIGHT + NAV_MARGIN;

// Por encima de BottomSheet (40, components/BottomSheet.tsx) y del FAB de
// las pantallas con lista (45) — así el bubble del tab activo, que entra en
// esa misma franja vertical, se pinta arriba de cualquiera de los dos en
// vez de quedar tapado. Por debajo de ToastHost (90) y los host de sheets
// globales (ConfirmSheetHost etc., 100): esos sí deben ganarle a la nav.
export const NAV_Z_INDEX = 50;
