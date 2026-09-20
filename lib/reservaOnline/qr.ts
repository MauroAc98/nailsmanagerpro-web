import QRCode from 'qrcode';

// QR del link publico de reserva, para mostrar/descargar desde LinkCompartir.
// - width 280: legible en pantalla y en una descarga para imprimir, sin pesar
//   de mas como data URL embebida.
// - errorCorrectionLevel 'M' (15% de tolerancia): balance estandar entre
//   robustez de lectura y densidad del patron para un link relativamente
//   corto como el nuestro.
// - margin 4 (quiet zone): el QR necesita un borde claro alrededor para que
//   los lectores lo detecten de forma confiable; sin margen, pegado a otro
//   contenido, falla el escaneo en varios lectores de camara.
export async function generarQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 280,
    margin: 4,
    errorCorrectionLevel: 'M',
  });
}
