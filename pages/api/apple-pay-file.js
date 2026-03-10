import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const filePath = path.join(process.cwd(), 'public', '.well-known', 'apple-developer-merchantid-domain-association');
  const hex = fs.readFileSync(filePath, 'utf8').trim();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(hex);
}
