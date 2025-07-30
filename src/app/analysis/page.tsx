'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AIChat from '@/components/AIChat';
import RealTimeAnalysis from '@/components/RealTimeAnalysis';

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

        {/* 채팅 인터페이스와 실시간 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 채팅창 - 3/4 너비 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 300px)' }}>
              <AIChat
                ref={chatRef}
              />
            </div>
          </div>

          {/* 실시간 분석 - 1/4 너비 */}
          <div className="lg:col-span-1">
            <RealTimeAnalysis />
          </div>
        </div>
      </main>
    </div>
  );
}
