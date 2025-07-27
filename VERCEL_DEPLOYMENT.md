# Vercel 배포 가이드

이 문서는 AI Festival 프로젝트를 Vercel에 배포하는 방법을 설명합니다.

## 🚀 빠른 배포 가이드

### 1. 환경변수 설정 (중요!)

Vercel 대시보드에서 다음 환경변수를 설정해야 합니다:

#### 필수 환경변수
- `CLOVA_STUDIO_API_KEY`: 네이버 클라우드 플랫폼에서 발급받은 Clova Studio API 키

#### 선택적 환경변수
- `NEXT_PUBLIC_BASE_URL`: 배포된 도메인 (예: `https://your-app.vercel.app`)

### 2. Vercel 환경변수 설정 방법

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard 에 로그인

2. **프로젝트 선택**
   - 배포된 프로젝트를 클릭

3. **Settings 탭 이동**
   - 상단 메뉴에서 "Settings" 클릭

4. **Environment Variables 설정**
   - 왼쪽 메뉴에서 "Environment Variables" 클릭
   - "Add New" 버튼 클릭
   - 다음과 같이 설정:

   ```
   Name: CLOVA_STUDIO_API_KEY
   Value: [네이버 클라우드에서 발급받은 실제 API 키]
   Environment: Production, Preview, Development (모두 선택)
   ```

   ```
   Name: NEXT_PUBLIC_BASE_URL
   Value: https://your-app.vercel.app (실제 배포 URL)
   Environment: Production, Preview, Development (모두 선택)
   ```

5. **재배포**
   - 환경변수 설정 후 "Deployments" 탭으로 이동
   - 최신 배포를 클릭하고 "Redeploy" 버튼 클릭

## 🔧 Clova Studio API 키 발급 방법

### 1. 네이버 클라우드 플랫폼 가입
1. https://www.ncloud.com/ 접속
2. 회원가입 및 로그인

### 2. Clova Studio 서비스 신청
1. 콘솔에서 "AI·Application Service" → "Clova Studio" 선택
2. 서비스 이용 신청
3. 승인 완료 후 API 키 발급

### 3. API 키 확인
1. Clova Studio 콘솔에서 "API Key" 메뉴 확인
2. 발급된 API 키를 복사하여 Vercel 환경변수에 설정

## 🐛 문제 해결

### 빌드 오류 해결

#### 1. "CLOVA_STUDIO_API_KEY is required" 오류
- **원인**: 환경변수가 설정되지 않음
- **해결**: Vercel 대시보드에서 환경변수 설정 후 재배포

#### 2. "Failed to load S&P 500 data" 오류
- **원인**: 데이터 파일 로딩 실패
- **해결**: 일반적으로 자동 해결됨. 지속되면 재배포 시도

#### 3. 빌드 시간 초과
- **원인**: Next.js 빌드 과정이 오래 걸림
- **해결**: Vercel Pro 플랜 사용 또는 빌드 최적화

### 런타임 오류 해결

#### 1. AI 채팅이 작동하지 않음
- **확인사항**:
  - Vercel 환경변수에 `CLOVA_STUDIO_API_KEY`가 올바르게 설정되었는지 확인
  - API 키가 유효한지 확인 (네이버 클라우드 콘솔에서 확인)
  - 네트워크 연결 상태 확인

#### 2. 차트가 표시되지 않음
- **확인사항**:
  - 브라우저 콘솔에서 JavaScript 오류 확인
  - 네트워크 탭에서 API 요청 실패 여부 확인

## 📊 배포 후 확인사항

### 1. 기본 기능 테스트
- [ ] 페이지 로딩 확인
- [ ] AI 채팅 기능 테스트
- [ ] 차트 표시 확인
- [ ] 투자 분석 기능 테스트

### 2. 성능 확인
- [ ] 페이지 로딩 속도 (3초 이내 권장)
- [ ] API 응답 시간 (5초 이내 권장)
- [ ] 모바일 반응형 확인

## 🔄 지속적 배포

### 자동 배포 설정
Vercel은 GitHub 리포지토리와 연결되어 있어 다음과 같이 자동 배포됩니다:

1. **main 브랜치 푸시** → 프로덕션 배포
2. **다른 브랜치 푸시** → 프리뷰 배포
3. **Pull Request 생성** → 프리뷰 배포

### 배포 상태 확인
- Vercel 대시보드에서 실시간 배포 상태 확인 가능
- 배포 로그를 통해 오류 원인 파악 가능

## 📞 지원

배포 과정에서 문제가 발생하면:

1. **Vercel 문서**: https://vercel.com/docs
2. **Next.js 문서**: https://nextjs.org/docs
3. **프로젝트 이슈**: GitHub Issues 탭에서 문의

---

**중요**: API 키는 절대 공개 리포지토리에 커밋하지 마세요. 반드시 Vercel 환경변수로만 설정하세요.
