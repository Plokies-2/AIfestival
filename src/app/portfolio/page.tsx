'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useServerStatus } from '@/hooks/useServerStatus';

interface Portfolio {
  id: string;
  name: string;
  strategy: 'traditional' | 'creative';
  companies: Array<{
    ticker: string;
    name: string;
    weight: number; // 투자 비중 (만원 단위)
  }>;
  createdAt: string;
  industry: string;
  refinedQuery?: string;
  groupId?: string;
}

interface PortfolioGroup {
  groupId: string;
  name: string;
  traditional?: Portfolio;
  creative?: Portfolio;
  createdAt: string;
}

interface BacktestResult {
  period: '3M' | '6M' | '1Y';
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  dailyReturns: Array<{
    date: string;
    value: number;
  }>;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioGroups, setPortfolioGroups] = useState<PortfolioGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'3M' | '6M' | '1Y'>('6M');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  // 서버 재시작 감지 및 포트폴리오 자동 삭제
  useServerStatus({
    onServerRestart: () => {
      console.log('🔄 [Portfolio Page] 서버 재시작으로 인한 포트폴리오 삭제, 페이지 새로고침');
      setPortfolios([]);
      setPortfolioGroups([]);
      loadPortfolios(); // 새로고침
    }
  });

  // 포트폴리오 로드
  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = () => {
    const savedPortfolios = localStorage.getItem('ai_portfolios');
    if (savedPortfolios) {
      const portfolioList = JSON.parse(savedPortfolios);
      setPortfolios(portfolioList);

      // 포트폴리오를 그룹으로 묶기 (groupId 기준)
      const groups: { [key: string]: PortfolioGroup } = {};

      portfolioList.forEach((portfolio: Portfolio) => {
        const groupKey = portfolio.groupId || portfolio.name; // groupId가 없으면 name으로 fallback
        if (!groups[groupKey]) {
          groups[groupKey] = {
            groupId: groupKey,
            name: portfolio.name,
            createdAt: portfolio.createdAt
          };
        }

        if (portfolio.strategy === 'traditional') {
          groups[groupKey].traditional = portfolio;
        } else {
          groups[groupKey].creative = portfolio;
        }
      });

      setPortfolioGroups(Object.values(groups));
    }
  };

  const handleBacktest = async (portfolio: Portfolio, period: '3M' | '6M' | '1Y') => {
    setIsLoading(true);
    setIsAnimating(false);
    setBacktestResults(null);

    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolio,
          period
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setBacktestResults(result);

        // 애니메이션 시작
        setTimeout(() => {
          setIsAnimating(true);
        }, 100);
      } else {
        const errorData = await response.json();
        console.error('백테스팅 실패:', errorData);
        alert('백테스팅에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('백테스팅 실패:', error);
      alert('백테스팅에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupClick = (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      setSelectedPortfolio(null);
      setBacktestResults(null);
    } else {
      setExpandedGroup(groupId);
      setSelectedPortfolio(null);
      setBacktestResults(null);
    }
  };

  const handleStrategySelect = (portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
    setBacktestResults(null);
    setIsAnimating(false);
  };

  const updatePortfolioWeight = (portfolioId: string, ticker: string, newWeight: number) => {
    const updatedPortfolios = portfolios.map(portfolio => {
      if (portfolio.id === portfolioId) {
        return {
          ...portfolio,
          companies: portfolio.companies.map(company => 
            company.ticker === ticker 
              ? { ...company, weight: newWeight }
              : company
          )
        };
      }
      return portfolio;
    });
    
    setPortfolios(updatedPortfolios);
    localStorage.setItem('ai_portfolios', JSON.stringify(updatedPortfolios));
    
    // 선택된 포트폴리오도 업데이트
    if (selectedPortfolio?.id === portfolioId) {
      setSelectedPortfolio(updatedPortfolios.find(p => p.id === portfolioId) || null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount * 10000); // 만원 단위를 원 단위로 변환
  };

  const formatPercentage = (value: number) => {
    if (isNaN(value) || value === null || value === undefined) {
      return '0.00%';
    }
    return `${(value * 100).toFixed(2)}%`;
  };

  const getMetricTooltip = (metric: string) => {
    const tooltips: { [key: string]: string } = {
      volatility: '변동성은 투자 수익률의 불확실성을 나타내는 지표입니다. 높을수록 가격 변동이 크고 위험이 높습니다.',
      sharpeRatio: '샤프 비율은 위험 대비 수익률을 측정하는 지표입니다. 높을수록 위험 대비 좋은 수익을 의미합니다.',
      maxDrawdown: '최대 낙폭은 투자 기간 중 최고점에서 최저점까지의 최대 하락률을 나타냅니다.'
    };
    return tooltips[metric] || '';
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* 헤더 */}
      <header className="relative bg-white border-b border-slate-200 shadow-sm">
        <div className="absolute inset-0 gradient-bg opacity-5"></div>
        <div className="relative px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">돌아가기</span>
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <h1 className="text-xl font-bold text-slate-900">포트폴리오 백테스팅</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">실시간</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 p-4 gap-4 min-h-0">
        {/* 좌측: 포트폴리오 목록 */}
        <section className="w-1/3 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">내 포트폴리오</h2>
            <p className="text-sm text-slate-600 mt-1">AI가 추천한 포트폴리오 목록</p>
          </div>

          <div className="overflow-y-auto h-full">
            {portfolioGroups.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">포트폴리오가 없습니다</h3>
                <p className="text-slate-600 mb-4">메인 페이지에서 AI 분석을 받아 포트폴리오를 생성해보세요.</p>
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
                >
                  AI 분석 받기
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {portfolioGroups.map((group) => (
                  <div key={group.name} className="space-y-2">
                    {/* 그룹 헤더 */}
                    <div
                      onClick={() => handleGroupClick(group.groupId)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        expandedGroup === group.groupId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-slate-900">{group.name}</h3>
                          <p className="text-xs text-slate-600 mt-1">
                            {new Date(group.createdAt).toLocaleDateString()} •
                            {group.traditional && group.creative ? ' 2개 전략' : ' 1개 전략'}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            expandedGroup === group.groupId ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* 확장된 전략 목록 */}
                    {expandedGroup === group.groupId && (
                      <div className="ml-4 space-y-2">
                        {group.traditional && (
                          <div
                            onClick={() => handleStrategySelect(group.traditional!)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPortfolio?.id === group.traditional.id
                                ? 'border-green-500 bg-green-50 shadow-md'
                                : 'border-slate-200 hover:border-green-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-900">정통한 전략</div>
                                <div className="text-xs text-slate-600">
                                  {group.traditional.companies.length}개 종목
                                </div>
                              </div>
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                정통한
                              </span>
                            </div>
                          </div>
                        )}
                        {group.creative && (
                          <div
                            onClick={() => handleStrategySelect(group.creative!)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPortfolio?.id === group.creative.id
                                ? 'border-purple-500 bg-purple-50 shadow-md'
                                : 'border-slate-200 hover:border-purple-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-900">창의적 전략</div>
                                <div className="text-xs text-slate-600">
                                  {group.creative.companies.length}개 종목
                                </div>
                              </div>
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                창의적
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 우측: 차트 및 상세 정보 */}
        <section className="flex-1 space-y-4 overflow-y-auto">
          {/* 수익률 차트 (항상 표시) */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {backtestResults ? `포트폴리오 수익률 추이 (${backtestResults.period})` : '포트폴리오 수익률 추이'}
            </h3>
            <div className="h-80">
              {backtestResults ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={backtestResults.dailyReturns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: number) => [
                        `${value.toFixed(2)}%`,
                        '수익률'
                      ]}
                      labelFormatter={(label) => {
                        const date = new Date(label);
                        return date.toLocaleDateString('ko-KR');
                      }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#64748b"
                      strokeWidth={2}
                      strokeDasharray="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="returnRate"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#3b82f6' }}
                      className={isAnimating ? 'animate-draw-line' : ''}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-lg font-medium">포트폴리오를 선택하고 백테스팅을 실행하세요</p>
                    <p className="text-sm mt-1">수익률 곡선이 여기에 표시됩니다</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 성과 지표 */}
          {backtestResults && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">백테스팅 결과 ({backtestResults.period})</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${(backtestResults.totalReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(backtestResults.totalReturn)}
                  </div>
                  <div className="text-sm text-slate-600">총 수익률</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${(backtestResults.annualizedReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(backtestResults.annualizedReturn)}
                  </div>
                  <div className="text-sm text-slate-600">연환산 수익률</div>
                </div>
                <div
                  className="text-center p-4 bg-slate-50 rounded-lg relative cursor-help"
                  onMouseEnter={() => setHoveredMetric('volatility')}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="text-2xl font-bold text-slate-900">{formatPercentage(backtestResults.volatility)}</div>
                  <div className="text-sm text-slate-600">변동성</div>
                  {hoveredMetric === 'volatility' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 w-64">
                      {getMetricTooltip('volatility')}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )}
                </div>
                <div
                  className="text-center p-4 bg-slate-50 rounded-lg relative cursor-help"
                  onMouseEnter={() => setHoveredMetric('sharpeRatio')}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className={`text-2xl font-bold ${(backtestResults.sharpeRatio || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(backtestResults.sharpeRatio || 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-slate-600">샤프 비율</div>
                  {hoveredMetric === 'sharpeRatio' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 w-64">
                      {getMetricTooltip('sharpeRatio')}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )}
                </div>
                <div
                  className="text-center p-4 bg-slate-50 rounded-lg relative cursor-help"
                  onMouseEnter={() => setHoveredMetric('maxDrawdown')}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="text-2xl font-bold text-red-600">{formatPercentage(backtestResults.maxDrawdown)}</div>
                  <div className="text-sm text-slate-600">최대 낙폭</div>
                  {hoveredMetric === 'maxDrawdown' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 w-64">
                      {getMetricTooltip('maxDrawdown')}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 포트폴리오 상세 및 백테스팅 */}
          {selectedPortfolio ? (
            <>
              {/* 백테스팅 컨트롤 */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">백테스팅</h3>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex space-x-2">
                    {(['3M', '6M', '1Y'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                          selectedPeriod === period
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleBacktest(selectedPortfolio, selectedPeriod)}
                    disabled={isLoading}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white rounded-lg transition-colors duration-200 font-medium"
                  >
                    {isLoading ? '분석 중...' : '백테스팅 실행'}
                  </button>
                </div>
              </div>

              {/* 종목 구성 및 비중 조정 */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">종목 구성 및 비중 조정</h3>
                <div className="space-y-3">
                  {selectedPortfolio.companies.map((company) => (
                    <div key={company.ticker} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{company.name}</div>
                        <div className="text-sm text-slate-600">{company.ticker}</div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="font-medium text-slate-900">{formatCurrency(company.weight)}</div>
                          <div className="text-sm text-slate-600">
                            {((company.weight / selectedPortfolio.companies.reduce((sum, c) => sum + c.weight, 0)) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <input
                          type="number"
                          value={company.weight}
                          onChange={(e) => updatePortfolioWeight(selectedPortfolio.id, company.ticker, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="100"
                        />
                        <span className="text-sm text-slate-600">만원</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900">총 투자금액</span>
                      <span className="font-bold text-lg text-slate-900">
                        {formatCurrency(selectedPortfolio.companies.reduce((sum, c) => sum + c.weight, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">포트폴리오를 선택하세요</h3>
              <p className="text-slate-600">좌측에서 포트폴리오를 선택하면 상세 정보와 백테스팅을 진행할 수 있습니다.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
