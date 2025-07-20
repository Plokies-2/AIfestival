import { SessionState } from '../session';
import { isPositive, getCompanyName } from '../intent';

export async function askChartStage(userInput: string, state: SessionState): Promise<{ reply: string; status?: string; symbol?: string }> {
  if (isPositive(userInput)) {
    const ticker = state.selectedTicker!;
    const reply = `🎉 ${getCompanyName(ticker)} (${ticker}) 차트입니다. SpeedTraffic도 준비하는 중! 📈`;
    state.stage = 'START';
    state.selectedIndustry = null;
    state.industryCompanies = [];
    state.selectedTicker = null;
    return { reply, status: 'chart_requested', symbol: ticker };
  }
  const reply = `🤔 ${getCompanyName(state.selectedTicker!)}(${state.selectedTicker}) 차트 분석을 시작해볼까요? "예" 또는 "아니오"로 답해주세요! 😊`;
  return { reply };
}
