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

    console.log(`🔍 [Backtest] 백테스팅 시작: ${portfolio.name} (${period})`);

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

    // Python 백테스팅 스크립트 실행
    const { spawn } = require('child_process');
    const path = require('path');

    const pythonScript = path.join(process.cwd(), 'src', 'services', 'backtest_service.py');
    
    const result = await new Promise<BacktestResult>((resolve, reject) => {
      const python = spawn('python', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 입력 데이터 전송
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
        console.log(`🐍 [Python] 표준 출력:`, output);
        console.log(`🐍 [Python] 에러 출력:`, errorOutput);

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

          console.log(`✅ [Backtest] 백테스팅 완료:`, result);
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
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ [Backtest] 백테스팅 실패:', error);
    res.status(500).json({ error: 'Backtesting failed', details: error.message });
  }
}

/**
 * 모의 일별 수익률 데이터 생성
 */
function generateMockDailyReturns(period: '3M' | '6M' | '1Y'): Array<{ date: string; value: number }> {
  const periodDays = {
    '3M': 90,
    '6M': 180,
    '1Y': 365
  };

  const days = periodDays[period];
  const dailyReturns = [];
  let cumulativeValue = 100; // 시작값 100

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // 랜덤 일별 수익률 (-3% ~ +3%)
    const dailyReturn = (Math.random() - 0.5) * 0.06;
    cumulativeValue *= (1 + dailyReturn);
    
    dailyReturns.push({
      date: date.toISOString().split('T')[0],
      value: cumulativeValue
    });
  }

  return dailyReturns;
}
