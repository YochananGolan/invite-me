import { useState } from 'react';

export default function LoginModal({ onClose }) {
  const [view, setView] = useState('sign_in');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl relative">
        <button
          className="absolute top-2 left-2 text-gray-600 hover:text-gray-900"
          onClick={onClose}
          aria-label="סגור טופס"
        >
          ✕
        </button>

        {/* Toggle Sign In / Sign Up */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setView('sign_in')}
            className={`px-4 py-2 w-1/2 border-b-2 ${view === 'sign_in' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500'}`}
          >
            כניסה
          </button>
          <button
            onClick={() => setView('sign_up')}
            className={`px-4 py-2 w-1/2 border-b-2 ${view === 'sign_up' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500'}`}
          >
            הרשמה
          </button>
        </div>

        {/* Forms */}
        {view === 'sign_in' ? (
          <form className="space-y-4">
            <div>
              <label className="block mb-1 font-medium" htmlFor="login-email">אימייל</label>
              <input
                id="login-email"
                type="email"
                placeholder="example@mail.com"
                className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium" htmlFor="login-password">סיסמה</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary text-white rounded-full py-2 font-medium hover:bg-primary/90 transition-colors"
            >
              כניסה
            </button>
          </form>
        ) : (
          <form className="space-y-4">
            <div>
              <label className="block mb-1 font-medium" htmlFor="signup-email">אימייל</label>
              <input
                id="signup-email"
                type="email"
                placeholder="example@mail.com"
                className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium" htmlFor="signup-password">סיסמה</label>
              <input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium" htmlFor="signup-password-confirm">אימות סיסמה</label>
              <input
                id="signup-password-confirm"
                type="password"
                placeholder="••••••••"
                className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary text-white rounded-full py-2 font-medium hover:bg-primary/90 transition-colors"
            >
              הרשמה
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
