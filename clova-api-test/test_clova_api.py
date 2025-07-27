import os
from dotenv import load_dotenv        # pip install python-dotenv
from openai import OpenAI            # pip install openai

# .env 파일 로드 (현재 작업 디렉토리 또는 상위에서 탐색)
load_dotenv()

API_KEY = os.getenv("CLOVA_STUDIO_API_KEY")
if not API_KEY:
    print("환경 변수 'CLOVA_STUDIO_API_KEY'가 설정되지 않았습니다.")
    exit(1)

# CLOVA Studio OpenAI 호환 API 엔드포인트
BASE_URL = "https://clovastudio.stream.ntruss.com/v1/openai"  # OpenAI 호환 엔드포인트 :contentReference[oaicite:4]{index=4}

# OpenAI 클라이언트 생성 (HyperCLOVA X HCX-005 모델 호출 준비)
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)          # OpenAI SDK 호환 방식 :contentReference[oaicite:5]{index=5}

def chat_loop():
    print("HyperCLOVA X 챗봇 실행 (종료: exit)")
    while True:
        user_input = input("당신: ").strip()
        if user_input.lower() == "exit":
            print("종료합니다.")
            break

        # Chat Completions 호출
        response = client.chat.completions.create(
            model="HCX-005",            # 기본 모델명 HCX-005 :contentReference[oaicite:6]{index=6}
            messages=[
                {"role": "system", "content": "모든 응답에 친절한 반말 어투를 적용할 것."},
                {"role": "user",   "content": user_input},
            ],
            temperature=0.7,
        )

        # 응답 콘텐츠 추출 (Pydantic 모델 방식)
        content = response.choices[0].message.content  # OpenAI SDK Pydantic 인터페이스 :contentReference[oaicite:7]{index=7}
        print("챗봇:", content)

if __name__ == "__main__":
    chat_loop()
