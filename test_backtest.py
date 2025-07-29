#!/usr/bin/env python3
"""
간단한 백테스팅 테스트
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def test_backtest():
    # 테스트 데이터
    tickers = ['000660.KS']  # SK하이닉스만
    start_date = '2025-01-01'
    end_date = '2025-07-29'
    
    print(f"Testing with ticker: {tickers[0]}")
    print(f"Period: {start_date} to {end_date}")
    
    # 데이터 다운로드
    data = yf.download(tickers[0], start=start_date, end=end_date, progress=False)
    
    if data.empty:
        print("No data downloaded")
        return
    
    print(f"Downloaded {len(data)} days of data")

    # Close 가격 추출
    close_prices = data['Close']
    print(f"Close prices type: {type(close_prices)}")
    print(f"Close prices shape: {close_prices.shape}")

    initial_price = float(close_prices.iloc[0])
    final_price = float(close_prices.iloc[-1])

    print(f"First close: {initial_price:.2f}")
    print(f"Last close: {final_price:.2f}")
    total_return = (final_price / initial_price) - 1
    
    print(f"Total return: {total_return:.4f} ({total_return*100:.2f}%)")
    
    # 일별 수익률
    daily_returns = close_prices.pct_change().dropna()
    print(f"Daily returns count: {len(daily_returns)}")
    print(f"Average daily return: {float(daily_returns.mean()):.6f}")
    print(f"Daily volatility: {float(daily_returns.std()):.6f}")

    # 연환산 변동성
    annual_vol = float(daily_returns.std()) * np.sqrt(252)
    print(f"Annualized volatility: {annual_vol:.4f} ({annual_vol*100:.2f}%)")

if __name__ == "__main__":
    test_backtest()
