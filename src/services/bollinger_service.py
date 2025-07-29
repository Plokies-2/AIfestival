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
                if validate_data_columns(hist, ['Close']):
                    cleaned_data = clean_and_validate_data(hist, min_rows=20)  # Bollinger는 20일 필요
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

        # 한국 주식의 경우 .KS 접미사 추가
        yahoo_symbol = symbol if '.' in symbol else f"{symbol}.KS"

        ticker_obj = yf.Ticker(yahoo_symbol)
        hist = ticker_obj.history(start=start_date, end=end_date)

        if hist.empty:
            print(f"❌ {symbol}에 대한 데이터가 없습니다", file=sys.stderr)
            return None

        # 컬럼명 표준화 및 Close 컬럼 생성
        hist.columns = [col.replace(' ', '').title() for col in hist.columns]
        hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)

        # Close 컬럼이 없으면 AdjClose 사용
        if 'Close' not in hist.columns and 'AdjClose' in hist.columns:
            hist['Close'] = hist['AdjClose']

        print(f"✅ {symbol} 데이터 로드 성공: {len(hist)}일", file=sys.stderr)
        return hist

    except Exception as e:
        print(f"❌ {symbol} 데이터 로드 오류: {e}", file=sys.stderr)
        return None

def calculate_bollinger(symbol, period: int = 20, k: float = 2.0):
    """
    20-일, 2 σ Bollinger Bands 기반 신호 계산.

    반환 예
    -------
    {
        "symbol": "TSLA",
        "date":   "2025-06-05",
        "percent_b": 1.08,       # 1 초과 → 상단 돌파
        "traffic_light": "red"   # red / yellow / green
    }
    """
    # 먼저 캐시된 데이터 시도
    df = load_cached_data(symbol)

    if df is not None:
        print(f"📊 Using realtime data for {symbol}", file=sys.stderr)
        # yfinance 데이터 사용
        try:
            # Close 컬럼 확인
            if 'Close' not in df.columns:
                raise ValueError(f"Missing Close column in yfinance data")

            # 데이터 정리
            df = df.dropna()
            if len(df) < period:
                raise ValueError(f"Insufficient data for Bollinger calculation: {len(df)} days")

            price = df['Close']

        except Exception as e:
            print(f"❌ Error processing yfinance data: {e}", file=sys.stderr)
            df = None

    if df is None:
        print(f"❌ No data available for {symbol}", file=sys.stderr)
        sys.exit(1)

    # 데이터가 있는 경우 처리
    price = df['Close']

    sma = price.rolling(window=period, min_periods=period).mean()
    std = price.rolling(window=period, min_periods=period).std()
    upper = sma + k * std
    lower = sma - k * std

    # %B (가격 위치: 0=하단, 1=상단)
    percent_b = (price - lower) / (upper - lower)

    # DataFrame에 percent_b 추가
    df["percent_b"] = percent_b
    val = df["percent_b"].iloc[-1]
    date_val = df.index[-1].date().isoformat()

    # red   : %B ≥ 1      → 상단 밴드 돌파, 과매수
    # green : %B ≤ 0      → 하단 밴드 이탈, 과매도
    # yellow: 0 < %B < 1  → 밴드 내부, 중립

    if val >= 1:          # 상단 돌파 → 과매수
        color = "red"
    elif val <= 0:        # 하단 돌파 → 과매도
        color = "green"
    else:                 # 밴드 내부
        color = "yellow"

    return {
        "symbol": symbol,
        "date": date_val,
        "percent_b": round(float(val), 2),
        "traffic_light": color
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: python bollinger_service.py <TICKER>", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(calculate_bollinger(sys.argv[1].upper())))


if __name__ == "__main__":
    main()
