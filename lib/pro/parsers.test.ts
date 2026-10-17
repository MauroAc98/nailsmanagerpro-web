import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseListaTurnos, parseMarcas, parseProMe, parseProTurno, parseServicios } from './parsers';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TURNO_API = {
  id: 41,
  fecha_hora: '2026-10-17T09:30:00',
  duracion_total_minutos: 90,
  estado_visual: 'confirmado',
  notas: 'Trae diseño propio',
  cliente: { nombre: 'Ana', apellido: 'Pérez' },
  servicios: [
    { id: 7, nombre: 'Semipermanente' },
    { id: 9, nombre: 'Diseño' },
  ],
  promo: { nombre: 'Promo primavera' },
};

describe('parseProTurno — lista blanca (AG-1 S1)', () => {
  it('copia solo las claves permitidas, con su valor', () => {
    expect(parseProTurno(TURNO_API)).toEqual(TURNO_API);
  });

  it('descarta claves ajenas en la raíz: teléfono, precio, seña, pagos, otras profesionales', () => {
    const sucio = {
      ...TURNO_API,
      telefono: '+54 9 11 5555-0000',
      precio_total: 25000,
      sena: 5000,
      pagos: [{ monto: 5000 }],
      profesional_id: 3,
      profesional: { nombre: 'Otra' },
      whatsapp: 'wa-secreto',
      cliente_id: 88,
      user_id: 1,
    };
    const turno = parseProTurno(sucio);
    expect(turno).not.toBeNull();
    expect(Object.keys(turno!).sort()).toEqual([
      'cliente',
      'duracion_total_minutos',
      'estado_visual',
      'fecha_hora',
      'id',
      'notas',
      'promo',
      'servicios',
    ]);
    expect(JSON.stringify(turno)).not.toMatch(/5555|25000|5000|wa-secreto|Otra|profesional/);
  });

  it('descarta claves ajenas anidadas: cliente, servicios y promo', () => {
    const turno = parseProTurno({
      ...TURNO_API,
      cliente: { nombre: 'Ana', apellido: 'Pérez', telefono: '1155550000', email: 'a@b.c', id: 5 },
      servicios: [{ id: 7, nombre: 'Gel', precio: 9000, duracion_minutos: 60, pivot: { profesional_id: 3 } }],
      promo: { nombre: 'Promo', precio: 1000, id: 2, componentes: [1, 2] },
    });
    expect(turno!.cliente).toEqual({ nombre: 'Ana', apellido: 'Pérez' });
    expect(turno!.servicios).toEqual([{ id: 7, nombre: 'Gel' }]);
    expect(turno!.promo).toEqual({ nombre: 'Promo' });
    expect(Object.keys(turno!.cliente)).toEqual(['nombre', 'apellido']);
  });

  it('una clave __proto__ del payload no contamina nada ni sobrevive', () => {
    const payload = JSON.parse(
      '{"id":1,"fecha_hora":"2026-10-17T09:30:00","duracion_total_minutos":30,"estado_visual":"confirmado","notas":null,' +
        '"cliente":{"nombre":"A","apellido":"B","__proto__":{"telefono":"1"}},"servicios":[],"promo":null,"__proto__":{"precio":1}}',
    );
    const turno = parseProTurno(payload);
    expect(turno).not.toBeNull();
    expect((turno as unknown as Record<string, unknown>).precio).toBeUndefined();
    expect(Object.keys(turno!.cliente)).toEqual(['nombre', 'apellido']);
    expect(({} as Record<string, unknown>).precio).toBeUndefined();
  });

  it('mantiene fecha_hora tal cual llegó (hora de pared, sin zona)', () => {
    expect(parseProTurno(TURNO_API)!.fecha_hora).toBe('2026-10-17T09:30:00');
  });

  it('no usa Date para leer fecha_hora (independiente del huso)', () => {
    vi.stubGlobal(
      'Date',
      class {
        constructor() {
          throw new Error('no se debe usar Date');
        }
        static parse(): number {
          throw new Error('no se debe usar Date.parse');
        }
      },
    );
    expect(parseProTurno(TURNO_API)!.fecha_hora).toBe('2026-10-17T09:30:00');
  });
});

describe('parseProTurno — filas inválidas y valores raros', () => {
  it.each([
    ['null', null],
    ['string', 'turno'],
    ['array', []],
    ['sin id', { ...TURNO_API, id: undefined }],
    ['id 0', { ...TURNO_API, id: 0 }],
    ['id negativo', { ...TURNO_API, id: -3 }],
    ['id decimal', { ...TURNO_API, id: 1.5 }],
    ['id string', { ...TURNO_API, id: '41' }],
    ['sin fecha_hora', { ...TURNO_API, fecha_hora: undefined }],
    ['fecha_hora con zona', { ...TURNO_API, fecha_hora: '2026-10-17T09:30:00Z' }],
    ['fecha_hora imposible', { ...TURNO_API, fecha_hora: '2026-02-31T09:30:00' }],
    ['fecha_hora numérica', { ...TURNO_API, fecha_hora: 1760700600000 }],
  ])('descarta la fila: %s', (_nombre, raw) => {
    expect(parseProTurno(raw)).toBeNull();
  });

  it('un estado_visual desconocido cae a confirmado y los conocidos se respetan', () => {
    expect(parseProTurno({ ...TURNO_API, estado_visual: 'cancelado' })!.estado_visual).toBe('confirmado');
    expect(parseProTurno({ ...TURNO_API, estado_visual: undefined })!.estado_visual).toBe('confirmado');
    expect(parseProTurno({ ...TURNO_API, estado_visual: 'en_curso' })!.estado_visual).toBe('en_curso');
    expect(parseProTurno({ ...TURNO_API, estado_visual: 'completado' })!.estado_visual).toBe('completado');
  });

  it('la duración inválida queda en 0 en vez de descartar el turno', () => {
    expect(parseProTurno({ ...TURNO_API, duracion_total_minutos: 'x' })!.duracion_total_minutos).toBe(0);
    expect(parseProTurno({ ...TURNO_API, duracion_total_minutos: -10 })!.duracion_total_minutos).toBe(0);
    expect(parseProTurno({ ...TURNO_API, duracion_total_minutos: 45 })!.duracion_total_minutos).toBe(45);
  });

  it('las notas vacías o no texto quedan en null; el texto se conserva literal', () => {
    expect(parseProTurno({ ...TURNO_API, notas: '   ' })!.notas).toBeNull();
    expect(parseProTurno({ ...TURNO_API, notas: 42 })!.notas).toBeNull();
    expect(parseProTurno({ ...TURNO_API, notas: '<img src=x onerror=alert(1)>\nlínea 2' })!.notas).toBe(
      '<img src=x onerror=alert(1)>\nlínea 2',
    );
  });

  it('tolera cliente ausente o con partes faltantes', () => {
    expect(parseProTurno({ ...TURNO_API, cliente: null })!.cliente).toEqual({ nombre: null, apellido: null });
    expect(parseProTurno({ ...TURNO_API, cliente: undefined })!.cliente).toEqual({ nombre: null, apellido: null });
    expect(parseProTurno({ ...TURNO_API, cliente: { nombre: 'Ana' } })!.cliente).toEqual({ nombre: 'Ana', apellido: null });
    expect(parseProTurno({ ...TURNO_API, cliente: { nombre: 7, apellido: '  ' } })!.cliente).toEqual({
      nombre: null,
      apellido: null,
    });
  });

  it('descarta servicios malformados y conserva los válidos', () => {
    const turno = parseProTurno({
      ...TURNO_API,
      servicios: [{ id: 1, nombre: 'Gel' }, null, { id: 'x', nombre: 'Mal' }, { id: 2 }, 'texto', { id: 3, nombre: 'Spa' }],
    });
    expect(turno!.servicios).toEqual([
      { id: 1, nombre: 'Gel' },
      { id: 3, nombre: 'Spa' },
    ]);
    expect(parseProTurno({ ...TURNO_API, servicios: 'nope' })!.servicios).toEqual([]);
  });

  it('promo solo si trae nombre de texto', () => {
    expect(parseProTurno({ ...TURNO_API, promo: null })!.promo).toBeNull();
    expect(parseProTurno({ ...TURNO_API, promo: {} })!.promo).toBeNull();
    expect(parseProTurno({ ...TURNO_API, promo: { nombre: 3 } })!.promo).toBeNull();
    expect(parseProTurno({ ...TURNO_API, promo: { nombre: 'Promo' } })!.promo).toEqual({ nombre: 'Promo' });
  });
});

describe('parseListaTurnos', () => {
  const fila = (id: number, fecha_hora: string) => ({ ...TURNO_API, id, fecha_hora });

  it('ordena por fecha_hora comparando strings, sin mover los empates', () => {
    const lista = parseListaTurnos({
      data: [fila(1, '2026-10-17T15:00:00'), fila(2, '2026-10-17T09:30:00'), fila(3, '2026-10-17T15:00:00'), fila(4, '2026-10-16T23:00:00')],
      truncated: false,
    });
    expect(lista!.turnos.map((t) => t.id)).toEqual([4, 2, 1, 3]);
    expect(lista!.descartados).toBe(0);
  });

  it('lee truncated solo si es exactamente true', () => {
    expect(parseListaTurnos({ data: [fila(1, '2026-10-17T09:30:00')], truncated: true })!.truncated).toBe(true);
    expect(parseListaTurnos({ data: [], truncated: false })!.truncated).toBe(false);
    expect(parseListaTurnos({ data: [], truncated: 'true' })!.truncated).toBe(false);
    expect(parseListaTurnos({ data: [] })!.truncated).toBe(false);
  });

  it('descarta las filas inválidas, conserva el resto y cuenta lo descartado', () => {
    const lista = parseListaTurnos({
      data: [fila(1, '2026-10-17T09:30:00'), null, { id: 'x' }, fila(2, 'no-es-fecha'), fila(3, '2026-10-17T10:00:00')],
      truncated: false,
    });
    expect(lista!.turnos.map((t) => t.id)).toEqual([1, 3]);
    expect(lista!.descartados).toBe(3);
  });

  it('si todas las filas son inválidas es una lista vacía con todo descartado, no un error', () => {
    expect(parseListaTurnos({ data: [null, { id: 'x' }], truncated: false })).toEqual({
      turnos: [],
      truncated: false,
      descartados: 2,
    });
  });

  it('una lista realmente vacía no descarta nada', () => {
    expect(parseListaTurnos({ data: [], truncated: false })).toEqual({ turnos: [], truncated: false, descartados: 0 });
  });

  it.each([
    ['null', null],
    ['un array suelto', [fila(1, '2026-10-17T09:30:00')]],
    ['data que no es lista', { data: 'x', truncated: true }],
    ['sin data (cuerpo de error)', { message: 'Server Error' }],
    ['HTML de un portal cautivo', '<html><body>Login</body></html>'],
  ])('un cuerpo con forma inválida (%s) es null: no se confunde con "sin turnos"', (_nombre, cuerpo) => {
    expect(parseListaTurnos(cuerpo)).toBeNull();
  });

  it('también limpia las claves ajenas de cada fila', () => {
    const lista = parseListaTurnos({ data: [{ ...fila(1, '2026-10-17T09:30:00'), telefono: '1155' }], truncated: false });
    expect(lista!.turnos).toHaveLength(1);
    expect('telefono' in lista!.turnos[0]).toBe(false);
  });
});

describe('parseProMe', () => {
  const VINCULO = {
    id: 12,
    negocio: { nombre: 'Estudio Luna', user_id: 1, telefono: '1111' },
    profesional: { nombre: 'Sol', apellido: 'Díaz', avatar_url: 'https://api.turnetto.com/storage/a.jpg', id: 9 },
    disponible: true,
    motivo: null,
  };

  it('devuelve el email y los vínculos aplanados, sin claves ajenas', () => {
    expect(parseProMe({ cuenta: { email: 'sol@mail.com', id: 4 }, vinculos: [VINCULO] })).toEqual({
      email: 'sol@mail.com',
      vinculos: [
        {
          id: 12,
          negocioNombre: 'Estudio Luna',
          profesional: { nombre: 'Sol', apellido: 'Díaz', avatar_url: 'https://api.turnetto.com/storage/a.jpg' },
          disponible: true,
          motivo: null,
        },
      ],
      descartados: 0,
    });
  });

  it('un vínculo no disponible conserva su motivo conocido; uno desconocido queda en null', () => {
    const me = parseProMe({
      cuenta: { email: 'a@b.c' },
      vinculos: [
        { ...VINCULO, id: 1, disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' },
        { ...VINCULO, id: 2, disponible: false, motivo: 'NO_SUBSCRIPTION' },
        { ...VINCULO, id: 3, disponible: false, motivo: 'SUBSCRIPTION_EXPIRED' },
        { ...VINCULO, id: 4, disponible: false, motivo: 'OTRA_COSA' },
      ],
    });
    expect(me!.vinculos.map((v) => [v.disponible, v.motivo])).toEqual([
      [false, 'SUBSCRIPTION_SUSPENDED'],
      [false, 'NO_SUBSCRIPTION'],
      [false, 'SUBSCRIPTION_EXPIRED'],
      [false, null],
    ]);
  });

  it('disponible solo es true si llega exactamente true (falla cerrado)', () => {
    const me = parseProMe({
      cuenta: { email: 'a@b.c' },
      vinculos: [
        { ...VINCULO, id: 1, disponible: 'true' },
        { ...VINCULO, id: 2, disponible: 1 },
        { ...VINCULO, id: 3, disponible: undefined },
        { ...VINCULO, id: 4, disponible: true },
      ],
    });
    expect(me!.vinculos.map((v) => v.disponible)).toEqual([false, false, false, true]);
  });

  it('descarta vínculos sin id válido (y los cuenta) y tolera nombres y avatar ausentes', () => {
    const me = parseProMe({
      cuenta: { email: 'a@b.c' },
      vinculos: [null, { ...VINCULO, id: 'x' }, { id: 5, disponible: true }],
    });
    expect(me).toEqual({
      email: 'a@b.c',
      vinculos: [
        {
          id: 5,
          negocioNombre: '',
          profesional: { nombre: '', apellido: null, avatar_url: null },
          disponible: true,
          motivo: null,
        },
      ],
      descartados: 2,
    });
  });

  it('si todos los vínculos son inválidos es una lista vacía con todo descartado', () => {
    expect(parseProMe({ cuenta: { email: 'a@b.c' }, vinculos: [null, 'x'] })).toEqual({
      email: 'a@b.c',
      vinculos: [],
      descartados: 2,
    });
  });

  it('la cuenta ausente o sin email deja email en null pero no invalida los vínculos', () => {
    expect(parseProMe({ vinculos: [] })).toEqual({ email: null, vinculos: [], descartados: 0 });
    expect(parseProMe({ cuenta: { email: 5 }, vinculos: [] })).toEqual({ email: null, vinculos: [], descartados: 0 });
  });

  it.each([
    ['null', null],
    ['vinculos que no es lista', { cuenta: { email: 'a@b.c' }, vinculos: 'x' }],
    ['cuerpo de error', { message: 'Server Error' }],
    ['HTML de un portal cautivo', '<html></html>'],
  ])('un cuerpo con forma inválida (%s) es null', (_nombre, cuerpo) => {
    expect(parseProMe(cuerpo)).toBeNull();
  });

  describe('avatar_url', () => {
    const conAvatar = (avatar_url: unknown) =>
      parseProMe({ cuenta: { email: 'a@b.c' }, vinculos: [{ ...VINCULO, profesional: { nombre: 'Sol', avatar_url } }] })!
        .vinculos[0].profesional.avatar_url;

    // El backend arma la URL con Storage::disk('public')->url() = APP_URL + /storage:
    // absoluta, pero http en local/staging. Se aceptan http(s) absolutas.
    it('acepta URLs absolutas http y https', () => {
      expect(conAvatar('https://api.turnetto.com/storage/a.jpg')).toBe('https://api.turnetto.com/storage/a.jpg');
      expect(conAvatar('http://localhost/storage/a.jpg')).toBe('http://localhost/storage/a.jpg');
    });

    it.each([
      ['javascript:', 'javascript:alert(1)'],
      ['data:', 'data:image/svg+xml;base64,PHN2Zz4='],
      ['relativa', '/storage/a.jpg'],
      ['protocolo relativo', '//evil.example/a.jpg'],
      ['vacía', ''],
      ['no texto', 42],
    ])('rechaza %s (queda null y se usan las iniciales)', (_nombre, valor) => {
      expect(conAvatar(valor)).toBeNull();
    });
  });
});

describe('parseMarcas', () => {
  it('devuelve los días con cantidad, sin claves ajenas', () => {
    expect(
      parseMarcas({
        mes: '2026-10',
        dias: [
          { fecha: '2026-10-03', cantidad: 2, extra: 'x' },
          { fecha: '2026-10-17', cantidad: 1 },
        ],
      }),
    ).toEqual({
      dias: [
        { fecha: '2026-10-03', cantidad: 2 },
        { fecha: '2026-10-17', cantidad: 1 },
      ],
      descartados: 0,
    });
  });

  it('descarta fechas imposibles, cantidades inválidas y filas que no son objeto, y cuenta lo descartado', () => {
    expect(
      parseMarcas({
        dias: [
          { fecha: '2026-02-30', cantidad: 1 },
          { fecha: '2026-10-04', cantidad: -1 },
          { fecha: '2026-10-05', cantidad: 1.5 },
          { fecha: '2026-10-06', cantidad: '3' },
          null,
          { fecha: '2026-10-07', cantidad: 0 },
        ],
      }),
    ).toEqual({ dias: [{ fecha: '2026-10-07', cantidad: 0 }], descartados: 5 });
  });

  it('un mes sin turnos (dias vacío) es éxito y no descarta nada', () => {
    expect(parseMarcas({ mes: '2026-10', dias: [] })).toEqual({ dias: [], descartados: 0 });
  });

  it.each([
    ['null', null],
    ['dias que no es lista', { mes: '2026-10', dias: 'x' }],
    ['cuerpo de error', { message: 'Server Error' }],
    ['HTML', '<html></html>'],
  ])('un cuerpo con forma inválida (%s) es null', (_nombre, cuerpo) => {
    expect(parseMarcas(cuerpo)).toBeNull();
  });
});

describe('parseServicios (lista plana)', () => {
  it('conserva id, nombre, duración y categoría, y descarta precio y otras claves', () => {
    expect(
      parseServicios([
        {
          id: 1,
          nombre: 'Gel',
          precio: 100,
          comision: 10,
          duracion_minutos: 60,
          categoria: { id: 5, nombre: 'Manos', fondo_historia_url: 'x', user_id: 9 },
        },
        { id: 2, nombre: 'Spa', duracion_minutos: 30, categoria: null },
      ]),
    ).toEqual({
      servicios: [
        { id: 1, nombre: 'Gel', duracion_minutos: 60, categoria: { id: 5, nombre: 'Manos' } },
        { id: 2, nombre: 'Spa', duracion_minutos: 30, categoria: null },
      ],
      descartados: 0,
    });
  });

  it('tolera una respuesta vieja sin duración ni categoría: lista plana con null', () => {
    expect(parseServicios([{ id: 1, nombre: 'Gel' }])).toEqual({
      servicios: [{ id: 1, nombre: 'Gel', duracion_minutos: null, categoria: null }],
      descartados: 0,
    });
  });

  it.each([
    ['duración cero', { duracion_minutos: 0 }],
    ['duración negativa', { duracion_minutos: -5 }],
    ['duración decimal', { duracion_minutos: 1.5 }],
    ['duración texto', { duracion_minutos: '60' }],
  ])('una duración inválida (%s) queda en null', (_nombre, extra) => {
    expect(parseServicios([{ id: 1, nombre: 'Gel', ...extra }])?.servicios[0].duracion_minutos).toBeNull();
  });

  it.each([
    ['sin nombre', { id: 5 }],
    ['id inválido', { id: 0, nombre: 'Manos' }],
    ['nombre vacío', { id: 5, nombre: ' ' }],
    ['un texto', 'Manos'],
    ['una lista', [5, 'Manos']],
  ])('una categoría malformada (%s) queda en null sin descartar el servicio', (_nombre, categoria) => {
    expect(parseServicios([{ id: 1, nombre: 'Gel', categoria }])?.servicios).toEqual([
      { id: 1, nombre: 'Gel', duracion_minutos: null, categoria: null },
    ]);
  });

  it('descarta elementos malformados y los cuenta', () => {
    expect(parseServicios([{ id: 1, nombre: 'Gel' }, { id: 0, nombre: 'Cero' }, { id: 2 }, null, { id: 3, nombre: '' }])).toEqual({
      servicios: [{ id: 1, nombre: 'Gel', duracion_minutos: null, categoria: null }],
      descartados: 4,
    });
  });

  it('una lista vacía es éxito', () => {
    expect(parseServicios([])).toEqual({ servicios: [], descartados: 0 });
  });

  it.each([
    ['cuerpo envuelto en data', { data: [{ id: 1, nombre: 'Gel' }] }],
    ['null', null],
    ['cuerpo de error', { message: 'Server Error' }],
    ['HTML', '<html></html>'],
  ])('lo que no es una lista (%s) es null', (_nombre, cuerpo) => {
    expect(parseServicios(cuerpo)).toBeNull();
  });
});
