// API route to get Tranzila terminal information (for debugging/admin)
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get Tranzila terminal name from environment variables
    const terminalName = process.env.NEXT_PUBLIC_TRANZILA_TERMINAL || 'לא מוגדר';
    const hasPassword = Boolean(
      process.env.TRANZILA_TERMINAL_PASSWORD ||
      process.env.TRANZILA_PW ||
      process.env.TRANZILA_API_KEY ||
      process.env.TRANZILLA_API_KEY
    );

    return res.status(200).json({
      terminal: terminalName,
      hasPassword: hasPassword,
      iframeUrl: `https://direct.tranzila.com/${terminalName}/iframenew.php`,
      isTestTerminal: terminalName === 'jira' || terminalName === 'testgya'
    });
  } catch (error) {
    console.error('Terminal info API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
