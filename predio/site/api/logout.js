import { route, origin, setCookie, json } from './_lib.js';
export default route(['POST'], async (req, res) => {
  origin(req);
  setCookie(res, '', 0);
  json(res, 200, { ok: true });
});
