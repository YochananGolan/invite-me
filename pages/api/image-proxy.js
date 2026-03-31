const ALLOWED_HOSTNAMES = new Set([
  'meet-m.co.il',
  'www.meet-m.co.il',
  'app.meet-m.co.il',
  'static.meet-m.co.il',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  if (!ALLOWED_HOSTNAMES.has(targetUrl.hostname)) {
    return res.status(403).json({ error: 'Hostname not permitted' });
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      redirect: 'follow',
    });

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      upstreamResponse.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(upstreamResponse.status);
    res.send(buffer);
  } catch (err) {
    console.error('image-proxy upstream fetch failed', err);
    res.status(502).json({ error: 'Failed to fetch upstream image' });
  }
}
