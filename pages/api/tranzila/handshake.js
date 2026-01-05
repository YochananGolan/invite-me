// API route to create Tranzila handshake token
// This prevents fraud by locking in the transaction amount before checkout

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get Tranzila credentials from environment variables
    const terminalName = process.env.NEXT_PUBLIC_TRANZILA_TERMINAL;
    const terminalPassword = process.env.TRANZILA_TERMINAL_PASSWORD;

    if (!terminalName || !terminalPassword) {
      console.error('Missing Tranzila credentials in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Missing Tranzila credentials. Please set NEXT_PUBLIC_TRANZILA_TERMINAL and TRANZILA_TERMINAL_PASSWORD in .env.local'
      });
    }

    // Build handshake URL
    const handshakeUrl = new URL('https://api.tranzila.com/v1/handshake/create');
    handshakeUrl.searchParams.append('supplier', terminalName);
    handshakeUrl.searchParams.append('sum', amount);
    handshakeUrl.searchParams.append('TranzilaPW', terminalPassword);

    console.log('Requesting handshake for amount:', amount, 'terminal:', terminalName);

    // Call Tranzila handshake API
    const response = await fetch(handshakeUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Tranzila handshake response:', responseText);

    // Parse response (Tranzila returns URL-encoded format)
    const params = new URLSearchParams(responseText);
    const thtk = params.get('thtk');
    const error = params.get('error');
    const errorMessage = params.get('message');

    if (error || !thtk) {
      console.error('Handshake failed:', { error, errorMessage, responseText });
      return res.status(400).json({
        error: error || 'Handshake failed',
        message: errorMessage || 'Failed to create handshake token',
        details: responseText
      });
    }

    // Return the handshake token
    return res.status(200).json({
      success: true,
      thtk,
      amount,
    });

  } catch (error) {
    console.error('Handshake API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
