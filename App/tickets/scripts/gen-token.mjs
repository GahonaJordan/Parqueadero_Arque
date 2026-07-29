/**
 * Genera un JWT ADMIN para pegar en Postman → Authorization → Bearer Token
 *
 *   node scripts/gen-token.mjs
 */
import crypto from 'crypto';

const secret =
  process.env.JWT_SECRET ||
  'parcial2-arqui-jwt-secret-key-2026-min-256-bits!!';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const now = Math.floor(Date.now() / 1000);
const header = b64url({ alg: 'HS256', typ: 'JWT' });
const payload = b64url({
  sub: 'postman',
  username: 'postman-admin',
  roles: ['ADMIN', 'OPERADOR'],
  iat: now,
  exp: now + 3600,
});
const data = `${header}.${payload}`;
const sig = crypto
  .createHmac('sha256', secret)
  .update(data)
  .digest('base64')
  .replace(/=+$/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const token = `${data}.${sig}`;
console.log('\nPega esto en Postman → Authorization → Bearer Token:\n');
console.log(token);
console.log('\nVálido 1 hora. Tickets URL (Docker): http://localhost:3002\n');
