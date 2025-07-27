#!/usr/bin/env python3
"""
데이터 캐싱 서비스
yfinance에서 한 번에 데이터를 가져와서 캐싱하고, 
SpeedTraffic Phase 1과 Phase 2에서 사용할 수 있도록 제공
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

# yfinance 가져오기 시도
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("Warning: yfinance not available", file=sys.stderr)

# 캐시 설정
CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache"
CACHE_DURATION_MINUTES = 5  # 5분간 캐시 유지

def ensure_cache_dir():
    """캐시 디렉토리 생성"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_cache_file_path(symbol):
    """캐시 파일 경로 반환"""
    return CACHE_DIR / f"{symbol}_cache.json"

def is_cache_valid(cache_file_path):
    """캐시가 유효한지 확인"""
    if not cache_file_path.exists():
        return False
    
    try:
        with open(cache_file_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        cache_time = datetime.fromisoformat(cache_data.get('timestamp', ''))
        current_time = datetime.now()
        
        # 캐시가 5분 이내인지 확인
        return (current_time - cache_time).total_seconds() < (CACHE_DURATION_MINUTES * 60)
    
    except Exception as e:
        print(f"Cache validation error: {e}", file=sys.stderr)
        return False

def load_from_cache(symbol):
    """캐시에서 데이터 로드"""
    cache_file_path = get_cache_file_path(symbol)
    
    if not is_cache_valid(cache_file_path):
        return None
    
    try:
        with open(cache_file_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        print(f"📦 Using cached data for {symbol}", file=sys.stderr)
        return cache_data['data']
    
    except Exception as e:
        print(f"Cache load error: {e}", file=sys.stderr)
        return None

def save_to_cache(symbol, data):
    """데이터를 캐시에 저장"""
    ensure_cache_dir()
    cache_file_path = get_cache_file_path(symbol)
    
    try:
        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'data': data
        }
        
        with open(cache_file_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Cached data for {symbol}", file=sys.stderr)
    
    except Exception as e:
        print(f"Cache save error: {e}", file=sys.stderr)

def fetch_comprehensive_data(symbol):
    """
    yfinance에서 SpeedTraffic에 필요한 모든 데이터를 한 번에 가져오기
    """
    if not YFINANCE_AVAILABLE:
        return None

    try:
        print(f"🔄 Fetching comprehensive data for {symbol} using yfinance...", file=sys.stderr)

        # 3년간의 데이터 가져오기
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3*365)

        # 개별 티커 데이터
        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(start=start_date, end=end_date)

        if hist.empty:
            print(f"❌ No data found for {symbol}", file=sys.stderr)
            return None

        # S&P 500 지수 데이터 (CAPM용)
        sp500_obj = yf.Ticker("^GSPC")
        sp500_hist = sp500_obj.history(start=start_date, end=end_date)

        # 데이터 정리 및 표준화
        hist.columns = [col.replace(' ', '').title() for col in hist.columns]
        hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)
        
        sp500_hist.columns = [col.replace(' ', '').title() for col in sp500_hist.columns]
        sp500_hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)

        # Close 컬럼이 없으면 AdjClose 사용
        if 'Close' not in hist.columns and 'AdjClose' in hist.columns:
            hist['Close'] = hist['AdjClose']
        
        if 'Close' not in sp500_hist.columns and 'AdjClose' in sp500_hist.columns:
            sp500_hist['Close'] = sp500_hist['AdjClose']

        # JSON 직렬화 가능한 형태로 변환
        data = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'ticker_data': {
                'dates': hist.index.strftime('%Y-%m-%d').tolist(),
                'open': hist['Open'].fillna(0).tolist(),
                'high': hist['High'].fillna(0).tolist(),
                'low': hist['Low'].fillna(0).tolist(),
                'close': hist['Close'].fillna(0).tolist(),
                'volume': hist['Volume'].fillna(0).tolist(),
            },
            'sp500_data': {
                'dates': sp500_hist.index.strftime('%Y-%m-%d').tolist(),
                'close': sp500_hist['Close'].fillna(0).tolist(),
            }
        }

        print(f"✅ Fetched {len(hist)} days of data for {symbol}", file=sys.stderr)
        return data

    except Exception as e:
        print(f"❌ Error fetching data for {symbol}: {e}", file=sys.stderr)
        return None

def get_cached_data(symbol):
    """
    캐시된 데이터 반환 (없으면 새로 가져오기)
    """
    # 캐시에서 먼저 확인
    cached_data = load_from_cache(symbol)
    if cached_data:
        return cached_data
    
    # 캐시에 없으면 새로 가져오기
    fresh_data = fetch_comprehensive_data(symbol)
    if fresh_data:
        save_to_cache(symbol, fresh_data)
        return fresh_data
    
    return None

def convert_to_dataframe(cached_data, data_type='ticker'):
    """
    캐시된 데이터를 pandas DataFrame으로 변환
    """
    try:
        if data_type == 'ticker':
            data_dict = cached_data['ticker_data']
        elif data_type == 'sp500':
            data_dict = cached_data['sp500_data']
        else:
            raise ValueError(f"Invalid data_type: {data_type}")

        df = pd.DataFrame(data_dict)
        df['dates'] = pd.to_datetime(df['dates'])
        df.set_index('dates', inplace=True)

        # 컬럼명을 표준화 (첫 글자 대문자)
        if data_type == 'ticker':
            column_mapping = {
                'open': 'Open',
                'high': 'High',
                'low': 'Low',
                'close': 'Close',
                'volume': 'Volume'
            }
            df.rename(columns=column_mapping, inplace=True)

        return df

    except Exception as e:
        print(f"DataFrame conversion error: {e}", file=sys.stderr)
        return None

def main():
    """메인 함수 - 명령행에서 호출"""
    if len(sys.argv) != 2:
        print("Usage: python data_cache_service.py <SYMBOL>", file=sys.stderr)
        sys.exit(1)
    
    symbol = sys.argv[1].upper()
    
    # 데이터 가져오기 및 캐싱
    data = get_cached_data(symbol)
    
    if data:
        # 성공 응답
        response = {
            "success": True,
            "symbol": symbol,
            "cached": True,
            "data_points": len(data['ticker_data']['dates']),
            "cache_timestamp": data['timestamp']
        }
        print(json.dumps(response, ensure_ascii=False))
    else:
        # 실패 응답
        response = {
            "success": False,
            "symbol": symbol,
            "error": "Failed to fetch or cache data"
        }
        print(json.dumps(response, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
