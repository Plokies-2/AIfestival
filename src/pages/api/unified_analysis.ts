import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

/**
 * 실제 금융 분석 결과 인터페이스
 * Python 스크립트에서 계산된 실제 값만 반환
 */
interface AnalysisResult {
  symbol: string;
  date: string;
  traffic_light: string;
  signal: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Python 분석을 실행하여 실제 재무 분석 수행
 * 로컬 개발: child_process 사용
 * Vercel 배포: HTTP 요청 사용
 */
export async function executePythonAnalysis(symbol: string, analysisType: string): Promise<AnalysisResult> {
  console.log(`[UNIFIED_ANALYSIS] Python 분석 시작: ${symbol} - ${analysisType}`);

  // Vercel 환경 감지
  const isVercel = process.env.VERCEL || process.env.VERCEL_URL;

  if (isVercel) {
    // Vercel 환경: Python 서버리스 함수 직접 호출
    try {
      // Vercel에서는 절대 URL이 필요함
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

      // GET 요청으로 변경 (unified_analysis.py가 GET을 처리함)
      const queryParams = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        type: analysisType.toLowerCase()
      });

      const response = await fetch(`${baseUrl}/api/python/unified_analysis?${queryParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SpeedTraffic-API/1.0'
        },
        signal: AbortSignal.timeout(45000) // 45초로 증가
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [UNIFIED_ANALYSIS] Python API 응답 오류: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Python API 호출 실패: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Python 분석 오류: ${result.error}`);
      }

      console.log(`✅ [UNIFIED_ANALYSIS] Python 분석 완료 (Vercel): ${symbol} - 신호등: ${result.traffic_light}`);
      return result;

    } catch (error) {
      console.error(`❌ [UNIFIED_ANALYSIS] Vercel Python 분석 실패:`, error);
      throw error;
    }
  } else {
    // 로컬 개발 환경: child_process 사용
    return new Promise((resolve, reject) => {
      try {
        const pythonScript = path.join(process.cwd(), 'api', 'python', 'unified_analysis.py');

        const python = spawn('python', [pythonScript], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const inputData = {
          symbol: symbol.toUpperCase(),
          analysis_type: analysisType.toLowerCase()
        };

        python.stdin.write(JSON.stringify(inputData));
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
          if (code !== 0) {
            console.error(`❌ [UNIFIED_ANALYSIS] Python 스크립트 실행 실패 (코드: ${code})`);
            reject(new Error(`Python 분석 실패: ${errorOutput || '알 수 없는 오류'}`));
            return;
          }

          try {
            const result = JSON.parse(output);
            console.log(`✅ [UNIFIED_ANALYSIS] Python 분석 완료 (로컬): ${symbol} - 신호등: ${result.traffic_light}`);
            resolve(result);
          } catch (parseError) {
            console.error(`❌ [UNIFIED_ANALYSIS] 결과 파싱 실패:`, parseError);
            reject(new Error(`Python 결과 파싱 실패: ${parseError}`));
          }
        });

        python.on('error', (error: Error) => {
          console.error(`❌ [UNIFIED_ANALYSIS] Python 프로세스 에러:`, error);
          reject(error);
        });

      } catch (error) {
        console.error(`❌ [UNIFIED_ANALYSIS] 로컬 Python 분석 실패:`, error);
        reject(error);
      }
    });
  }
}

/**
 * 통합 분석 API 엔드포인트
 * 모든 분석은 Python 스크립트를 통해 실제 데이터로만 수행
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, type } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'Type parameter is required' });
  }

  // 지원되는 분석 타입 검증
  const supportedTypes = ['mfi', 'rsi', 'bollinger', 'capm', 'garch', 'industry', 'speedtraffic'];
  if (!supportedTypes.includes(type.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported analysis type: ${type}. Supported types: ${supportedTypes.join(', ')}`
    });
  }

  try {
    console.log(`[UNIFIED_ANALYSIS] ${type.toUpperCase()} 분석 요청: ${symbol}`);

    // Python 스크립트를 직접 실행하여 실제 분석 수행
    const result = await executePythonAnalysis(symbol, type);

    console.log(`[UNIFIED_ANALYSIS] ${type.toUpperCase()} 분석 완료: ${symbol} - 신호등: ${result.traffic_light}`);
    return res.status(200).json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error(`[UNIFIED_ANALYSIS] ${type.toUpperCase()} 분석 실패 ${symbol}:`, errorMessage);

    // 실제 데이터 분석 실패 시 더미 데이터 반환 금지
    // 오류 상황을 명확히 전달
    return res.status(500).json({
      error: `실제 ${type.toUpperCase()} 분석 실패: ${errorMessage}`,
      symbol,
      type,
      timestamp: new Date().toISOString()
    });
  }
}
