#!/usr/bin/env python3
"""
간단한 서비스 테스트 스크립트
"""
import subprocess
import sys
import os

def test_service(service_name, symbol="AAPL"):
    """서비스 테스트"""
    print(f"\n🧪 Testing {service_name} service with {symbol}...")
    
    try:
        # 서비스 실행
        result = subprocess.run(
            [sys.executable, f"src/services/{service_name}_service.py", symbol],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"✅ {service_name} service SUCCESS")
            print(f"📊 Output: {result.stdout[:200]}...")
        else:
            print(f"❌ {service_name} service FAILED (code: {result.returncode})")
            print(f"🔍 stderr: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print(f"⏰ {service_name} service TIMEOUT")
    except Exception as e:
        print(f"💥 {service_name} service ERROR: {e}")

def main():
    """메인 함수"""
    print("🚀 Testing Python services with yfinance integration...")
    
    # 테스트할 서비스들
    services = [
        "bollinger",
        "rsi", 
        "mfi",
        "capm",
        "garch"
    ]
    
    for service in services:
        test_service(service)
    
    print("\n🎯 Testing complete!")

if __name__ == "__main__":
    main()
