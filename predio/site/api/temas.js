import { route, session, redis, json } from './_lib.js';

export default route(['GET'], async (req, res) => {
  session(req);
  const raw = await redis('HGETALL', 'auto:temas');
  const entries = Array.isArray(raw)
    ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[2*i], raw[2*i+1]])
    : Object.entries(raw ?? {});
  json(res, 200, Object.fromEntries(entries.map(([pasta, value]) => [pasta, JSON.parse(value)])));
});
