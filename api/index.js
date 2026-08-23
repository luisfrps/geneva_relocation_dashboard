/* API de conta e sincronizacao do painel de Genebra.
   Cloudflare Worker + KV. Guarda o blob de estado por utilizador e devolve-o
   a qualquer dispositivo que faca login.

   A password NUNCA chega aqui. O browser deriva PBKDF2-SHA256(password, 310k)
   e envia so o resultado; o servidor guarda SHA-256(salt aleatorio || derivado).
   Isso mantem o custo de CPU do Worker perto de zero e o segredo do lado do dono.

   Chaves KV:  user:<email>  -> {salt, hash, createdAt}
               state:<email> -> {state, updatedAt}
*/

const ORIGINS = [
  'https://luisfrps.github.io',
  'http://127.0.0.1:5321',
  'http://localhost:5321',
];

const enc = new TextEncoder();

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request) },
  });
}

const b64url = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(str) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(str)));
}

/* Comparacao em tempo constante: um return antecipado revelaria o prefixo certo. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return body + '.' + mac;
}

async function verify(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  if (!sameSecret(mac, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const normEmail = e => String(e || '').trim().toLowerCase();

function allowed(email, env) {
  const list = String(env.ALLOWED_EMAILS || '')
    .split(/[,\s]+/)
    .map(normEmail)
    .filter(Boolean);
  return list.length === 0 ? false : list.includes(email);
}

/* O derivado do cliente e' hex de 32 bytes. Recusar tudo o resto evita
   que um cliente partido grave uma password fraca sem se dar por isso. */
const validDerived = p => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p);

async function auth(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return verify(header.slice(7), env.AUTH_SECRET);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (!env.AUTH_SECRET) return json(request, { error: 'server not configured' }, 503);

    if (path === '/' || path === '/health') return json(request, { ok: true });

    /* ---- registo ---- */
    if (path === '/auth/register' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = normEmail(body.email);
      if (!allowed(email, env)) return json(request, { error: 'this address cannot register here' }, 403);
      if (!validDerived(body.ph)) return json(request, { error: 'bad password payload' }, 400);
      if (await env.GENEVA.get('user:' + email)) return json(request, { error: 'account already exists' }, 409);

      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await sha256Hex(salt + body.ph);
      await env.GENEVA.put('user:' + email, JSON.stringify({ salt, hash, createdAt: Date.now() }));
      const token = await sign({ e: email, exp: Date.now() + 90 * 864e5 }, env.AUTH_SECRET);
      return json(request, { token, email });
    }

    /* ---- login ---- */
    if (path === '/auth/login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = normEmail(body.email);
      const raw = await env.GENEVA.get('user:' + email);
      /* Mesma resposta para utilizador inexistente e password errada. */
      if (!raw || !validDerived(body.ph)) return json(request, { error: 'wrong email or password' }, 401);
      const user = JSON.parse(raw);
      if (!sameSecret(await sha256Hex(user.salt + body.ph), user.hash))
        return json(request, { error: 'wrong email or password' }, 401);
      const token = await sign({ e: email, exp: Date.now() + 90 * 864e5 }, env.AUTH_SECRET);
      return json(request, { token, email });
    }

    /* ---- estado ---- */
    if (path === '/state') {
      const session = await auth(request, env);
      if (!session) return json(request, { error: 'not signed in' }, 401);

      if (request.method === 'GET') {
        const raw = await env.GENEVA.get('state:' + session.e);
        return json(request, raw ? JSON.parse(raw) : { state: null, updatedAt: 0 });
      }

      if (request.method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        if (!body || typeof body.state !== 'object' || body.state === null)
          return json(request, { error: 'bad state' }, 400);
        const updatedAt = Number(body.updatedAt) || Date.now();
        await env.GENEVA.put('state:' + session.e, JSON.stringify({ state: body.state, updatedAt }));
        return json(request, { ok: true, updatedAt });
      }
    }

    if (path === '/me') {
      const session = await auth(request, env);
      return session ? json(request, { email: session.e }) : json(request, { error: 'not signed in' }, 401);
    }

    return json(request, { error: 'not found' }, 404);
  },
};
