import { route, session, bearer, body, pipeline, redis, fail, json } from './_lib.js';
export default route(['GET', 'POST'], async (req, res) => {
  if (req.method === 'GET') {
    session(req);
    const eventos = await redis('LRANGE', 'auto:eventos', 0, 59);
    return json(res, 200, { eventos: eventos.map(e => JSON.parse(e)), agora: new Date().toISOString() });
  }
  bearer(req);
  const data = await body(req);
  const event = {};
  for (const field of ['pasta', 'setor', 'tipo', 'nome', 'motivo', 'hora']) {
    if (typeof data[field] !== 'string') fail(400, `Campo ${field} deve ser string.`);
    event[field] = data[field].slice(0, 200);
  }
  await pipeline([['LPUSH', 'auto:eventos', JSON.stringify(event)], ['LTRIM', 'auto:eventos', 0, 199]]);
  json(res, 201, { ok: true });
});
