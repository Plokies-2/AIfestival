import { NextApiRequest, NextApiResponse } from 'next';
import { getServerStatus, isServerRestarted, shouldClearPortfolios } from '../../lib/server-session';

/**
 * 서버 상태 확인 API
 * 클라이언트가 서버 재시작 여부를 확인할 수 있도록 함
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lastKnownStartTime } = req.query;
    const clientLastKnownStartTime = lastKnownStartTime ? parseInt(lastKnownStartTime as string) : undefined;
    
    const serverStatus = getServerStatus();
    const restarted = isServerRestarted(clientLastKnownStartTime);

    res.status(200).json({
      ...serverStatus,
      restarted,
      shouldClearPortfolios: shouldClearPortfolios() // 서버 시작 후 첫 번째 요청에서만 true
    });
  } catch (error) {
    console.error('❌ [Server Status] API 오류:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
