import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title:       'ช่างโปร — ระบบจัดการงานช่าง',
  description: 'ระบบจัดการช่าง ลงเวลา และคำนวณเงินเดือนครบวงจร',
  manifest:    '/manifest.json',
  appleWebApp: {
    capable: true,
    title:   'ช่างโปร',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor:    '#1e6fff',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
  viewportFit:   'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-screen">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
