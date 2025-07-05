import pandas as pd
import sys
import json
from pathlib import Path

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
    # …/financial_dashboard/data/ 경로
    DATA_DIR = Path(__file__).resolve().parents[1] / "data"

    try:
        close_file = DATA_DIR / "sp500_adj_close_3y.csv"  # 필요 시 파일명 확인
        close = pd.read_csv(close_file)
        close["Date"] = pd.to_datetime(close["Date"])
        # 수치형 변환
        for col in close.columns:
            if col != "Date":
                close[col] = pd.to_numeric(close[col], errors="coerce")
    except Exception as e:
        print(f"Error reading CSV files: {e}", file=sys.stderr)
        sys.exit(1)

    if symbol not in close.columns:
        print(f"Error: Symbol {symbol} not found in data", file=sys.stderr)
        sys.exit(1)

    # 단일 종목 시계열 생성
    df = close[["Date", symbol]].rename(columns={symbol: "Close"})
    df = df.set_index("Date").sort_index()
    price = df["Close"]

    # RSI 계산
    delta = price.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # 지수이동평균(EMA) 방식
    avg_gain = gain.ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    df["RSI_14"] = rsi

    latest_val = df["RSI_14"].iloc[-1]
    
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
        "date": df.index[-1].date().isoformat(),
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
