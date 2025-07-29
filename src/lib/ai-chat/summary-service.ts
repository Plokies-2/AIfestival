/**
 * 뉴스 요약 서비스 모듈
 * 
 * Clova Studio Summarization API를 사용하여 뉴스 데이터를 요약합니다.
 * hcx-005 모델의 토큰 사용량을 줄이기 위해 사용됩니다.
 */

// Next.js 내장 fetch 사용

// Summarization API URL (올바른 엔드포인트)
const SUMMARIZE_URL = 'https://clovastudio.stream.ntruss.com/v1/api-tools/summarization/v2';

/**
 * 뉴스 아이템 인터페이스
 */
export interface NewsItem {
  title: string;
  description: string;
  pub_date: string;
  link?: string;
}

// 사용하지 않는 코드 제거됨

/**
 * Clova Studio Summarization API 직접 호출 (Chat Completions 형태)
 */
async function callSummarizeApi(args: {
  texts: string[];
  autoSentenceSplitter?: boolean;
  segMaxSize?: number;
  segMinSize?: number;
  segCount?: number;
}): Promise<string> {
  console.log(`📝 [Summary API] 요약 API 호출 시작 - 텍스트 ${args.texts.length}개`);

  const startTime = Date.now();

  try {
    const response = await fetch(SUMMARIZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NCP_API_KEY!}`,
        'X-NCP-CLOVASTUDIO-REQUEST-ID': Math.random().toString(36).substring(2, 15)
      },
      body: JSON.stringify({
        texts: args.texts,
        autoSentenceSplitter: args.autoSentenceSplitter ?? true,
        segCount: args.segCount ?? -1,
        segMaxSize: args.segMaxSize ?? 300,
        segMinSize: args.segMinSize ?? 100,
        includeAiFilters: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Summary API] 응답 오류:`, errorText);
      throw new Error(`요약 API 오류 ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    const processingTime = Date.now() - startTime;
    console.log(`✅ [Summary API] 요약 완료 (${processingTime}ms)`);
    console.log(`🔍 [Summary API] 응답 구조 확인:`, JSON.stringify(result, null, 2));

    // Summarization API 응답에서 내용 추출 (실제 응답 구조 기반)
    let summary = null;

    // 1. 실제 Summarization API v2 응답 구조 (가장 우선)
    if (result.result && typeof result.result.text === 'string') {
      summary = result.result.text;
      console.log(`✅ [Summary API] result.text에서 요약 내용 추출 성공`);
    }
    // 2. 표준 Summarization API 응답 (이전 버전)
    else if (result.summaries && Array.isArray(result.summaries) && result.summaries.length > 0) {
      if (result.summaries[0].summary) {
        summary = result.summaries[0].summary;
        console.log(`✅ [Summary API] summaries[0].summary에서 요약 내용 추출 성공`);
      }
    }
    // 3. Chat Completions 형태 응답
    else if (result.result?.message?.content) {
      summary = result.result.message.content;
      console.log(`✅ [Summary API] result.message.content에서 요약 내용 추출 성공`);
    }
    // 4. 다른 Chat Completions 형태
    else if (result.choices && Array.isArray(result.choices) && result.choices.length > 0) {
      if (result.choices[0].message?.content) {
        summary = result.choices[0].message.content;
        console.log(`✅ [Summary API] choices[0].message.content에서 요약 내용 추출 성공`);
      }
    }
    // 5. 직접 content 필드
    else if (result.content) {
      summary = result.content;
      console.log(`✅ [Summary API] content에서 요약 내용 추출 성공`);
    }
    // 6. 문자열 응답
    else if (typeof result === 'string') {
      summary = result;
      console.log(`✅ [Summary API] 문자열 응답에서 요약 내용 추출 성공`);
    }

    if (summary) {
      console.log(`✅ [Summary API] 요약 내용 추출 성공`);
      return summary;
    } else {
      console.error(`❌ [Summary API] 예상하지 못한 응답 구조:`, JSON.stringify(result, null, 2));
      throw new Error('요약 결과를 찾을 수 없습니다');
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [Summary API] 요약 실패 (${processingTime}ms):`, error.message);
    throw error;
  }
}

// 사용하지 않는 hcx-005 Function Calling 코드 제거됨

/**
 * 뉴스 아이템들을 요약하는 메인 함수
 */
export async function summarizeNewsItems(newsItems: NewsItem[]): Promise<string> {
  if (!newsItems || newsItems.length === 0) {
    return '';
  }

  console.log(`📰 [News Summary] 뉴스 ${newsItems.length}개 요약 시작`);

  try {
    // 뉴스 내용을 하나의 텍스트로 결합
    const combinedText = newsItems.map((news, index) => {
      const formattedDate = new Date(news.pub_date).toLocaleDateString('ko-KR');
      return `뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}`;
    }).join('\n\n');

    // 모든 텍스트에 대해 직접 Summarization API 사용 (간소화)
    const textLength = combinedText.length;
    console.log(`📏 [News Summary] 결합된 텍스트 길이: ${textLength}자`);
    console.log(`📝 [News Summary] Summarization API 사용`);

    return await callSummarizeApi({
      texts: [combinedText]
    });
  } catch (error: any) {
    console.error(`❌ [News Summary] 뉴스 요약 실패:`, error.message);
    // 요약 실패 시 원본 텍스트의 일부만 반환 (fallback)
    const fallbackText = newsItems.slice(0, 3).map((news, index) => {
      return `뉴스${index + 1}: ${news.title}`;
    }).join('\n');
    console.log(`🔄 [News Summary] Fallback 텍스트 사용`);
    return fallbackText;
  }
}

/**
 * 뉴스 요약 여부를 결정하는 함수
 */
export function shouldSummarizeNews(newsItems: NewsItem[]): boolean {
  if (!newsItems || newsItems.length === 0) {
    return false;
  }

  // 총 텍스트 길이가 2500자 이상이면 요약
  const totalLength = newsItems.reduce((sum, news) => {
    return sum + news.title.length + news.description.length;
  }, 0);

  const shouldSummarize = totalLength >= 2500;

  console.log(`🤔 [News Summary] 요약 필요성 판단: 뉴스 ${newsItems.length}개, 총 ${totalLength}자 → ${shouldSummarize ? '요약 필요' : '요약 불필요'}`);

  return shouldSummarize;
}

/**
 * 요약 서비스 클래스
 */
export class NewsSummaryService {
  /**
   * 뉴스 아이템들을 요약합니다
   */
  async summarize(newsItems: NewsItem[]): Promise<string> {
    return await summarizeNewsItems(newsItems);
  }

  /**
   * 요약이 필요한지 판단합니다
   */
  shouldSummarize(newsItems: NewsItem[]): boolean {
    return shouldSummarizeNews(newsItems);
  }
}
