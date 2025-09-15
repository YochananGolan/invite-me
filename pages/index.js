import Head from 'next/head';
import NavBar from '../components/NavBar';
import HeroSection from '../components/HeroSection';
import StepButtons from '../components/StepButtons';
import { useState } from 'react';
import { useEffect } from 'react';
import AuthModal from '../components/AuthModal';
import { useRef } from 'react';


export default function Home({ session }) {
  const [showAuth, setShowAuth] = useState(!session);
  const stepRef = useRef();

  useEffect(() => {
    setShowAuth(!session);
  }, [session]);
  // When no session, show Supabase AuthModal; otherwise render site normally.

  return (
    <>
      <Head>
        <title>InviteMe | הדרך המושלמת להזמין ולנהל אורחים</title>
        <meta name="description" content="Send stylish invitations and manage guests effortlessly" />
      </Head>
      <main>
        <NavBar />
        <HeroSection onStart={() => stepRef.current?.startFlow()} />
        <StepButtons ref={stepRef} />
      </main>
      {showAuth && <AuthModal />}
    </>
  );
}
