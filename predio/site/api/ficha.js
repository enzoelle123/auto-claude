import { route, session, bearer, body, redis, json, fail } from './_lib.js';
import { pastaQuery } from './_tema.js';

export default route(['GET', 'PUT'], async (req, res) => {
  if (req.method === 'GET') session(req); else bearer(req);
  const key = `auto:ficha:${encodeURIComponent(pastaQuery(req))}`;
  if (req.method === 'GET') {
    const ficha = await redis('GET', key);
    if (!ficha) fail(404, 'Ficha não encontrada.');
    return json(res, 200, JSON.parse(ficha));
  }
  const ficha = await body(req, 200 * 1024);
  await redis('SET', key, JSON.stringify(ficha));
  json(res, 200, { ok: true });
});
