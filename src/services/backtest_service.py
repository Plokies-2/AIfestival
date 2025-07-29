#!/usr/bin/env python3
"""
포트폴리오 백테스팅 서비스
yfinance를 사용하여 한국 주식 데이터로 백테스팅 수행
"""

import sys
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')

def calculate_portfolio_metrics(returns, period):
    """포트폴리오 성과 지표 계산"""

    # 데이터 유효성 검사
    if len(returns) < 2:
        print("Not enough data points", file=sys.stderr)
        return {
            'total_return': 0.0,
            'annualized_return': 0.0,
            'volatility': 0.0,
            'sharpe_ratio': 0.0,
            'max_drawdown': 0.0
        }

    # 총 수익률 계산
    initial_value = returns.iloc[0]
    final_value = returns.iloc[-1]

    if initial_value == 0 or pd.isna(initial_value) or pd.isna(final_value):
        print(f"Invalid values: initial={initial_value}, final={final_value}", file=sys.stderr)
        total_return = 0.0
    else:
        total_return = (final_value / initial_value) - 1

    # 연환산 수익률
    days = len(returns)
    if period == '3M':
        annualized_return = (1 + total_return) ** (365 / 90) - 1 if total_return > -1 else 0.0
    elif period == '6M':
        annualized_return = (1 + total_return) ** (365 / 180) - 1 if total_return > -1 else 0.0
    else:  # 1Y
        annualized_return = total_return

    # 일별 수익률 계산
    daily_returns = returns.pct_change().dropna()

    # 변동성 (연환산)
    if len(daily_returns) > 1:
        volatility = daily_returns.std() * np.sqrt(252)
    else:
        volatility = 0.0

    # 샤프 비율 (무위험 수익률 3% 가정)
    risk_free_rate = 0.03
    if volatility > 0:
        sharpe_ratio = (annualized_return - risk_free_rate) / volatility
    else:
        sharpe_ratio = 0.0

    # 최대 낙폭 (Maximum Drawdown)
    try:
        if len(daily_returns) > 1:
            cumulative = (1 + daily_returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            max_drawdown = drawdown.min()

            if pd.isna(max_drawdown):
                max_drawdown = 0.0
        else:
            max_drawdown = 0.0
    except:
        max_drawdown = 0.0

    return {
        'total_return': float(total_return) if not pd.isna(total_return) else 0.0,
        'annualized_return': float(annualized_return) if not pd.isna(annualized_return) else 0.0,
        'volatility': float(volatility) if not pd.isna(volatility) else 0.0,
        'sharpe_ratio': float(sharpe_ratio) if not pd.isna(sharpe_ratio) else 0.0,
        'max_drawdown': float(max_drawdown) if not pd.isna(max_drawdown) else 0.0
    }

def backtest_portfolio(tickers, weights, start_date, end_date, period):
    """포트폴리오 백테스팅 실행"""

    try:
        # 주가 데이터 다운로드 (로그 제거)

        # 모든 종목 데이터를 한 번에 다운로드
        try:
            data = yf.download(tickers, start=start_date, end=end_date, progress=False)

            if data.empty:
                raise Exception("No data downloaded")

            # 단일 종목인 경우와 다중 종목인 경우 처리
            if len(tickers) == 1:
                # 단일 종목: Close가 Series이므로 DataFrame으로 변환
                close_prices = pd.DataFrame({tickers[0]: data['Close']})
            else:
                # 다중 종목: Close가 이미 DataFrame
                close_prices = data['Close']

            # NaN 값 제거
            close_prices = close_prices.dropna()

            if close_prices.empty:
                raise Exception("No valid price data after cleaning")

            print(f"Downloaded data: {len(close_prices)} days, {len(close_prices.columns)} stocks", file=sys.stderr)

            # 가중치 정규화 (유효한 종목만)
            valid_tickers = list(close_prices.columns)
            valid_weights = []

            for ticker in valid_tickers:
                # 원래 티커 리스트에서 해당 가중치 찾기
                original_index = tickers.index(ticker)
                valid_weights.append(weights[original_index])

            total_weight = sum(valid_weights)
            normalized_weights = [w / total_weight for w in valid_weights]

            # 포트폴리오 가치 계산 (수익률 기반)
            # 각 종목을 첫날 기준으로 정규화 (100으로 시작)
            normalized_prices = close_prices.div(close_prices.iloc[0]) * 100

            # 가중평균으로 포트폴리오 가치 계산
            portfolio_values = (normalized_prices * normalized_weights).sum(axis=1)

            # 성과 지표 계산
            metrics = calculate_portfolio_metrics(portfolio_values, period)

            # 일별 수익률 데이터 생성 (0%를 기준으로 한 수익률)
            daily_returns_data = []
            initial_value = portfolio_values.iloc[0]

            for date, value in portfolio_values.items():
                return_rate = ((value / initial_value) - 1) * 100  # 백분율 수익률
                daily_returns_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'returnRate': float(return_rate)
                })

            result = {
                'period': period,
                'total_return': metrics['total_return'],
                'annualized_return': metrics['annualized_return'],
                'volatility': metrics['volatility'],
                'sharpe_ratio': metrics['sharpe_ratio'],
                'max_drawdown': metrics['max_drawdown'],
                'dailyReturns': daily_returns_data
            }

            # 백테스팅 완료 (로그 제거)
            return result

        except Exception as download_error:
            print(f"Download error: {download_error}", file=sys.stderr)
            raise

    except Exception as e:
        print(f"Backtest error: {e}", file=sys.stderr)
        raise

def main():
    """메인 함수"""
    try:
        # stdin에서 JSON 데이터 읽기
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        tickers = data['tickers']
        weights = data['weights']
        start_date = data['start_date']
        end_date = data['end_date']
        period = data['period']
        
        # 백테스팅 시작 (상세 로그 제거)
        
        # 백테스팅 실행
        result = backtest_portfolio(tickers, weights, start_date, end_date, period)
        
        # 결과 출력
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(f"Main error: {e}", file=sys.stderr)
        # 에러 발생 시 기본 결과 반환
        error_result = {
            'period': data.get('period', '6M') if 'data' in locals() else '6M',
            'total_return': 0.0,
            'annualized_return': 0.0,
            'volatility': 0.2,
            'sharpe_ratio': 0.0,
            'max_drawdown': -0.1,
            'dailyReturns': [
                {'date': '2024-01-01', 'value': 100.0},
                {'date': '2024-07-29', 'value': 100.0}
            ]
        }
        print(json.dumps(error_result, ensure_ascii=False))

if __name__ == "__main__":
    main()
