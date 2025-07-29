import pandas as pd
import sys
import json
from datetime import datetime, timedelta

# 데이터 캐시 서비스 가져오기
try:
    from data_cache_service import get_cached_data, convert_to_dataframe
    CACHE_SERVICE_AVAILABLE = True
except ImportError:
    CACHE_SERVICE_AVAILABLE = False
    print("Warning: data_cache_service not available, falling back to direct yfinance", file=sys.stderr)

# yfinance 유틸리티 가져오기
try:
    from yfinance_utils import get_stock_data, validate_data_columns, clean_and_validate_data
    YFINANCE_UTILS_AVAILABLE = True
except ImportError:
    YFINANCE_UTILS_AVAILABLE = False
    print("Warning: yfinance_utils not available, falling back to direct yfinance", file=sys.stderr)

# yfinance 가져오기 시도 (폴백용)
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("Warning: yfinance not available", file=sys.stderr)

def load_cached_data(symbol):
    """
    캐시된 데이터를 사용하여 DataFrame 반환
    """
    if CACHE_SERVICE_AVAILABLE:
        try:
            print(f"📦 Loading cached data for {symbol}...", file=sys.stderr)
            cached_data = get_cached_data(symbol)
            if cached_data:
                df = convert_to_dataframe(cached_data, 'ticker')
                if df is not None and not df.empty:
                    print(f"✅ Loaded {len(df)} days of cached data for {symbol}", file=sys.stderr)
                    return df
        except Exception as e:
            print(f"❌ Error loading cached data: {e}", file=sys.stderr)

    # 캐시 서비스 실패 시 직접 yfinance 사용
    return load_realtime_data_direct(symbol)

def load_realtime_data_direct(symbol):
    """
    안전한 yfinance를 사용하여 데이터 로드 (429 오류 처리 포함)
    """
    # 새로운 유틸리티 사용 시도
    if YFINANCE_UTILS_AVAILABLE:
        try:
            print(f"🔄 안전한 yfinance로 {symbol} 데이터 로드 중...", file=sys.stderr)
            hist = get_stock_data(symbol, years=3, max_retries=3)

            if hist is not None and not hist.empty:
                # 데이터 유효성 검사
                required_cols = ['High', 'Low', 'Close', 'Volume']
                if validate_data_columns(hist, required_cols):
                    cleaned_data = clean_and_validate_data(hist, min_rows=14)
                    if cleaned_data is not None:
                        print(f"✅ {symbol} 데이터 로드 성공: {len(cleaned_data)}일", file=sys.stderr)
                        return cleaned_data

            print(f"❌ {symbol} 데이터 로드 실패 (유틸리티)", file=sys.stderr)
        except Exception as e:
            print(f"❌ {symbol} 유틸리티 오류: {e}", file=sys.stderr)

    # 폴백: 기존 방식 사용
    if not YFINANCE_AVAILABLE:
        return None

    try:
        print(f"🔄 기존 방식으로 {symbol} 데이터 로드 중...", file=sys.stderr)

        # 3년간의 데이터 가져오기
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3*365)

        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(start=start_date, end=end_date)

        if hist.empty:
            print(f"❌ {symbol}에 대한 데이터가 없습니다", file=sys.stderr)
            return None

        # 컬럼명 표준화
        hist.columns = [col.replace(' ', '').title() for col in hist.columns]
        hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)

        print(f"✅ {symbol} 데이터 로드 성공: {len(hist)}일", file=sys.stderr)
        return hist

    except Exception as e:
        print(f"❌ {symbol} 데이터 로드 오류: {e}", file=sys.stderr)
        return None

def calculate_mfi(symbol):
    """Calculate MFI-14 for given symbol"""

    # 먼저 캐시된 데이터 시도
    df = load_cached_data(symbol)

    if df is not None:
        print(f"📊 Using data for {symbol}", file=sys.stderr)
        # 데이터 사용
        try:
            # 필요한 컬럼들이 있는지 확인
            required_cols = ['High', 'Low', 'Close', 'Volume']
            if not all(col in df.columns for col in required_cols):
                raise ValueError(f"Missing required columns in data: {required_cols}")

            # 데이터 정리
            df = df.dropna()
            if len(df) < 14:
                raise ValueError(f"Insufficient data for MFI calculation: {len(df)} days")

        except Exception as e:
            print(f"❌ Error processing data: {e}", file=sys.stderr)
            df = None

    if df is None:
        print(f"❌ No data available for {symbol}", file=sys.stderr)
        sys.exit(1)

    period = 14

    # 데이터 처리
    df = df.sort_index()
    # 컬럼명이 이미 표준화되어 있음 (High, Low, Close, Volume)

    # Typical Price와 Money Flow (data is already numeric, no need for conversion)
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    rmf = tp * df["Volume"]

    pos_flow = rmf.where(tp.diff() > 0, 0.0)  # 상승일
    neg_flow = rmf.where(tp.diff() <= 0, 0.0) # 하락일

    # 14 일 합계로 Money Flow Ratio → MFI
    pos_sum = pos_flow.rolling(period).sum()
    neg_sum = neg_flow.rolling(period).sum()
    mfi = 100 - (100 / (1 + pos_sum / neg_sum))
    df["MFI_14"] = mfi

    # 2025-06-05 사용자가 앱을 보는 시점 기준 최근값 판정

    # red   : MFI ≥ 80  → 거래량 동반 과열(자금 유입 과다)
    # green : MFI ≤ 20  → 자금 유출 과다, 과매도
    # yellow: 20 < MFI < 80 → 중립

    latest_val = df["MFI_14"].iloc[-1]
    if latest_val >= 80:
        color = "red"          # 과매수
    elif latest_val <= 20:
        color = "green"        # 과매도
    else:
        color = "yellow"       # 중립

    return {
        "symbol": symbol,
        "date": df.index[-1].date().isoformat(),
        "mfi_14": round(float(latest_val), 2),
        "traffic_light": color
    }

def main():
    """Main function to handle command line execution"""
    if len(sys.argv) != 2:
        print("Usage: python mfi_service.py <TICKER>", file=sys.stderr)
        sys.exit(1)

    ticker = sys.argv[1].upper()
    result = calculate_mfi(ticker)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
