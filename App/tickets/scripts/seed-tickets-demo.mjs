/**
 * Genera datos reales en usuarios/vehiculos/zonas y crea tickets
 * para ejercitar el cache Redis (MISS → SET → HIT).
 *
 * Uso (con todos los microservicios arriba):
 *   npm run seed:tickets -- --count=50
 *
 * Variables opcionales:
 *   MS_PERSONAS, MS_VEHICULOS, MS_ZONAS_BASE, TICKETS_URL, INTERNAL_API_KEY, JWT_SECRET
 *
 * Nota: si exportas MS_ZONAS del .env de tickets (.../api/espacios), el script
 * lo normaliza solo a .../api para poder llamar /zonas y /espacios.
 */

import crypto from 'crypto';

const COUNT = Number(
  (process.argv.find((a) => a.startsWith('--count=')) || '--count=50').split(
    '=',
  )[1],
);

const MS_PERSONAS =
  process.env.MS_PERSONAS || 'http://localhost:9090/api/users';
const MS_VEHICULOS =
  process.env.MS_VEHICULOS || 'http://localhost:3001/vehiculo';
const TICKETS_URL = process.env.TICKETS_URL || 'http://localhost:3000';
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal-service-key-parcial2';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'parcial2-arqui-jwt-secret-key-2026-min-256-bits!!';

/** Base del MS zonas: http://localhost:8081/api (sin /espacios ni /zonas) */
function resolveZonasBase() {
  const raw =
    process.env.MS_ZONAS_BASE ||
    process.env.MS_ZONAS ||
    'http://localhost:8081/api';
  return raw
    .replace(/\/+$/, '')
    .replace(/\/espacios$/i, '')
    .replace(/\/zonas$/i, '');
}

const MS_ZONAS_BASE = resolveZonasBase();

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret, expiresInSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

function placa(i) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${letters[i % 26]}${letters[Math.floor(i / 26) % 26]}${letters[Math.floor(i / 676) % 26]}-${String(1000 + (i % 9000)).slice(0, 4)}`;
}

function dni(i) {
  return String(1710000000 + i).slice(0, 10);
}

/** Nombres solo letras (usuarios valida ^[\\p{L}]+$) */
function nombreSoloLetras(i) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[i % 26];
  const b = letters[Math.floor(i / 26) % 26];
  const c = letters[Math.floor(i / 676) % 26];
  return {
    firstName: `Nombre${a}${b}${c}`,
    middleName: 'Demo',
    lastName: `Apellido${a}${b}${c}`,
  };
}

let authToken = '';

function commonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': INTERNAL_API_KEY,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...extra,
  };
}

async function req(method, url, body, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: commonHeaders(extraHeaders),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `${method} ${url} → conexión fallida (${err.message}). ¿Servicio arriba?`,
    );
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 250)}`);
  }
  return data;
}

async function pingZonas() {
  console.log(`MS_ZONAS_BASE = ${MS_ZONAS_BASE}`);
  try {
    const zonas = await req('GET', `${MS_ZONAS_BASE}/zonas`);
    const n = Array.isArray(zonas) ? zonas.length : 0;
    console.log(`  ping GET /zonas OK (${n} zonas)\n`);
    return true;
  } catch (err) {
    console.error(`  ping GET /zonas FAIL: ${err.message}`);
    console.error(`
No se puede hablar con zonas-espacios.
  1) ¿Corre el servicio?  docker ps | findstr zona
  2) URL correcta:       http://localhost:8081/api
  3) NO uses MS_ZONAS=.../api/espacios aquí (eso es solo para tickets)
     Usa: set MS_ZONAS_BASE=http://localhost:8081/api
`);
    return false;
  }
}

async function ensureZonaYEspacios(n) {
  console.log('Creando/obteniendo zona demo...');

  // Tipos válidos en zonas-espacios: VIP | VISITATES | GENERAL | PREFERENCIAL
  const zonaBody = {
    nombre: `Zona Redis ${Date.now().toString().slice(-8)}`,
    descripcion: 'Zona para demo de cache Redis',
    capacidad: Math.max(n, 50),
    tipo: 'GENERAL',
    activo: true,
  };

  let zona = null;

  try {
    zona = await req('POST', `${MS_ZONAS_BASE}/zonas`, zonaBody);
    console.log(`  zona creada: ${zona.nombre} (${zona.id})`);
  } catch (postErr) {
    console.log(`  POST /zonas falló: ${postErr.message.slice(0, 180)}`);
    console.log('  → listando zonas existentes...');
    try {
      const zonas = await req('GET', `${MS_ZONAS_BASE}/zonas`);
      if (Array.isArray(zonas) && zonas.length > 0) {
        zona = zonas.find((z) => z.activo !== false) || zonas[0];
        console.log(`  usando zona existente: ${zona.nombre} (${zona.id})`);
      } else {
        throw new Error('GET /zonas devolvió lista vacía');
      }
    } catch (getErr) {
      throw new Error(
        `No se pudo crear ni listar zonas.\n  POST: ${postErr.message}\n  GET: ${getErr.message}`,
      );
    }
  }

  if (!zona?.id) {
    throw new Error(
      `Respuesta de zona sin id. Body: ${JSON.stringify(zona)?.slice(0, 200)}`,
    );
  }

  console.log(`Zona: ${zona.nombre} (${zona.id})`);
  const espacios = [];

  for (let i = 0; i < n; i++) {
    try {
      const esp = await req('POST', `${MS_ZONAS_BASE}/espacios`, {
        descripcion: `Espacio redis demo ${i}`,
        tipo: 'AUTO',
        idzona: zona.id,
      });
      espacios.push(esp);
      if ((i + 1) % 10 === 0) console.log(`  espacios: ${i + 1}/${n}`);
    } catch (err) {
      console.log(`  espacio ${i} skip: ${err.message.slice(0, 100)}`);
    }
  }

  if (espacios.length === 0) {
    console.log('  no se crearon espacios nuevos → listando existentes...');
    const list = await req('GET', `${MS_ZONAS_BASE}/espacios`);
    const disponibles = Array.isArray(list)
      ? list.filter(
          (e) =>
            (e.estado === 'DISPONIBLE' || e.estado === 'Disponible') &&
            (e.idzona === zona.id ||
              e.nombrezona === zona.nombre ||
              !e.idzona),
        )
      : [];
    if (disponibles.length === 0 && Array.isArray(list)) {
      return {
        zonaNombre: zona.nombre,
        espacios: list.filter(
          (e) => e.estado === 'DISPONIBLE' || e.estado === 'Disponible',
        ),
      };
    }
    return { zonaNombre: zona.nombre, espacios: disponibles };
  }

  return { zonaNombre: zona.nombre, espacios };
}

async function main() {
  console.log(`\nSeed tickets/Redis demo — count=${COUNT}\n`);

  authToken = signJwt(
    {
      sub: 'seed',
      username: 'seed-admin',
      roles: ['ADMIN', 'OPERADOR', 'SERVICE'],
    },
    JWT_SECRET,
  );

  const ok = await pingZonas();
  if (!ok) process.exit(1);

  // 1) Personas
  console.log('Creando personas...');
  let personasOk = 0;
  for (let i = 0; i < COUNT; i++) {
    const names = nombreSoloLetras(i);
    try {
      await req('POST', MS_PERSONAS, {
        dni: dni(i),
        firstName: names.firstName,
        middleName: names.middleName,
        lastName: names.lastName,
        email: `redisdemo${i}@mail.com`,
        phone: `09${String(30000000 + i).slice(0, 8)}`,
        address: 'Quito',
        nationality: 'Ecuatoriana',
        password: 'demo1234',
      });
      personasOk++;
    } catch (err) {
      const msg = String(err.message);
      if (
        msg.includes('409') ||
        msg.includes('ya existe') ||
        msg.includes('El DNI') ||
        msg.includes('El email') ||
        msg.includes('400')
      ) {
        personasOk++;
      } else {
        console.log(`  persona ${i} FAIL: ${msg.slice(0, 160)}`);
      }
    }
    if ((i + 1) % 10 === 0)
      console.log(`  personas: ${i + 1}/${COUNT} (ok~${personasOk})`);
  }
  console.log(`  personas listas: ~${personasOk}/${COUNT}`);

  // 2) Vehiculos
  console.log('Creando vehiculos...');
  let vehiculosOk = 0;
  for (let i = 0; i < COUNT; i++) {
    try {
      await req('POST', MS_VEHICULOS, {
        tipo: 'auto',
        datos: {
          placa: placa(i),
          marca: 'Toyota',
          modelo: 'Corolla',
          color: 'Negro',
          anio: 2020,
          clasificacion: 'Gasolina',
          numeroPuertas: 4,
          capacidadMaletero: 400,
        },
      });
      vehiculosOk++;
    } catch (err) {
      const msg = String(err.message);
      if (
        msg.includes('409') ||
        msg.includes('Ya existe') ||
        msg.includes('Conflict')
      ) {
        vehiculosOk++;
      } else {
        console.log(`  vehiculo ${i} FAIL: ${msg.slice(0, 160)}`);
      }
    }
    if ((i + 1) % 10 === 0)
      console.log(`  vehiculos: ${i + 1}/${COUNT} (ok~${vehiculosOk})`);
  }
  console.log(`  vehiculos listos: ~${vehiculosOk}/${COUNT}`);

  // 3) Espacios
  const { zonaNombre, espacios } = await ensureZonaYEspacios(COUNT);
  console.log(`Espacios disponibles: ${espacios.length}`);

  if (espacios.length === 0) {
    throw new Error(
      'No hay espacios DISPONIBLE. Revisa POST /api/espacios (auth ADMIN/OPERADOR/SERVICE + X-Internal-Key).',
    );
  }

  // 4) Tickets
  console.log(
    '\nCreando tickets (1ra pasada = MISS, reintentos = HIT en cache)...',
  );
  const limit = Math.min(COUNT, espacios.length);

  for (let i = 0; i < limit; i++) {
    const body = {
      placa: placa(i),
      dni: dni(i),
      idEspacio: espacios[i].id,
      zona: espacios[i].nombrezona || zonaNombre,
    };

    const t1 = Date.now();
    try {
      const r1 = await req('POST', `${TICKETS_URL}/tickets`, body);
      console.log(
        `  #${i} create1 ${Date.now() - t1}ms → ${String(r1).slice(0, 80)}`,
      );
    } catch (err) {
      console.log(
        `  #${i} create1 ${Date.now() - t1}ms FAIL → ${err.message.slice(0, 120)}`,
      );
    }
  }

  console.log(
    '\nCerrando tickets y recreando (debería haber HIT de persona/vehiculo)...',
  );
  let activos = [];
  try {
    activos = await req('GET', `${TICKETS_URL}/tickets/activos`);
  } catch (err) {
    console.log(`  no se pudieron listar activos: ${err.message.slice(0, 120)}`);
  }

  for (const t of (activos || []).slice(0, Math.min(10, limit))) {
    try {
      await req('PATCH', `${TICKETS_URL}/tickets/${t.id}`, { activo: false });
    } catch {
      // ignore
    }
  }

  for (let i = 0; i < Math.min(10, limit); i++) {
    const body = {
      placa: placa(i),
      dni: dni(i),
      idEspacio: espacios[i].id,
      zona: espacios[i].nombrezona || zonaNombre,
    };
    const t1 = Date.now();
    try {
      const r1 = await req('POST', `${TICKETS_URL}/tickets`, body);
      console.log(
        `  retry #${i} ${Date.now() - t1}ms → ${String(r1).slice(0, 80)}`,
      );
    } catch (err) {
      console.log(
        `  retry #${i} ${Date.now() - t1}ms FAIL → ${err.message.slice(0, 120)}`,
      );
    }
  }

  console.log(`
Listo. Revisa:
  - Logs Nest: Cache HIT / Cache MISS / Cache SET
  - docker exec -it redis-ticket redis-cli KEYS "*"
  - docker exec -it redis-ticket redis-cli DBSIZE
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
