import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html dir="rtl" lang="he">
      <Head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvgxmlns='http://www.w3.org/2000/svg'viewBox='0 0 100 100'%3E%3Ctexty='.9em'font-size='90'%3E✉️%3C/text%3E%3C/svg%3E"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Gloria+Hallelujah&family=M+PLUS+1p&family=Edu+NSW+ACT+Cursive:wght@400..700&family=Secular+One&family=Ojuju:wght@200..800&family=Macondo&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

