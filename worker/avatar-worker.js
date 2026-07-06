// ============================================================
//  X(旧Twitter) アバター取得プロキシ  ―  Cloudflare Worker（改良版）
// ------------------------------------------------------------
//  https://<your>.workers.dev/?u=<アカウント名>      画像を返す
//  https://<your>.workers.dev/?u=<アカウント名>&debug=1  各取得先の状態をJSONで返す
//
//  複数の取得先を順に試し、最初に画像が取れたものを返します。
//  1つが429(レート制限)でも、別経路で取れれば成功します。
// ============================================================

const UA = 'Mozilla/5.0 (compatible; RakugakiAvatarBot/1.0)';
const CORS = { 'Access-Control-Allow-Origin': '*' };

// 取得先候補（上から順に試す）
async function candidates(user) {
  const u = encodeURIComponent(user);
  const list = [
    { name: 'unavatar/twitter', url: 'https://unavatar.io/twitter/' + u + '?fallback=false' },
    { name: 'unavatar/x',       url: 'https://unavatar.io/x/' + u + '?fallback=false' },
  ];
  // X公式JSON → 実アバターURL（pbs.twimg.com）
  try {
    const r = await fetch(
      'https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=' + u,
      { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }
    );
    if (r.ok) {
      const j = await r.json();
      const p = j && j[0] && j[0].profile_image_url_https;
      if (p) list.push({ name: 'syndication', url: p.replace('_normal', '_400x400') });
    }
  } catch (_) { /* ignore */ }
  return list;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const user = (url.searchParams.get('u') || '').replace(/^@+/, '').trim();
    const debug = url.searchParams.get('debug');
    if (!user) return new Response('usage: ?u=<screen_name>', { status: 400, headers: CORS });

    const cands = await candidates(user);
    const report = [];
    for (const c of cands) {
      try {
        const ir = await fetch(c.url, { headers: { 'User-Agent': UA } });
        const type = ir.headers.get('content-type') || '';
        report.push({ source: c.name, status: ir.status, type });
        if (ir.ok && type.startsWith('image/')) {
          if (debug) continue; // debug時は全経路の状態を集める
          const buf = await ir.arrayBuffer();
          return new Response(buf, { status: 200, headers: {
            'Content-Type': type || 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          }});
        }
      } catch (e) {
        report.push({ source: c.name, error: String((e && e.message) || e) });
      }
    }
    if (debug) {
      return new Response(JSON.stringify({ user, report }, null, 2),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('all sources failed: ' + JSON.stringify(report),
      { status: 502, headers: CORS });
  }
};
