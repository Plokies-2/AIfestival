"""
CAPM: KOSPI 지수(^KS11) ↔ 개별 종목 6 개월(126 영업일) Rolling OLS
Newey-West(HAC) 표준오차 + Andrew (1991) maxlags 규칙 적용
JSON :
{
  symbol, date, beta_market, r2_market, tstat_market, traffic_light
}
"""

import sys, json, math, warnings
import pandas as pd
import statsmodels.api as sm
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
    from yfinance_utils import get_stock_data, get_kospi_data, validate_data_columns, clean_and_validate_data
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

WIN = 126   # 6 개월(영업일)

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

            # KOSPI 지수인 경우 특별 처리
            if symbol == "^KS11":
                from datetime import datetime, timedelta
                end_date = datetime.now()
                start_date = end_date - timedelta(days=3*365)
                hist = get_kospi_data(start_date, end_date, max_retries=3)
            else:
                hist = get_stock_data(symbol, years=3, max_retries=3)

            if hist is not None and not hist.empty:
                # 데이터 유효성 검사
                if validate_data_columns(hist, ['Close']):
                    cleaned_data = clean_and_validate_data(hist, min_rows=126)  # CAPM은 126일 필요
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

# ── Newey-West maxlags(Andrews 1991) ──────────────────────────────────
def nw_maxlags(n):
    return int(math.floor(4 * (n / 100) ** (2 / 9)))

# ── CAPM 회귀 함수 ────────────────────────────────────────────────────
def capm_beta(ticker: str):
    # ─ 개별 주식 데이터 로드
    print(f"📊 CAPM 분석 시작: {ticker}", file=sys.stderr)
    df_stk = load_cached_data(ticker)

    if df_stk is None:
        print(f"❌ {ticker} 주식 데이터 로드 실패", file=sys.stderr)
        sys.exit(1)

    # ─ KOSPI 지수 데이터 로드
    df_mkt = load_cached_data("^KS11")

    if df_mkt is None:
        print(f"❌ KOSPI 지수 데이터 로드 실패", file=sys.stderr)
        sys.exit(1)

    print(f"📊 데이터 로드 완료 - 주식: {len(df_stk)}일, KOSPI: {len(df_mkt)}일", file=sys.stderr)

    # 수익률(%) 계산
    try:
        # 인덱스 timezone 정규화 (timezone 정보 제거)
        df_stk.index = df_stk.index.tz_localize(None) if df_stk.index.tz is not None else df_stk.index
        df_mkt.index = df_mkt.index.tz_localize(None) if df_mkt.index.tz is not None else df_mkt.index

        stk_ret = df_stk['Close'].pct_change().dropna() * 100
        mkt_ret = df_mkt['Close'].pct_change().dropna() * 100

        print(f"📊 수익률 계산 완료 - 주식: {len(stk_ret)}일, KOSPI: {len(mkt_ret)}일", file=sys.stderr)

        # 인덱스 타입 확인
        print(f"📊 주식 인덱스 타입: {type(stk_ret.index[0]) if len(stk_ret) > 0 else 'Empty'}", file=sys.stderr)
        print(f"📊 KOSPI 인덱스 타입: {type(mkt_ret.index[0]) if len(mkt_ret) > 0 else 'Empty'}", file=sys.stderr)

        # 인덱스 범위 확인
        if len(stk_ret) > 0:
            print(f"📊 주식 날짜 범위: {stk_ret.index[0]} ~ {stk_ret.index[-1]}", file=sys.stderr)
        if len(mkt_ret) > 0:
            print(f"📊 KOSPI 날짜 범위: {mkt_ret.index[0]} ~ {mkt_ret.index[-1]}", file=sys.stderr)

        # 공통 거래일 찾기
        common = stk_ret.index.intersection(mkt_ret.index)
        print(f"📊 공통 거래일: {len(common)}일", file=sys.stderr)

        if len(common) > 0:
            print(f"📊 공통 날짜 범위: {common[0]} ~ {common[-1]}", file=sys.stderr)
        else:
            print("❌ 공통 거래일이 없습니다. 인덱스 불일치 문제", file=sys.stderr)

        # 최소 데이터 요구사항 확인 (유연하게 조정)
        min_required = min(WIN, 60)  # 최소 60일 또는 WIN일 중 작은 값
        if len(common) < min_required:
            raise ValueError(f"공통 거래일 부족: {len(common)}일 (최소 {min_required}일 필요)")

        # 실제 사용할 윈도우 크기 조정
        actual_window = min(len(common), WIN)
        print(f"📊 사용할 윈도우 크기: {actual_window}일", file=sys.stderr)

    except Exception as e:
        print(f"❌ 데이터 처리 오류: {e}", file=sys.stderr)
        sys.exit(1)

    # 공통 거래일 데이터 추출
    y = stk_ret[common]
    x = mkt_ret[common]

    # 실제 윈도우 크기에 맞춰 데이터 추출
    ys = y.iloc[-actual_window:]
    xs = sm.add_constant(x.iloc[-actual_window:])

    # ─ Newey-West 보정 (윈도우 크기에 맞춰 조정)
    maxlags = nw_maxlags(actual_window)
    warnings.filterwarnings("ignore", category=RuntimeWarning)
    fit = sm.OLS(ys, xs).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})

    beta  = float(fit.params.iloc[1])
    r2    = float(fit.rsquared)
    tstat = float(fit.tvalues.iloc[1])

    # ─ 신호등 규칙
    if beta > 1.5 and r2 >= 0.3: 
        light = "red" #시장 충격에 1.5배 이상 반응함.
    elif 0.8 <= beta <= 1.3 and r2 >= 0.3:
        light = "green" #시장과 비슷한 수준
    else:
        light = "yellow" #저베타 방어주거나 R^2 낮음

    return {
        "symbol"       : ticker,
        "date"         : str(common[-1].date()),
        "beta_market"  : round(beta, 2),
        "r2_market"    : round(r2, 2),
        "tstat_market" : round(tstat, 2),
        "traffic_light": light
    }

# ── CLI 실행 ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python capm_service.py <TICKER>")
    try:
        print(json.dumps(capm_beta(sys.argv[1].upper()), ensure_ascii=False))
    except Exception:
        import traceback, sys as _s
        traceback.print_exc()
        _s.exit(1)
