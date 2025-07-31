import { NextApiRequest, NextApiResponse } from 'next';

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

/**
 * Python 백테스팅을 실행하여 실제 포트폴리오 백테스팅 수행
 * 로컬 개발: child_process 사용
 * Vercel 배포: HTTP 요청 사용
 */
async function executePythonBacktest(portfolio: Portfolio, period: '3M' | '6M' | '1Y'): Promise<BacktestResult> {
  console.log(`[BACKTEST] Python 백테스팅 시작: ${portfolio.name} - ${period}`);

  // 기간별 일수 계산
  const periodDays = {
    '3M': 90,
    '6M': 180,
    '1Y': 365
  };

  const days = periodDays[period];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  // 한국 주식 티커에 .KS 추가 (6자리 패딩)
  const tickers = portfolio.companies.map(company => {
    const ticker = company.ticker.toString().padStart(6, '0'); // 6자리로 패딩
    return `${ticker}.KS`;
  });

  console.log(`📊 [Backtest] 분석 대상: ${tickers.join(', ')}`);
  console.log(`📅 [Backtest] 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);

  // Python 스크립트 실행을 위한 데이터 준비
  const backtestData = {
    tickers,
    weights: portfolio.companies.map(company => company.weight),
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    period
  };

  // Vercel 환경 감지
  const isVercel = process.env.VERCEL || process.env.VERCEL_URL;

  if (isVercel) {
    // Vercel 환경: Python 서버리스 함수 직접 호출
    try {
      // Vercel에서는 절대 URL이 필요함
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

      const response = await fetch(`${baseUrl}/api/python/backtest_vercel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Backtest-API/1.0'
        },
        body: JSON.stringify(backtestData),
        signal: AbortSignal.timeout(60000) // 60초 타임아웃
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [BACKTEST] Python API 응답 오류: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Python API 호출 실패: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success || result.error) {
        throw new Error(`Python 백테스팅 오류: ${result.error}`);
      }

      const pythonResult = result.data;

      // Python의 snake_case를 JavaScript의 camelCase로 변환
      const backtestResult: BacktestResult = {
        period: pythonResult.period,
        totalReturn: pythonResult.total_return,
        annualizedReturn: pythonResult.annualized_return,
        volatility: pythonResult.volatility,
        sharpeRatio: pythonResult.sharpe_ratio,
        maxDrawdown: pythonResult.max_drawdown,
        dailyReturns: pythonResult.dailyReturns
      };

      console.log(`✅ [BACKTEST] Python 백테스팅 완료 (Vercel): ${portfolio.name} - 총수익률: ${backtestResult.totalReturn}%`);
      return backtestResult;

    } catch (error) {
      console.error(`❌ [BACKTEST] Vercel Python 백테스팅 실패:`, error);
      throw error;
    }
  } else {
    // 로컬 개발 환경: child_process 사용
    return new Promise((resolve, reject) => {
      try {
        const { spawn } = require('child_process');
        const path = require('path');

        const pythonScript = path.join(process.cwd(), 'api', 'python', 'backtest.py');

        const python = spawn('python', [pythonScript], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        python.stdin.write(JSON.stringify(backtestData));
        python.stdin.end();

        let output = '';
        let errorOutput = '';

        python.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        python.stderr.on('data', (data: Buffer) => {
          const errorText = data.toString();
          errorOutput += errorText;
          console.log(`🐍 [Python Debug]:`, errorText.trim());
        });

        python.on('close', (code: number) => {
          console.log(`🐍 [Python] 프로세스 종료 (코드: ${code})`);

          if (code !== 0) {
            console.error(`❌ [Backtest] Python 스크립트 실행 실패 (코드: ${code})`);
            console.error(`❌ [Backtest] 에러 출력:`, errorOutput);
            reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
            return;
          }

          try {
            const pythonResult = JSON.parse(output);

            // Python의 snake_case를 JavaScript의 camelCase로 변환
            const result: BacktestResult = {
              period: pythonResult.period,
              totalReturn: pythonResult.total_return,
              annualizedReturn: pythonResult.annualized_return,
              volatility: pythonResult.volatility,
              sharpeRatio: pythonResult.sharpe_ratio,
              maxDrawdown: pythonResult.max_drawdown,
              dailyReturns: pythonResult.dailyReturns
            };

            console.log(`✅ [BACKTEST] Python 백테스팅 완료 (로컬): ${portfolio.name} - 총수익률: ${result.totalReturn}%`);
            resolve(result);
          } catch (parseError) {
            console.error(`❌ [Backtest] 결과 파싱 실패:`, parseError);
            console.error(`❌ [Backtest] 원본 출력:`, output);
            reject(new Error(`Failed to parse Python output: ${parseError}`));
          }
        });

        python.on('error', (error: Error) => {
          console.error(`❌ [Backtest] Python 프로세스 에러:`, error);
          reject(error);
        });

      } catch (error) {
        console.error(`❌ [BACKTEST] 로컬 Python 백테스팅 실패:`, error);
        reject(error);
      }
    });
  }
}

/**
 * 백테스팅 API 엔드포인트
 * yfinance를 사용하여 실제 주가 데이터로 백테스팅 수행
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { portfolio, period }: { portfolio: Portfolio; period: '3M' | '6M' | '1Y' } = req.body;

    if (!portfolio || !period) {
      return res.status(400).json({ error: 'Portfolio and period are required' });
    }

    // 백테스팅 실행
    const result = await executePythonBacktest(portfolio, period);

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ [Backtest] 백테스팅 실패:', error);
    res.status(500).json({
      error: 'Backtesting failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
