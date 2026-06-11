import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000, options = {}) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, position: options.position || 'bottom-left' }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const renderToasts = (items) => (
    <>
      {items.map(toast => (
          <div
            key={toast.id}
            className={`
              px-6 py-4 rounded-lg shadow-lg text-white text-right max-w-md
              transform transition-all duration-300 ease-out
              ${toast.type === 'success' ? 'bg-green-600' : ''}
              ${toast.type === 'error' ? 'bg-red-600' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-500' : ''}
              ${toast.type === 'info' ? 'bg-blue-600' : ''}
            `}
          >
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => removeToast(toast.id)}
                className="text-white/80 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
              <span className="flex-1">{toast.message}</span>
              <span className="text-2xl">
                {toast.type === 'success' && '✓'}
                {toast.type === 'error' && '✗'}
                {toast.type === 'warning' && '⚠'}
                {toast.type === 'info' && 'ℹ'}
              </span>
            </div>
          </div>
      ))}
    </>
  );

  const bottomLeftToasts = toasts.filter(toast => toast.position !== 'center-high');
  const centerHighToasts = toasts.filter(toast => toast.position === 'center-high');

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2">
        {renderToasts(bottomLeftToasts)}
      </div>
      <div className="fixed top-24 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
        {renderToasts(centerHighToasts)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
