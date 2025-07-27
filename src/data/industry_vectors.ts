export interface IndustryVector {
  /**
   * SP500 데이터에서 사용되는 영문 산업명입니다. 고유 식별자로도 사용됩니다.
   */
  sp500_industry: string;
  /**
   * 산업의 한글 표기입니다. 사용자에게 보여질 이름으로 사용합니다.
   */
  industry_ko: string;
  /**
   * 산업을 대표하는 키워드 목록입니다. 짧은 한글 키워드와 관련 용어를 포함하여 질의‑확장에 활용합니다.
   */
  keywords: string[];
}

// 각 산업별 벡터 정의. 산업명과 키워드는 모두 한글로 작성했으며,
// 기술 약어는 사용자가 검색할 때 흔히 사용하는 경우 그대로 포함했습니다.
export const INDUSTRY_VECTORS: IndustryVector[] = [
  {
    sp500_industry: "Aerospace & Defense",
    industry_ko: "항공우주 및 방위산업",
    keywords: ["항공우주", "우주항공", "방위산업", "방산", "군수산업", "항공기", "드론"]
  },
  {
    sp500_industry: "Application Software",
    industry_ko: "응용 소프트웨어",
    keywords: ["응용 소프트웨어", "애플리케이션", "앱", "기업 소프트웨어", "설계 프로그램", "워드프로세서", "스프레드시트"]
  },
  {
    sp500_industry: "Asset & Wealth Management",
    industry_ko: "자산·자산 운용",
    keywords: ["자산관리", "재산관리", "자산운용", "투자관리", "포트폴리오", "펀드매니지먼트", "재무설계"]
  },
  {
    sp500_industry: "Automobiles & Components",
    industry_ko: "자동차 및 부품",
    keywords: ["자동차", "자동차부품", "모빌리티", "차량", "엔진", "자동차 산업", "전기차"]
  },
  {
    sp500_industry: "Banks",
    industry_ko: "은행",
    keywords: ["은행", "상업은행", "투자은행", "금융기관", "대출", "예금", "금융업"]
  },
  {
    sp500_industry: "Biotechnology",
    industry_ko: "생명공학",
    keywords: ["생명공학", "바이오테크", "유전자편집", "세포치료", "바이오", "바이오 산업", "재조합기술"]
  },
  {
    sp500_industry: "Building Products – Materials",
    industry_ko: "건축 자재 및 제품",
    keywords: ["건축자재", "건축재료", "시멘트", "철강재", "단열재", "건설용품", "건축제품"]
  },
  {
    sp500_industry: "Chemicals & Specialty Materials",
    industry_ko: "화학 및 특수 소재",
    keywords: ["화학제품", "특수소재", "석유화학", "플라스틱", "배터리소재", "정밀화학", "합성수지"]
  },
  {
    sp500_industry: "Cloud & IT Services",
    industry_ko: "클라우드 및 IT 서비스",
    keywords: ["클라우드", "클라우드서비스", "SaaS", "IaaS", "PaaS", "데이터센터", "IT서비스"]
  },
  {
    sp500_industry: "Computer & Networking Hardware",
    industry_ko: "컴퓨터 및 네트워크 하드웨어",
    keywords: ["컴퓨터하드웨어", "서버", "네트워크장비", "라우터", "스위치", "스토리지", "PC"]
  },
  {
    sp500_industry: "Consumer Staples – Beverages",
    industry_ko: "생활필수품 – 음료",
    keywords: ["음료", "주스", "탄산음료", "생수", "맥주", "콜라", "음료산업"]
  },
  {
    sp500_industry: "Consumer Staples – Packaged Foods & Meats",
    industry_ko: "생활필수품 – 가공식품 및 식사",
    keywords: ["식품", "가공식품", "간편식", "간식", "냉동식품", "조미료", "식품산업"]
  },
  {
    sp500_industry: "Data & Analytics Platforms",
    industry_ko: "데이터 및 분석 플랫폼",
    keywords: ["데이터플랫폼", "분석플랫폼", "빅데이터", "데이터분석", "BI도구", "데이터시각화", "데이터웨어하우스"]
  },
  {
    sp500_industry: "Digital Payments & Fintech",
    industry_ko: "디지털 결제 및 핀테크",
    keywords: ["디지털결제", "모바일결제", "전자지갑", "핀테크", "결제플랫폼", "QR결제", "암호화폐결제"]
  },
  {
    sp500_industry: "Electrical Equipment & Components",
    industry_ko: "전기 장비 및 부품",
    keywords: ["전기장비", "전력장치", "케이블", "센서", "전기부품", "배선", "변압기"]
  },
  {
    sp500_industry: "Energy – Mid & Downstream Services",
    industry_ko: "에너지 – 중·하류 및 서비스",
    keywords: ["정제", "파이프라인", "연료유", "석유정제", "가스유통", "에너지서비스", "유류저장"]
  },
  {
    sp500_industry: "Energy – Upstream (Oil & Gas E&P)",
    industry_ko: "에너지 – 상류 (석유·가스 탐사 및 생산)",
    keywords: ["석유개발", "가스개발", "탐사", "생산", "해상유전", "셰일가스", "유전"]
  },
  {
    sp500_industry: "Healthcare Providers & Services",
    industry_ko: "헬스케어 제공자 및 서비스",
    keywords: ["병원", "의료서비스", "헬스케어", "클리닉", "의료기관", "재활", "건강관리"]
  },
  {
    sp500_industry: "Hotels, Resorts & Leisure",
    industry_ko: "호텔, 리조트 및 레저",
    keywords: ["호텔", "리조트", "레저", "여행", "숙박", "크루즈", "테마파크"]
  },
  {
    sp500_industry: "Industrial Machinery – Heavy Equipment",
    industry_ko: "산업 기계 – 중장비",
    keywords: ["중장비", "굴착기", "건설장비", "채굴장비", "크레인", "불도저", "산업기계"]
  },
  {
    sp500_industry: "Industrial Machinery – Tools & Components",
    industry_ko: "산업 기계 – 공구 및 구성품",
    keywords: ["산업공구", "기계부품", "모터", "베어링", "압축기", "센서모듈", "기계요소"]
  },
  {
    sp500_industry: "Insurance – Life & Health",
    industry_ko: "보험 – 생명 및 건강",
    keywords: ["생명보험", "건강보험", "보험상품", "보험사", "보험료", "헬스보험", "종신보험"]
  },
  {
    sp500_industry: "Insurance – P&C",
    industry_ko: "보험 – 손해",
    keywords: ["손해보험", "재산보험", "자동차보험", "화재보험", "보험청구", "책임보험", "보험대리점"]
  },
  {
    sp500_industry: "Insurance – Reinsurance & Specialty",
    industry_ko: "보험 – 재보험 및 특수",
    keywords: ["재보험", "특수보험", "보험중개", "보험브로커", "모기지보험", "위험관리", "보험어음"]
  },
  {
    sp500_industry: "Media & Entertainment",
    industry_ko: "미디어 및 엔터테인먼트",
    keywords: ["미디어", "엔터테인먼트", "스트리밍", "영화", "방송", "음악", "콘텐츠"]
  },
  {
    sp500_industry: "Medical Devices – Diagnostics & Imaging",
    industry_ko: "의료 기기 – 진단 및 영상",
    keywords: ["진단기기", "영상장비", "MRI", "CT", "초음파", "의료영상", "진단장비"]
  },
  {
    sp500_industry: "Medical Devices – Lab Instruments",
    industry_ko: "의료 기기 – 실험실 장비",
    keywords: ["실험실장비", "분석기기", "검사기", "바이오센서", "실험용기구", "랩장비", "진단키트"]
  },
  {
    sp500_industry: "Pharmaceuticals",
    industry_ko: "제약",
    keywords: ["의약품", "제약", "처방약", "신약", "바이오의약품", "약학", "약물개발"]
  },
  {
    sp500_industry: "Real Estate – Commercial REITs",
    industry_ko: "부동산 – 상업용 리츠",
    keywords: ["리츠", "상업용부동산", "임대", "오피스빌딩", "물류센터", "리테일부동산", "부동산투자"]
  },
  {
    sp500_industry: "Retail – Specialty – Lifestyle",
    industry_ko: "소매 – 전문 – 라이프스타일",
    keywords: ["소매", "전문매장", "라이프스타일매장", "백화점", "쇼핑", "의류매장", "소매업"]
  },
  {
    sp500_industry: "Semiconductors & Foundries",
    industry_ko: "반도체 및 파운드리",
    keywords: ["반도체", "칩", "파운드리", "칩제조", "집적회로", "GPU", "ASIC"]
  },
  {
    sp500_industry: "Telecom Operators & Infrastructure",
    industry_ko: "통신 사업자 및 인프라",
    keywords: ["통신사", "통신인프라", "이동통신", "광대역", "5G", "기지국", "네트워크"]
  },
  {
    sp500_industry: "Transportation & Logistics",
    industry_ko: "운송 및 물류",
    keywords: ["운송", "물류", "배송", "항공화물", "도로운송", "해운", "터미널"]
  },
  {
    sp500_industry: "Utilities – Electric Utilities",
    industry_ko: "유틸리티 – 전기",
    keywords: ["전력회사", "전기공급", "송배전", "발전", "전력망", "배전망", "전력요금"]
  },
  {
    sp500_industry: "Utilities – Gas Utilities",
    industry_ko: "유틸리티 – 가스",
    keywords: ["가스회사", "가스공급", "천연가스", "가스배관", "도시가스", "가스요금", "LNG"]
  }
];