import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setSent(true);
        setName('');
        setEmail('');
        setMessage('');
        setTimeout(() => setSent(false), 5000);
      } else {
        alert('שליחת ההודעה נכשלה');
      }
    } catch {
      alert('שגיאה בשליחה');
    }
  };

  return (
    <>
    <main className="container mx-auto p-6 rtl text-right max-w-xl relative">
      <h1 className="text-3xl font-bold mb-6">צור קשר</h1>
      <form onSubmit={handleSubmit} className="relative space-y-4 bg-[#FFF9E8] border-2 border-primary rounded-lg p-6 shadow-sm">
        <Link href="/" className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700" aria-label="סגור">&times;</Link>
        <div>
          <label className="block font-bold mb-1">שם מלא</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full border border-primary rounded-md p-2" />
        </div>
        <div>
          <label className="block font-bold mb-1">אימייל</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-primary rounded-md p-2" />
        </div>
        <div>
          <label className="block font-bold mb-1">הודעה</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required className="w-full border border-primary rounded-md p-2" />
        </div>
        <button type="submit" className="bg-primary text-white rounded-full px-6 py-2 hover:bg-primary/90">שלח</button>
      </form>
    </main>

    {sent && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
        <div className="bg-white rounded-lg p-6 text-center w-80">
          <p className="text-xl font-bold text-green-700 mb-6">ההודעה נשלחה בהצלחה!</p>
          <button onClick={()=>setSent(false)} className="bg-primary text-white rounded-full px-6 py-2">סגור</button>
        </div>
      </div>
    )}
    </>
  );
}
