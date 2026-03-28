import { useState, useEffect, useRef } from 'react';

// Load Tranzila Apple Pay JS when payment modal opens (required for Apple Pay in iframe)
// טרנזילה: יש להשתמש ב-jQuery שלהם כדי למנוע התנגשויות עם ספריות קיימות
function useTranzilaApplePayScript(isOpen) {
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || loadedRef.current) return;
    if (typeof window === 'undefined') return;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });

    (async () => {
      try {
        // jQuery של טרנזילה – מונע התנגשויות עם React/ספריות אחרות
        await loadScript('https://direct.tranzila.com/Tranzila_files/jquery.js');
        await loadScript(`https://direct.tranzila.com/js/tranzilanapple_v3.js?v=${Date.now()}`);
        if (window.jQuery && !window.$n) {
          window.$n = window.jQuery.noConflict(true);
        }
        loadedRef.current = true;
      } catch (e) {
        console.warn('Tranzila Apple Pay script load skipped:', e?.message);
      }
    })();
  }, [isOpen]);
}

export default function TranzilaPayment({
  isOpen,
  onClose,
  amount,
  planName,
  onSuccess,
  onFailure
}) {
  useTranzilaApplePayScript(isOpen);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [isHandshakeLoading, setIsHandshakeLoading] = useState(false);
  const [handshakeToken, setHandshakeToken] = useState(null);
  const [handshakeMode, setHandshakeMode] = useState('handshake');
  const [handshakeDetails, setHandshakeDetails] = useState(null);
  const [handshakeError, setHandshakeError] = useState(null);
  const [handshakeAttempt, setHandshakeAttempt] = useState(0);
  const handshakeInProgressRef = useRef(false);
  const iframeRef = useRef(null);
  const formRef = useRef(null);
  const failureTimeoutRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onFailureRef.current = onFailure;
  }, [onFailure]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
        failureTimeoutRef.current = null;
      }
      setIsIframeLoading(true);
      setIsHandshakeLoading(false);
      setHandshakeToken(null);
      setHandshakeMode('handshake');
      setHandshakeDetails(null);
      setHandshakeError(null);
      setHandshakeAttempt(0);
      handshakeInProgressRef.current = false;
      // Restore UserWay when payment modal closes
      try {
        if (typeof document !== 'undefined') document.body?.classList.remove('payment-modal-open');
        if (typeof window !== 'undefined' && window.UserWay?.iconVisibilityOn) {
          window.UserWay.iconVisibilityOn();
        }
      } catch (e) {}
    } else {
      // Hide UserWay during payment - prevents overlay from blocking name field in Google Pay form
      try {
        if (typeof document !== 'undefined') document.body?.classList.add('payment-modal-open');
        if (typeof window !== 'undefined' && window.UserWay?.iconVisibilityOff) {
          window.UserWay.iconVisibilityOff();
        }
      } catch (e) {}
    }
    return () => {
      try {
        if (typeof document !== 'undefined') document.body?.classList.remove('payment-modal-open');
        if (typeof window !== 'undefined' && window.UserWay?.iconVisibilityOn) {
          window.UserWay.iconVisibilityOn();
        }
      } catch (e) {}
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (failureTimeoutRef.current) {
      clearTimeout(failureTimeoutRef.current);
      failureTimeoutRef.current = null;
    }

    failureTimeoutRef.current = setTimeout(() => {
      console.warn('Tranzila payment timeout reached – triggering failure handler');
      onFailureRef.current?.({
        error: true,
        reason: 'timeout',
        message: 'לא התקבל אישור תשלום בזמן. אנא נסה שוב או בחר אמצעי תשלום אחר.',
      });
    }, 120000);

    return () => {
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
        failureTimeoutRef.current = null;
      }
    };
  }, [isOpen, handshakeAttempt]);

  useEffect(() => {
    if (!isOpen) return;

    // Listen for messages from Tranzila iframe
    const handleMessage = (event) => {
      try {
        // Log all messages for debugging
        console.log('Received message from iframe:', {
          origin: event.origin,
          data: event.data,
          type: typeof event.data
        });

        const data = event.data;

        // Origin validation – allow our own domain and trusted Tranzila domains (for Google Pay callbacks).
        // Tranzila may emit intermediate statuses; we react only when the payload clearly indicates success or failure.
        const isOwnOrigin = typeof window !== 'undefined' && event.origin === window.location.origin;
        const isTrustedTranzilaOrigin =
          typeof event.origin === 'string' && /(?:^https?:\/\/)?([^/]+\.)?tranzila\.com$/i.test(event.origin);
        const isTrustedOrigin = isOwnOrigin || isTrustedTranzilaOrigin;

        // Handle string messages (from API callbacks) - only from our success/failure pages
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            const responseCode =
              parsed?.Response ??
              parsed?.transactionData?.Response ??
              parsed?.response_code ??
              null;
            const normalizedResponse =
              responseCode !== null && responseCode !== undefined ? String(responseCode) : null;
            const parsedSuccess =
              parsed?.success === true ||
              normalizedResponse === '000' ||
              normalizedResponse === '0';
            const parsedFailure =
              parsed?.error ||
              parsed?.reason ||
              (normalizedResponse && normalizedResponse !== '000' && normalizedResponse !== '0');

            if (isTrustedOrigin && parsedSuccess) {
              if (failureTimeoutRef.current) {
                clearTimeout(failureTimeoutRef.current);
                failureTimeoutRef.current = null;
              }
              onSuccessRef.current && onSuccessRef.current(parsed);
              onCloseRef.current && onCloseRef.current();
              return;
            }
            if (isTrustedOrigin && !parsedSuccess && parsedFailure) {
              if (failureTimeoutRef.current) clearTimeout(failureTimeoutRef.current);
              failureTimeoutRef.current = null;
              onFailureRef.current && onFailureRef.current(parsed);
              return;
            }
          } catch (e) {
            return;
          }
        }

        // Handle object messages
        if (!data || typeof data !== 'object') {
          return;
        }

        // closePayment and retryPayment are ONLY sent from our success/failure pages (same origin).
        // Ignore from Tranzila or other origins - prevents Google Pay sheet from being interrupted
        // when Tranzila or browser sends spurious messages during payment flow.

        // Handle close payment request - only from our success page
        if (data.closePayment) {
          if (!isOwnOrigin) return;
          onCloseRef.current && onCloseRef.current();
          return;
        }

        // Handle retry payment request - only from our failure page (user clicked "נסה שוב")
        if (data.retryPayment) {
          if (!isOwnOrigin) return;
          handshakeInProgressRef.current = false;
          setHandshakeToken(null);
          setHandshakeDetails(null);
          setHandshakeError(null);
          setIsIframeLoading(true);
          setIsHandshakeLoading(false);
          setHandshakeAttempt((prev) => prev + 1);
          return;
        }

        // Success/failure ONLY from our callback pages - Tranzila redirects iframe to our success/fail URL.
        // Ignore messages from Tranzila (direct.tranzila.com) - they send intermediate status during Google Pay
        // that we wrongly treated as failure (e.g. when user clicks Continue, card shows, then "failed").

        // Handle successful payment - only from our success page
        const isSuccess = data.success === true || 
                         data.Response === '000' || 
                         data.Response === 0 ||
                         data.Response === '0' ||
                         (data.transactionData && (data.transactionData.Response === '000' || data.transactionData.Response === 0));

        if (isSuccess && isTrustedOrigin) {
          if (failureTimeoutRef.current) {
            clearTimeout(failureTimeoutRef.current);
            failureTimeoutRef.current = null;
          }
          console.log('Payment successful, calling onSuccess with:', data);
          const transactionData = data.transactionData || data;
          onSuccessRef.current && onSuccessRef.current(transactionData);
          onCloseRef.current && onCloseRef.current();
          return;
        }

        // Handle failed payment - from our failure page (Tranzila redirects iframe to our URL).
        // Show popup immediately with failure reason and button to return to payment.
        const responseCode =
          data?.Response ??
          data?.transactionData?.Response ??
          null;
        const normalizedResponse =
          responseCode !== null && responseCode !== undefined ? String(responseCode) : null;
        const isFailureResponse =
          normalizedResponse && normalizedResponse !== '000' && normalizedResponse !== '0';
        const hasFailureSignal = Boolean(data?.error || data?.reason || isFailureResponse);

        if (isTrustedOrigin && !isSuccess && hasFailureSignal) {
          if (failureTimeoutRef.current) clearTimeout(failureTimeoutRef.current);
          failureTimeoutRef.current = null;
          console.log('Payment failed, calling onFailure with:', data);
          const errorData = data.transactionData || data;
          onFailureRef.current && onFailureRef.current(errorData);
          return;
        }

        // Log unhandled messages for debugging
        console.warn('Unhandled message from iframe:', data);
      } catch (error) {
        console.error('Error handling message from iframe:', error);
        // Don't crash - just log the error
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      handshakeInProgressRef.current = false;
      return;
    }
    
    // Prevent multiple handshakes if one is already in progress
    if (handshakeInProgressRef.current) {
      console.log('Handshake already in progress, skipping...');
      return;
    }

    let isCancelled = false;
    handshakeInProgressRef.current = true;

    const amountValue = Number(amount);

    const initiateHandshake = async () => {
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        const message = 'סכום העסקה אינו תקין עבור תשלום ב-Tranzila.';
        console.error(message, { amount });
        setHandshakeError(message);
        onFailureRef.current &&
          onFailureRef.current({
            error: true,
            reason: 'invalid_amount',
            message,
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
            onFailureRef.current &&
              onFailureRef.current({
                error: true,
                reason: 'handshake_failed',
                message,
              });
          }

          return;
        }

        // Check for token in multiple possible fields
        const token = payload?.token || payload?.thtk;
        if (!token && !payload?.mock) {
          throw new Error('Handshake response missing token');
        }

        const isMockHandshake = Boolean(payload?.mock);

        console.log('Tranzila handshake ready', {
          sum: payload?.sum || payload?.amount || amountValue,
          amount: payload?.amount || amountValue,
          hasToken: Boolean(payload?.token || payload?.thtk),
          mock: isMockHandshake,
          payload
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
          const token = payload.token || payload.thtk;
          setHandshakeToken(token);
          // Ensure sum is set from amount if not present
          setHandshakeDetails({
            ...payload,
            sum: payload.sum || payload.amount || amountValue,
            token: token // Ensure token is in details too
          });
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

        onFailureRef.current &&
          onFailureRef.current({
            error: true,
            reason: 'handshake_failed',
            message,
          });
      } finally {
        if (!isCancelled) {
          setIsHandshakeLoading(false);
          handshakeInProgressRef.current = false;
        }
      }
    };

    initiateHandshake();

    return () => {
      isCancelled = true;
      handshakeInProgressRef.current = false;
    };
  }, [isOpen, amount, planName, handshakeAttempt]);

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
  const isTestTerminal = /(?:^test|test$|demo|jira)/i.test(terminalName);
  const googlePayEnabled =
    !isTestTerminal &&
    process.env.NEXT_PUBLIC_DISABLE_GOOGLE_PAY !== '1' &&
    process.env.NEXT_PUBLIC_DISABLE_GOOGLE_PAY !== 'true';
  const applePayEnabled =
    !isTestTerminal &&
    process.env.NEXT_PUBLIC_DISABLE_APPLE_PAY !== '1' &&
    process.env.NEXT_PUBLIC_DISABLE_APPLE_PAY !== 'true';

  // Warn if using test terminal
  if (isTestTerminal) {
    console.warn('⚠️ Using Tranzila test/demo terminal. Configure production credentials to enable real payments and digital wallets.');
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

  // Success and failure URLs - use NEXT_PUBLIC_APP_URL for production consistency (Vercel)
  // Tranzila requires absolute URLs; NEXT_PUBLIC_APP_URL ensures correct domain in production
  const baseUrl =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
      : process.env.NEXT_PUBLIC_APP_URL || '';
  const successUrl = `${baseUrl || 'https://invite-me-two.vercel.app'}/api/tranzila/success`;
  const failUrl = `${baseUrl || 'https://invite-me-two.vercel.app'}/api/tranzila/failure`;
  const notifyUrl = `${baseUrl || 'https://invite-me-two.vercel.app'}/api/tranzila/notify`;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-[200] p-0 sm:p-4">
      <div className="relative bg-white w-full h-[100dvh] sm:h-auto sm:rounded-lg sm:max-w-4xl sm:max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header - single compact line on mobile */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-3 py-1.5 sm:p-6 flex justify-between items-center flex-shrink-0">
          <p className="text-sm sm:text-2xl font-bold">
            <span className="sm:hidden">תשלום - {planName} - {amount} ₪</span>
            <span className="hidden sm:inline">תשלום מאובטח</span>
          </p>
          <p className="hidden sm:block text-sm opacity-90 mt-1">
            {planName} - {amount} ₪
          </p>
          <button
            onClick={() => onCloseRef.current && onCloseRef.current()}
            className="text-white hover:bg-white/20 rounded-full w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center text-xl sm:text-3xl transition-colors flex-shrink-0"
            aria-label="סגור"
          >
            &times;
          </button>
        </div>

        {/* Payment Form Container */}
        <div className="p-0 sm:p-6 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="hidden sm:block mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
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

          {(handshakeMode === 'legacy' || isTestTerminal) && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-right">
              <p className="font-semibold text-amber-900 mb-1">
                {isTestTerminal ? 'מסוף תשלומים במצב בדיקות' : 'מצב תשלום להרצה'}
              </p>
              <p className="text-sm text-amber-800">
                {isTestTerminal
                  ? 'המסוף מחובר במצב בדיקות של Tranzila. השתמש במספרי כרטיס בדיקה של Tranzila בלבד – העסקה לא תחייב בפועל, וארנקים דיגיטליים (Google Pay / Apple Pay) מושבתים כדי למנוע תקלות.'
                  : 'התשלום פועל במצב בדיקות עם מסוף Tranzila לדוגמה. כדי לאפשר סליקה אמיתית, הגדר ערכי TRANZILA_TERMINAL ו-TRANZILA_TERMINAL_PASSWORD בקובץ ‎.env.local ולאחר מכן הפעל מחדש את השרת.'}
              </p>
              {(handshakeDetails?.message || handshakeError) && (
                <p className="text-xs text-amber-700 mt-2">
                  {handshakeDetails?.message || handshakeError}
                </p>
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
            {/* Hidden fields - sum must match handshake exactly (Tranzila validates; 004 = invalid amount).
                Format "5.00" helps Payment Request API display amount in Google Pay sheet. */}
            <input
              type="hidden"
              name="sum"
              value={(() => {
                const raw = handshakeDetails?.sum ?? handshakeDetails?.amount ?? amount;
                if (typeof raw === 'string' && /^\d+(\.\d{1,2})?$/.test(raw)) return raw;
                const num = typeof raw === 'number' ? raw : parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return String(Number(amount).toFixed(2));
                return (Math.round(num * 100) / 100).toFixed(2);
              })()}
            />
            <input type="hidden" name="supplier" value={terminalName} />
            <input type="hidden" name="currency" value="1" />
            <input type="hidden" name="cred_type" value="1" />
            <input type="hidden" name="tranmode" value="A" />
            {handshakeMode === 'handshake' && handshakeToken && (
              <>
                <input type="hidden" name="new_process" value="1" />
                <input type="hidden" name="thtk" value={handshakeToken} />
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
            {/* Google Pay - enabled only when terminal supports it */}
            {googlePayEnabled && <input type="hidden" name="google_pay" value="1" />}
            {/* Apple Pay - enabled only when terminal supports it */}
            {applePayEnabled && <input type="hidden" name="apple_pay" value="1" />}
            {handshakeDetails?.response?.index && (
              <input
                type="hidden"
                name="index"
                value={handshakeDetails.response.index}
              />
            )}
          </form>

          {/* Amount banner - always visible, especially for Google Pay where Tranzila may not show it */}
          <div className="mb-3 py-2 px-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-lg font-bold text-amber-900">סכום לתשלום: {amount} ₪</p>
            <p className="text-sm text-amber-700">{planName}</p>
          </div>
          {/* Iframe container - no border/padding on mobile to maximize space */}
          <div className="relative bg-gray-50 sm:rounded-lg sm:border-2 sm:border-gray-200 flex-1 min-h-0 sm:flex-none sm:h-[600px]">
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
              onLoad={() => setTimeout(() => setIsIframeLoading(false), 500)}
              allow="payment *"
              allowPaymentRequest
            />
          </div>

          {/* Payment methods info - hidden on mobile to maximize iframe space */}
          <div className="hidden sm:block mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 flex-shrink-0">
            <p className="text-center font-semibold text-gray-800 mb-3">אפשרויות תשלום זמינות:</p>
            <div className="flex flex-wrap justify-center gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💳</span>
                <span className="text-sm text-gray-700">כרטיס אשראי</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                <span className="text-sm text-gray-700">Bit</span>
              </div>
              {googlePayEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">🟢</span>
                <span className="text-sm text-gray-700">Google Pay</span>
                {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
                  <span className="text-xs text-amber-600 mr-1">(זמין רק ב-HTTPS)</span>
                )}
              </div>
              )}
              {applePayEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">&#63743;</span>
                <span className="text-sm text-gray-700">Apple Pay</span>
              </div>
              )}
            </div>
            {googlePayEnabled &&
             typeof window !== 'undefined' && window.location.protocol === 'http:' && (
              <p className="text-center text-xs text-amber-600 mt-2">
                ⚠️ Google Pay זמין רק באתרים מאובטחים (HTTPS). באתר ייצור Google Pay יופיע אוטומטית.
              </p>
            )}
          </div>

          {/* Additional info - hidden on mobile */}
          <div className="hidden sm:block mt-4 text-center text-sm text-gray-600 flex-shrink-0">
            <p>💳 מקבלים את כל סוגי כרטיסי האשראי</p>
            <p className="mt-1">🔐 אבטחה מלאה בתקן PCI-DSS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
