'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FinancialChart from '@/components/FinancialChart';
import SpeedTraffic from '@/components/SpeedTraffic';
import { getCompanyName } from '@/utils/companyLookup';

export default function SpeedTrafficPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSymbol, setCurrentSymbol] = useState<string | undefined>(undefined);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);

  useEffect(() => {
    if (!searchParams) return;

    const symbol = searchParams.get('symbol');
    if (symbol) {
      setCurrentSymbol(symbol);
    }
  }, [searchParams]);

  const handlePhaseMessage = (message: string, hasReportButton?: boolean) => {
    setPhaseMessage(message);
    if (hasReportButton) {
      setIsAnalysisComplete(true);
    }
  };

  const handleAnalysisComplete = (results: any) => {
    setAnalysisData(results);
    setIsAnalysisComplete(true);
  };

  const handleNewAnalysis = () => {
    setCurrentSymbol(undefined);
    setAnalysisData(null);
    setPhaseMessage('');
    setIsAnalysisComplete(false);
  };

  const handleSymbolSubmit = (symbol: string) => {
    setCurrentSymbol(symbol);
    setAnalysisData(null);
    setPhaseMessage('');
    setIsAnalysisComplete(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">메인으로</span>
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <h1 className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text">
                SpeedTraffic 분석
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleNewAnalysis}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
              >
                새 분석
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600">실시간</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentSymbol ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">SpeedTraffic 분석</h2>
                <p className="text-slate-600">분석할 종목의 티커를 입력하세요</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const symbol = formData.get('symbol') as string;
                if (symbol?.trim()) {
                  handleSymbolSubmit(symbol.trim().toUpperCase());
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="symbol" className="block text-sm font-medium text-slate-700 mb-2">
                      종목 티커
                    </label>
                    <input
                      type="text"
                      id="symbol"
                      name="symbol"
                      placeholder="예: 005930 (삼성전자)"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  >
                    분석 시작
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {getCompanyName(currentSymbol)}
                    </h2>
                    <p className="text-lg text-slate-600 font-mono">{currentSymbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">실시간 분석 중</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-900">주가 차트</h3>
                    <p className="text-sm text-slate-600">3년간 일봉 데이터</p>
                  </div>
                  <div className="h-96 lg:h-[500px]">
                    <FinancialChart symbol={currentSymbol} />
                  </div>
                </div>
              </div>

              <div className="xl:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-900">투자 신호등</h3>
                    <p className="text-sm text-slate-600">5단계 분석 결과</p>
                  </div>
                  <div className="p-4">
                    <SpeedTraffic
                      symbol={currentSymbol}
                      onPhaseMessage={handlePhaseMessage}
                      onAnalysisComplete={handleAnalysisComplete}
                    />
                  </div>
                </div>
              </div>
            </div>

            {phaseMessage && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isAnalysisComplete
                      ? 'bg-green-500'
                      : 'bg-blue-500 animate-pulse'
                  }`}>
                    {isAnalysisComplete ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${
                      isAnalysisComplete ? 'text-green-800' : 'text-blue-800'
                    }`}>
                      {isAnalysisComplete ? '분석 완료' : '분석 진행 중'}
                    </h4>
                    <p className={`text-sm ${
                      isAnalysisComplete ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {phaseMessage}
                    </p>
                  </div>
                  {isAnalysisComplete && (
                    <button
                      onClick={handleNewAnalysis}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                    >
                      새 분석
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
