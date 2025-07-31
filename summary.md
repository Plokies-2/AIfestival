# 📊 AI Festival 투자지원 플랫폼 - 파일 구조 분석

## 🎯 핵심 기능 개요

이 프로젝트는 **4가지 핵심 기능**을 제공하는 AI 기반 투자 분석 플랫폼입니다:

1. **🔍 1차 RAG 기반 산업 매칭** - 사용자 아이디어를 KOSPI 산업군과 매칭
2. **📰 2차 뉴스 기반 전략 도출** - 실시간 뉴스 분석으로 투자 전략 생성
3. **📈 포트폴리오 백테스팅** - AI 추천 포트폴리오의 과거 성과 분석
4. **⚡ SpeedTraffic™ 개별 기업 분석** - 4중 신호등 시스템으로 기업 분석

---

## 📁 src/components (React 컴포넌트)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `AIChat.tsx` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 사용자와 AI가 대화하는 채팅창
- **정확한 설명**: AI 채팅 인터페이스의 메인 컴포넌트로, 사용자 입력 처리, 메시지 히스토리 관리, 실시간 추론 과정 표시를 담당
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 사용자 입력을 AI 서비스로 전달
  - 📰 **2차 뉴스 분석**: 상세 분석 요청 및 진행 상황 표시
  - 📈 **포트폴리오 저장**: AI 추천 결과를 localStorage에 자동 저장

#### `SpeedTraffic.tsx` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 개별 주식의 투자 신호등을 분석하는 백그라운드 작업자
- **정확한 설명**: SpeedTraffic™ 분석 API 호출 및 결과 처리를 담당하는 백그라운드 컴포넌트
- **핵심 기능 연결**: 
  - ⚡ **SpeedTraffic™**: 4중 분석(기술적/산업/시장/리스크) 실행의 핵심

#### `SpeedTrafficLights.tsx` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 빨강/노랑/초록 신호등으로 투자 판단을 보여주는 화면
- **정확한 설명**: 4개 분석 영역(기술적/산업/시장/리스크)의 신호등 UI 및 종합 투자 신호 계산
- **핵심 기능 연결**: 
  - ⚡ **SpeedTraffic™**: 분석 결과의 직관적 시각화

#### `FinancialChart.tsx` ⭐⭐⭐⭐
- **쉬운 설명**: 주식 가격 차트를 그려주는 화면
- **정확한 설명**: lightweight-charts 라이브러리를 사용한 실시간 주가 차트 컴포넌트
- **핵심 기능 연결**: 
  - ⚡ **SpeedTraffic™**: 분석 대상 기업의 차트 표시

### 🎨 **UI/UX 지원 파일들**

#### `LandingPageNew.tsx` ⭐⭐⭐
- **쉬운 설명**: 웹사이트 첫 화면 (소개 페이지)
- **정확한 설명**: 4가지 핵심 기능을 소개하는 랜딩 페이지, 실제 UI 데모 포함

#### `RealTimeThinkingBox.tsx` ⭐⭐⭐
- **쉬운 설명**: AI가 생각하는 과정을 실시간으로 보여주는 말풍선
- **정확한 설명**: AI 분석 진행 상황을 실시간으로 표시하는 컴포넌트
- **핵심 기능 연결**: 
  - 📰 **2차 뉴스 분석**: 뉴스 검색/요약/전략 생성 과정 표시

#### `MarketStatus.tsx` ⭐⭐
- **쉬운 설명**: 코스피, 원달러 환율 등 시장 현황 표시
- **정확한 설명**: 실시간 시장 데이터(KOSPI, KRW/USD, VIX, 미국 10년 국채) 표시

#### `RealTimeAnalysis.tsx` ⭐⭐
- **쉬운 설명**: 실시간 시장 분석 정보 표시
- **정확한 설명**: 시장 지표들의 실시간 분석 결과 표시 (MarketStatus와 유사하지만 더 분석적)

#### `ReportModal.tsx` ⭐⭐
- **쉬운 설명**: SpeedTraffic 분석 결과를 팝업창으로 보여주는 화면
- **정확한 설명**: SpeedTraffic™ 분석 보고서를 모달 형태로 표시하는 컴포넌트

---

## 📊 src/data (데이터 파일)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `KOSPI_companies.json` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 코스피에 상장된 모든 회사 정보가 담긴 데이터베이스
- **정확한 설명**: 4,454개 KOSPI 상장 기업의 티커, 회사명, 산업분류, 주요사업 정보
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 기업 임베딩 생성의 기초 데이터
  - 📰 **2차 뉴스 분석**: 추천 기업 정보 제공

#### `kospi_enriched_final.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 회사 정보를 빠르게 찾을 수 있도록 정리한 데이터
- **정확한 설명**: 티커를 키로 하는 기업 정보 객체, 빠른 조회를 위한 최적화된 구조
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 기업명 조회
  - ⚡ **SpeedTraffic™**: 분석 대상 기업 정보 조회

#### `kospi_industry_vectors.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 각 산업별 특징을 나타내는 키워드 모음
- **정확한 설명**: 396개 산업 분류별 키워드 벡터, RAG 기반 산업 매칭의 핵심 데이터
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 사용자 입력과 산업 매칭의 핵심 데이터

#### `KOSPI_industry_mapping.json` ⭐⭐⭐⭐
- **쉬운 설명**: 산업 분류와 관련 키워드를 연결한 매핑 테이블
- **정확한 설명**: 산업별 키워드 매핑 정보 (kospi_industry_vectors.ts와 유사하지만 JSON 형태)

---

## 🛠️ src/lib (핵심 라이브러리)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `clova-embedding.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 텍스트를 숫자 벡터로 변환하는 AI 도구
- **정확한 설명**: Clova Studio의 bge-m3 모델을 사용한 임베딩 생성 유틸리티
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 사용자 입력을 벡터로 변환하여 산업 매칭

#### `embeddings.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 미리 계산된 벡터 데이터를 빠르게 불러오는 도구
- **정확한 설명**: 임베딩 캐시 파일 로드 및 관리, 코사인 유사도 계산 함수 제공
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 캐시된 기업/산업 임베딩 로드 및 유사도 계산

### 🔧 **지원 기능 파일들**

#### `server-session.ts` ⭐⭐
- **쉬운 설명**: 서버 재시작을 감지하고 사용자 데이터를 관리하는 도구
- **정확한 설명**: 서버 세션 관리, 재시작 감지, 포트폴리오 데이터 보존 로직

#### `utils.ts` ⭐
- **쉬운 설명**: 여러 곳에서 쓰이는 공통 도구 모음
- **정확한 설명**: Tailwind CSS 클래스 병합을 위한 유틸리티 함수

---

## 🤖 src/lib/ai-chat (AI 채팅 시스템)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `ai-service.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: AI와 대화하고 투자 분석을 요청하는 핵심 엔진
- **정확한 설명**: OpenAI 호환 클라이언트 초기화, 의도 분류, GPT 기반 응답 생성
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 사용자 의도 분류 및 초기 응답 생성
  - 📰 **2차 뉴스 분석**: 상세 투자 분석 요청 처리

#### `rag-service.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 사용자 말을 이해해서 적합한 산업을 찾아주는 검색 엔진
- **정확한 설명**: RAG 기반 의도 분류, 임베딩 유사도 계산, 산업 매칭 로직
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 핵심 구현체, 사용자 입력을 산업과 매칭

#### `news-service.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 네이버에서 관련 뉴스를 찾아오는 뉴스 수집기
- **정확한 설명**: Naver News API를 활용한 뉴스 검색, 필터링, 데이터 정제
- **핵심 기능 연결**: 
  - 📰 **2차 뉴스 분석**: 투자 전략 생성을 위한 뉴스 데이터 수집

#### `function-calling-tools.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: AI가 뉴스 검색, 요약 등의 작업을 수행할 수 있게 해주는 도구상자
- **정확한 설명**: HCX-005 모델용 Function Calling 도구 정의 및 실행기
- **핵심 기능 연결**: 
  - 📰 **2차 뉴스 분석**: AI가 뉴스 검색/요약/분석을 자동으로 수행

#### `summary-service.ts` ⭐⭐⭐⭐
- **쉬운 설명**: 긴 뉴스 기사를 짧게 요약해주는 요약기
- **정확한 설명**: Naver 요약 API를 활용한 뉴스 요약 서비스
- **핵심 기능 연결**: 
  - 📰 **2차 뉴스 분석**: 수집된 뉴스의 핵심 내용 추출

#### `pipeline-handlers.ts` ⭐⭐⭐⭐
- **쉬운 설명**: 사용자 요청을 단계별로 처리하는 작업 관리자
- **정확한 설명**: 의도별 파이프라인 핸들러, 대화형/투자 쿼리 처리 로직
- **핵심 기능 연결**: 
  - 🔍 **1차 RAG 매칭**: 의도 분류 결과에 따른 처리 분기
  - 📰 **2차 뉴스 분석**: 투자 쿼리 처리 파이프라인

### 🔧 **지원 기능 파일들**

#### `config.ts` ⭐⭐⭐
- **쉬운 설명**: AI 시스템의 모든 설정값들이 모여있는 설정 파일
- **정확한 설명**: RAG 임계값, 패턴 매칭, API 설정, 시스템 프롬프트 등 통합 설정

#### `types.ts` ⭐⭐⭐
- **쉬운 설명**: AI 시스템에서 사용하는 데이터 형태를 정의한 설계도
- **정확한 설명**: TypeScript 인터페이스 및 타입 정의

#### `request-handler.ts` ⭐⭐⭐
- **쉬운 설명**: 사용자 요청을 받아서 적절히 처리하는 요청 처리기
- **정확한 설명**: AI 채팅 요청의 메인 핸들러, 세션 관리 및 응답 생성

#### `session-manager.ts` ⭐⭐
- **쉬운 설명**: 사용자별 대화 기록을 관리하는 메모리 관리자
- **정확한 설명**: 세션 기반 대화 히스토리 관리, 자동 정리 기능

#### `company-utils.ts` ⭐⭐
- **쉬운 설명**: 회사 정보를 찾고 정리하는 도구 모음
- **정확한 설명**: 기업 데이터 조회, 패턴 매칭, 포맷팅 유틸리티

#### `speedtraffic-prompts.ts` ⭐⭐
- **쉬운 설명**: SpeedTraffic 분석용 AI 명령어 모음
- **정확한 설명**: SpeedTraffic™ 분석을 위한 시스템 프롬프트 정의

#### `index.ts` ⭐
- **쉬운 설명**: ai-chat 모듈의 진입점
- **정확한 설명**: 모듈 내 주요 함수들의 export 관리

---

## 🎯 핵심 기능별 파일 연관도

### 🔍 **1차 RAG 기반 산업 매칭**
```
사용자 입력 → AIChat.tsx → ai_chat.ts → ai-service.ts → rag-service.ts
→ embeddings.ts + clova-embedding.ts → kospi_industry_vectors.ts
```

### 📰 **2차 뉴스 기반 전략 도출**
```
산업 매칭 결과 → ai_chat_detailed.ts → function-calling-tools.ts → news-service.ts
→ summary-service.ts → ai-service.ts → 최종 투자 전략
```

### 📈 **포트폴리오 백테스팅**
```
AI 추천 결과 → AIChat.tsx (localStorage 저장) → 포트폴리오 페이지 → backtest.ts
→ unified_analysis.ts → backtest.py → 백테스팅 결과
```

### ⚡ **SpeedTraffic™ 개별 기업 분석**
```
기업 선택 → SpeedTraffic.tsx → speedtraffic_analysis.ts → unified_analysis.ts
→ unified_analysis.py → [mfi/bollinger/rsi/industry/capm/garch]_analysis.py
→ SpeedTrafficLights.tsx + FinancialChart.tsx + ReportModal.tsx
```

---

## 📈 파일 중요도 등급

- ⭐⭐⭐⭐⭐ **핵심 구현체** (21개): 4가지 주요 기능을 직접 구현
- ⭐⭐⭐⭐ **주요 지원** (10개): 핵심 기능의 중요한 지원 역할
- ⭐⭐⭐ **UI/설정** (9개): 사용자 경험 및 시스템 설정
- ⭐⭐ **보조 기능** (14개): 부가적인 지원 기능
- ⭐ **유틸리티** (2개): 공통 도구 및 진입점

---

## 🌐 src/pages/api (API 엔드포인트)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `ai_chat.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 사용자와 AI가 대화할 수 있게 해주는 서버 API
- **정확한 설명**: AI 채팅 시스템의 메인 API 엔드포인트, 모듈화된 AI 채팅 시스템의 진입점
- **핵심 기능 연결**:
  - 🔍 **1차 RAG 매칭**: 사용자 입력 처리 및 의도 분류
  - 📰 **2차 뉴스 분석**: 초기 응답 생성

#### `ai_chat_detailed.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: AI가 더 자세하고 깊이 있는 투자 분석을 해주는 고급 API
- **정확한 설명**: 고급 모델(HCX-005)을 사용한 상세 투자 분석 API, Function Calling 기반
- **핵심 기능 연결**:
  - 📰 **2차 뉴스 분석**: 핵심 구현체, 뉴스 검색/요약/전략 생성

#### `speedtraffic_analysis.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 개별 주식의 4가지 신호등 분석을 실행하는 API
- **정확한 설명**: SpeedTraffic™ 분석 API, Python 분석 서비스 호출 및 결과 처리
- **핵심 기능 연결**:
  - ⚡ **SpeedTraffic™**: 핵심 구현체, 4중 분석 실행

#### `backtest.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: AI가 추천한 포트폴리오의 과거 성과를 계산해주는 API
- **정확한 설명**: 포트폴리오 백테스팅 API, Python 백테스팅 서비스 호출
- **핵심 기능 연결**:
  - 📈 **포트폴리오 백테스팅**: 핵심 구현체

#### `unified_analysis.ts` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 모든 Python 분석 도구들을 하나로 묶어서 실행하는 통합 API
- **정확한 설명**: Python 분석 서비스 통합 실행기, 로컬/Vercel 환경 대응
- **핵심 기능 연결**:
  - ⚡ **SpeedTraffic™**: Python 분석 서비스 호출의 핵심

### 🔧 **지원 기능 파일들**

#### `analysis-progress.ts` ⭐⭐⭐
- **쉬운 설명**: AI 분석 진행 상황을 실시간으로 알려주는 API
- **정확한 설명**: 실시간 분석 진행 상황 조회 API, SSE 기반 진행 상황 추적

#### `speedtraffic_commentary.ts` ⭐⭐⭐
- **쉬운 설명**: SpeedTraffic 분석 결과를 쉬운 말로 설명해주는 API
- **정확한 설명**: SpeedTraffic™ 분석 결과의 AI 기반 해설 생성 API

#### `realtime_chart_data.ts` ⭐⭐⭐
- **쉬운 설명**: 실시간 주가 차트 데이터를 가져오는 API
- **정확한 설명**: 실시간 주가 데이터 제공 API, 차트 컴포넌트용

#### `market_data.ts` ⭐⭐
- **쉬운 설명**: 코스피, 환율 등 시장 현황 데이터를 가져오는 API
- **정확한 설명**: 실시간 시장 지표 데이터 제공 API

#### `server-status.ts` ⭐⭐
- **쉬운 설명**: 서버가 정상 작동하는지 확인하는 API
- **정확한 설명**: 서버 상태 및 재시작 감지 API

#### `csv_chart_data.ts` ⭐⭐
- **쉬운 설명**: CSV 파일에서 차트 데이터를 읽어오는 API
- **정확한 설명**: CSV 기반 차트 데이터 제공 API (백업용)

#### `generate_report.ts` ⭐⭐
- **쉬운 설명**: 분석 결과를 보고서 형태로 만들어주는 API
- **정확한 설명**: SpeedTraffic™ 분석 보고서 생성 API

#### `speedtraffic_log.ts` ⭐
- **쉬운 설명**: SpeedTraffic 분석 기록을 관리하는 API
- **정확한 설명**: SpeedTraffic™ 분석 로그 관리 API

#### `simple_ai_chat.ts` ⭐
- **쉬운 설명**: 간단한 AI 채팅 기능을 제공하는 API (사용되지 않음)
- **정확한 설명**: 단순화된 AI 채팅 API (레거시)

---

## 🐍 api/python (Python 분석 서비스)

### 🔥 **핵심 기능 직접 구현 파일들**

#### `unified_analysis.py` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 모든 주식 분석을 한 번에 실행하는 Python 메인 엔진
- **정확한 설명**: SpeedTraffic™ 통합 분석 서버리스 함수, 모든 분석 도구 통합 실행
- **핵심 기능 연결**:
  - ⚡ **SpeedTraffic™**: Python 분석의 핵심 구현체

#### `backtest.py` ⭐⭐⭐⭐⭐
- **쉬운 설명**: 포트폴리오의 과거 성과를 실제로 계산하는 Python 엔진
- **정확한 설명**: yfinance 기반 포트폴리오 백테스팅 서버리스 함수
- **핵심 기능 연결**:
  - 📈 **포트폴리오 백테스팅**: Python 백테스팅의 핵심 구현체

### 🔧 **개별 분석 도구들**

#### `mfi_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 자금 흐름을 분석해서 매수/매도 신호를 만드는 도구
- **정확한 설명**: Money Flow Index(MFI) 기술적 분석 도구
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 기술적 분석 신호등

#### `bollinger_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 주가가 정상 범위를 벗어났는지 확인하는 도구
- **정확한 설명**: 볼린저 밴드 기술적 분석 도구
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 기술적 분석 신호등

#### `rsi_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 주식이 너무 많이 오르거나 내렸는지 확인하는 도구
- **정확한 설명**: Relative Strength Index(RSI) 기술적 분석 도구
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 기술적 분석 신호등

#### `industry_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 같은 업종 다른 회사들과 비교해서 분석하는 도구
- **정확한 설명**: 산업 포트폴리오 회귀 분석 도구, 업종 민감도 측정
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 산업 분석 신호등

#### `capm_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 전체 주식 시장과 비교해서 위험도를 측정하는 도구
- **정확한 설명**: CAPM(Capital Asset Pricing Model) 기반 시장 베타 분석
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 시장 분석 신호등

#### `garch_analysis.py` ⭐⭐⭐⭐
- **쉬운 설명**: 주가 변동성과 투자 위험을 통계적으로 계산하는 도구
- **정확한 설명**: GARCH(1,1) 모델 기반 변동성 및 VaR 분석
- **핵심 기능 연결**: ⚡ **SpeedTraffic™**: 리스크 분석 신호등

### 🔧 **배포 지원 파일들**

#### `unified_analysis_vercel.py` ⭐⭐
- **쉬운 설명**: Vercel 클라우드에서 분석을 실행하기 위한 특별 버전
- **정확한 설명**: Vercel 서버리스 환경 최적화 버전

#### `backtest_vercel.py` ⭐⭐
- **쉬운 설명**: Vercel 클라우드에서 백테스팅을 실행하기 위한 특별 버전
- **정확한 설명**: Vercel 서버리스 환경 최적화 백테스팅 버전

---

## 🛠️ src/utils (유틸리티 함수)

### 🔧 **지원 기능 파일들**

#### `companyLookup.ts` ⭐⭐⭐⭐
- **쉬운 설명**: 회사 이름과 티커 코드를 서로 변환해주는 도구
- **정확한 설명**: KOSPI 기업 정보 조회 및 티커-회사명 변환 유틸리티
- **핵심 기능 연결**:
  - ⚡ **SpeedTraffic™**: 기업 정보 조회
  - 📰 **2차 뉴스 분석**: 기업명 변환

#### `resultsStorage.ts` ⭐⭐
- **쉬운 설명**: SpeedTraffic 분석 결과의 데이터 형태를 정의한 설계도
- **정확한 설명**: SpeedTraffic™ 분석 결과 타입 정의 (저장 기능은 제거됨)

---

## 🗂️ 정리된 파일 현황

### ❌ **제거된 중복 파일들**
- `src/services/backtest_service.py` → `api/python/backtest.py`로 대체
- `src/services/industry_regression_service.py` → `api/python/industry_analysis.py`로 대체
- `src/services/yfinance_utils.py` → api/python 개별 분석 파일들로 대체

### 📊 **최종 파일 통계**
- **src/components**: 9개 파일 (UI 컴포넌트)
- **src/data**: 4개 파일 (데이터)
- **src/lib**: 4개 파일 (핵심 라이브러리)
- **src/lib/ai-chat**: 13개 파일 (AI 채팅 시스템)
- **src/pages/api**: 14개 파일 (API 엔드포인트)
- **api/python**: 10개 파일 (Python 분석 서비스)
- **src/utils**: 2개 파일 (유틸리티)

**총 56개 파일**이 유기적으로 연결되어 **AI 기반 투자 분석 플랫폼**을 구성합니다.

---

# 🔄 실제 사용 시나리오별 상세 플로우 분석

## 📋 **상황 1: "반도체 기업에 투자하고 싶어" 질의 처리 (완전한 플로우)**

### 🎯 **쉬운 설명**
사용자가 반도체 투자 의사를 표현하면, AI가 2단계 분류 시스템을 통해 이를 이해하고 관련 기업들을 찾아 투자 전략을 제시하는 과정

### 🔧 **개발자 수준 상세 플로우**

#### **Phase 1: 입력 처리 및 1차 분류**

1. **사용자 입력 처리** (`AIChat.tsx` → `ai_chat.ts`)
   - 사용자 입력 "반도체 기업에 투자하고 싶어"가 `AIChat.tsx`의 `handleSendMessage()` 함수로 전달
   - `/api/ai_chat` 엔드포인트 호출하여 `ai_chat.ts`로 라우팅
   - `request-handler.ts`의 `handleAIChatRequest()` 함수가 요청 처리

2. **파이프라인 시작** (`pipeline-handlers.ts`)
   - `handleStartStage()` 함수 실행
   - `classifyUserIntent()` 함수 호출로 의도 분류 시작

3. **2단계 RAG 시스템 - 1단계: 기본 페르소나 분류** (`ai-service.ts` → `rag-service.ts`)
   - `ai-service.ts`의 `classifyIntent()` 함수가 `findBestPersona()` 호출
   - `rag-service.ts`의 `findBestPersona()` 함수 실행:
     - Clova Studio bge-m3 모델로 입력 텍스트 임베딩 생성 (`clova-embedding.ts`)
     - MD 파일 기반 페르소나 임베딩과 코사인 유사도 계산
     - 임계값 0.7 기준으로 greeting/about_ai 분류 시도
     - "반도체 기업에 투자하고 싶어"는 투자 관련이므로 null 반환

4. **2단계 RAG 시스템 - 2단계: 투자 의도 분류** (`rag-service.ts`)
   - 1단계에서 null 반환 시 `classifyIntentWithRAG()` 함수 실행
   - 396개 산업 벡터와 코사인 유사도 계산 (`kospi_industry_vectors.ts`)
   - "반도체" 관련 키워드 벡터와 매칭
   - 임계값 0.65 이상 시 `investment_query` 의도로 분류

#### **Phase 2: 산업 매칭 및 초기 응답**

5. **투자 쿼리 처리** (`pipeline-handlers.ts`)
   - `handleInvestmentQuery()` 함수 실행
   - `findBestIndustries()` 함수로 상위 2개 산업 추출
   - 1순위: "반도체" (점수 0.85), 2순위: "전자부품" (점수 0.72)

6. **산업 적합성 메시지 생성** (`ai-service.ts`)
   - **hcx-dash-002 모델 호출**: `generateDynamicResponse()` 함수 실행
   - 시스템 프롬프트: 산업 적합성 판단 메시지 생성
   - 온도 0.7, 최대 토큰 120으로 간결한 응답 생성
   - 출력: "사용자님의 투자 전략을 판단해볼 때, 반도체 산업이 가장 적합해 보입니다!"

7. **관련 기업 추출** (`rag-service.ts`)
   - `findCompaniesByIndustry()` 함수로 반도체 기업 필터링
   - `kospi_enriched_final.ts`에서 산업별 기업 리스트 생성
   - 결과: 삼성전자(005930), SK하이닉스(000660), 등 반도체 관련 기업들

#### **Phase 3: 상세 분석 (사용자 요청 시)**

8. **상세 분석 트리거** (`ai_chat_detailed.ts`)
   - 사용자가 "더 자세한 분석" 버튼 클릭
   - `/api/ai_chat_detailed` 엔드포인트 호출
   - **HCX-005 모델** Function Calling 기능 활성화

9. **0단계: 사용자 입력 정제** (`function-calling-tools.ts`)
   - `executeRefineUserQuery()` 함수 실행
   - **HCX-005 모델**이 비정형 입력을 구체적 투자 쿼리로 변환
   - 출력: `refined_query: "반도체 산업 투자 전략"`, `target_industries: ["반도체"]`

10. **1단계: 투자 동향 뉴스 검색** (`news-service.ts`)
    - `searchInvestmentTrendNews()` 함수로 "반도체" 키워드 네이버 뉴스 검색
    - 최근 30일간 뉴스 수집, 유사도(sim) 기준 정렬
    - 중복 제거 및 관련도 필터링 적용

11. **2단계: 뉴스 요약** (`summary-service.ts`)
    - 수집된 뉴스 총 길이가 2000자 이상일 경우 네이버 요약 API 호출
    - 요약 길이: 원문의 30% 수준으로 압축
    - 요약된 뉴스를 투자 전략 생성에 활용

12. **3단계: 최종 투자 전략 생성** (`function-calling-tools.ts`)
    - `executeGenerateInvestmentStrategies()` 함수 실행
    - **HCX-005 모델**이 뉴스 분석 기반 투자 전략 생성
    - 전통적 전략 + 창의적 전략 조합으로 포트폴리오 구성

---

## 📋 **상황 2: "너는 무엇을 제일 잘 해?" 질의 처리**

### 🎯 **쉬운 설명**
AI 시스템의 기능을 묻는 일반적인 질문에 대해 시스템 소개 응답을 제공하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **1차 페르소나 분류** (`ai-service.ts` → `rag-service.ts`)
   - `findBestPersona()` 함수가 MD 파일 기반 임베딩과 매칭
   - "너는 무엇을 제일 잘 해?" → about_ai 페르소나 임베딩과 높은 유사도 (0.82)
   - 임계값 0.7 이상이므로 `about_ai` 의도로 즉시 분류

2. **대화형 의도 처리** (`pipeline-handlers.ts`)
   - `handleConversationalIntent()` 함수 실행
   - 2단계 RAG 시스템을 우회하고 직접 응답 생성

3. **hcx-dash-002 모델 응답 생성** (`ai-service.ts`)
   - `generateDynamicResponse()` 함수 실행
   - 시스템 프롬프트: `ABOUT_AI_SYSTEM_PROMPT` 사용
   - 4가지 핵심 기능 소개: RAG 매칭, 뉴스 분석, 백테스팅, SpeedTraffic™
   - 온도 0.7, 최대 토큰 120으로 친근한 한국어 응답 생성

---

## 📋 **상황 3: "조선업에 투자하고 싶어" 질의 처리**

### 🎯 **쉬운 설명**
조선업 투자 의사 표현 시 관련 기업 분석 및 투자 전략 제시 과정

### 🔧 **개발자 수준 상세 플로우**

1. **입력 처리 및 임베딩** (`AIChat.tsx` → `clova-embedding.ts`)
   - "조선업에 투자하고 싶어" 텍스트를 bge-m3 모델로 1024차원 벡터 변환
   - 정규화된 임베딩 벡터 생성

2. **산업 벡터 매칭** (`kospi_industry_vectors.ts`)
   - 396개 산업 중 "조선업" 관련 키워드 벡터와 코사인 유사도 계산
   - 매칭 결과: "선박건조업" (industry_ko) 또는 "해운업" 등 관련 산업

3. **기업 필터링** (`rag-service.ts` → `kospi_enriched_final.ts`)
   - `findCompaniesByIndustry()` 함수로 조선업 관련 기업 추출
   - 예시: 현대중공업, 대우조선해양, 삼성중공업 등

4. **뉴스 수집 및 분석** (`news-service.ts`)
   - "조선업" 키워드로 네이버 뉴스 API 호출
   - 최근 30일간 뉴스 수집, 날짜(date) 기준 내림차순 정렬
   - 중복 제거 및 관련도 필터링 적용

5. **요약 처리** (`summary-service.ts`)
   - 수집된 뉴스 총 길이가 2000자 이상일 경우 네이버 요약 API 호출
   - 요약 길이: 원문의 30% 수준으로 압축

6. **투자 전략 생성** (`function-calling-tools.ts`)
   - HCX-005 모델의 `generateInvestmentStrategy()` 함수 실행
   - 조선업 시장 동향, 수주 현황, 글로벌 해운 시장 분석 포함

---

## 📋 **상황 4: SpeedTraffic™으로 삼성전자 분석**

### 🎯 **쉬운 설명**
삼성전자 주식을 4가지 관점(기술적/산업/시장/리스크)에서 종합 분석하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **분석 요청 처리** (`SpeedTraffic.tsx` → `speedtraffic_analysis.ts`)
   - 사용자가 삼성전자(005930.KS) 선택
   - `SpeedTraffic.tsx`의 `handleAnalyze()` 함수가 `/api/speedtraffic_analysis` 호출

2. **통합 분석 서비스 호출** (`unified_analysis.ts`)
   - `speedtraffic_analysis.ts`에서 `/api/unified_analysis` 내부 호출
   - 로컬 환경: Python 서브프로세스 실행
   - Vercel 환경: 서버리스 함수 호출

3. **Python 통합 분석 실행** (`unified_analysis.py`)
   - 삼성전자 티커(005930.KS)로 yfinance 데이터 수집
   - 최근 252일(1년) 주가 데이터 로드
   - 4개 분석 모듈 병렬 실행

4. **기술적 분석** (3개 지표 동시 실행)
   - `mfi_analysis.py`: Money Flow Index 계산, 14일 기간, 80/20 임계값
   - `bollinger_analysis.py`: 20일 이동평균, 2σ 밴드, 현재가 위치 분석
   - `rsi_analysis.py`: 14일 RSI 계산, 70/30 과매수/과매도 구간 판정

5. **산업 분석** (`industry_analysis.py`)
   - 반도체 업종 포트폴리오 구성 (SK하이닉스, 삼성전자 등)
   - 선형 회귀 분석으로 업종 베타 계산
   - 업종 대비 상대적 성과 측정

6. **시장 분석** (`capm_analysis.py`)
   - KOSPI 지수 대비 베타 계산 (252일 기간)
   - CAPM 모델 기반 기대수익률 산출
   - 시장 민감도 분석

7. **리스크 분석** (`garch_analysis.py`)
   - GARCH(1,1) 모델로 변동성 예측
   - 95% 신뢰구간 VaR(Value at Risk) 계산
   - 조건부 변동성 모델링

8. **신호등 시스템 계산** (`unified_analysis.py`)
   - 각 분석 결과를 0-100 점수로 정규화
   - 임계값 기준: 녹색(70+), 노랑(30-70), 빨강(30-)
   - 4개 신호등의 가중평균으로 종합 신호 계산

9. **결과 시각화** (`SpeedTrafficLights.tsx` → `FinancialChart.tsx`)
   - 분석 결과를 신호등 UI로 표시
   - lightweight-charts로 주가 차트 렌더링
   - 실시간 차트 데이터 업데이트

10. **보고서 생성** (`ReportModal.tsx` → `generate_report.ts`)
    - 상세 분석 보고서 모달 표시
    - PDF 다운로드 기능 제공

---

## 📋 **상황 5: 포트폴리오 백테스팅 실행**

### 🎯 **쉬운 설명**
AI가 추천한 포트폴리오의 과거 성과를 실제 주가 데이터로 검증하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **포트폴리오 데이터 준비** (`AIChat.tsx` → `resultsStorage.ts`)
   - AI 추천 결과가 localStorage에 자동 저장
   - 포트폴리오 구성: 티커 리스트 + 투자 비중(만원 단위)
   - 예시: [{"ticker": "005930.KS", "weight": 5000}, {"ticker": "000660.KS", "weight": 3000}]

2. **백테스팅 API 호출** (포트폴리오 페이지 → `backtest.ts`)
   - 사용자가 백테스팅 버튼 클릭
   - `/api/backtest` 엔드포인트로 POST 요청
   - 요청 데이터: 티커 리스트, 비중, 시작일, 종료일, 분석 기간

3. **Python 백테스팅 서비스 실행** (`unified_analysis.ts` → `backtest.py`)
   - `backtest.ts`에서 `/api/unified_analysis` 내부 호출
   - 백테스팅 모드로 `backtest.py` 실행

4. **주가 데이터 수집** (`backtest.py`)
   - yfinance 라이브러리로 각 티커별 일별 주가 데이터 수집
   - 데이터 기간: 사용자 지정 또는 기본 1년
   - 수정주가(Adjusted Close) 기준 수익률 계산

5. **포트폴리오 성과 계산**
   - 일별 포트폴리오 가치 계산: Σ(개별주식 수익률 × 투자비중)
   - 누적 수익률 계산: (최종가치 - 초기투자) / 초기투자 × 100
   - 연환산 수익률: (1 + 총수익률)^(365/투자일수) - 1

6. **리스크 지표 계산**
   - 변동성(Volatility): 일별 수익률의 표준편차 × √252
   - 샤프 비율: (포트폴리오 수익률 - 무위험 수익률) / 변동성
   - 최대 낙폭(MDD): 고점 대비 최대 하락률

7. **벤치마크 비교**
   - KOSPI 지수 동일 기간 성과 계산
   - 상대적 성과 분석: 포트폴리오 수익률 - KOSPI 수익률
   - 베타 계산: 포트폴리오와 KOSPI 간 상관관계

8. **결과 시각화 및 보고서**
   - 일별 포트폴리오 가치 변화 차트 생성
   - 주요 성과 지표 테이블 생성
   - JSON 형태로 프론트엔드에 결과 반환

9. **프론트엔드 결과 표시**
   - 백테스팅 결과 차트 렌더링
   - 성과 지표 대시보드 표시
   - 포트폴리오 구성 및 개별 종목 기여도 분석

---

## � **상황 6: "안녕하세요" 인사말 처리**

### 🎯 **쉬운 설명**
사용자의 간단한 인사말에 대해 친근한 응답을 제공하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **1차 페르소나 분류** (`rag-service.ts`)
   - `findBestPersona()` 함수가 "안녕하세요"를 greeting 페르소나와 매칭
   - 코사인 유사도 0.89로 임계값 0.7 초과
   - `greeting` 페르소나로 즉시 분류

2. **대화형 응답 생성** (`pipeline-handlers.ts` → `ai-service.ts`)
   - `handleConversationalIntent()` 함수 실행
   - **hcx-dash-002 모델**로 `generateDynamicResponse()` 호출
   - 시스템 프롬프트: 친근한 인사 응답 생성
   - 출력: "안녕하세요! 투자 관련 질문이나 궁금한 점이 있으시면 언제든 말씀해 주세요! 😊"

---

## 📋 **상황 7: "오늘 날씨 어때?" 일반 대화 처리**

### 🎯 **쉬운 설명**
투자와 관련 없는 일반적인 질문에 대한 처리 과정

### 🔧 **개발자 수준 상세 플로우**

1. **1차 페르소나 분류 실패** (`rag-service.ts`)
   - `findBestPersona()` 함수가 모든 페르소나와 낮은 유사도 반환
   - 최고 점수 0.45로 임계값 0.7 미달, null 반환

2. **2차 투자 의도 분류 실패** (`rag-service.ts`)
   - `classifyIntentWithRAG()` 함수 실행
   - 396개 산업 벡터와 매칭하지만 최고 점수 0.32로 임계값 0.65 미달
   - 투자 키워드 패턴 매칭도 실패

3. **기본 인사말로 분류** (`ai-service.ts`)
   - 모든 분류 실패 시 기본값으로 `greeting` 의도 설정
   - **hcx-dash-002 모델**이 일반 대화를 투자 상담으로 유도하는 응답 생성

---

## 📋 **상황 8: SpeedTraffic 해설 요청 처리**

### 🎯 **쉬운 설명**
SpeedTraffic 분석 결과에 대한 상세 해설을 AI가 제공하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **해설 요청 처리** (`speedtraffic_commentary.ts`)
   - 사용자가 SpeedTraffic 결과 화면에서 "AI 해설" 버튼 클릭
   - `/api/speedtraffic_commentary` 엔드포인트 호출

2. **분석 데이터 포맷팅**
   - `formatSpeedTrafficDataForAI()` 함수로 분석 결과를 AI 입력용으로 변환
   - 4개 영역별 점수, 신호등 색상, 실제 수치값 포함

3. **hcx-dash-002 모델 해설 생성**
   - 전문 투자 AI 페르소나로 상세 해설 생성
   - 각 분석의 실제 수치, 읽는 법, 신호등 색상 이유 설명
   - 온도 0.8, 최대 토큰 2048로 전문적이면서 친근한 해설 제공

---

## 📋 **상황 9: 포트폴리오 저장 및 관리**

### 🎯 **쉬운 설명**
AI가 추천한 포트폴리오를 자동으로 저장하고 관리하는 과정

### 🔧 **개발자 수준 상세 플로우**

1. **포트폴리오 자동 저장** (`AIChat.tsx`)
   - AI 응답에서 포트폴리오 정보 파싱
   - `localStorage`에 JSON 형태로 자동 저장
   - 키: `ai_portfolio_${timestamp}`, 값: 티커 리스트 + 비중

2. **서버 세션 관리** (`server-session.ts`)
   - `checkServerRestart()` 함수로 서버 재시작 감지
   - 재시작 시 localStorage 데이터 보존 로직 실행

3. **포트폴리오 페이지 연동**
   - 저장된 포트폴리오 데이터를 포트폴리오 페이지에서 자동 로드
   - 백테스팅 실행 시 해당 데이터 활용

---

## �🔍 **핵심 기술적 세부사항**

### **RAG 시스템 정확도 관리**
- **임계값 설정**: `RAG_THRESHOLDS.INVESTMENT_INTENT_MIN_SCORE = 0.65`
- **다중 매칭 로직**: 최고 점수 < 0.65일 경우 상위 2개 산업 추출
- **임베딩 모델**: Clova Studio bge-m3 (1024차원)
- **유사도 계산**: 정규화된 코사인 유사도

### **뉴스 수집 및 처리**
- **수집 기준**: 유사도(sim) 우선, 날짜(date) 보조 정렬
- **수집 기간**: 기본 7일, 최대 30일
- **요약 임계값**: 2000자 이상 시 네이버 요약 API 호출
- **요약 비율**: 원문 대비 30% 압축

### **SpeedTraffic™ 분석 파라미터**
- **데이터 기간**: 252일 (1년)
- **기술적 지표**: MFI(14일), 볼린저밴드(20일, 2σ), RSI(14일)
- **신호등 임계값**: 녹색(70+), 노랑(30-70), 빨강(30-)
- **종합 점수**: 4개 영역 가중평균 (기술적 30%, 산업 25%, 시장 25%, 리스크 20%)

### **백테스팅 정확도**
- **데이터 소스**: yfinance (실제 거래 데이터)
- **수익률 기준**: 수정주가 (배당, 액면분할 반영)
- **리밸런싱**: 일별 (실제 거래비용 미반영)
- **벤치마크**: KOSPI 지수 (^KS11)
