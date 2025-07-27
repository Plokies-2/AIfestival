import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.CLOVA_STUDIO_API_KEY,  // Clova Studio API 키 사용
  baseURL: 'https://clovastudio.stream.ntruss.com/v1/openai'  // Clova Studio OpenAI 호환 엔드포인트
});

interface ReportData {
  symbol: string;
  companyName: string;
  rsi?: { value: number; traffic_light: string };
  bollinger?: { value: number; traffic_light: string };
  mfi?: { value: number; traffic_light: string };
  capm?: { beta: number; r2: number; tstat: number; traffic_light: string };
  garch?: { volatility: number; var95: number; traffic_light: string };
  industry?: { beta: number; r2: number; tstat: number; industry_name: string; traffic_light: string };
  lstm?: { accuracy: number; pred_prob_up: number; traffic_light: string };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const reportData: ReportData = req.body;

    // Validate required fields
    const requiredFields = [
      'symbol', 'companyName', 'rsi', 'bollinger', 'mfi', 'capm', 'garch', 'industry', 'lstm'
    ];
    
    const missingFields = requiredFields.filter(field => !(field in reportData));
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields 
      });
    }

    // Format the input data following the pattern from finetuning_collect.py
    const formatTrafficLight = (light: string) => light.toUpperCase();
    
    // Build the user message with all components in the required order
    const userMessage = [
      `[RSI Value: ${reportData.rsi!.value.toFixed(2)}, Traffic light: ${formatTrafficLight(reportData.rsi!.traffic_light)}]`,
      `[Bollinger %B: ${reportData.bollinger!.value.toFixed(2)}, Traffic light: ${formatTrafficLight(reportData.bollinger!.traffic_light)}]`,
      `[MFI Value: ${reportData.mfi!.value.toFixed(2)}, Traffic light: ${formatTrafficLight(reportData.mfi!.traffic_light)}]`,
      `[Market Beta: ${reportData.capm!.beta.toFixed(2)}, R²: ${reportData.capm!.r2.toFixed(2)}, t-stat: ${reportData.capm!.tstat.toFixed(2)}, Traffic light: ${formatTrafficLight(reportData.capm!.traffic_light)}]`,
      `[Volatility: ${reportData.garch!.volatility.toFixed(1)}%, VaR 95%: ${reportData.garch!.var95.toFixed(1)}%, Traffic light: ${formatTrafficLight(reportData.garch!.traffic_light)}]`,
      `[Industry Beta: ${reportData.industry!.beta.toFixed(2)}, R²: ${reportData.industry!.r2.toFixed(2)}, t-stat: ${reportData.industry!.tstat.toFixed(2)}, Traffic light: ${formatTrafficLight(reportData.industry!.traffic_light)}]`,
      `[industry : ${reportData.industry!.industry_name}]`,
      `[LSTM accuracy: ${reportData.lstm!.accuracy.toFixed(3)}, Prediction probability up: ${reportData.lstm!.pred_prob_up.toFixed(3)}, Traffic light: ${formatTrafficLight(reportData.lstm!.traffic_light)}]`
    ].join(' ');

    console.log(`[REPORT_API] Generating report for ${reportData.symbol} with message: ${userMessage}`);

    // Call the Clova Studio model (fine-tuned 모델 대신 기본 모델 사용)
    const response = await openai.chat.completions.create({
      model: 'hcx-dash-002',  // Clova Studio 기본 모델 사용
      messages: [
        {
          role: 'system',
          content: '당신은 이 메시지를 바탕으로 투자 의견을 제공하는 투자 AI입니다. [LSTM accuracy: 0.00]을 받은 경우 **절대 LSTM의 light를 말하지 마세요** 이모티콘을 적절히 활용해 친근한 분위기를 유지하면서(최대 2개까지, 💪🚀✨💎📈🎯💡🔥⭐️🌟💫🎉🎂 등), 전문적인 어조로 답변하세요'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 1.1,
      max_tokens: 2048
    });

    const report = response.choices[0].message.content?.trim();

    if (!report) {
      throw new Error('No report generated');
    }

    console.log(`[REPORT_API] Report generated successfully for ${reportData.symbol}`);

    res.status(200).json({
      success: true,
      report,
      symbol: reportData.symbol,
      companyName: reportData.companyName
    });

  } catch (error) {
    console.error('[REPORT_API] Error generating report:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: 'Failed to generate report',
      message: errorMessage
    });
  }
}
