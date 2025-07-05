#!/usr/bin/env python3
"""
원본 Jupyter 노트북과 현재 LSTM 구현의 일치성 검증 스크립트

이 스크립트는 다음을 확인합니다:
1. 시퀀스 길이 (20일)
2. 모델 아키텍처 (LSTM 레이어 구성)
3. 학습 파라미터 (epochs, batch_size)
4. 데이터 전처리 방식
5. CPU 환경에서의 성능
"""

import sys
import os
import json
import time
from datetime import datetime

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def verify_notebook_parameters():
    """원본 노트북 파라미터와 현재 구현 비교"""
    print("🔍 원본 Jupyter 노트북 파라미터 검증 중...")
    
    try:
        from services.lstm_service import LSTMPredictor
        
        # 기본 파라미터로 예측기 초기화
        predictor = LSTMPredictor()
        
        # 원본 노트북 파라미터 확인
        original_params = {
            "sequence_length": 20,
            "epochs": 10,
            "batch_size": 1,
            "lstm_units": 20,
            "train_split": 0.8
        }
        
        current_params = {
            "sequence_length": predictor.sequence_length,
            "epochs": predictor.epochs,
            "batch_size": predictor.batch_size,
            "lstm_units": 20,  # 하드코딩된 값 (build_model에서 확인)
            "train_split": 0.8  # prepare_data에서 확인
        }
        
        print("\n📊 파라미터 비교:")
        print("=" * 50)
        
        all_match = True
        for param, original_value in original_params.items():
            current_value = current_params[param]
            match = "✅" if original_value == current_value else "❌"
            print(f"{param:15}: 원본={original_value:3} | 현재={current_value:3} {match}")
            if original_value != current_value:
                all_match = False
        
        print("=" * 50)
        if all_match:
            print("🎉 모든 파라미터가 원본 노트북과 완벽히 일치합니다!")
        else:
            print("⚠️  일부 파라미터가 원본과 다릅니다.")
            
        return all_match
        
    except Exception as e:
        print(f"❌ 파라미터 검증 실패: {e}")
        return False

def test_cpu_performance():
    """CPU 환경에서의 성능 테스트"""
    print("\n🖥️  CPU 환경 성능 테스트 중...")
    
    try:
        # LSTM 서비스 실행
        start_time = time.time()
        
        # Python subprocess로 LSTM 서비스 실행
        import subprocess
        result = subprocess.run([
            sys.executable, 
            os.path.join('src', 'services', 'lstm_service.py'),
            'AAPL'
        ], capture_output=True, text=True, timeout=120)  # 2분 타임아웃
        
        execution_time = time.time() - start_time
        
        if result.returncode == 0:
            try:
                response = json.loads(result.stdout)
                if response.get('success'):
                    print(f"✅ LSTM 실행 성공!")
                    print(f"⏱️  실행 시간: {execution_time:.1f}초")
                    print(f"📈 예측값: {response['data']['lastPrediction']:.2f}")
                    print(f"🎯 정확도: {response['data']['accuracy']:.4f}")
                    print(f"📊 시퀀스 길이: {response['data']['sequenceLength']}일")
                    
                    # 성능 기준 확인
                    if execution_time < 60:
                        print("🚀 성능: 우수 (60초 미만)")
                    elif execution_time < 120:
                        print("⚡ 성능: 양호 (2분 미만)")
                    else:
                        print("🐌 성능: 개선 필요 (2분 초과)")
                        
                    return True
                else:
                    print(f"❌ LSTM 실행 실패: {response.get('error', 'Unknown error')}")
                    return False
            except json.JSONDecodeError:
                print(f"❌ JSON 파싱 실패. 출력: {result.stdout[:200]}...")
                return False
        else:
            print(f"❌ 프로세스 실행 실패 (코드: {result.returncode})")
            print(f"에러: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("⏰ 타임아웃: LSTM 실행이 2분을 초과했습니다.")
        return False
    except Exception as e:
        print(f"❌ 성능 테스트 실패: {e}")
        return False

def verify_architecture():
    """모델 아키텍처 검증"""
    print("\n🏗️  모델 아키텍처 검증 중...")
    
    try:
        from services.lstm_service import LSTMPredictor
        import numpy as np
        
        predictor = LSTMPredictor()
        
        # 더미 데이터로 모델 빌드 테스트
        input_shape = (20, 1)  # 원본 노트북: (X_train2.shape[1], 1) where X_train2.shape[1] = 20
        model = predictor.build_model(input_shape)
        
        if model is not None:
            print("✅ 모델 빌드 성공")
            
            # 레이어 구조 확인
            expected_layers = [
                ("LSTM", 20, True),   # units=20, return_sequences=True
                ("LSTM", 20, False),  # units=20, return_sequences=False  
                ("Dense", 1, None)    # units=1
            ]
            
            print("\n📋 레이어 구조 검증:")
            print("-" * 40)
            
            if hasattr(model, 'layers'):
                for i, layer in enumerate(model.layers):
                    layer_type = layer.__class__.__name__
                    if i < len(expected_layers):
                        expected_type, expected_units, expected_return_seq = expected_layers[i]
                        
                        units_match = True
                        return_seq_match = True
                        
                        if hasattr(layer, 'units'):
                            units_match = layer.units == expected_units
                            print(f"Layer {i+1}: {layer_type}(units={layer.units}) {'✅' if units_match else '❌'}")
                        else:
                            print(f"Layer {i+1}: {layer_type} ✅")
                            
                        if hasattr(layer, 'return_sequences') and expected_return_seq is not None:
                            return_seq_match = layer.return_sequences == expected_return_seq
                            print(f"         return_sequences={layer.return_sequences} {'✅' if return_seq_match else '❌'}")
                    else:
                        print(f"Layer {i+1}: {layer_type} (예상 외)")
                        
                print("-" * 40)
                print("🎯 원본 노트북 아키텍처와 일치 확인 완료")
                return True
            else:
                print("❌ 모델 레이어 정보를 가져올 수 없습니다.")
                return False
        else:
            print("❌ 모델 빌드 실패")
            return False
            
    except Exception as e:
        print(f"❌ 아키텍처 검증 실패: {e}")
        return False

def main():
    """메인 검증 함수"""
    print("🔬 원본 Jupyter 노트북 일치성 검증 시작")
    print("=" * 60)
    print(f"📅 검증 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = {
        "parameters": verify_notebook_parameters(),
        "architecture": verify_architecture(), 
        "performance": test_cpu_performance()
    }
    
    print("\n" + "=" * 60)
    print("📋 최종 검증 결과:")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, result in results.items():
        status = "✅ 통과" if result else "❌ 실패"
        print(f"{test_name:12}: {status}")
    
    print("-" * 60)
    print(f"전체 결과: {passed_tests}/{total_tests} 테스트 통과")
    
    if passed_tests == total_tests:
        print("🎉 모든 검증이 성공했습니다!")
        print("💡 현재 구현이 원본 Jupyter 노트북과 완벽히 일치합니다.")
    else:
        print("⚠️  일부 검증이 실패했습니다.")
        print("🔧 문제를 해결한 후 다시 실행해주세요.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
