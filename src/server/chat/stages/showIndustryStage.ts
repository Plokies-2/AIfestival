import { SessionState } from '../session';
import { findTickerInText, getCompanyName } from '../intent';
import { generatePersonaResponse } from '../responses';

export async function showIndustryStage(userInput: string, state: SessionState, intentResult: { intent: string; confidence: number }): Promise<{ reply: string; status?: string; hasMore?: boolean }> {
  if (/더보기|전체보기|더|모든|전체|all/i.test(userInput)) {
    const allCompanies = state.industryCompanies;
    const allCompanyList = allCompanies.map((t, i) => `${i + 1}. ${getCompanyName(t)} (${t})`).join('\n');
    const reply = `🎉 ${state.selectedIndustry} 산업의 전체 기업 목록입니다! (총 ${allCompanies.length}개) 📊\n\n${allCompanyList}\n\n어떤 기업이 가장 흥미로우신가요? ✨`;
    return { reply, status: 'showing_companies', hasMore: false };
  }

  const selectedTicker = findTickerInText(userInput, state.industryCompanies);
  if (selectedTicker) {
    state.stage = 'ASK_CHART';
    state.selectedTicker = selectedTicker;
    const reply = `📈 ${getCompanyName(selectedTicker)} (${selectedTicker}) 차트 분석을 시작해볼까요? (예/아니오) ✨`;
    return { reply };
  }

  if (intentResult.intent === 'casual_chat') {
    const reply = await generatePersonaResponse(userInput, 'casual_chat');
    state.conversationHistory.push({ user: userInput, ai: reply, intent: 'casual_chat', timestamp: Date.now() });
    if (state.conversationHistory.length > 10) state.conversationHistory = state.conversationHistory.slice(-10);
    return { reply };
  }

  const companyList = state.industryCompanies.map((t, i) => `${i + 1}. ${getCompanyName(t)} (${t})`).join('\n');
  const reply = `🤗 위 목록에서 선택해 주세요!\n\n${companyList}\n\n또는 "아니오"라고 말씀해 주세요! 😊`;
  return { reply };
}
