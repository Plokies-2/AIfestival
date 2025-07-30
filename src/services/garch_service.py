# src/services/garch_service.py
import sys, json
import pandas as pd
from arch import arch_model
from datetime import datetime, timedelta

# 캐시 서비스 제거됨 - 실시간 데이터만 사용

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

def load_data(symbol):
    """
    실시간 데이터 로드 (캐시 제거됨)
    """
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
                    cleaned_data = clean_and_validate_data(hist, min_rows=252)  # GARCH는 252일 필요
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

def gjr_var(ticker: str):
    # 실시간 데이터 로드
    df = load_data(ticker)

    if df is not None:
        print(f"📊 Using data for {ticker}", file=sys.stderr)
        # 데이터 사용
        try:
            # Close 컬럼 확인
            if 'Close' not in df.columns:
                raise ValueError(f"Missing Close column in data")

            close = df['Close'].dropna()
            ret = close.pct_change().dropna() * 100  # % 단위
        except Exception as e:
            print(f"❌ Error processing data: {e}", file=sys.stderr)
            df = None

    if df is None:
        print(f"❌ No data available for {ticker}", file=sys.stderr)
        sys.exit(1)

    # 데이터가 있는 경우 처리
    close = df['Close'].dropna()
    ret = close.pct_change().dropna() * 100  # % 단위

    fit = arch_model(ret, p=1, o=1, q=1, dist="t").fit(update_freq=0, disp="off")
    fcst = fit.forecast(horizon=1, reindex=False)  # 버그 회피
    sigma_pct = (fcst.variance.values[-1, 0] ** 0.5)        # %
    var95_pct = 1.65 * sigma_pct                              # %

    #red: 내일 95% 신뢰구간 손실 3% 이상 가능 - 단기 고위험
    #yellow: 2% <= var95 < 3% -> 중간 위험
    #green: var95 < 2% -> 단기 안정
    light = "red" if var95_pct > 3 else "yellow" if var95_pct > 2 else "green"
    return {
        "symbol": ticker,
        "date": str(close.index[-1].date()),
        "sigma_pct": round(sigma_pct, 2),     # 하루 σ (%)
        "var95_pct": round(var95_pct, 2),     # VaR95 (%)
        "traffic_light": light
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python garch_service.py <TICKER>")
    try:
        print(json.dumps(gjr_var(sys.argv[1].upper()), ensure_ascii=False))
    except Exception:
        import traceback, sys as _s
        traceback.print_exc()
        _s.exit(1)
