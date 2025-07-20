import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuid } from 'uuid';
import { SESSIONS, SessionState } from '@/server/chat/session';
import { classifyUserIntent, findBestIndustry } from '@/server/chat/intent';
import { startStage } from '@/server/chat/stages/startStage';
import { showIndustryStage } from '@/server/chat/stages/showIndustryStage';
import { askChartStage } from '@/server/chat/stages/askChartStage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { userInput } = req.body as { userInput: string };
  if (!userInput) return res.status(400).json({ reply: 'No input' });

  let sessionId = req.cookies.sessionId;
  if (!sessionId) {
    sessionId = uuid();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly`);
  }

  let state = SESSIONS.get(sessionId);
  if (!state) {
    state = { stage: 'START', selectedIndustry: null, industryCompanies: [], selectedTicker: null, conversationHistory: [], lastActivity: Date.now() };
    SESSIONS.set(sessionId, state);
  }
  state.lastActivity = Date.now();

  const intentResult = await classifyUserIntent(userInput);
  let result: any;

  switch (state.stage) {
    case 'START':
      result = await startStage(userInput, state, intentResult);
      break;
    case 'SHOW_INDUSTRY':
      result = await showIndustryStage(userInput, state, intentResult);
      break;
    case 'ASK_CHART':
      result = await askChartStage(userInput, state);
      break;
  }

  SESSIONS.set(sessionId, state);
  res.status(200).json(result);
}

export async function resetSessionAfterChart(sessionId: string) {
  const state: SessionState = { stage: 'START', selectedIndustry: null, industryCompanies: [], selectedTicker: null, conversationHistory: [], lastActivity: Date.now() };
  SESSIONS.set(sessionId, state);
}

export async function testRAGThresholds(userInput: string) {
  const industry = await findBestIndustry(userInput);
  const isCasualConversation = industry === null;
  const reasoning = isCasualConversation ? 'Input classified as casual conversation' : `Input matched to industry: ${industry}`;
  return { industry, isCasualConversation, reasoning };
}
