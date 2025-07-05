import pandas as pd
import sys
import json
from pathlib import Path

def calculate_mfi(symbol):
    """Calculate MFI-14 for given symbol"""
    # 프로젝트 루트 기준 CSV 경로 (…/financial_dashboard/data/)
    DATA_DIR = Path(__file__).resolve().parents[1] / "data"

    try:
        high_file = DATA_DIR / "sp500_high_3y.csv"
        low_file = DATA_DIR / "sp500_low_3y.csv"
        close_file = DATA_DIR / "sp500_adj_close_3y.csv"
        volume_file = DATA_DIR / "sp500_volume_3y.csv"

        # Read CSV files with proper data types (first read to get column names, then read with proper dtypes)
        high = pd.read_csv(high_file)
        low = pd.read_csv(low_file)
        close = pd.read_csv(close_file)
        volume = pd.read_csv(volume_file)

        # Convert Date columns to datetime (first, convert to string, then to datetime)
        high['Date'] = pd.to_datetime(high['Date'])
        low['Date'] = pd.to_datetime(low['Date'])
        close['Date'] = pd.to_datetime(close['Date'])
        volume['Date'] = pd.to_datetime(volume['Date'])

        # Convert numeric columns to float64
        for col in high.columns:
            if col != 'Date':
                high[col] = pd.to_numeric(high[col], errors='coerce')
                low[col] = pd.to_numeric(low[col], errors='coerce')
                close[col] = pd.to_numeric(close[col], errors='coerce')
                volume[col] = pd.to_numeric(volume[col], errors='coerce')

    except FileNotFoundError as e:
        print(f"Error: CSV file not found - {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading CSV files: {e}", file=sys.stderr)
        sys.exit(1)

    if symbol not in high.columns:
        print(f"Error: Symbol {symbol} not found in data", file=sys.stderr)
        sys.exit(1)

    period = 14

    # 날짜 컬럼을 인덱스로 변환하고 정렬(가장 최신 = 맨 아래)
    df = pd.DataFrame({
        "Date": high["Date"],
        "High":   high[symbol],
        "Low":    low[symbol],
        "Close":  close[symbol],
        "Volume": volume[symbol]
    }).astype({"High": "float64", "Low": "float64",
           "Close": "float64", "Volume": "float64"})
    
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.set_index("Date").sort_index()

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
