import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: '사용자 맞춤 투자지원 AI',
  description: '한양대학교 금융인공지능실무 - 사용자 맞춤형 투자지원 AI 시스템',
  icons: {
    icon: '/hanyang-logo.png',
    shortcut: '/hanyang-logo.png',
    apple: '/hanyang-logo.png',
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
