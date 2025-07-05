import os
# Suppress TensorFlow GPU and oneDNN warnings. Must be set before TensorFlow is imported.
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

"""
CHANGELOG:
- Added temporal data leakage prevention with cutoff_offset=5 trading days
- Training data now filtered to Date <= target_date - 5 business days before label creation
- Added comprehensive logging for train start/end, rows kept/dropped, and cut-off dates
- Preserved existing shift(-5) logic within the temporally safe training slice
"""

from pathlib import Path
import sys
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.utils.class_weight import compute_class_weight
import pandas as pd
import numpy as np
import json
import argparse
from datetime import datetime
from pandas.tseries.offsets import BDay
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input, Dropout
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


def apply_temporal_cutoff(df, target_date, cutoff_offset=10):
    """
    Apply temporal cut-off to prevent label leakage.

    Rule: Training data must end on target_date - cutoff_offset (trading days)
    to ensure that when we create labels with shift(-5), no future information
    beyond target_date - 1 is used.

    Parameters:
    -----------
    df : pandas.DataFrame
        Raw dataframe with Date column
    target_date : str or pd.Timestamp
        Target prediction date (day D)
    cutoff_offset : int
        Number of trading days to subtract (default=5)

    Returns:
    --------
    tuple: (filtered_df, cutoff_date, rows_kept, rows_dropped)
    """
    target_ts = pd.Timestamp(target_date)

    # Calculate cut-off date: target_date - cutoff_offset business days
    cutoff_date = target_ts - BDay(cutoff_offset)

    # Filter dataframe to dates <= cutoff_date
    original_rows = len(df)
    filtered_df = df[df.index <= cutoff_date].copy()
    rows_kept = len(filtered_df)
    rows_dropped = original_rows - rows_kept

    return filtered_df, cutoff_date, rows_kept, rows_dropped

def create_sequences(data, look_back, num_features):
    dataX, dataY = [], []
    for i in range(len(data) - look_back):
        features = data[i:(i + look_back), :num_features]
        dataX.append(features)
        target = data[i + look_back, -1]
        dataY.append(target)
    return np.array(dataX), np.array(dataY)

def calculate_indicators(df):
    delta = df['Adj Close'].diff(1)
    gain = (delta.where(delta > 0, 0)).ewm(com=14 - 1, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(com=14 - 1, adjust=False).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))

    rolling_mean = df['Adj Close'].rolling(window=20).mean()
    rolling_std = df['Adj Close'].rolling(window=20).std()
    bb_upper = rolling_mean + (rolling_std * 2)
    bb_lower = rolling_mean - (rolling_std * 2)

    df['BB_UPPER_PCT'] = (df['Adj Close'] - bb_upper) / bb_upper * 100
    df['BB_LOWER_PCT'] = (df['Adj Close'] - bb_lower) / bb_lower * 100
    df['BB_WIDTH_PCT'] = (bb_upper - bb_lower) / df['Adj Close'] * 100
    return df


def run_prediction(ticker, target_date_str):
    # --- Random Walk Noise Control ---
    # 한 방향으로 너무 치중되는 거 아닐까? 하는 아이디어
    noise_factor = 0.00
    try:
        tf.get_logger().setLevel('ERROR')
        print(f"TensorFlow-Intel {tf.__version__} - oneDNN enabled")

        ROOT_DIR = Path(__file__).resolve().parents[1]
        data_path = lambda name: ROOT_DIR / 'data' / f'sp500_{name}_3y.csv'
        
        df = pd.DataFrame()
        all_cols = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
        
        for col_name in all_cols:
            try:
                file_path = data_path(col_name)
                temp_df = pd.read_csv(file_path, usecols=['Date', ticker], parse_dates=['Date'], index_col='Date')
                df[col_name.replace('_', ' ').title().replace(' ', '')] = temp_df[ticker]
            except (FileNotFoundError, KeyError) as e:
                print(json.dumps({"error": f"Failed to load data for ticker '{ticker}' from 'sp500_{col_name}_3y.csv'. Details: {e}"}, indent=4))
                return
        
        df.rename(columns={'AdjClose': 'Adj Close'}, inplace=True)
        df.dropna(inplace=True)

        # Apply temporal cut-off to prevent label leakage
        # Rule: Training data must end on target_date - 5 trading days
        target_date = pd.to_datetime(target_date_str)
        cutoff_offset = 10

        df_cutoff, cutoff_date, rows_kept, rows_dropped = apply_temporal_cutoff(
            df, target_date, cutoff_offset
        )

        # Logging: Train start/end, rows kept/dropped, target date, cut-off date
        train_start_date = df_cutoff.index.min().date()
        train_end_date = df_cutoff.index.max().date()

        print(f"Target date: {target_date.date()}")
        print(f"Cut-off date: {cutoff_date.date()}")
        print(f"Train start: {train_start_date}")
        print(f"Train end: {train_end_date}")
        print(f"Rows kept: {rows_kept}, Rows dropped: {rows_dropped}")

        # Calculate indicators on cutoff data
        df = calculate_indicators(df_cutoff)
        df['log_return'] = np.log(df['Adj Close'] / df['Adj Close'].shift(1))
        df['volatility_30d'] = df['log_return'].rolling(window=30).std() * np.sqrt(252)

        # Create labels with shift(-5) - safe because data is pre-filtered
        df['R_PCT_5D_FWD'] = df['Adj Close'].pct_change(5).shift(-5) * 100
        df.dropna(inplace=True)
        df['target'] = (df['R_PCT_5D_FWD'] > 0).astype(int)

        # Calculate rows dropped due to horizon (should be exactly 5)
        rows_dropped_horizon = rows_kept - len(df)
        print(f"Rows dropped (horizon): {rows_dropped_horizon}")

        print(f"Dataset range: {df.index.min().strftime('%Y-%m-%d')} to {df.index.max().strftime('%Y-%m-%d')}")

        look_back = 75

        # --- Data Splitting: Use all cutoff data for training ---
        # Since temporal cutoff already applied, use all available data for training
        # The cutoff ensures no label leakage beyond target_date - 1

        train_df = df.copy()

        # For evaluation, we need to create a separate dataset that includes prediction dates
        # Load the full dataset again for evaluation purposes
        df_full = pd.DataFrame()
        for col_name in all_cols:
            try:
                file_path = data_path(col_name)
                temp_df = pd.read_csv(file_path, usecols=['Date', ticker], parse_dates=['Date'], index_col='Date')
                df_full[col_name.replace('_', ' ').title().replace(' ', '')] = temp_df[ticker]
            except (FileNotFoundError, KeyError) as e:
                print(json.dumps({"error": f"Failed to load full data for evaluation. Details: {e}"}, indent=4))
                return

        df_full.rename(columns={'AdjClose': 'Adj Close'}, inplace=True)
        df_full.dropna(inplace=True)
        df_full = calculate_indicators(df_full)
        df_full['log_return'] = np.log(df_full['Adj Close'] / df_full['Adj Close'].shift(1))
        df_full['volatility_30d'] = df_full['log_return'].rolling(window=30).std() * np.sqrt(252)
        df_full['R_PCT_5D_FWD'] = df_full['Adj Close'].pct_change(5).shift(-5) * 100
        df_full.dropna(inplace=True)
        df_full['target'] = (df_full['R_PCT_5D_FWD'] > 0).astype(int)

        # Create eval_df for prediction window around target_date
        try:
            target_date_iloc = df_full.index.get_loc(df_full.index.asof(target_date))
            eval_start_iloc = max(0, target_date_iloc - look_back - 4)
            eval_df = df_full.iloc[eval_start_iloc:]
        except (KeyError, TypeError):
            print(json.dumps({"error": f"Target date {target_date_str} not found in full dataset."}, indent=4))
            return
        
        features = ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT', 'volatility_30d', 'log_return', 'Volume']
        target = 'target'
        num_features = len(features)
        
        print("Technical indicator stats:")
        for col in ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT']:
            print(f"  {col} range: {df[col].min():.3f} - {df[col].max():.3f}")

        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_train_features = scaler.fit_transform(train_df[features])
        scaled_eval_features = scaler.transform(eval_df[features])

        train_data = np.hstack([scaled_train_features, train_df[[target]]])
        eval_data = np.hstack([scaled_eval_features, eval_df[[target]]])
        print(f"학습 데이터 형태 (leak-free): {train_data.shape}")

        print(f"입력 형태: ({len(train_df) - look_back}, {look_back}, {num_features})")

        trainX, trainY = create_sequences(train_data, look_back, num_features=num_features)
        evalX, evalY = create_sequences(eval_data, look_back, num_features=num_features)

        if len(np.unique(trainY)) < 2:
            print(json.dumps({"error": "Training data has only one class, cannot train the model.", "ticker": ticker, "date": target_date_str}, indent=4))
            return

        class_weights = compute_class_weight('balanced', classes=np.unique(trainY), y=trainY)
        class_weight_dict = {i: w for i, w in enumerate(class_weights)}
        print(f"클래스 가중치: {{0: '{class_weight_dict.get(0, 1.0):.2f}', 1: '{class_weight_dict.get(1, 1.0):.2f}'}}")

        val_size = int(len(trainX) * 0.15)
        if val_size < 1:
            print(json.dumps({"error": "Not enough data to create a validation set."}, indent=4))
            return
        valX, valY = trainX[-val_size:], trainY[-val_size:]
        trainX_no_val, trainY_no_val = trainX[:-val_size], trainY[:-val_size]

        early_stopping = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)

        model = Sequential([
            Input(shape=(look_back, num_features)),
            LSTM(64),
            Dropout(0.2),
            Dense(1, activation='sigmoid')
        ])
        model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])
        
        model.fit(
            trainX_no_val, trainY_no_val, 
            epochs=30, 
            batch_size=32, 
            verbose=0,
            validation_data=(valX, valY),
            callbacks=[early_stopping],
            class_weight=class_weight_dict
        )

        def sigmoid(x):
            return 1 / (1 + np.exp(-x))

        epsilon = 1e-6
        p_pos = trainY.mean()
        logit_bias = np.log((p_pos + epsilon) / (1 - p_pos + epsilon))
        temperature = 0.9
        
        val_probs_raw = model.predict(valX, verbose=0).flatten()
        val_logits_raw = np.log((val_probs_raw + epsilon) / (1 - val_probs_raw + epsilon))
        val_logits_adj = (val_logits_raw + logit_bias) / temperature
        val_probs_calibrated = sigmoid(val_logits_adj)

        thresholds = np.arange(0.05, 0.95, 0.01)
        f1_scores = [f1_score(valY, val_probs_calibrated > t, zero_division=0) for t in thresholds]

        if not any(f1_scores) or np.all(np.isnan(f1_scores)):
            optimal_threshold = 0.5
            max_f1 = f1_score(valY, val_probs_calibrated > optimal_threshold, zero_division=0)
        else:
            optimal_idx = np.nanargmax(f1_scores)
            optimal_threshold = thresholds[optimal_idx]
            max_f1 = f1_scores[optimal_idx]
        
        print(f"Logit 편향 (b): {logit_bias:.4f}, 온도 (T): {temperature}")
        print(f"최적 임계값 (θ): {optimal_threshold:.2f} (검증 F1: {max_f1:.4f})")

        predictions_log = []
        predicted_directions = []
        actuals = []
        final_probs = []

        # Find the integer location of the target date within the evaluation dataframe (eval_df)
        try:
            # Find the last valid trading day at or before the target date, compatible with older pandas versions
            last_valid_date = eval_df.index.asof(target_date)
            if pd.isna(last_valid_date):
                # Handle case where target_date is before the first date in eval_df
                raise KeyError
            # Get the integer location of that date
            target_date_iloc = eval_df.index.get_loc(last_valid_date)
        except KeyError:
            print(json.dumps({"error": f"Target date {target_date_str} is outside the evaluation range or no data available before it."}, indent=4))
            return

        # Define the 6-day prediction window using integer locations (days -4 to +1)
        prediction_start_iloc = target_date_iloc - 4
        prediction_end_iloc = target_date_iloc + 1  # Include day +1

        # Ensure the window is valid, but allow partial windows
        if prediction_start_iloc < 0:
            prediction_start_iloc = 0

        # Loop through the prediction window using integer locations from eval_df
        for i in range(prediction_start_iloc, prediction_end_iloc + 1):

            # The sequence for prediction ends at index `i` in eval_data
            sequence_end_index = i
            sequence_start_index = sequence_end_index - look_back + 1

            if sequence_start_index < 0:
                continue

            # For day +1, we might be beyond eval_df bounds, so handle this case
            if i >= len(eval_df):
                # This is day +1 - generate the date manually
                target_date_actual = eval_df.index[target_date_iloc]
                from pandas.tseries.offsets import BDay
                current_date = target_date_actual + BDay(1)  # Day +1

                # Use the last available sequence for prediction
                sequence_data = eval_data[sequence_start_index - 1 : sequence_end_index]
            else:
                # Extract the sequence from eval_data (which contains scaled features)
                sequence_data = eval_data[sequence_start_index : sequence_end_index + 1]
                current_date = eval_df.index[i]

            if sequence_data.shape[0] != look_back:
                continue

            # Extract just the features and reshape for LSTM
            input_sequence = sequence_data[:, :num_features]
            predict_day_features = np.reshape(input_sequence, (1, look_back, num_features))

            # Predict
            raw_prob = model.predict(predict_day_features, verbose=0)[0][0]
            prob_clipped = np.clip(raw_prob, epsilon, 1 - epsilon)
            logit = np.log(prob_clipped / (1 - prob_clipped))
            calibrated_prob = 1 / (1 + np.exp(-(logit + logit_bias) / temperature))
            prob_up = calibrated_prob

            # --- Add random walk noise ---
            # Noise increases with the prediction horizon to simulate growing uncertainty
            prediction_horizon_day = i - prediction_start_iloc  # Horizon from 0 to 5
            noise_std_dev = prediction_horizon_day * noise_factor
            noise = np.random.normal(0, noise_std_dev)
            prob_up += noise
            prob_up = np.clip(prob_up, 0, 1)  # Ensure probability remains in [0, 1]

            final_probs.append(prob_up)

            predicted_direction = 1 if prob_up > optimal_threshold else 0

            # Check if actual direction is available (day +1 won't have actual data)
            actual_direction = None
            day_offset = i - target_date_iloc  # Calculate day offset relative to target date

            try:
                if i < len(eval_df) and current_date in eval_df.index and 'target' in eval_df.columns:
                    actual_direction = int(eval_df.loc[current_date, 'target'])
            except (KeyError, IndexError):
                # Day +1 or other future dates won't have actual data
                actual_direction = None

            # Only include in accuracy calculation if actual direction is available (days -4 to 0)
            if actual_direction is not None and day_offset <= 0:
                predicted_directions.append(predicted_direction)
                actuals.append(actual_direction)

            predictions_log.append({
                "date": current_date.strftime('%Y-%m-%d'),
                "day_offset": day_offset,
                "prob_up": float(f"{prob_up:.4f}"),
                "predicted_direction": predicted_direction,
                "actual_direction": actual_direction,
                "prediction_horizon": 5
            })

        if not predictions_log:
            print(json.dumps({"error": "Could not generate any predictions for the target date range.", "ticker": ticker, "date": target_date_str}, indent=4))
            return

        hits_last5 = sum(p == a for p, a in zip(predicted_directions, actuals))

        # Find day +1 prediction for traffic light calculation
        day_plus_1_prediction = None
        day_plus_1_prob_up = 0.0

        for pred in predictions_log:
            if pred.get("day_offset") == 1:  # Day +1
                day_plus_1_prediction = pred
                day_plus_1_prob_up = pred['prob_up']
                break

        if day_plus_1_prediction is None:
            print(f"[LSTM accuracy: {hits_last5}, No Day +1 prediction available, Traffic light: RED]")
            return

        # Traffic light logic based on day +1 prediction probability
        if day_plus_1_prob_up > 0.525:
            traffic_light = "GREEN"
        elif day_plus_1_prob_up >= 0.475:
            traffic_light = "YELLOW"
        else:
            traffic_light = "RED"

        # Final simplified output
        print(f"[LSTM accuracy: {hits_last5}, Prediction probability up: {day_plus_1_prob_up:.3f}, Traffic light: {traffic_light}]")

    except Exception as e:
        error_output = {"error": str(e), "ticker": ticker, "date": target_date_str}
        print(json.dumps(error_output, indent=4))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='LSTM Directional Stock Prediction with Technical Indicators.')
    parser.add_argument('ticker', type=str, help='Stock ticker symbol (e.g., AAPL)')
    parser.add_argument('date', type=str, help='Target date in YYYY-MM-DD format')
    args = parser.parse_args()
    run_prediction(args.ticker, args.date)
