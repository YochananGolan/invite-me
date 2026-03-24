import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res
      .status(500)
      .json({ error: 'Missing Supabase configuration on the server.' });
  }

  const { email, redirectTo } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const defaultRedirect =
      redirectTo ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers?.origin ||
      '';

    const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: defaultRedirect
          ? `${defaultRedirect.replace(/\/$/, '')}/reset-password`
          : undefined,
      }
    );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.error('reset-password API error:', err);
    return res.status(500).json({ error: 'Failed to send reset email.' });
  }
}
