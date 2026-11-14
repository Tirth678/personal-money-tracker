import type { NextApiRequest, NextApiResponse } from 'next';
import app from '../../server/app.mjs';

// Next supplies Node request/response objects directly to Express. Preserve the
// original /api/... URL and stream so Express owns routing and JSON validation.
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
  maxDuration: 60,
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve, reject) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    res.once('error', reject);
    app(req, res);
  });
}
