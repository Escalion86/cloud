import '../styles/globals.css'
import { useEffect } from 'react'
import Head from 'next/head'

const App = ({ Component, pageProps }) => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore registration errors to avoid breaking app bootstrap
    })
  }, [])

  return (
    <>
      <Head>
        <meta name="application-name" content="Cloud" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Cloud" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ea580c" />
        <meta name="description" content="Приватное хранилище фотографий и файлов" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/launchericon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/launchericon-192x192.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default App
