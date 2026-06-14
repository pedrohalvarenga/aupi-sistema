import type { Metadata, Viewport } from 'next'
import './globals.css'
import MetaPixel from '@/components/MetaPixel'
import { GoogleAnalytics } from '@next/third-parties/google'

export const metadata: Metadata = {
  title: 'Aupipet — Gestão Pet',
  description: 'Plataforma de gestão para creches, hotéis e banho & tosa',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aupipet',
  },
}

export const viewport: Viewport = {
  themeColor: '#D98232',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <MetaPixel />
        {children}
        <GoogleAnalytics gaId="G-ZEZ87VEE12" />
      </body>
    </html>
  )
}
