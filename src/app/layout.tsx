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
    icon: '/image.png',
    shortcut: '/image.png',
    apple: '/image.png',
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* 페이지 로드/새로고침 시 세션 정리 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 페이지 로드 시 세션 정리 트리거
              window.addEventListener('load', function() {
                try {
                  fetch('/api/ai_chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: '__RESET_SESSION__' })
                  }).then(() => {
                    console.log('✅ Session reset on page load');
                  }).catch((error) => {
                    console.warn('⚠️ Session reset failed on page load:', error);
                  });
                } catch (error) {
                  console.warn('Session cleanup on page load failed:', error);
                }
              });

              // 페이지 언로드 시 세션 정리 트리거
              window.addEventListener('beforeunload', function() {
                try {
                  // sendBeacon을 사용하여 페이지 언로드 시에도 요청 전송
                  navigator.sendBeacon('/api/ai_chat', JSON.stringify({ message: '__RESET_SESSION__' }));
                } catch (error) {
                  console.warn('Session cleanup on page unload failed:', error);
                }
              });
            `
          }}
        />
      </body>
    </html>
  )
}
