// Altura de contenido del bottom tab nav (sin el safe-area del home
// indicator, que se suma aparte vía env(safe-area-inset-bottom) donde
// corresponda). Un solo lugar para este valor evita que un elemento fixed
// nuevo (FAB, toast, sheet) se agregue sin sumar el safe-area y quede tapado
// por el nav en iPhones con home indicator — ver app/(app)/layout.tsx.
export const NAV_HEIGHT = 78;
