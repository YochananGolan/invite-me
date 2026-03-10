export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract transaction data from Tranzila
    const transactionData = req.method === 'POST' ? req.body : req.query;

    console.log('Tranzila Success Callback:', transactionData);

    // You can save the transaction to your database here
    // const { Response, ConfirmationCode, sum, etc } = transactionData;

    // Return HTML that will communicate with the parent window
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>תשלום בוצע בהצלחה</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            .success-icon {
              font-size: 5rem;
              color: #10b981;
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
              background: #f3f4f6;
              padding: 1rem;
              border-radius: 0.5rem;
              margin-top: 1rem;
              text-align: right;
            }
            .details p {
              margin: 0.5rem 0;
            }
            .continue-btn {
              display: inline-block;
              margin-top: 1.5rem;
              padding: 0.75rem 2rem;
              font-size: 1.125rem;
              font-weight: 600;
              color: white;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border: none;
              border-radius: 0.5rem;
              cursor: pointer;
              transition: opacity 0.2s;
            }
            .continue-btn:hover {
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>התשלום בוצע בהצלחה!</h1>
            <p>תודה על הרכישה. פרטי האירוע שלך מוכנים.</p>
            ${transactionData.ConfirmationCode || transactionData.sum ? `
              <div class="details">
                ${transactionData.ConfirmationCode ? `<p><strong>מספר אישור:</strong> ${transactionData.ConfirmationCode}</p>` : ''}
                ${transactionData.sum != null ? `<p><strong>סכום:</strong> ${(typeof transactionData.sum === 'number' ? transactionData.sum : (parseFloat(String(transactionData.sum).replace(/[^0-9.]/g, '')) || transactionData.sum))} ₪</p>` : ''}
              </div>
            ` : ''}
            <button class="continue-btn" onclick="handleContinue()">המשך</button>
          </div>
          <script>
            // Send success message to parent window
            try {
              if (window.parent && window.parent !== window) {
                const message = {
                  success: true,
                  Response: '000',
                  transactionData: ${JSON.stringify(transactionData)},
                  ConfirmationCode: ${transactionData.ConfirmationCode ? JSON.stringify(transactionData.ConfirmationCode) : 'null'},
                  sum: ${transactionData.sum ? JSON.stringify(transactionData.sum) : 'null'}
                };
                console.log('Sending success message to parent:', message);
                window.parent.postMessage(message, '*');
              }
            } catch (error) {
              console.error('Error sending success message:', error);
            }

            function handleContinue() {
              try {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ closePayment: true }, '*');
                } else {
                  var tx = ${JSON.stringify(transactionData)};
                  try {
                    sessionStorage.setItem('payment_success_transaction', JSON.stringify(tx));
                  } catch (e) {}
                  window.location.href = '/?payment_success=1';
                }
              } catch (error) {
                console.error('Error closing payment window:', error);
              }
            }
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Tranzila success handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
