import { route, session, json } from './_lib.js';
export default route(['GET'], async (req, res) => {
  session(req);
  json(res, 200, { ok: true });
});
