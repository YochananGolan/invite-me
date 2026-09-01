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
    return res.status(500).json({ error: 'Supabase URL is not configured.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = null;
    let tokenHash = null;

    if (SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // 1. Check if user exists via Admin API
      if (
        supabaseAdmin.auth?.admin &&
        typeof supabaseAdmin.auth.admin.getUserByEmail === 'function'
      ) {
        const { data: userData, error: userError } =
          await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);

        if (userError && userError.message && !/user not found/i.test(userError.message)) {
          console.error('login: admin getUserByEmail error:', userError);
        }

        if (userData?.user) {
          user = {
            id: userData.user.id,
            email: userData.user.email,
          };
        } else if (userData?.id) {
          user = {
            id: userData.id,
            email: userData.email,
          };
        }
      }

      // 2. Fallback check via RPC or public tables if user not found via getUserByEmail
      if (!user) {
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('email_exists', {
          p_email: normalizedEmail,
        });

        if (rpcData) {
          const { data: publicUser } = await supabaseAdmin
            .from('users')
            .select('id, email')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (publicUser) {
            user = { id: publicUser.id, email: publicUser.email };
          } else {
            // Also check events table if user created events
            const { data: eventUser } = await supabaseAdmin
              .from('events')
              .select('user_id')
              .eq('user_id', normalizedEmail)
              .maybeSingle();

            user = {
              id: eventUser?.user_id || normalizedEmail,
              email: normalizedEmail,
            };
          }
        }
      }

      // If user is definitely not registered
      if (!user) {
        return res.status(200).json({
          success: false,
          exists: false,
          code: 'user_not_found',
          message: 'האימייל לא רשום במערכת. ניתן להירשם כעת.',
        });
      }

      // 3. User is registered! Generate token hash to log in without sending an email
      if (
        supabaseAdmin.auth?.admin &&
        typeof supabaseAdmin.auth.admin.generateLink === 'function'
      ) {
        try {
          const { data: linkData, error: linkError } =
            await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: normalizedEmail,
            });

          if (!linkError && linkData?.properties?.hashed_token) {
            tokenHash = linkData.properties.hashed_token;
          }
        } catch (linkErr) {
          console.warn('login: generateLink error (falling back to direct session):', linkErr);
        }
      }

      return res.status(200).json({
        success: true,
        exists: true,
        user: {
          id: user.id,
          email: user.email,
        },
        tokenHash: tokenHash || null,
      });
    }

    // Fallback if SERVICE_ROLE_KEY is missing
    if (SUPABASE_ANON_KEY) {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: rpcExists } = await supabaseClient.rpc('email_exists', {
        p_email: normalizedEmail,
      });

      if (!rpcExists) {
        return res.status(200).json({
          success: false,
          exists: false,
          code: 'user_not_found',
          message: 'האימייל לא רשום במערכת. ניתן להירשם כעת.',
        });
      }

      return res.status(200).json({
        success: true,
        exists: true,
        user: {
          id: normalizedEmail,
          email: normalizedEmail,
        },
        tokenHash: null,
      });
    }

    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  } catch (err) {
    console.error('login handler unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
}
