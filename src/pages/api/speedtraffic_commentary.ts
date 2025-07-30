import { NextApiRequest, NextApiResponse } from 'next';
import { SPEEDTRAFFIC_ANALYSIS_PROMPT, formatSpeedTrafficDataForAI } from '@/lib/ai-chat/speedtraffic-prompts';
import { OPENAI_CONFIG, ENV_CONFIG } from '@/lib/ai-chat/config';

// SpeedTraffic 분석 결과에 대한 AI 해설을 생성하는 API

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const analysisData = req.body;

    console.log('🔍 [SPEEDTRAFFIC_COMMENTARY] 받은 데이터:', JSON.stringify(analysisData, null, 2));

    // 필수 필드 검증
    if (!analysisData.symbol || !analysisData.traffic_lights) {
      return res.status(400).json({ error: 'Symbol and traffic_lights are required' });
    }

    // AI용 데이터 포맷팅
    const formattedData = formatSpeedTrafficDataForAI(analysisData);

    console.log('🔍 [SPEEDTRAFFIC_COMMENTARY] 포맷된 데이터:', formattedData);

    // OpenAI 호환 API를 통한 hcx-dash-002 모델 호출
    const aiResponse = await fetch(OPENAI_CONFIG.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV_CONFIG.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model, // hcx-dash-002
        messages: [
          {
            role: 'system',
            content: SPEEDTRAFFIC_ANALYSIS_PROMPT
          },
          {
            role: 'user',
            content: formattedData
          }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens.investmentAnalysis,
        temperature: OPENAI_CONFIG.temperature.investmentAnalysis,
        stream: false // 스트리밍 비활성화로 간단하게 처리
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API 호출 실패: ${aiResponse.status} ${aiResponse.statusText}`);
    }

    // JSON 응답 처리 (스트리밍 비활성화)
    const responseData = await aiResponse.json();

    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error('AI로부터 유효한 응답을 받지 못했습니다');
    }

    const fullResponse = responseData.choices[0].message?.content || '';

    if (!fullResponse.trim()) {
      throw new Error('AI로부터 유효한 응답을 받지 못했습니다');
    }

    // 로깅
    console.log(`🤖 [SPEEDTRAFFIC_AI] ${analysisData.symbol} 해설 생성 완료 (${fullResponse.length}자)`);

    return res.status(200).json({
      success: true,
      commentary: fullResponse.trim(),
      symbol: analysisData.symbol,
      companyName: analysisData.companyName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ SpeedTraffic AI 해설 생성 오류:', error);
    
    // 폴백 응답 (AI 호출 실패 시)
    const fallbackCommentary = `
## 📊 SpeedTraffic™ 분석 해설

### 🚦 투자 신호등 종합 판단
- **기술적 분석**: ${req.body.traffic_lights?.technical || 'inactive'} - 현재 기술적 지표 상태
- **업종 민감도**: ${req.body.traffic_lights?.industry || 'inactive'} - 업종 대비 민감도
- **시장 민감도**: ${req.body.traffic_lights?.market || 'inactive'} - 시장 대비 민감도
- **변동성 리스크**: ${req.body.traffic_lights?.risk || 'inactive'} - 변동성 위험도

### 💡 투자 방향성
현재 AI 해설 서비스에 일시적인 문제가 발생했습니다. 신호등 분석 결과를 참고하여 투자 결정을 내리시기 바랍니다.

### ⚠️ 투자 위험 고지
투자 결정은 본인의 판단과 책임하에 이루어져야 하며, 이 분석은 참고용으로만 활용하시기 바랍니다.
    `.trim();

    return res.status(200).json({
      success: true,
      commentary: fallbackCommentary,
      symbol: req.body.symbol || 'N/A',
      companyName: req.body.companyName || 'N/A',
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
}
