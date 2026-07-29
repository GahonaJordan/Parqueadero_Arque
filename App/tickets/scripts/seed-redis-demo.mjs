/**
 * Pobla Redis con muchos datos para ver el cache del servicio tickets.
 *
 * Uso:
 *   npm run seed:redis
 *   npm run seed:redis -- --count=1000
 *   npm run seed:redis -- --demo-api
 *
 * Ver en Redis:
 *   docker exec -it redis-ticket redis-cli DBSIZE
 *   docker exec -it redis-ticket redis-cli KEYS "persona:*"
 *   docker exec -it redis-ticket redis-cli MONITOR
 */

import Redis from 'ioredis';
import crypto from 'crypto';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const TICKETS_URL = process.env.TICKETS_URL || 'http://localhost:3000';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'parcial2-arqui-jwt-secret-key-2026-min-256-bits!!';

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const COUNT = countArg ? Number(countArg.split('=')[1]) : 500;
const DEMO_API = args.includes('--demo-api');

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
  const a = letters[i % 26];
  const b = letters[Math.floor(i / 26) % 26];
  const c = letters[Math.floor(i / 676) % 26];
  const num = String(1000 + (i % 9000)).slice(0, 4);
  return `${a}${b}${c}-${num}`;
}

function dni(i) {
  return String(1700000000 + i).slice(0, 10);
}

async function demoApiHits() {
  console.log('\n==> Demo API: midiendo tiempos vía POST /tickets (MISS vs HIT)\n');
  console.log('  Requiere: tickets + usuarios + vehiculos + zonas + Redis\n');

  const token = signJwt(
    {
      sub: 'seed-demo',
      username: 'admin-demo',
      roles: ['ADMIN', 'OPERADOR'],
    },
    JWT_SECRET,
  );

  const body = {
    placa: placa(0),
    dni: dni(0),
    idEspacio: '00000000-0000-0000-0000-000000000099',
    zona: 'Zona A',
  };

  for (let round = 1; round <= 3; round++) {
    const start = Date.now();
    try {
      const res = await fetch(`${TICKETS_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(
        `  Round ${round}: ${Date.now() - start}ms | HTTP ${res.status} | ${text.slice(0, 120)}`,
      );
    } catch (err) {
      console.log(`  Round ${round}: ERROR - ${err.message}`);
      console.log(`  ¿Tickets corriendo en ${TICKETS_URL}?`);
      break;
    }
  }

  console.log(`
En logs de Nest deberías ver:
  Cache MISS / Cache SET en la 1ra llamada
  Cache HIT en la 2da/3ra (misma persona/placa)
`);
}

async function main() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    console.log(`Redis OK → ${REDIS_HOST}:${REDIS_PORT}`);
  } catch (err) {
    console.error(`
No hay Redis en ${REDIS_HOST}:${REDIS_PORT}
Levanta con:
  docker compose -f "src/tickets/docker-compose.redis.yml" up -d
`);
    console.error(err.message);
    process.exit(1);
  }

  console.log(
    `\nInsertando ${COUNT} personas + ${COUNT} vehiculos + ${COUNT} espacios...\n`,
  );

  const ttl = 600;
  const batchSize = 100;

  for (let start = 0; start < COUNT; start += batchSize) {
    const end = Math.min(start + batchSize, COUNT);
    const pipeline = redis.pipeline();

    for (let i = start; i < end; i++) {
      pipeline.set(
        `persona:${dni(i)}`,
        JSON.stringify({
          dni: dni(i),
          nombre: `Nombre${i}`,
          apellido: `Apellido${i}`,
          email: `user${i}@demo.local`,
          telefono: `09${String(10000000 + i).slice(0, 8)}`,
        }),
        'EX',
        ttl,
      );
      pipeline.set(
        `vehiculo:${placa(i)}`,
        JSON.stringify({
          placa: placa(i),
          marca: ['Toyota', 'Chevrolet', 'Kia', 'Hyundai'][i % 4],
          modelo: ['Corolla', 'Spark', 'Rio', 'Accent'][i % 4],
          color: ['Rojo', 'Azul', 'Negro', 'Blanco'][i % 4],
          anio: 2015 + (i % 10),
          tipo: 'auto',
        }),
        'EX',
        ttl,
      );
      pipeline.set(
        `espacio:demo-${String(i).padStart(4, '0')}`,
        JSON.stringify({
          id: `demo-${String(i).padStart(4, '0')}`,
          nombre: `ZON-A-${String(i).padStart(3, '0')}`,
          activo: true,
          nombrezona: 'Zona A',
          estado: 'DISPONIBLE',
        }),
        'EX',
        ttl,
      );
    }

    await pipeline.exec();
    console.log(`  ... ${end}/${COUNT}`);
  }

  const dbsize = await redis.dbsize();
  console.log(`\nDBSIZE = ${dbsize}`);
  console.log(`Ejemplo: persona:${dni(0)}`);
  console.log(await redis.get(`persona:${dni(0)}`));
  console.log(`
Comandos útiles:
  docker exec -it redis-ticket redis-cli DBSIZE
  docker exec -it redis-ticket redis-cli KEYS "persona:*"
  docker exec -it redis-ticket redis-cli GET persona:${dni(0)}
  docker exec -it redis-ticket redis-cli TTL persona:${dni(0)}
  docker exec -it redis-ticket redis-cli MONITOR
`);

  if (DEMO_API) {
    await demoApiHits();
  }

  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
