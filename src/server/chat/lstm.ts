export interface LSTMData {
  symbol: string;
  timestamp: string;
  prediction_data: {
    shock_level: string;
    shock_description: string;
    last_prediction: number;
    accuracy: number;
    model_type: string;
  };
  analysis: {
    ai_summary: string;
    explanation: string;
  };
}

export async function getLSTMDataForSymbol(symbol: string): Promise<LSTMData | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/lstm_data?symbol=${symbol}&format=summary`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function getAvailableLSTMSymbols(): Promise<string[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/lstm_data?action=list`);
    if (!response.ok) return [];
    const result = await response.json();
    return result.success ? (result.available_symbols || []) : [];
  } catch {
    return [];
  }
}

export async function enhanceResponseWithLSTMData(companies: string[], response: string, getCompanyName: (t: string) => string): Promise<string> {
  try {
    const availableSymbols = await getAvailableLSTMSymbols();
    const lstmDataPromises = companies
      .filter(t => availableSymbols.includes(t))
      .slice(0, 2)
      .map(t => getLSTMDataForSymbol(t));
    const lstmResults = await Promise.all(lstmDataPromises);
    const validResults = lstmResults.filter(r => r !== null) as LSTMData[];
    if (validResults.length > 0) {
      let lstmEnhancement = '\n\n🔮 **LSTM 실시간 분석 결과:**\n';
      for (const data of validResults) {
        const companyName = getCompanyName(data.symbol);
        lstmEnhancement += `\n**${companyName} (${data.symbol})**: ${data.analysis.ai_summary}`;
      }
      lstmEnhancement += '\n\n*LSTM 분석은 AI 기반 실시간 예측으로 참고용입니다.*';
      return response + lstmEnhancement;
    }
    return response;
  } catch {
    return response;
  }
}
