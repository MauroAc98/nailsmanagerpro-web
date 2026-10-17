// Traspaso en memoria del correo entre "olvidé mi contraseña" y "restablecer".
// Así el correo no viaja en la URL (la navegación del router manda la URL
// completa a los logs del servidor). Vive solo en esta pestaña: no se guarda en
// storage y se borra al recargar. La lectura no consume el valor (el doble
// render de desarrollo la repite); quien lo usa lo limpia al montar.
let correo = '';

export function guardarCorreoPendiente(valor: string): void {
  correo = valor;
}

export function leerCorreoPendiente(): string {
  return correo;
}

export function limpiarCorreoPendiente(): void {
  correo = '';
}
