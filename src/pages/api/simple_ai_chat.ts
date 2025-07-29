import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = process.env.CLOVA_STUDIO_API_KEY ? new OpenAI({
  apiKey: process.env.CLOVA_STUDIO_API_KEY,  // Clova Studio API 키 사용
  baseURL: 'https://clovastudio.stream.ntruss.com/v1/openai'  // Clova Studio OpenAI 호환 엔드포인트
}) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`[SIMPLE_AI_CHAT] Processing message: ${message.substring(0, 100)}...`);

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI client not initialized - CLOVA_STUDIO_API_KEY is required' });
    }

    // Call the Clova Studio model
    const response = await openai.chat.completions.create({
      model: 'hcx-dash-002',  // Clova Studio 모델 사용
      messages: [
        {
          role: 'system',
          content: '당신은 SpeedTraffic™ 분석 결과를 해설하는 전문 투자 AI입니다. 각 분석의 실제 수치, 읽는 법, 그리고 불빛이 왜 그 색깔로 나왔는지에 대한 이유를 포함하여 상세하고 전문적인 해설을 제공해주세요. 이모티콘을 적절히 활용해 친근한 분위기를 유지하면서(최대 2개까지), 전문적인 어조로 답변하세요.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.8,
      max_tokens: 2048
    });

    const reply = response.choices[0].message.content?.trim();

    if (!reply) {
      throw new Error('No response generated');
    }

    console.log(`[SIMPLE_AI_CHAT] Response generated successfully`);

    res.status(200).json({
      success: true,
      response: reply
    });

  } catch (error) {
    console.error('[SIMPLE_AI_CHAT] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: 'AI chat failed',
      message: errorMessage
    });
  }
}
