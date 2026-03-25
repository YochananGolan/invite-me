import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn(
      'check-email: missing Supabase configuration – defaulting to exists=false'
    );
    return res.status(200).json({ exists: false, skipped: true });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(
      email.trim().toLowerCase()
    );

    if (error && error.message && !/user not found/i.test(error.message)) {
      console.error('check-email admin error:', error);
      return res.status(200).json({ exists: false, error: error.message });
    }

    return res.status(200).json({ exists: !!data });
  } catch (err) {
    console.error('check-email unexpected error:', err);
    return res.status(200).json({ exists: false, error: err?.message });
  }
}
