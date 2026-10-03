// "Ana y Laura" / "Ana, Laura y Sol" en el idioma de la pantalla.
export const listaDeNombres = (nombres: string[], locale: string): string =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(nombres);
