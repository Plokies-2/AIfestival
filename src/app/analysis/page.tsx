'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AIChat from '@/components/AIChat';

export default function AnalysisPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<any>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">메인</span>
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <h1 className="text-xl font-bold text-slate-900">AI 투자 분석</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/portfolio')}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
              >
                포트폴리오
              </button>
              <button
                onClick={() => router.push('/speedtraffic')}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
              >
                SpeedTraffic
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">실시간</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            AI 투자 분석 채팅
          </h2>
          <p className="text-lg text-slate-600 mb-2">
            자연어로 질문하면 AI가 맞춤형 투자 전략을 제안합니다
          </p>
          <p className="text-sm text-slate-500">
            의도 분석 → 뉴스 분석 → 포트폴리오 백테스팅까지 한 번에
          </p>
        </div>

        {/* 채팅 인터페이스 */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <AIChat
            ref={chatRef}
            onLoadingChange={setIsLoading}
          />
        </div>

        {/* 도움말 섹션 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">💡</span>
              </div>
              <h3 className="font-semibold text-slate-900">투자 아이디어</h3>
            </div>
            <p className="text-sm text-slate-600">
              "ESG 관련주에 투자하고 싶어요", "반도체 업종 전망이 궁금해요" 등 자유롭게 질문하세요.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <h3 className="font-semibold text-slate-900">뉴스 분석</h3>
            </div>
            <p className="text-sm text-slate-600">
              실시간 뉴스 데이터를 분석하여 시장 동향과 투자 기회를 찾아드립니다.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <h3 className="font-semibold text-slate-900">포트폴리오</h3>
            </div>
            <p className="text-sm text-slate-600">
              AI가 추천한 포트폴리오를 자동으로 저장하고 백테스팅을 진행할 수 있습니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
