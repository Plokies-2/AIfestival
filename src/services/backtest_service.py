#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
백테스팅 서비스 (로컬 개발용)
yfinance를 사용하여 실제 주가 데이터로 포트폴리오 백테스팅 수행
"""

import json
import sys
import os
import warnings
warnings.filterwarnings('ignore')

# 상위 디렉토리의 api/python 모듈 import를 위한 경로 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
api_python_dir = os.path.join(os.path.dirname(os.path.dirname(current_dir)), 'api', 'python')
sys.path.append(api_python_dir)

try:
    from backtest import handle_backtest_request
except ImportError:
    # 필요한 라이브러리 import
    try:
        import yfinance as yf
        import pandas as pd
        import numpy as np
        from datetime import datetime, timedelta
    except ImportError as e:
        print(f"라이브러리 import 오류: {e}", file=sys.stderr)
        sys.exit(1)

    def calculate_portfolio_backtest(tickers, weights, start_date, end_date, period):
        """
        포트폴리오 백테스팅 계산 (로컬 버전)
        """
        try:
            # 가중치 정규화 (비율로 변환)
            total_weight = sum(weights)
            if total_weight == 0:
                raise ValueError("총 투자 비중이 0입니다")
            
            normalized_weights = [w / total_weight for w in weights]
            
            # 주가 데이터 수집
            price_data = {}
            for ticker in tickers:
                try:
                    stock = yf.Ticker(ticker)
                    hist = stock.history(start=start_date, end=end_date)
                    if hist.empty:
                        print(f"⚠️ {ticker} 데이터가 없습니다", file=sys.stderr)
                        continue
                    price_data[ticker] = hist['Close']
                except Exception as e:
                    print(f"⚠️ {ticker} 데이터 수집 실패: {e}", file=sys.stderr)
                    continue
            
            if not price_data:
                raise ValueError("유효한 주가 데이터가 없습니다")
            
            # 데이터프레임 생성
            df = pd.DataFrame(price_data)
            df = df.dropna()
            
            if df.empty:
                raise ValueError("공통 거래일 데이터가 없습니다")
            
            # 일일 수익률 계산
            returns = df.pct_change().dropna()
            
            # 포트폴리오 수익률 계산 (가중평균)
            portfolio_returns = (returns * normalized_weights).sum(axis=1)
            
            # 누적 수익률 계산
            cumulative_returns = (1 + portfolio_returns).cumprod()
            
            # 성과 지표 계산
            total_return = (cumulative_returns.iloc[-1] - 1) * 100  # 총 수익률 (%)
            
            # 연환산 수익률
            days = len(portfolio_returns)
            annualized_return = ((1 + total_return/100) ** (252/days) - 1) * 100
            
            # 변동성 (연환산)
            volatility = portfolio_returns.std() * np.sqrt(252) * 100
            
            # 샤프 비율 (무위험 수익률 3% 가정)
            risk_free_rate = 0.03
            excess_return = (annualized_return/100) - risk_free_rate
            sharpe_ratio = excess_return / (volatility/100) if volatility > 0 else 0
            
            # 최대 낙폭 (Maximum Drawdown)
            peak = cumulative_returns.expanding().max()
            drawdown = (cumulative_returns - peak) / peak
            max_drawdown = drawdown.min() * 100
            
            # 일일 수익률 데이터 (차트용)
            daily_returns_data = []
            for date, value in cumulative_returns.items():
                daily_returns_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'value': round((value - 1) * 100, 2)  # 수익률 %
                })
            
            # 결과 반환
            result = {
                'period': period,
                'total_return': round(total_return, 2),
                'annualized_return': round(annualized_return, 2),
                'volatility': round(volatility, 2),
                'sharpe_ratio': round(sharpe_ratio, 2),
                'max_drawdown': round(max_drawdown, 2),
                'dailyReturns': daily_returns_data
            }
            
            return result
            
        except Exception as e:
            raise Exception(f"백테스팅 계산 오류: {str(e)}")

    def handle_backtest_request(request_body):
        """
        백테스팅 요청 처리 (로컬 버전)
        """
        try:
            # JSON 데이터 파싱
            input_data = json.loads(request_body) if isinstance(request_body, str) else request_body
            
            tickers = input_data.get('tickers', [])
            weights = input_data.get('weights', [])
            start_date = input_data.get('start_date')
            end_date = input_data.get('end_date')
            period = input_data.get('period')
            
            # 입력 검증
            if not tickers or not weights:
                raise ValueError("티커와 가중치가 필요합니다")
            
            if len(tickers) != len(weights):
                raise ValueError("티커와 가중치 개수가 일치하지 않습니다")
            
            if not start_date or not end_date:
                raise ValueError("시작일과 종료일이 필요합니다")
            
            # 백테스팅 실행
            result = calculate_portfolio_backtest(tickers, weights, start_date, end_date, period)
            
            return result
            
        except Exception as e:
            raise Exception(f"백테스팅 요청 처리 오류: {str(e)}")

# 메인 실행
if __name__ == "__main__":
    try:
        # stdin에서 JSON 데이터 읽기
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            raise ValueError("입력 데이터가 없습니다")
        
        # 백테스팅 실행
        result = handle_backtest_request(input_data)
        
        # 결과 출력
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
