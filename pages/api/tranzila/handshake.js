// API route to create Tranzila handshake token
// This prevents fraud by locking in the transaction amount before checkout

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    // Validate and normalize amount (Tranzila expects positive decimal)
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get Tranzila credentials from environment variables
    // Use test terminal 'jira' as default if not configured
    const terminalName = process.env.NEXT_PUBLIC_TRANZILA_TERMINAL || 'jira';

    // Check for terminal password in multiple possible variable names
    // TranzilaPW = Terminal Token Password (handshake). TRANZILA_TERMINAL_PASSWORD is for main terminal (testgya).
    // TRANZILA_TOKEN_PASSWORD is for token terminal - use TRANZILA_TERMINAL_PASSWORD first for handshake.
    const terminalPassword =
      process.env.TRANZILA_TERMINAL_PASSWORD ||
      process.env.TRANZILA_TOKEN_PASSWORD ||
      process.env.TRANZILA_PW ||
      process.env.TRANZILA_API_KEY ||
      process.env.TRANZILLA_API_KEY; // Legacy name with double L

    // For test terminal 'jira', return mock handshake (no real API call needed)
    if (terminalName === 'jira' && !terminalPassword) {
      console.log('Using Tranzila test terminal (jira) - returning mock handshake');
      const mockSum = Number.isInteger(amountNum) ? amountNum : Math.round(amountNum * 100) / 100;
      return res.status(200).json({
        success: true,
        thtk: 'mock-handshake-token-for-test-terminal',
        token: 'mock-handshake-token-for-test-terminal',
        amount: mockSum,
        sum: mockSum,
        mock: true
      });
    }

    // For production terminals, password is required
    if (!terminalPassword) {
      console.error('Missing Tranzila terminal password');
      console.error('Checked: TRANZILA_TERMINAL_PASSWORD, TRANZILA_TOKEN_PASSWORD, TRANZILA_PW, TRANZILA_API_KEY');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Missing Tranzila terminal password. Add one of these to .env.local: TRANZILA_TERMINAL_PASSWORD=your_password or TRANZILA_PW=your_password'
      });
    }

    // Build handshake URL - Tranzila expects sum as positive decimal
    const sumValue = Number.isInteger(amountNum) ? amountNum : Math.round(amountNum * 100) / 100;
    const handshakeUrl = new URL('https://api.tranzila.com/v1/handshake/create');
    handshakeUrl.searchParams.append('supplier', terminalName);
    handshakeUrl.searchParams.append('sum', String(sumValue));
    handshakeUrl.searchParams.append('TranzilaPW', terminalPassword);

    console.log('Requesting handshake:', {
      sum: sumValue,
      terminal: terminalName
    });

    // Call Tranzila handshake API (User-Agent may be required by some gateways)
    const response = await fetch(handshakeUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'InviteMe/1.0 (+https://invite-me-two.vercel.app)',
      },
    });

    const responseText = await response.text();
    console.log('Tranzila handshake response:', { status: response.status, body: responseText });

    // Parse response (Tranzila returns JSON for errors, URL-encoded for success)
    let thtk, error, errorMessage;

    try {
      // Try parsing as JSON first (error responses)
      const jsonData = JSON.parse(responseText);

      if (jsonData.error_code) {
        // JSON error response
        error = jsonData.error_code.toString();
        errorMessage = jsonData.message || 'Handshake failed';
      } else if (jsonData.thtk) {
        // JSON success response (in case they return JSON)
        thtk = jsonData.thtk;
      }
    } catch (e) {
      // Not JSON, try URL-encoded format (success responses)
      const params = new URLSearchParams(responseText);
      thtk = params.get('thtk');
      error = params.get('error');
      errorMessage = params.get('message');
    }

    if (error || !thtk) {
      // Log full Tranzila response for debugging production issues
      console.error('Handshake failed:', {
        error,
        errorMessage,
        responseText,
        httpStatus: response?.status,
        terminal: terminalName,
        amount
      });
      return res.status(400).json({
        success: false,
        error: error || 'Handshake failed',
        message: errorMessage || 'Failed to create handshake token. Check Vercel env: TRANZILA_TERMINAL_PASSWORD.',
        details: responseText
      });
    }

    // Return the handshake token - use sumValue so form sum matches handshake (Tranzila requires identical)
    return res.status(200).json({
      success: true,
      thtk,
      token: thtk, // alias for frontend expectations
      amount: sumValue,
      sum: sumValue,
    });

  } catch (error) {
    console.error('Handshake API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
