import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  if (!SUPABASE_URL) {
    console.warn('check-email: missing Supabase URL – defaulting to exists=false');
    return res.status(200).json({ exists: false, skipped: true });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      if (
        supabaseAdmin.auth?.admin &&
        typeof supabaseAdmin.auth.admin.getUserByEmail === 'function'
      ) {
        const { data, error } =
          await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);

        if (error && error.message && !/user not found/i.test(error.message)) {
          console.error('check-email admin error:', error);
        }

        const user = data?.user || (data?.id ? data : null);
        if (user) {
          return res.status(200).json({ exists: true, user: { id: user.id, email: user.email } });
        }
      }

      // Fallback check via RPC or public tables
      const { data: rpcData } = await supabaseAdmin.rpc('email_exists', {
        p_email: normalizedEmail,
      });

      if (rpcData) {
        return res.status(200).json({ exists: true });
      }

      const { data: publicUser } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (publicUser) {
        return res.status(200).json({ exists: true, user: publicUser });
      }

      return res.status(200).json({ exists: false });
    }

    if (!SUPABASE_ANON_KEY) {
      console.warn('check-email: missing anon key – defaulting to exists=false');
      return res.status(200).json({ exists: false, skipped: true });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: rpcExists, error } = await supabaseClient.rpc('email_exists', {
      p_email: normalizedEmail,
    });

    if (error) {
      console.error('check-email rpc error:', error);
      return res
        .status(200)
        .json({ exists: false, skipped: true, error: error.message });
    }

    return res.status(200).json({ exists: !!rpcExists });
  } catch (err) {
    console.error('check-email unexpected error:', err);
    return res
      .status(200)
      .json({ exists: false, skipped: true, error: err?.message });
  }
}
