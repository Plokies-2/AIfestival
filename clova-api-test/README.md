# Clova Chat API Test Project

이 프로젝트는 네이버 클로바 챗봇 API를 테스트하기 위한 환경을 설정합니다.

## 사전 준비

1. 네이버 클라우드 플랫폼 계정이 필요합니다.
2. 네이버 클라우드 플랫폼에서 다음 정보를 확인하세요:
   - Access Key (NCP_ACCESS_KEY)
   - Secret Key (NCP_SECRET_KEY)
   - API Gateway Invoke URL (APIGW_INVOKE_URL)

## 환경 설정

1. 가상환경 활성화 (Windows)
   ```
   .\venv\Scripts\activate
   ```

2. 필요한 패키지 설치
   ```
   pip install -r requirements.txt
   ```

3. `.env` 파일 설정
   - `.env` 파일을 열고 다음 정보를 입력하세요:
     ```
     # 네이버 클라우드 플랫폼 인증 정보
     NCP_ACCESS_KEY=발급받은_Access_Key
     NCP_SECRET_KEY=발급받은_Secret_Key
     
     # API Gateway Invoke URL
     APIGW_INVOKE_URL=발급받은_API_Gateway_URL
     
     # 선택사항: 대화 추적을 위한 사용자 ID
     USER_ID=test_user
     ```

## 사용 방법

1. 챗봇 테스트 실행:
   ```
   python test_clova_api.py
   ```

2. 대화 시작:
   - 화면에 표시되는 프롬프트에 메시지를 입력하면 챗봇이 응답합니다.
   - 종료하려면 '종료', 'exit', 또는 'quit'을 입력하세요.

## API 문서

- [Clova Chatbot API 가이드](https://api.ncloud-docs.com/docs/ai-application-service-chatbot-chatbot)
- [Clova Chatbot 콘솔](https://chatbot.ncloud.com/)

## 문제 해결

- API 키가 유효하지 않으면 인증 오류가 발생합니다.
- 챗봇 ID가 올바르지 않으면 404 오류가 발생합니다.
- 네트워크 문제가 있는 경우 인터넷 연결을 확인하세요.

## 주의사항

- `.env` 파일은 절대 버전 관리 시스템에 올리지 마세요.
- API 키와 시크릿 키는 안전하게 보관하세요.
- 무료 사용 한도를 초과하면 추가 요금이 부과될 수 있습니다.
