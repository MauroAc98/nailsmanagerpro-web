// Flag para el nudge proactivo de "historia de precios" — seteado por las
// pantallas de alta/edición de servicio justo después de guardar, leído una
// sola vez por la lista de servicios al montar (y limpiado ahí mismo), así
// el banner aparece solo inmediatamente después de un cambio de precio real,
// no en cualquier visita normal a la lista.
export const PRICE_STORY_NUDGE_KEY = 'nmp:price-story-nudge';
