import { NextApiRequest, NextApiResponse } from 'next';
import { getAnalysisProgress } from '@/lib/ai-chat/session-manager';

/**
 * 분석 진행 상황 조회 API
 * 실시간 thinking box를 위한 polling 엔드포인트
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId = 'global-session' } = req.query;
    
    const progressData = getAnalysisProgress(sessionId as string);
    
    res.status(200).json({
      success: true,
      ...progressData
    });
  } catch (error) {
    console.error('❌ [Analysis Progress] API 오류:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false,
      isAnalyzing: false,
      progressHistory: []
    });
  }
}
