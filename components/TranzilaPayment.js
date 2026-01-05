import { useState, useEffect, useRef } from 'react';

export default function TranzilaPayment({
  isOpen,
  onClose,
  amount,
  planName,
  onSuccess,
  onFailure
}) {
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [isHandshakeLoading, setIsHandshakeLoading] = useState(false);
  const [handshakeToken, setHandshakeToken] = useState(null);
  const [handshakeMode, setHandshakeMode] = useState('handshake');
  const [handshakeDetails, setHandshakeDetails] = useState(null);
  const [handshakeError, setHandshakeError] = useState(null);
  const [handshakeAttempt, setHandshakeAttempt] = useState(0);
  const iframeRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setIsIframeLoading(true);
      setIsHandshakeLoading(false);
      setHandshakeToken(null);
      setHandshakeMode('handshake');
      setHandshakeDetails(null);
      setHandshakeError(null);
      setHandshakeAttempt(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Listen for messages from Tranzila iframe
    const handleMessage = (event) => {
      // Security: Verify the origin if needed
      // if (event.origin !== 'https://direct.tranzila.com') return;

      console.log('Received message from iframe:', event.data);

      const data = event.data;

      if (!data || typeof data !== 'object') {
        return;
      }

      if (data.closePayment) {
        onClose();
        return;
      }

      if (data.retryPayment) {
        setHandshakeToken(null);
        setHandshakeDetails(null);
        setHandshakeError(null);
        setIsIframeLoading(true);
        setIsHandshakeLoading(false);
        setHandshakeAttempt((prev) => prev + 1);
        return;
      }

      if (data.success || data.Response === '000') {
        onSuccess && onSuccess(data);
        onClose();
        return;
      }

      if (data.error || data.Response) {
        onFailure && onFailure(data);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, onSuccess, onFailure, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const amountValue = Number(amount);

    const initiateHandshake = async () => {
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        const message = 'סכום העסקה אינו תקין עבור תשלום ב-Tranzila.';
        console.error(message, { amount });
        setHandshakeError(message);
        onFailure &&
          onFailure({
            error: true,
            reason: 'invalid_amount',
            message
          });
        return;
      }

      setHandshakeMode('handshake');
      setIsHandshakeLoading(true);
      setIsIframeLoading(true);
      setHandshakeError(null);
      setHandshakeToken(null);
      setHandshakeDetails(null);

      try {
        const response = await fetch('/api/tranzila/handshake', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          cache: 'no-store',
          body: JSON.stringify({
            amount: amountValue,
            description: planName
          })
        });

        let payload = null;

        try {
          payload = await response.json();
        } catch (jsonError) {
          console.warn('Failed to parse Tranzila handshake response as JSON', jsonError);
        }

        if (!response.ok) {
          const message =
            payload?.error ||
            payload?.message ||
            'שגיאה בחיבור למסוף Tranzila. בדוק את הגדרות ההתחברות ונסה שוב.';

          console.error('Tranzila handshake request returned an error response', {
            status: response.status,
            payload
          });

          if (!isCancelled) {
            setHandshakeError(message);
            onFailure &&
              onFailure({
                error: true,
                reason: 'handshake_failed',
                message
              });
          }

          return;
        }

        if (!payload?.token && !payload?.mock) {
          throw new Error('Handshake response missing token');
        }

        const isMockHandshake = Boolean(payload?.mock);

        console.log('Tranzila handshake ready', {
          sum: payload?.sum,
          hasToken: Boolean(payload?.token),
          mock: isMockHandshake
        });

        if (isCancelled) {
          return;
        }

        if (isMockHandshake) {
          console.warn(
            'Tranzila handshake is running in mocked development mode. Configure environment variables for real payments.',
            payload
          );
          setHandshakeMode('legacy');
          setHandshakeToken(null);
          setHandshakeDetails(payload);
        } else {
          setHandshakeMode('handshake');
          setHandshakeToken(payload.token);
          setHandshakeDetails(payload);
        }
      } catch (error) {
        console.error('Failed to initialize Tranzila handshake', error);

        if (isCancelled) {
          return;
        }

        const message =
          error?.message ||
          'שגיאה בחיבור למסוף Tranzila. אנא נסה שוב או פנה לתמיכה.';

        setHandshakeError(message);

        onFailure &&
          onFailure({
            error: true,
            reason: 'handshake_failed',
            message
          });
      } finally {
        if (!isCancelled) {
          setIsHandshakeLoading(false);
        }
      }
    };

    initiateHandshake();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, amount, planName, onFailure, handshakeAttempt]);

  useEffect(() => {
    if (!isOpen) return;

    const isReadyToSubmit =
      handshakeMode === 'handshake'
        ? Boolean(handshakeToken)
        : handshakeMode === 'legacy'
        ? Boolean(handshakeDetails)
        : false;

    if (!isReadyToSubmit) return;

    const timer = setTimeout(() => {
      if (formRef.current) {
        console.log(
          'Submitting payment form to Tranzila iframe',
          handshakeMode === 'legacy'
            ? { mode: 'legacy', reason: handshakeDetails?.message }
            : { mode: 'handshake' }
        );
        formRef.current.submit();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, handshakeToken, handshakeMode, handshakeDetails]);

  if (!isOpen) return null;

  // Get terminal name from env or use a default
  const terminalName = process.env.NEXT_PUBLIC_TRANZILA_TERMINAL || 'jira';

  // Warn if using test terminal
  if (terminalName === 'jira') {
    console.warn('⚠️ Using Tranzila test terminal. Set NEXT_PUBLIC_TRANZILA_TERMINAL in .env.local for production.');
  }

  // Build the Tranzila iframe URL
  const tranzilaUrl = `https://direct.tranzila.com/${terminalName}/iframenew.php`;

  console.log('Tranzila payment modal opened:', {
    terminal: terminalName,
    url: tranzilaUrl,
    amount,
    planName,
    handshakeMode
  });

  // Success and failure URLs - these should point to your API routes
  const successUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/tranzila/success`;
  const failUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/tranzila/failure`;
  const notifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/tranzila/notify`;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-[200] p-4">
      <div className="relative bg-white rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">תשלום מאובטח</h2>
            <p className="text-sm opacity-90 mt-1">
              {planName} - {amount} ₪
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-3xl transition-colors"
            aria-label="סגור"
          >
            &times;
          </button>
        </div>

        {/* Payment Form Container */}
        <div className="p-6">
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
            <div className="flex items-start">
              <span className="text-blue-600 text-xl ml-3">🔒</span>
              <div>
                <p className="font-semibold text-blue-900 mb-1">תשלום מאובטח</p>
                <p className="text-sm text-blue-700">
                  התשלום מתבצע דרך מערכת Tranzila המאובטחת. פרטי האשראי שלך מוצפנים ומועברים ישירות לחברת סליקה ללא שמירה במערכת שלנו.
                </p>
              </div>
            </div>
          </div>

          {handshakeMode === 'legacy' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-right">
              <p className="font-semibold text-amber-900 mb-1">מצב תשלום להרצה</p>
              <p className="text-sm text-amber-800">
                התשלום פועל במצב בדיקות עם מסוף Tranzila לדוגמה. כדי לאפשר סליקה אמיתית, הגדר ערכי TRANZILA_TERMINAL ו-TRANZILA_TERMINAL_PASSWORD בקובץ ‎.env.local ולאחר מכן הפעל מחדש את השרת.
              </p>
              {handshakeDetails?.message && (
                <p className="text-xs text-amber-700 mt-2">{handshakeDetails.message}</p>
              )}
            </div>
          )}

          {/* Form for iframe submission */}
          <form
            ref={formRef}
            action={tranzilaUrl}
            target="tranzila-iframe"
            method="POST"
            className="hidden"
          >
            {/* Hidden fields */}
            <input
              type="hidden"
              name="sum"
              value={`${handshakeDetails?.sum ?? amount}`}
            />
            <input type="hidden" name="supplier" value={terminalName} />
            <input type="hidden" name="currency" value="1" />
            <input type="hidden" name="cred_type" value="1" />
            <input type="hidden" name="tranmode" value="A" />
            {handshakeMode === 'handshake' && (
              <>
                <input type="hidden" name="new_process" value="1" />
                <input type="hidden" name="thtk" value={handshakeToken || ''} />
              </>
            )}
            <input type="hidden" name="buttonLabel" value="שלם עכשיו" />
            <input
              type="hidden"
              name="success_url_address"
              value={successUrl}
            />
            <input type="hidden" name="fail_url_address" value={failUrl} />
            <input type="hidden" name="notify_url_address" value={notifyUrl} />
            <input type="hidden" name="pdesc" value={planName} />
            <input type="hidden" name="lang" value="il" />
            <input type="hidden" name="trBgColor" value="ffffff" />
            <input type="hidden" name="trTextColor" value="333333" />
            <input type="hidden" name="trButtonColor" value="D4AF37" />
            <input type="hidden" name="nologo" value="1" />
            <input type="hidden" name="bit_pay" value="1" />
            <input type="hidden" name="google_pay" value="1" />
            {handshakeDetails?.response?.index && (
              <input
                type="hidden"
                name="index"
                value={handshakeDetails.response.index}
              />
            )}
          </form>

          {/* Iframe container */}
          <div className="relative bg-gray-50 rounded-lg border-2 border-gray-200" style={{ height: '600px' }}>
            {(isHandshakeLoading || isIframeLoading) && !handshakeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-4"></div>
                <p className="text-gray-600 font-medium text-lg mb-2">
                  {isHandshakeLoading
                    ? 'מתחבר למסוף Tranzila...'
                    : 'טוען טופס תשלום מאובטח...'}
                </p>
                <p className="text-gray-500 text-sm">אנא המתן, הטופס ייטען בקרוב</p>
              </div>
            )}
            {handshakeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 p-6">
                <div className="text-4xl mb-4">⚠️</div>
                <p className="text-gray-700 font-semibold text-lg mb-2 text-center">
                  לא הצלחנו להתחבר למסוף התשלומים.
                </p>
                <p className="text-gray-600 text-center mb-4">
                  {handshakeError}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setHandshakeAttempt((prev) => prev + 1);
                      setHandshakeError(null);
                    }}
                    className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    נסה שוב
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    סגור
                  </button>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              name="tranzila-iframe"
              className="w-full h-full rounded-lg"
              onLoad={() => {
                // Only hide loading after iframe actually loads content
                setTimeout(() => setIsIframeLoading(false), 500);
              }}
              allow="payment"
              allowpaymentrequest="true"
            />
          </div>

          {/* Additional info */}
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>💳 מקבלים את כל סוגי כרטיסי האשראי</p>
            <p className="mt-1">🔐 אבטחה מלאה בתקן PCI-DSS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
