export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract transaction data from Tranzila
    const transactionData = req.method === 'POST' ? req.body : req.query;

    console.log('Tranzila Failure Callback:', transactionData);

    // Log the failure for monitoring
    // You can save this to your database for tracking failed transactions

    // Return HTML that will communicate with the parent window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>התשלום נכשל</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              direction: rtl;
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            .error-icon {
              font-size: 5rem;
              color: #ef4444;
              margin-bottom: 1rem;
            }
            h1 {
              color: #1f2937;
              margin-bottom: 1rem;
            }
            p {
              color: #6b7280;
              margin-bottom: 2rem;
            }
            .details {
              background: #fef2f2;
              padding: 1rem;
              border-radius: 0.5rem;
              margin-top: 1rem;
              text-align: right;
              border: 1px solid #fecaca;
            }
            .details p {
              margin: 0.5rem 0;
              color: #991b1b;
            }
            .button {
              display: inline-block;
              background: #ef4444;
              color: white;
              padding: 0.75rem 2rem;
              border-radius: 0.5rem;
              text-decoration: none;
              font-weight: 600;
              margin-top: 1rem;
              cursor: pointer;
              border: none;
            }
            .button:hover {
              background: #dc2626;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>התשלום נכשל</h1>
            <p>מצטערים, לא הצלחנו לבצע את התשלום. אנא נסה שוב.</p>
            ${transactionData.Response || transactionData.reason ? `
              <div class="details">
                <p><strong>סיבת הכישלון:</strong></p>
                <p>${transactionData.reason || 'שגיאה בעיבוד התשלום'}</p>
                ${transactionData.Response ? `<p><strong>קוד שגיאה:</strong> ${transactionData.Response}</p>` : ''}
              </div>
            ` : ''}
            <button class="button" onclick="tryAgain()">נסה שוב</button>
            <p style="margin-top: 2rem; color: #9ca3af; font-size: 0.875rem;">
              או סגור חלון זה לביטול
            </p>
          </div>
          <script>
            // Send failure message to parent window
            if (window.parent) {
              window.parent.postMessage({
                success: false,
                error: true,
                transactionData: ${JSON.stringify(transactionData)}
              }, '*');
            }

            function tryAgain() {
              if (window.parent) {
                window.parent.postMessage({ retryPayment: true }, '*');
              }
            }

            // Don't auto-close on failure - let user decide
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Tranzila failure handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
