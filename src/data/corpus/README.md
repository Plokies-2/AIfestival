# 임베딩 캐시 재생성 스크립트

이 디렉토리에는 about_ai.md와 greeting.md 파일 변경 시 임베딩 캐시를 자동으로 재생성하는 스크립트가 포함되어 있습니다.

## 📁 파일 구조

```
src/data/corpus/
├── about_ai.md              # AI 정체성/능력 질문 예시
├── greeting.md              # 인사말 예시
├── investment.md            # 투자 관련 (사용하지 않음)
├── regenerate-embeddings.js # 캐시 재생성 스크립트
└── README.md               # 이 파일
```

## 🚀 사용 방법

### 1. npm 스크립트 사용 (권장)

```bash
npm run regenerate-embeddings
```

### 2. 직접 실행

```bash
node src/data/corpus/regenerate-embeddings.js
```

## 📝 MD 파일 수정 가이드

### about_ai.md 수정

AI의 정체성이나 능력에 대한 질문 예시를 추가/수정할 때:

```markdown
# about_ai
> AI의 능력과 정체성에 대한 질문 처리용 intent입니다.

## Examples
- 너 누구야?
- 너 뭐해?
- 너는 어떤 AI야?
- 새로운 예시 추가...
```

### greeting.md 수정

인사말 예시를 추가/수정할 때:

```markdown
# greeting
> 사용자 인사 처리용 intent입니다.

## Examples
- 안녕
- 안녕하세요
- 하이
- 새로운 인사말 추가...
```

## ⚠️ 주의사항

1. **## Examples 섹션 필수**: 각 MD 파일에는 반드시 `## Examples` 섹션이 있어야 합니다.
2. **예시 형식**: 각 예시는 `- ` (대시 + 공백)으로 시작해야 합니다.
3. **환경 변수**: `.env.local` 파일에 `OPENAI_API_KEY`가 설정되어 있어야 합니다.

## 🔄 스크립트 실행 과정

1. **환경 변수 확인**: OPENAI_API_KEY 존재 여부 확인
2. **MD 파일 검증**: about_ai.md, greeting.md 파일 및 Examples 섹션 확인
3. **캐시 삭제**: 기존 `.cache/sp500_vectors.json` 파일 삭제
4. **임베딩 생성**: 
   - 기업 임베딩 (496개)
   - 산업 임베딩 (40개)
   - 페르소나 임베딩 (2개: about_ai, greeting)
5. **캐시 검증**: 생성된 캐시 파일 유효성 확인

## 📊 예상 결과

성공적으로 실행되면 다음과 같은 출력을 볼 수 있습니다:

```
🚀 임베딩 캐시 재생성 스크립트

ℹ 환경 변수 확인 중...
✅ 환경 변수 확인 완료
🔄 마크다운 파일 확인 중...
✅ about_ai.md: 36개 예시 발견
✅ greeting.md: 26개 예시 발견
🔄 기존 캐시 파일 확인 중...
⚠️ 기존 캐시 파일 발견: .cache/sp500_vectors.json
🔄 기존 캐시 파일 삭제 중...
✅ 기존 캐시 파일 삭제 완료
🔄 임베딩 생성을 위한 API 호출 준비 중...
...
✅ 임베딩 생성 완료!
📊 생성된 임베딩: 기업 496개, 산업 40개, 페르소나 2개
🔄 생성된 캐시 파일 검증 중...
✅ 캐시 파일 검증 완료:
  - 기업: 496개
  - 산업: 40개
  - 페르소나: 2개

🎉 캐시 재생성 완료! (소요시간: 120초)
```

## 🛠️ 문제 해결

### 환경 변수 오류
```
❌ OPENAI_API_KEY가 .env.local 파일에 설정되지 않았습니다.
```
**해결**: `.env.local` 파일에 `OPENAI_API_KEY=your-actual-api-key` 추가

### MD 파일 오류
```
❌ about_ai.md 파일에 "## Examples" 섹션이 없습니다.
```
**해결**: MD 파일에 `## Examples` 섹션과 예시들 추가

### 임베딩 생성 오류
```
❌ 임베딩 생성 실패: Request failed with status code 401
```
**해결**: OpenAI API 키가 유효한지 확인

## 🔧 개발자 정보

- **스크립트 위치**: `src/data/corpus/regenerate-embeddings.js`
- **캐시 위치**: `.cache/sp500_vectors.json`
- **소요 시간**: 약 2-3분 (네트워크 상황에 따라 다름)
- **API 호출 수**: 약 10-15회 (배치 처리로 최적화됨)

## 📈 성능 최적화

- **배치 처리**: 기업 임베딩을 100개씩 배치로 처리
- **캐시 검증**: 기존 캐시가 유효하면 재사용
- **에러 처리**: 각 단계별 상세한 에러 메시지 제공
- **진행 상황**: 실시간 진행 상황 표시

---

**💡 팁**: MD 파일을 수정한 후에는 반드시 이 스크립트를 실행하여 새로운 임베딩을 생성해야 변경사항이 반영됩니다!
