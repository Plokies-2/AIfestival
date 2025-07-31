import { NextApiRequest, NextApiResponse } from 'next';
import { SPEEDTRAFFIC_QA_PROMPT, formatSpeedTrafficDataForAI } from '@/lib/ai-chat/speedtraffic-prompts';
import { OPENAI_CONFIG, ENV_CONFIG } from '@/lib/ai-chat/config';

// SpeedTraffic 분석 결과 기반 질문 답변 API

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, analysisData } = req.body;

    console.log('🔍 [SIMPLE_AI_CHAT] 받은 데이터:', { 
      message: message?.substring(0, 100) + '...',
      hasAnalysisData: !!analysisData 
    });

    // 필수 필드 검증
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 분석 데이터가 있으면 포맷팅, 없으면 기본 메시지
    let contextData = '';
    if (analysisData && analysisData.symbol) {
      contextData = formatSpeedTrafficDataForAI(analysisData);
      console.log('📊 [SIMPLE_AI_CHAT] 분석 데이터 포함:', analysisData.symbol);
    } else {
      contextData = '현재 분석된 SpeedTraffic 데이터가 없습니다. SpeedTraffic 분석 방법론에 대한 일반적인 설명을 제공하겠습니다.';
      console.log('⚠️ [SIMPLE_AI_CHAT] 분석 데이터 없음 - 일반 답변 모드');
    }

    // AI 질문 답변 생성
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
            content: SPEEDTRAFFIC_QA_PROMPT
          },
          {
            role: 'user',
            content: `분석 데이터:\n${contextData}\n\n사용자 질문: ${message}`
          }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens.investmentAnalysis,
        temperature: OPENAI_CONFIG.temperature.investmentAnalysis,
        stream: false
      })
    });

    if (!aiResponse.ok) {
      console.error('🚨 [SIMPLE_AI_CHAT] AI API 오류:', aiResponse.status, aiResponse.statusText);
      throw new Error(`AI API 호출 실패: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    
    if (!aiResult.choices || !aiResult.choices[0] || !aiResult.choices[0].message) {
      console.error('🚨 [SIMPLE_AI_CHAT] AI 응답 형식 오류:', aiResult);
      throw new Error('AI 응답 형식이 올바르지 않습니다');
    }

    const response = aiResult.choices[0].message.content?.trim();

    if (!response) {
      throw new Error('AI 응답 생성 실패');
    }

    console.log('✅ [SIMPLE_AI_CHAT] 답변 생성 완료');

    res.json({
      success: true,
      response: response
    });

  } catch (error) {
    console.error('🚨 [SIMPLE_AI_CHAT] 오류:', error);
    
    res.status(500).json({
      success: false,
      error: 'AI 답변 생성 중 오류가 발생했습니다',
      response: '죄송합니다. 현재 답변을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.'
    });
  }
}
