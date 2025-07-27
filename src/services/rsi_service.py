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
    직접 yfinance를 사용하여 데이터 로드 (폴백용)
    """
    if not YFINANCE_AVAILABLE:
        return None

    try:
        print(f"🔄 Loading realtime data for {symbol} using yfinance directly...", file=sys.stderr)

        # 3년간의 데이터 가져오기
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3*365)

        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(start=start_date, end=end_date)

        if hist.empty:
            print(f"❌ No realtime data found for {symbol}", file=sys.stderr)
            return None

        # 컬럼명 표준화 및 Close 컬럼 생성
        hist.columns = [col.replace(' ', '').title() for col in hist.columns]
        hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)

        # Close 컬럼이 없으면 AdjClose 사용
        if 'Close' not in hist.columns and 'AdjClose' in hist.columns:
            hist['Close'] = hist['AdjClose']

        print(f"✅ Loaded {len(hist)} days of realtime data for {symbol}", file=sys.stderr)
        return hist

    except Exception as e:
        print(f"❌ Error loading realtime data for {symbol}: {e}", file=sys.stderr)
        return None

def calculate_rsi(symbol, period: int = 14):
    """
    Calculate 14-day RSI for <symbol>.

    Returns
    -------
    dict
        {
            "symbol": "TSLA",
            "date":   "YYYY-MM-DD",
            "rsi_14": 55.32,
            "traffic_light": "yellow"
        }
    """
    # 먼저 캐시된 데이터 시도
    df = load_cached_data(symbol)

    if df is not None:
        print(f"📊 Using data for {symbol}", file=sys.stderr)
        # 데이터 사용
        try:
            # Close 컬럼 확인
            if 'Close' not in df.columns:
                raise ValueError(f"Missing Close column in data")

            # 데이터 정리
            df = df.dropna()
            if len(df) < period:
                raise ValueError(f"Insufficient data for RSI calculation: {len(df)} days")

            price = df['Close']

        except Exception as e:
            print(f"❌ Error processing data: {e}", file=sys.stderr)
            df = None

    if df is None:
        print(f"❌ No data available for {symbol}", file=sys.stderr)
        sys.exit(1)

    # 데이터가 있는 경우 처리
    price = df['Close']

    # RSI 계산
    delta = price.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # 지수이동평균(EMA) 방식
    avg_gain = gain.ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    # DataFrame에 RSI 추가
    df["RSI_14"] = rsi
    latest_val = df["RSI_14"].iloc[-1]
    date_val = df.index[-1].date().isoformat()

    # red   : RSI ≥ 70  → 과매수, 가격 고평가 가능성
    # green : RSI ≤ 30  → 과매도, 반등 가능성
    # yellow: 30 < RSI < 70 → 중립

    if latest_val >= 70:
        color = "red"
    elif latest_val <= 30:
        color = "green"
    else:
        color = "yellow"

    return {
        "symbol": symbol,
        "date": date_val,
        "rsi_14": round(float(latest_val), 2),
        "traffic_light": color
    }

def main():
    if len(sys.argv) != 2:
        print("Usage: python rsi_service.py <TICKER>", file=sys.stderr)
        sys.exit(1)

    ticker = sys.argv[1].upper()
    print(json.dumps(calculate_rsi(ticker)))

if __name__ == "__main__":
    main()
