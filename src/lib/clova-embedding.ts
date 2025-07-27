/**
 * Clova Studio OpenAI 호환 임베딩 API 유틸리티
 *
 * OpenAI 호환 API를 사용하여 bge-m3 모델로 임베딩을 생성합니다.
 */

import OpenAI from 'openai';
import { ENV_CONFIG } from './ai-chat/config';

/**
 * Clova Studio OpenAI 호환 클라이언트
 */
const openai = new OpenAI({
  apiKey: ENV_CONFIG.openaiApiKey,
  baseURL: 'https://clovastudio.stream.ntruss.com/v1/openai'
});

/**
 * OpenAI 호환 인터페이스로 Clova Studio 임베딩 API 사용
 *
 * @param input 임베딩할 텍스트
 * @returns OpenAI 호환 응답 형식
 */
export async function createEmbeddingCompatible(input: string): Promise<{ data: Array<{ embedding: number[] }> }> {
  try {
    const response = await openai.embeddings.create({
      model: 'bge-m3',
      input: input,
      encoding_format: 'float'  // Clova Studio에서 필수 파라미터
    } as any);

    return {
      data: response.data
    };
  } catch (error) {
    console.error('Clova embedding error:', error);
    throw error;
  }
}
