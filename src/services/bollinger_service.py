import pandas as pd
import sys
import json
from pathlib import Path


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
    # …/financial_dashboard/data
    DATA_DIR = Path(__file__).resolve().parents[1] / "data"

    try:
        close_file = DATA_DIR / "sp500_adj_close_3y.csv"
        close = pd.read_csv(close_file)
        close["Date"] = pd.to_datetime(close["Date"])
        for col in close.columns:
            if col != "Date":
                close[col] = pd.to_numeric(close[col], errors="coerce")
    except Exception as e:
        print(f"Error reading CSV: {e}", file=sys.stderr)
        sys.exit(1)

    if symbol not in close.columns:
        print(f"Error: {symbol} not found", file=sys.stderr)
        sys.exit(1)

    df = close[["Date", symbol]].rename(columns={symbol: "Close"}).set_index("Date").sort_index()
    price = df["Close"]

    sma = price.rolling(window=period, min_periods=period).mean()
    std = price.rolling(window=period, min_periods=period).std()
    upper = sma + k * std
    lower = sma - k * std

    # %B (가격 위치: 0=하단, 1=상단)
    percent_b = (price - lower) / (upper - lower)
    df["percent_b"] = percent_b


# red   : %B ≥ 1      → 상단 밴드 돌파, 과매수
# green : %B ≤ 0      → 하단 밴드 이탈, 과매도
# yellow: 0 < %B < 1  → 밴드 내부, 중립


    val = df["percent_b"].iloc[-1]
    if val >= 1:          # 상단 돌파 → 과매수
        color = "red"
    elif val <= 0:        # 하단 돌파 → 과매도
        color = "green"
    else:                 # 밴드 내부
        color = "yellow"

    return {
        "symbol": symbol,
        "date": df.index[-1].date().isoformat(),
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
