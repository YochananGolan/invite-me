import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract transaction data from Tranzila
    const transactionData = req.method === 'POST' ? req.body : req.query;

    console.log('Tranzila Notify Callback (Server-to-Server):', transactionData);

    // Verify this is a legitimate Tranzila notification
    // In production, you should validate the request signature or IP address

    // Extract important fields
    const {
      Response,
      ConfirmationCode,
      sum,
      currency,
      tranmode,
      index,
      TranzilaTK,
      ccno,
      expdate,
      cred_type,
      pdesc,
      // Add any custom fields you sent
    } = transactionData;

    // Check if transaction was successful
    const isSuccessful = Response === '000' || Response === 0;

    // Save transaction to database
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          confirmation_code: ConfirmationCode,
          response_code: Response,
          amount: sum,
          currency: currency || '1',
          transaction_type: tranmode,
          transaction_index: index,
          token: TranzilaTK,
          last_4_digits: ccno ? ccno.slice(-4) : null,
          card_expiry: expdate,
          credit_type: cred_type,
          description: pdesc,
          status: isSuccessful ? 'success' : 'failed',
          transaction_data: transactionData,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to save transaction to database:', error);
        // Don't fail the entire request if DB save fails
        // Tranzila needs a 200 response to consider the notification delivered
      } else {
        console.log('Transaction saved to database:', data);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // Send confirmation email if successful (optional)
    if (isSuccessful) {
      // TODO: Send confirmation email
      // await sendConfirmationEmail(...)
    }

    // Tranzila expects a 200 OK response to confirm notification was received
    // Return simple OK response
    res.status(200).send('OK');
  } catch (error) {
    console.error('Tranzila notify handler error:', error);
    // Still return 200 to Tranzila to prevent retries
    res.status(200).send('ERROR');
  }
}
