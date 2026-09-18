// Precio de la tarjeta de "Historia de precios". Siempre es-AR, sin depender
// del idioma activo de la app: la tarjeta es una imagen que se comparte con
// las clientas. Sin decimales (una lista de precios con ",00" en cada fila
// recarga la imagen), y con el mismo estilo de signo que el resto de la app:
// "$1.500", pegado, sin espacio.
const formato = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatoPrecioTarjeta(precio: string | null): string {
  return precio ? `$${formato.format(Number(precio))}` : '-';
}
