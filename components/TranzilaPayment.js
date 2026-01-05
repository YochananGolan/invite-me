import { useState, useEffect, useRef } from 'react';

export default function TranzilaPayment({
  isOpen,
  onClose,
  amount,
  planName,
  onSuccess,
  onFailure
}) {
  console.log('🎨 TranzilaPayment rendering. isOpen:', isOpen, 'amount:', amount);

  const [isLoading, setIsLoading] = useState(true);
  const [handshakeToken, setHandshakeToken] = useState(null);
  const [handshakeError, setHandshakeError] = useState(null);
  const iframeRef = useRef(null);
  const formRef = useRef(null);

  // Store callbacks in refs to avoid re-running effect when they change
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onFailureRef.current = onFailure;
    onCloseRef.current = onClose;
  }, [onSuccess, onFailure, onClose]);

  // Get handshake token when modal opens
  useEffect(() => {
    console.log('🔄 TranzilaPayment effect running. isOpen:', isOpen);

    if (!isOpen) {
      setIsLoading(true);
      setHandshakeToken(null);
      setHandshakeError(null);
      return;
    }

    // Call handshake API
    const getHandshake = async () => {
      try {
        setIsLoading(true);
        setHandshakeError(null);

        console.log('🤝 Requesting handshake for amount:', amount);

        const response = await fetch('/api/tranzila/handshake', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to create handshake');
        }

        console.log('✅ Handshake successful. Token:', data.thtk);
        setHandshakeToken(data.thtk);

      } catch (error) {
        console.error('❌ Handshake failed:', error);
        setHandshakeError(error.message);
        setIsLoading(false);
      }
    };

    getHandshake();
  }, [isOpen, amount]);

  // Auto-submit form after handshake succeeds
  useEffect(() => {
    if (!handshakeToken || !isOpen) return;

    const timer = setTimeout(() => {
      if (formRef.current) {
        console.log('🚀 Auto-submitting payment form with handshake token');
        formRef.current.submit();
      }
    }, 100);

    // Listen for messages from Tranzila iframe
    const handleMessage = (event) => {
      // Security: Verify the origin if needed
      // if (event.origin !== 'https://direct.tranzila.com') return;

      console.log('Received message from iframe:', event.data);

      // Handle Tranzila response
      if (event.data && typeof event.data === 'object') {
        if (event.data.success || event.data.Response === '000') {
          // Payment successful
          onSuccessRef.current && onSuccessRef.current(event.data);
          onCloseRef.current();
        } else if (event.data.error || event.data.Response) {
          // Payment failed
          onFailureRef.current && onFailureRef.current(event.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, [handshakeToken, isOpen]);

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
    planName
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

          {/* Form for iframe submission */}
          <form
            ref={formRef}
            action={tranzilaUrl}
            target="tranzila-iframe"
            method="POST"
            className="hidden"
          >
            {/* Hidden fields */}
            <input type="hidden" name="sum" value={amount} />
            <input type="hidden" name="currency" value="1" />
            <input type="hidden" name="cred_type" value="1" />
            <input type="hidden" name="tranmode" value="A" />
            <input type="hidden" name="buttonLabel" value="שלם עכשיו" />
            <input type="hidden" name="success_url_address" value={successUrl} />
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

            {/* Handshake parameters - required for fraud prevention */}
            {handshakeToken && (
              <>
                <input type="hidden" name="thtk" value={handshakeToken} />
                <input type="hidden" name="new_process" value="1" />
              </>
            )}
          </form>

          {/* Iframe container */}
          <div className="relative bg-gray-50 rounded-lg border-2 border-gray-200" style={{ height: '600px' }}>
            {/* Error state */}
            {handshakeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 p-6">
                <div className="text-red-600 text-6xl mb-4">⚠️</div>
                <p className="text-red-600 font-bold text-xl mb-2">שגיאה באימות התשלום</p>
                <p className="text-gray-600 text-center mb-4">{handshakeError}</p>
                <button
                  onClick={onClose}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  סגור
                </button>
              </div>
            )}

            {/* Loading state */}
            {isLoading && !handshakeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-4"></div>
                <p className="text-gray-600 font-medium text-lg mb-2">
                  {!handshakeToken ? 'מאבטח את פרטי התשלום...' : 'טוען טופס תשלום מאובטח...'}
                </p>
                <p className="text-gray-500 text-sm">אנא המתן, הטופס ייטען בקרוב</p>
              </div>
            )}
            <iframe
              ref={iframeRef}
              name="tranzila-iframe"
              className="w-full h-full rounded-lg"
              onLoad={() => {
                // Only hide loading after iframe actually loads content
                setTimeout(() => setIsLoading(false), 500);
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
