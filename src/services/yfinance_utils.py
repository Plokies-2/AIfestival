"""
yfinance 429 오류 처리 유틸리티
"""

import time
import sys
from datetime import datetime, timedelta
import yfinance as yf
from requests.exceptions import HTTPError, RequestException

def safe_yfinance_download(symbol, start_date, end_date, max_retries=3, base_delay=2):
    """
    yfinance를 사용하여 안전하게 데이터를 다운로드합니다.
    429 오류 발생 시 지수 백오프로 재시도합니다.
    
    Args:
        symbol (str): 주식 심볼 (예: "005930.KS")
        start_date (datetime): 시작 날짜
        end_date (datetime): 종료 날짜
        max_retries (int): 최대 재시도 횟수
        base_delay (int): 기본 대기 시간 (초)
    
    Returns:
        pandas.DataFrame: 주식 데이터 또는 None (실패 시)
    """
    
    for attempt in range(1, max_retries + 1):
        try:
            print(f"📊 {symbol} 데이터 다운로드 시도 {attempt}/{max_retries}...", file=sys.stderr)
            
            # yfinance Ticker 객체 생성
            ticker_obj = yf.Ticker(symbol)
            
            # 데이터 다운로드
            hist = ticker_obj.history(start=start_date, end=end_date)
            
            if hist.empty:
                print(f"❌ {symbol}에 대한 데이터가 없습니다.", file=sys.stderr)
                return None
            
            # 컬럼명 표준화
            hist.columns = [col.replace(' ', '').title() for col in hist.columns]
            hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)
            
            # Close 컬럼이 없으면 AdjClose 사용
            if 'Close' not in hist.columns and 'AdjClose' in hist.columns:
                hist['Close'] = hist['AdjClose']

            # timezone 정보 제거 (일관성을 위해)
            if hist.index.tz is not None:
                hist.index = hist.index.tz_localize(None)

            print(f"✅ {symbol} 데이터 다운로드 성공: {len(hist)}일", file=sys.stderr)
            return hist
            
        except HTTPError as e:
            if e.response.status_code == 429:
                # 429 오류 처리
                wait_time = base_delay * (2 ** (attempt - 1))  # 지수 백오프
                print(f"⚠️ {symbol} - 429 오류 발생. {wait_time}초 대기 후 재시도 ({attempt}/{max_retries})", file=sys.stderr)
                
                if attempt < max_retries:
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"❌ {symbol} - 최대 재시도 횟수 초과 (429 오류)", file=sys.stderr)
                    return None
            else:
                print(f"❌ {symbol} - HTTP 오류 {e.response.status_code}: {e}", file=sys.stderr)
                return None
                
        except RequestException as e:
            print(f"❌ {symbol} - 네트워크 오류: {e}", file=sys.stderr)
            if attempt < max_retries:
                wait_time = base_delay
                print(f"⚠️ {wait_time}초 대기 후 재시도 ({attempt}/{max_retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            else:
                return None
                
        except Exception as e:
            print(f"❌ {symbol} - 예상치 못한 오류: {e}", file=sys.stderr)
            if attempt < max_retries:
                wait_time = base_delay
                print(f"⚠️ {wait_time}초 대기 후 재시도 ({attempt}/{max_retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            else:
                return None
    
    return None

def get_kospi_data(start_date, end_date, max_retries=3):
    """
    KOSPI 지수 데이터를 안전하게 다운로드합니다.
    
    Args:
        start_date (datetime): 시작 날짜
        end_date (datetime): 종료 날짜
        max_retries (int): 최대 재시도 횟수
    
    Returns:
        pandas.DataFrame: KOSPI 데이터 또는 None (실패 시)
    """
    return safe_yfinance_download("^KS11", start_date, end_date, max_retries)

def get_stock_data(symbol, years=3, max_retries=3):
    """
    개별 주식 데이터를 안전하게 다운로드합니다.
    
    Args:
        symbol (str): 주식 심볼 (예: "005930")
        years (int): 과거 몇 년간의 데이터를 가져올지
        max_retries (int): 최대 재시도 횟수
    
    Returns:
        pandas.DataFrame: 주식 데이터 또는 None (실패 시)
    """
    # 한국 주식의 경우 .KS 접미사 추가
    yahoo_symbol = symbol if '.' in symbol else f"{symbol}.KS"
    
    # 날짜 범위 설정
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)
    
    return safe_yfinance_download(yahoo_symbol, start_date, end_date, max_retries)

def validate_data_columns(df, required_columns):
    """
    데이터프레임에 필요한 컬럼들이 있는지 확인합니다.
    
    Args:
        df (pandas.DataFrame): 확인할 데이터프레임
        required_columns (list): 필요한 컬럼 목록
    
    Returns:
        bool: 모든 필요한 컬럼이 있으면 True, 없으면 False
    """
    if df is None or df.empty:
        return False
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        print(f"❌ 필요한 컬럼이 없습니다: {missing_columns}", file=sys.stderr)
        return False
    
    return True

def clean_and_validate_data(df, min_rows=14):
    """
    데이터를 정리하고 유효성을 검사합니다.
    
    Args:
        df (pandas.DataFrame): 정리할 데이터프레임
        min_rows (int): 최소 필요한 행 수
    
    Returns:
        pandas.DataFrame: 정리된 데이터프레임 또는 None (유효하지 않은 경우)
    """
    if df is None or df.empty:
        return None
    
    # NaN 값 제거
    df_clean = df.dropna()
    
    # 최소 행 수 확인
    if len(df_clean) < min_rows:
        print(f"❌ 데이터가 부족합니다: {len(df_clean)}일 (최소 {min_rows}일 필요)", file=sys.stderr)
        return None
    
    return df_clean
