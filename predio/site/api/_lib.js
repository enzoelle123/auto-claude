import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function fail(status, message) { throw new HttpError(status, message); }
export function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value : '';
}
export function equal(a, b) {
  // Hashes de tamanho fixo permitem comparar inclusive entradas de tamanhos diferentes.
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(),
    createHash('sha256').update(String(b)).digest());
}
export function config(name) {
  const value = process.env[name];
  if (!value) fail(503, 'Serviço não configurado.');
  return value;
}
export function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
export function route(methods, handler) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        fail(405, 'Método não permitido.');
      }
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && cookie(req) !== null) origin(req);
      await handler(req, res);
    } catch (error) {
      json(res, error instanceof HttpError ? error.status : 503,
        { erro: error instanceof HttpError ? error.message : 'Serviço indisponível.' });
    }
  };
}
export function origin(req) {
  try {
    const value = header(req, 'origin');
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value ||
        parsed.host !== header(req, 'host')) throw new Error();
  } catch { fail(403, 'Origin não permitida.'); }
}
export function cookie(req) {
  const values = header(req, 'cookie').split(';').map(v => v.trim()).filter(v => v.startsWith('sessao='));
  if (!values.length) return null;
  return values.length === 1 ? values[0].slice(7) : '';
}
function signature(expires) {
  return createHmac('sha256', config('SEGREDO_SESSAO')).update(expires).digest('hex');
}
export function sessionToken() {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${expires}.${signature(expires)}`;
}
export function session(req) {
  const token = cookie(req) ?? '';
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(token);
  if (!match || !equal(match[2], signature(match[1])) || Number(match[1]) <= Date.now() / 1000)
    fail(401, 'Sessão inválida.');
  return createHash('sha256').update(token).digest('hex');
}
export function bearer(req) {
  const expected = config('TOKEN_PC');
  const auth = header(req, 'authorization');
  if (!auth.startsWith('Bearer ') || !equal(auth.slice(7), expected)) fail(401, 'Token inválido.');
}
export function setCookie(res, token, maxAge = SESSION_SECONDS) {
  res.setHeader('Set-Cookie', `sessao=${token}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict; Path=/`);
}
export async function body(req, limit = 16 * 1024) {
  if (Number(header(req, 'content-length')) > limit) fail(413, 'JSON excede o limite.');
  let raw;
  if (req.body !== undefined) {
    raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  } else {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limit) fail(413, 'JSON excede o limite.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw.length > limit) fail(413, 'JSON excede o limite.');
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { fail(400, 'Informe um objeto JSON válido.'); }
}
export function text(value, name, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    fail(400, `Campo ${name} inválido.`);
  return value;
}

// INCR e EXPIRE atômicos: nem concorrência nem falha de rede deixam contadores sem prazo.
const RATE_SCRIPT = "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n";
export async function rate(key, maximum, seconds) {
  const n = Number(await redis('EVAL', RATE_SCRIPT, 1, key, seconds));
  if (n > maximum) fail(429, 'Limite de tentativas atingido. Tente mais tarde.');
}
export async function redis(...cmd) { return (await pipeline([cmd]))[0]; }
export async function pipeline(commands) {
  if (process.env.REDIS_FALSO === '1') return commands.map(fakeRedis);
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) fail(503, 'Redis não configurado.');
  const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands), signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error('Redis indisponível');
  const results = await response.json();
  if (!Array.isArray(results) || results.length !== commands.length || results.some(r => r.error))
    throw new Error('Resposta Redis inválida');
  return results.map(r => r.result);
}
export async function getPedido(id) {
  return parsePedido(await redis('HGETALL', `auto:pedido:${id}`));
}
function parsePedido(raw) {
  if (!raw || (Array.isArray(raw) && !raw.length)) return null;
  const entries = Array.isArray(raw) ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[2*i], raw[2*i+1]]) : Object.entries(raw);
  if (!entries.length) return null;
  return Object.fromEntries(entries.map(([key, value]) => [key, JSON.parse(value)]));
}
export async function getPedidos(ids) {
  if (!ids.length) return [];
  return (await pipeline(ids.map(id => ['HGETALL', `auto:pedido:${id}`]))).map(parsePedido).filter(Boolean);
}
export const PEDIDO_SECONDS = 90 * 24 * 60 * 60;
export function indexPedido(pedido) {
  const key = `auto:pedidos:pasta:${pedido.pasta}`;
  const score = Date.parse(pedido.criado);
  return [
    ['ZADD', key, score, pedido.id],
    ['ZREMRANGEBYRANK', key, 0, -201],
    ['EXPIRE', `auto:pedido:${pedido.id}`, PEDIDO_SECONDS],
    ...(pedido.status === 'novo' ? [['ZADD', 'auto:pedidos:novo', score, pedido.id]] : [])
  ];
}
export async function migratePedidos() {
  if (await redis('GET', 'auto:pedidos:migrado')) return;
  const ids = await redis('ZREVRANGE', 'auto:pedidos', 0, -1);
  // Uma única leitura em lote do legado; as próximas consultas usam só os novos índices.
  const pedidos = await getPedidos(ids);
  const commands = pedidos.flatMap(indexPedido);
  commands.push(['SET', 'auto:pedidos:migrado', '1']);
  await pipeline(commands);
}

// Somente para testes locais explícitos. Produção usa exclusivamente o REST acima.
const memory = new Map();
function fakeRedis(command) {
  const [operation, key, ...args] = command;
  const entry = memory.get(key);
  if (entry?.expires && entry.expires <= Date.now()) memory.delete(key);
  const get = () => memory.get(key)?.value;
  const put = value => memory.set(key, { value, expires: memory.get(key)?.expires });
  switch (operation) {
    case 'EXPIRE': {
      if (!memory.has(key)) return 0;
      memory.get(key).expires = Date.now() + Number(args[0])*1000; return 1;
    }
    case 'TTL': {
      const current = memory.get(key);
      return !current ? -2 : current.expires ? Math.ceil((current.expires-Date.now())/1000) : -1;
    }
    case 'EVAL': {
      if (key !== RATE_SCRIPT) throw new Error('Script falso desconhecido');
      const [, rateKey, seconds] = args;
      const previous = memory.get(rateKey);
      const valid = previous && previous.expires > Date.now();
      const value = valid ? previous.value + 1 : 1;
      memory.set(rateKey, { value, expires: valid ? previous.expires : Date.now() + Number(seconds)*1000 });
      return value;
    }
    case 'SET': put(String(args[0])); return 'OK';
    case 'GET': return get() ?? null;
    case 'LPUSH': { const list = get() ?? []; list.unshift(...args.map(String)); put(list); return list.length; }
    case 'LTRIM': put((get() ?? []).slice(Number(args[0]), Number(args[1])+1)); return 'OK';
    case 'LRANGE': return (get() ?? []).slice(Number(args[0]), Number(args[1])+1);
    case 'HSET': {
      const hash = get() ?? {};
      for (let i=0; i<args.length; i+=2) hash[args[i]] = String(args[i+1]);
      put(hash); return args.length/2;
    }
    case 'HGETALL': return Object.entries(get() ?? {}).flat();
    case 'ZADD': {
      const set = get() ?? {};
      set[args[1]] = Number(args[0]); put(set); return 1;
    }
    case 'ZREVRANGE': {
      const ids = Object.entries(get() ?? {}).sort((a,b) => b[1]-a[1] || b[0].localeCompare(a[0])).map(([id]) => id);
      return ids.slice(Number(args[0]), Number(args[1]) === -1 ? undefined : Number(args[1])+1);
    }
    case 'ZREM': {
      const set = get() ?? {}; let removed = 0;
      for (const id of args) if (Object.hasOwn(set, id)) { delete set[id]; removed++; }
      put(set); return removed;
    }
    case 'ZREMRANGEBYRANK': {
      const set = get() ?? {};
      const ids = Object.keys(set).sort((a,b) => set[a]-set[b] || a.localeCompare(b));
      const rank = n => Number(n) < 0 ? ids.length+Number(n) : Number(n);
      const start = Math.max(0, rank(args[0])), end = rank(args[1]);
      const removed = end < start ? [] : ids.slice(start, end+1);
      for (const id of removed) delete set[id];
      put(set); return removed.length;
    }
    default: throw new Error(`Comando falso não implementado: ${operation}`);
  }
}
