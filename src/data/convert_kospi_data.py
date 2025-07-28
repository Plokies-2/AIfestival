#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from collections import defaultdict

def convert_kospi_data():
    """KOSPI 데이터를 enriched_final 형태로 변환"""
    
    # 현재 스크립트 위치
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # KOSPI 회사 데이터 로드
    kospi_companies_path = os.path.join(script_dir, 'KOSPI_companies.json')
    
    print("📊 KOSPI 데이터 변환 시작...")
    
    with open(kospi_companies_path, 'r', encoding='utf-8') as f:
        kospi_companies = json.load(f)
    
    print(f"총 기업 수: {len(kospi_companies)}")
    
    # 산업별 기업 수 계산
    industry_count = defaultdict(int)
    for company in kospi_companies:
        industry_count[company['industry']] += 1
    
    print("\n📈 산업별 기업 수 (상위 10개):")
    sorted_industries = sorted(industry_count.items(), key=lambda x: x[1], reverse=True)
    for industry, count in sorted_industries[:10]:
        print(f"  {industry}: {count}개")
    
    # main_product가 없는 기업들 확인
    no_main_product = []
    for company in kospi_companies:
        main_product = company.get('main_product')
        if not main_product or main_product in [None, 'NaN', '', 'null']:
            no_main_product.append(company)
    
    print(f"\n⚠️ main_product가 없는 기업: {len(no_main_product)}개")
    if no_main_product:
        print("예시:")
        for company in no_main_product[:5]:
            print(f"  {company['name']} ({company['ticker']}): {company.get('main_product', 'None')}")
    
    # kospi_enriched_final.ts 파일 생성
    enriched_data = {}
    for company in kospi_companies:
        # ticker에서 .KS 제거하여 키로 사용
        ticker = company['ticker'].replace('.KS', '')
        
        # main_product 처리
        main_product = company.get('main_product')
        if main_product and main_product not in [None, 'NaN', '', 'null']:
            description = str(main_product)
        else:
            description = f"{company['industry']} 관련 사업"
        
        enriched_data[ticker] = {
            "name": company['name'],
            "description": description,
            "industry": company['industry']
        }
    
    # TypeScript 파일로 출력
    ts_content = f"export const KOSPI_ENRICHED_FINAL = {json.dumps(enriched_data, ensure_ascii=False, indent=2)} as const;"
    
    output_path = os.path.join(script_dir, 'kospi_enriched_final.ts')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    
    print(f"\n✅ kospi_enriched_final.ts 파일 생성 완료")
    print(f"📁 위치: {output_path}")
    print(f"📊 총 {len(enriched_data)}개 기업 데이터 변환 완료")
    
    return len(enriched_data), len(sorted_industries)

if __name__ == "__main__":
    convert_kospi_data()
