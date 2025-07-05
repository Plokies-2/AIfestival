#!/usr/bin/env python3
"""
Intel-Optimized LSTM Stock Prediction Service
6-feature input (adj close, volume, RSI-14, Bollinger %) with 75-day window / 5-day horizon
Trains up to day -10, predicts 5 days (-4, -3, -2, -1, 0) and day +1

CHANGELOG:
- Based on lstm_finetuning.py with reference date fixed to 2025-06-05
- Implements temporal data leakage prevention with proper cutoff
- Evaluates on days -4 to 0 and predicts day +1 for traffic light
"""

import os
import sys
import json
import argparse
from datetime import datetime, date
from pathlib import Path
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.metrics import accuracy_score
from pandas.tseries.offsets import BDay
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def convert_to_serializable(obj):
    """
    Recursively convert numpy types to native Python types for JSON serialization.
    Handles nested dictionaries, lists, and numpy arrays.
    """
    if isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_serializable(item) for item in obj]
    return obj

# Module-level constants - June 5, 2025 as day 0 (reference date)
REFERENCE_DATE = date(2025, 6, 5)  # Day 0 - consistent with other Python services
TARGET_DATE = pd.Timestamp(REFERENCE_DATE)  # Target date for prediction

# Model Configuration
WINDOW_DAYS = 75               # LSTM input sequence length (75 trading days)
RSI_PERIOD = 14               # RSI calculation period
BB_PERIOD = 20                # Bollinger Bands period
BB_STD_MULT = 2               # Bollinger Bands standard deviation multiplier

# Date Configuration
TRAIN_CUTOFF_OFFSET = 10       # Business days before REF_DATE to end training
EVAL_HORIZON = 5              # Number of days to evaluate (-4 to 0)
PREDICTION_HORIZON = 1         # Days ahead to predict for traffic light

# Intel optimization environment variables
os.environ['OMP_NUM_THREADS'] = '16'
os.environ['KMP_AFFINITY'] = 'granularity=fine,compact,1,0'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '1'
os.environ['TF_ENABLE_BF16_CONVOLUTIONS'] = '1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['PYTHONWARNINGS'] = 'ignore'

# Suppress warnings
import warnings
warnings.filterwarnings('ignore')

# Configure TensorFlow threading for Intel Core Ultra 7 155H
tf.config.threading.set_intra_op_parallelism_threads(16)
tf.config.threading.set_inter_op_parallelism_threads(2)
tf.get_logger().setLevel('ERROR')

# Print startup log
logger.info(f"TensorFlow-Intel {tf.__version__} — oneDNN enabled")

def compute_technical_indicators(df):
    """
    Compute technical indicators for the given DataFrame.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        DataFrame with 'close' and 'volume' columns
        
    Returns:
    --------
    pandas.DataFrame
        DataFrame with added technical indicators
    """
    df = df.copy()
    
    # Calculate returns
    df['returns'] = df['close'].pct_change()
    
    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=RSI_PERIOD).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=RSI_PERIOD).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=BB_PERIOD).mean()
    df['bb_std'] = df['close'].rolling(window=BB_PERIOD).std()
    df['bb_upper'] = df['bb_middle'] + (df['bb_std'] * BB_STD_MULT)
    df['bb_lower'] = df['bb_middle'] - (df['bb_std'] * BB_STD_MULT)
    
    # Bollinger Band percentages
    df['bb_upper_pct'] = (df['close'] - df['bb_upper']) / df['bb_upper'] * 100
    df['bb_lower_pct'] = (df['close'] - df['bb_lower']) / df['bb_lower'] * 100
    df['bb_width_pct'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle'] * 100
    
    # Volatility
    df['volatility_30d'] = df['returns'].rolling(window=30).std() * np.sqrt(252)
    
    # Log returns
    df['log_return'] = np.log(df['close'] / df['close'].shift(1))
    
    # Clean up intermediate columns
    df = df.drop(['bb_middle', 'bb_std', 'bb_upper', 'bb_lower', 'returns'], axis=1, errors='ignore')
    
    return df

def apply_temporal_cutoff(df, target_date, cutoff_offset=5):
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
    cutoff_date = target_ts - BDay(cutoff_offset)
    original_rows = len(df)
    filtered_df = df[df.index <= cutoff_date].copy()
    rows_kept = len(filtered_df)
    rows_dropped = original_rows - rows_kept
    
    logger.info(f"Applied temporal cutoff: kept {rows_kept} rows, dropped {rows_dropped} rows")
    logger.info(f"Cutoff date: {cutoff_date.date()}, target date: {target_ts.date()}")
    
    return filtered_df, cutoff_date, rows_kept, rows_dropped

def load_and_prepare_data(ticker):
    """
    Load and prepare stock data for LSTM model training and evaluation.
    
    Parameters:
    -----------
    ticker : str
        Stock ticker symbol (e.g., 'AAPL')
        
    Returns:
    --------
    dict
        Dictionary containing prepared data and metadata
    """
    logger.info(f"Loading and preparing data for {ticker}...")
    
    try:
        # Load price and volume data
        data_dir = Path(__file__).parent.parent / 'data'
        price_file = data_dir / f'{ticker}_prices.csv'  # Expected format: Date,close
        volume_file = data_dir / f'{ticker}_volume.csv'  # Expected format: Date,volume
        
        if not price_file.exists() or not volume_file.exists():
            raise FileNotFoundError(f"Required data files not found for {ticker}")
        
        # Load and merge data
        price_df = pd.read_csv(price_file, parse_dates=['Date'], index_col='Date')
        volume_df = pd.read_csv(volume_file, parse_dates=['Date'], index_col='Date')
        
        df = pd.DataFrame({
            'close': price_df['close'],
            'volume': volume_df['volume']
        })
        
        # Ensure data is sorted by date
        df = df.sort_index()
        
        # Calculate technical indicators
        df = compute_technical_indicators(df)
        
        # Calculate target (1 if next day's close > today's close, else 0)
        df['target'] = (df['close'].shift(-1) > df['close']).astype(int)
        
        # Drop any remaining NaN values
        df = df.dropna()
        
        # Apply temporal cutoff for training data
        train_df, cutoff_date, rows_kept, rows_dropped = apply_temporal_cutoff(
            df, TARGET_DATE, cutoff_offset=TRAIN_CUTOFF_OFFSET
        )
        
        # Prepare features and target
        feature_cols = ['rsi', 'bb_upper_pct', 'bb_lower_pct', 'bb_width_pct', 'volatility_30d', 'log_return', 'volume']
        X = train_df[feature_cols].values
        y = train_df['target'].values
        
        # Scale features
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Create sequences
        X_seq, y_seq = create_sequences(X_scaled, WINDOW_DAYS, len(feature_cols))
        
        # Split into train/validation sets (80/20)
        train_size = int(0.8 * len(X_seq))
        X_train, X_val = X_seq[:train_size], X_seq[train_size:]
        y_train, y_val = y_seq[:train_size], y_seq[train_size:]
        
        # Prepare evaluation data (last 5 days)
        eval_start_date = TARGET_DATE - BDay(EVAL_HORIZON - 1)
        eval_df = df[(df.index >= eval_start_date) & (df.index <= TARGET_DATE)]
        
        if len(eval_df) < EVAL_HORIZON:
            raise ValueError(f"Insufficient evaluation data. Need {EVAL_HORIZON} days, got {len(eval_df)}")
        
        # Prepare prediction data (next day)
        pred_date = TARGET_DATE + BDay(PREDICTION_HORIZON)
        pred_df = df[df.index == pred_date]
        
        logger.info(f"Data loaded - Train: {len(X_train)} samples, Val: {len(X_val)} samples")
        logger.info(f"Eval period: {eval_df.index.min().date()} to {eval_df.index.max().date()}")
        
        return {
            'X_train': X_train,
            'y_train': y_train,
            'X_val': X_val,
            'y_val': y_val,
            'eval_data': eval_df,
            'pred_data': pred_df,
            'scaler': scaler,
            'feature_cols': feature_cols,
            'cutoff_date': cutoff_date,
            'rows_kept': rows_kept,
            'rows_dropped': rows_dropped,
            'status': 'success'
        }
        
    except Exception as e:
        logger.error(f"Error loading data: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }
    
    return result


def compute_indicators(df):
    """
    Compute technical indicators for LSTM features

    Parameters:
    -----------
    df : pandas.DataFrame
        DataFrame with columns ['Date', 'close', 'volume'] (or similar)

    Returns:
    --------
    pandas.DataFrame
        DataFrame with columns: ['close', 'volume', 'rsi14', 'bb_upper_pct', 'bb_lower_pct', 'bb_width_pct']
    """
    # Ensure we have the required columns
    if 'Adj Close' in df.columns:
        df = df.rename(columns={'Adj Close': 'close'})
    if 'Volume' in df.columns:
        df = df.rename(columns={'Volume': 'volume'})

    # Sort by date to ensure proper calculation
    df = df.sort_values('Date').copy()

    # Calculate RSI(14)
    delta = df['close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Use exponential moving average for RSI calculation
    avg_gain = gain.ewm(alpha=1/RSI_PERIOD, min_periods=RSI_PERIOD).mean()
    avg_loss = loss.ewm(alpha=1/RSI_PERIOD, min_periods=RSI_PERIOD).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    # Normalize RSI from 0-100 range to 0-1 scale
    df['rsi14'] = rsi / 100.0

    # Calculate Bollinger Bands
    sma = df['close'].rolling(window=BB_PERIOD).mean()
    std = df['close'].rolling(window=BB_PERIOD).std()
    bb_upper = sma + (BB_STD_MULT * std)
    bb_lower = sma - (BB_STD_MULT * std)

    # Calculate Bollinger Band features as percentages
    # bb_upper_pct: How far current price is above upper band (as percentage)
    df['bb_upper_pct'] = ((df['close'] - bb_upper) / bb_upper * 100).clip(lower=-100, upper=100)

    # bb_lower_pct: How far current price is above lower band (as percentage)
    df['bb_lower_pct'] = ((df['close'] - bb_lower) / bb_lower * 100).clip(lower=-100, upper=100)

    # bb_width_pct: Band width as percentage of middle line
    df['bb_width_pct'] = ((bb_upper - bb_lower) / sma * 100).clip(lower=0, upper=100)

    # Remove NaN values and reset index to ensure proper alignment
    df_clean = df.dropna().reset_index(drop=True)

    # Debug logging for technical indicator statistics
    print(f"Technical indicator stats:", file=sys.stderr)
    print(f"  Original data rows: {len(df)}, After NaN removal: {len(df_clean)}", file=sys.stderr)
    print(f"  RSI14 range: {df_clean['rsi14'].min():.3f} - {df_clean['rsi14'].max():.3f}", file=sys.stderr)
    print(f"  BB Upper %: {df_clean['bb_upper_pct'].min():.1f} - {df_clean['bb_upper_pct'].max():.1f}", file=sys.stderr)
    print(f"  BB Lower %: {df_clean['bb_lower_pct'].min():.1f} - {df_clean['bb_lower_pct'].max():.1f}", file=sys.stderr)
    print(f"  BB Width %: {df_clean['bb_width_pct'].min():.1f} - {df_clean['bb_width_pct'].max():.1f}", file=sys.stderr)
    print(f"  Date range: {df_clean['Date'].min().date()} to {df_clean['Date'].max().date()}", file=sys.stderr)

    # Return DataFrame with Date column and exact feature column order required
    feature_cols = ['Date', 'close', 'volume', 'rsi14', 'bb_upper_pct', 'bb_lower_pct', 'bb_width_pct']
    return df_clean[feature_cols]


# Removed update_history_csv function - no longer needed for traffic history tracking


def load_and_prepare_data(ticker):
    """
    Load and prepare data according to the new specification:
    1. Load all available data
    2. Compute ret5 on full dataset
    3. Split into train/eval/pred DataFrames
    4. Calculate technical indicators
    5. Dropna only on feature columns
    """
    try:
        ROOT_DIR = Path(__file__).resolve().parents[1]
        data_path = lambda name: ROOT_DIR / 'data' / f'sp500_{name}_3y.csv'

        # Load all columns
        df = pd.DataFrame()
        all_cols = ['open', 'high', 'low', 'close', 'adj_close', 'volume']

        # Track if REF_DATE is found in the data
        ref_date_found = False

        for col_name in all_cols:
            try:
                file_path = data_path(col_name)
                temp_df = pd.read_csv(file_path, usecols=['Date', ticker], parse_dates=['Date'], index_col='Date')
                col_name_formatted = col_name.replace('_', ' ').title().replace(' ', '')
                df[col_name_formatted] = temp_df[ticker]
                
                # Check if REF_DATE is in the data
                if not ref_date_found and REF_DATE in temp_df.index:
                    ref_date_found = True
                    
            except (FileNotFoundError, KeyError) as e:
                print(f"Failed to load data for ticker '{ticker}' from 'sp500_{col_name}_3y.csv'. Details: {e}", file=sys.stderr)
                sys.exit(1)

        # Log data loading results
        print(f"Loaded data shape: {df.shape}", file=sys.stderr)
        print(f"Data date range: {df.index.min().date()} to {df.index.max().date()}", file=sys.stderr)
        
        if not ref_date_found:
            print(f"WARNING: Reference date {REF_DATE.date()} not found in the data", file=sys.stderr)

        # Rename columns to match expected format
        df.rename(columns={'AdjClose': 'Adj Close'}, inplace=True)
        
        # Calculate returns and target (ret5 = price.pct_change(5).shift(-5))
        df['ret5'] = df['Adj Close'].pct_change(5).shift(-5)
        df['target'] = (df['ret5'] > 0).astype(int)
        
        # Log after adding target
        print(f"After adding target, shape: {df.shape}", file=sys.stderr)

        # Create train/eval/pred DataFrames before calculating indicators
        train_df = df[df.index <= REF_DATE - BDay(TRAIN_CUTOFF_OFFSET)].copy()
        eval_df = df[(df.index > REF_DATE - BDay(EVAL_HORIZON)) & (df.index <= REF_DATE)].copy()
        pred_df = df[df.index == REF_DATE + BDay(PREDICTION_HORIZON)].copy()
        
        # Log shapes after splitting
        print(f"Train shape: {train_df.shape}, date range: {train_df.index.min().date()} to {train_df.index.max().date()}", file=sys.stderr)
        print(f"Eval shape: {eval_df.shape}, date range: {eval_df.index.min().date()} to {eval_df.index.max() if not eval_df.empty else 'N/A'}", file=sys.stderr)
        print(f"Pred shape: {pred_df.shape}, date: {pred_df.index[0].date() if not pred_df.empty else 'N/A'}", file=sys.stderr)
        
        # Calculate technical indicators for each dataframe
        def add_indicators(df):
            if df.empty:
                return df
                
            # Calculate RSI
            delta = df['Adj Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['RSI'] = 100 - (100 / (1 + rs))
            
            # Calculate Bollinger Bands
            df['BB_MA'] = df['Adj Close'].rolling(window=20).mean()
            df['BB_STD'] = df['Adj Close'].rolling(window=20).std()
            df['BB_UPPER'] = df['BB_MA'] + (df['BB_STD'] * 2)
            df['BB_LOWER'] = df['BB_MA'] - (df['BB_STD'] * 2)
            df['BB_UPPER_PCT'] = (df['BB_UPPER'] - df['Adj Close']) / df['Adj Close']
            df['BB_LOWER_PCT'] = (df['Adj Close'] - df['BB_LOWER']) / df['Adj Close']
            df['BB_WIDTH_PCT'] = (df['BB_UPPER'] - df['BB_LOWER']) / df['BB_MA']
            
            # Calculate volatility and log returns
            df['log_return'] = np.log(df['Adj Close'] / df['Adj Close'].shift(1))
            df['volatility_30d'] = df['log_return'].rolling(window=30).std() * np.sqrt(252)
            
            # Clean up intermediate columns
            df.drop(['BB_MA', 'BB_STD', 'BB_UPPER', 'BB_LOWER'], axis=1, inplace=True)
            
            return df
        
        # Add indicators to each dataframe
        train_df = add_indicators(train_df)
        eval_df = add_indicators(eval_df)
        pred_df = add_indicators(pred_df)

        # Drop rows with missing feature values (but keep rows where only target is missing)
        # Only drop rows where feature columns are NaN, not target
        feature_cols = ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT', 'volatility_30d', 'log_return', 'Volume']
        
        train_df_clean = train_df.dropna(subset=feature_cols) if not train_df.empty else train_df
        eval_df_clean = eval_df.dropna(subset=feature_cols) if not eval_df.empty else eval_df
        pred_df_clean = pred_df.dropna(subset=feature_cols) if not pred_df.empty else pred_df
        
        # Log after cleaning
        print(f"After cleaning - Train: {train_df_clean.shape}, Eval: {eval_df_clean.shape}, Pred: {pred_df_clean.shape}", file=sys.stderr)
        
        # Verify we have enough data
        if len(train_df_clean) < 100:
            print(f"Insufficient training data: {len(train_df_clean)} rows (minimum 100 required)", file=sys.stderr)
            sys.exit(1)
            
        if eval_df_clean.empty:
            print("WARNING: No evaluation data available after cleaning", file=sys.stderr)
            
        if pred_df_clean.empty:
            print("WARNING: No prediction data available for traffic light", file=sys.stderr)

        return {
            'full': df,
            'train': train_df_clean,
            'eval': eval_df_clean,
            'pred': pred_df_clean
        }

    except Exception as e:
        print(f"Error in load_and_prepare_data: {e}", file=sys.stderr)
        raise
        sys.exit(1)


def create_sequences_with_labels(df, feature_cols=None):
    """
    Create sequences for LSTM training with shift(-5) label creation.

    This function assumes the input df has already been temporally filtered
    to prevent label leakage (i.e., df contains only dates <= target_date - 5).

    Parameters:
    -----------
    df : pandas.DataFrame
        DataFrame with technical indicator features and 'close' column
    feature_cols : list, optional
        List of feature column names. If None, uses all columns except 'Date'

    Returns:
    --------
    tuple
        (X, y) where X has shape (samples, WINDOW_DAYS, num_features) and y is binary labels
    """
    if feature_cols is None:
        feature_cols = ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT', 'volatility_30d', 'log_return', 'Volume']

    # Use existing ret5 column (already created and cleaned in main)
    df = df.copy()
    # 중복 레이블 생성 제거 - ret5는 이미 main에서 생성됨
    # if 'ret5' not in df.columns:
    #     price_col = 'Adj Close' if 'Adj Close' in df.columns else 'close'
    #     df['ret5'] = df[price_col].pct_change(5).shift(-5)

    df['target'] = (df['ret5'] > 0).astype(int)

    # Drop rows where target becomes NaN (last 5 rows)
    df_clean = df.dropna(subset=['target']).copy()

    X, y = [], []

    # Create sequences from the cleaned data
    for i in range(len(df_clean) - WINDOW_DAYS):
        # Extract sequence from df_clean.iloc[i:i+WINDOW_DAYS, feature_cols] with shape (75, 6)
        sequence = df_clean.iloc[i:i+WINDOW_DAYS][feature_cols].values

        # Verify sequence shape
        if sequence.shape != (WINDOW_DAYS, len(feature_cols)):
            print(f"Warning: sequence shape {sequence.shape} != expected ({WINDOW_DAYS}, {len(feature_cols)})", file=sys.stderr)
            continue

        X.append(sequence)

        # Target is at position i + WINDOW_DAYS
        target_idx = i + WINDOW_DAYS
        if target_idx < len(df_clean):
            y.append(df_clean.iloc[target_idx]['target'])

    return np.array(X), np.array(y), len(df_clean)


def focal_loss(gamma=2.0):
    """Focal Loss to address class imbalance more effectively than class weights"""
    def loss(y_true, y_pred):
        bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
        p_t = y_true * y_pred + (1 - y_true) * (1 - y_pred)
        return tf.pow(1 - p_t, gamma) * bce
    return loss


def sigmoid(x):
    """Sigmoid function for temperature calibration (from fine-tuning implementation)"""
    return 1 / (1 + np.exp(-x))


def build_lstm_model(input_shape=(WINDOW_DAYS, 7)):
    """
    Build LSTM classifier model matching lstm_finetuning.py exactly

    Architecture: LSTM(64) → Dropout(0.2) → Dense(1, sigmoid)
    Loss: binary_crossentropy with class_weight
    Features: 7 (RSI, BB_UPPER_PCT, BB_LOWER_PCT, BB_WIDTH_PCT, volatility_30d, log_return, Volume)
    """
    model = Sequential([
        Input(shape=input_shape),
        LSTM(64),
        Dropout(0.2),
        Dense(1, activation='sigmoid')
    ])

    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    return model


def build_sequence(all_data, indicators_df, scaler, target_date):
    """
    Build a single sequence for prediction on target_date with proper data alignment

    Parameters:
    -----------
    all_data : pandas.DataFrame
        DataFrame with Date and price columns (Date as Timestamp)
    indicators_df : pandas.DataFrame
        DataFrame with technical indicators (must have Date column)
    scaler : sklearn.preprocessing.MinMaxScaler
        Fitted scaler for features
    target_date : date or Timestamp
        Target date for sequence building

    Returns:
    --------
    numpy.ndarray
        Scaled sequence of shape (1, 75, 6)
    """
    # Convert target_date to Timestamp for consistent comparison
    target_ts = pd.Timestamp(target_date)

    # Find target date in indicators data
    date_mask = indicators_df['Date'] == target_ts
    if not date_mask.any():
        # Find nearest available date before or on target
        available_dates = indicators_df['Date'].values
        dates_before = [d for d in available_dates if d <= target_ts]
        if not dates_before:
            raise ValueError(f"No data available before {target_date}")
        actual_date = max(dates_before)
        date_mask = indicators_df['Date'] == actual_date
        print(f"Using nearest date {actual_date.date()} for target {target_date}", file=sys.stderr)

    # Get the row number (not index) in the indicators DataFrame
    matching_rows = indicators_df[date_mask]
    if len(matching_rows) == 0:
        raise ValueError(f"No matching date found for {target_date}")

    # Use iloc position (row number) instead of index
    date_position = matching_rows.index[0]
    row_number = indicators_df.index.get_loc(date_position)

    print(f"Target date: {target_date}, Row position: {row_number}, Total rows: {len(indicators_df)}", file=sys.stderr)

    # Check if we have enough data for WINDOW_DAYS sequence
    if row_number < WINDOW_DAYS:
        raise ValueError(f"Insufficient data before {target_date}: need {WINDOW_DAYS} days, have {row_number}")

    # Extract most recent WINDOW_DAYS (75) days from indicators data using iloc
    feature_cols = ['close', 'volume', 'rsi14', 'bb_upper_pct', 'bb_lower_pct', 'bb_width_pct']
    # Check if we have the renamed columns
    if 'Adj Close' in indicators_df.columns:
        feature_cols = ['Adj Close', 'Volume', 'RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT']
    start_row = row_number - WINDOW_DAYS
    end_row = row_number

    print(f"Extracting rows {start_row}:{end_row} for sequence", file=sys.stderr)
    sequence_data = indicators_df.iloc[start_row:end_row][feature_cols].values

    # Verify sequence shape before scaling (7 features)
    expected_features = 7
    if sequence_data.shape != (WINDOW_DAYS, expected_features):
        print(f"Available data shape: {sequence_data.shape}, expected: ({WINDOW_DAYS}, {expected_features})", file=sys.stderr)
        raise ValueError(f"Sequence shape mismatch: expected ({WINDOW_DAYS}, {expected_features}), got {sequence_data.shape}")

    sequence_scaled = scaler.transform(sequence_data)
    return sequence_scaled.reshape(1, WINDOW_DAYS, expected_features)  # (1, 75, 7)


def get_actual_label_if_available(all_data, target_date):
    """
    Get actual label for target_date if data is available

    Returns None for future dates, 0/1 for historical dates
    """
    try:
        # Convert target_date to Timestamp for consistent comparison
        target_ts = pd.Timestamp(target_date)

        date_mask = all_data['Date'] == target_ts
        if not date_mask.any():
            return None

        date_idx = all_data[date_mask].index[0]

        # Check if we have future data for HORIZON_DAYS prediction
        if date_idx + HORIZON_DAYS - 1 >= len(all_data):
            return None

        # Calculate actual label
        price_col = 'Adj Close' if 'Adj Close' in all_data.columns else 'close'
        current_price = all_data.iloc[date_idx-1][price_col]
        future_price = all_data.iloc[date_idx + HORIZON_DAYS - 1][price_col]
        return 1 if future_price > current_price else 0

    except Exception:
        return None


def main():
    """
    Main function with new 6-day prediction approach

    Trains up to day -5, predicts 6 days (-4, -3, -2, -1, 0, +1)
    Uses bias offset only (no calibration/thresholds)
    """
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python lstm_service.py <TICKER> [--no-volume]", file=sys.stderr)
        sys.exit(1)

    ticker = sys.argv[1].upper()
    # Volume is always included in the new data loading approach

    try:
        # Load and prepare data - returns a dictionary with 'full', 'train', 'eval', 'pred' DataFrames
        data_dict = load_and_prepare_data(ticker)
        full_df = data_dict['full']
        train_df = data_dict['train']
        eval_df = data_dict['eval']
        pred_df = data_dict['pred']

        # Apply temporal cut-off to prevent label leakage
        # Rule: Training data must end on REFERENCE_DATE - 10 trading days
        target_date = REFERENCE_DATE
        train_cutoff_offset = 10  # Training data ends at day -10
        eval_horizon = 5  # Evaluate on days -4 to 0 (5 days total)


        # Apply temporal cutoff to training data
        train_data_cutoff, cutoff_date, rows_kept, rows_dropped = apply_temporal_cutoff(
            train_df, target_date, train_cutoff_offset
        )

        # Logging: Train start/end, rows kept/dropped, target date, cut-off date
        train_start_date = train_data_cutoff.index.min().date()
        train_end_date = train_data_cutoff.index.max().date()

        print(f"Target date: {target_date}", file=sys.stderr)
        print(f"Train data range: {train_start_date} to {train_end_date}", file=sys.stderr)
        print(f"Cut-off date: {cutoff_date.date()}", file=sys.stderr)
        print(f"Rows kept: {rows_kept}, Rows dropped: {rows_dropped}", file=sys.stderr)

        if len(train_data_cutoff) < 100:
            print(f"Insufficient training data for {ticker} after cutoff", file=sys.stderr)
            sys.exit(1)

        # Prepare training data (already filtered to <= day -10 by load_and_prepare_data)
        train_indicators = train_data_cutoff.copy()
        print(f"Training data shape: {train_indicators.shape}", file=sys.stderr)

        # Ensure we have the required columns for training
        required_cols = ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT', 
                        'volatility_30d', 'log_return', 'Volume', 'Adj Close', 'target']
        missing_cols = [col for col in required_cols if col not in train_indicators.columns]
        if missing_cols:
            print(f"Missing required columns in training data: {missing_cols}", file=sys.stderr)
            sys.exit(1)

        # Calculate 5-day returns for training labels
        train_indicators['ret5'] = train_indicators['Adj Close'].pct_change(5).shift(-5)
        train_indicators['target'] = (train_indicators['ret5'] > 0).astype(int)
        
        # Drop rows with NaN values (including the last 5 rows with NaN ret5)
        train_indicators = train_indicators.dropna(subset=['ret5'] + required_cols)
        print(f"Training data after cleaning: {len(train_indicators)} rows", file=sys.stderr)

        # Scale the features
        feature_cols = ['RSI', 'BB_UPPER_PCT', 'BB_LOWER_PCT', 'BB_WIDTH_PCT', 
                       'volatility_30d', 'log_return', 'Volume']
        
        scaler = MinMaxScaler(feature_range=(0, 1))
        train_scaled = scaler.fit_transform(train_indicators[feature_cols])

        # Create sequences with labels
        train_scaled_df = pd.DataFrame(train_scaled, columns=feature_cols, index=train_indicators.index)
        train_scaled_df['Date'] = train_indicators.index
        train_scaled_df['Adj Close'] = train_indicators['Adj Close'].values
        train_scaled_df['target'] = train_indicators['target'].values

        # Create sequences for training
        X_train, y_train, _ = create_sequences_with_labels(train_scaled_df, feature_cols)
        
        print(f"Training data shape: {X_train.shape}, Labels: {y_train.shape}", file=sys.stderr)
        print(f"Class distribution: {np.mean(y_train):.2f} positive", file=sys.stderr)

        # Calculate class weights for imbalanced data
        from sklearn.utils.class_weight import compute_class_weight
        class_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
        class_weight_dict = {i: w for i, w in enumerate(class_weights)}
        
        # Create validation split (15% of training data)
        val_size = max(1, int(len(X_train) * 0.15))
        valX, valY = X_train[-val_size:], y_train[-val_size:]
        trainX, trainY = X_train[:-val_size], y_train[:-val_size]

        # Build and train the LSTM model
        model = build_lstm_model((WINDOW_DAYS, len(feature_cols)))
        
        # Early stopping callback
        early_stopping = EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True
        )

        # Train the model
        print("Training model...", file=sys.stderr)
        history = model.fit(
            trainX, trainY,
            epochs=30,
            batch_size=32,
            verbose=1,
            validation_data=(valX, valY),
            callbacks=[early_stopping],
            class_weight=class_weight_dict
        )
        
        # Log training results
        print(f"Training complete. Best validation loss: {min(history.history['val_loss']):.4f}", file=sys.stderr)

        # Prepare evaluation data (days -4 to 0)
        print("\nPreparing evaluation data (days -4 to 0)...", file=sys.stderr)
        
        # Ensure we have evaluation data
        if eval_df.empty:
            print("No evaluation data available. Cannot calculate accuracy.", file=sys.stderr)
            eval_results = []
            accuracy = 0.0
        else:
            # Sort evaluation data by date and select the last 5 days
            eval_df_sorted = eval_df.sort_index()
            eval_dates = eval_df_sorted.index[-5:]  # Last 5 days for evaluation
            
            print(f"Evaluating on {len(eval_dates)} days: {eval_dates[0].date()} to {eval_dates[-1].date()}", file=sys.stderr)
            
            # Initialize results storage
            eval_results = []
            accuracy_scores = []
            
            # Make predictions for each evaluation date
            for date in eval_dates:
                try:
                    # Get the data for this date
                    row = eval_df_sorted.loc[date]
                    
                    # Prepare sequence for prediction (use full_df for price history)
                    seq = build_sequence(full_df, eval_df_sorted, scaler, date)
                    if seq is None:
                        print(f"Skipping {date.date()}: insufficient data for sequence", file=sys.stderr)
                        continue
                    
                    # Make prediction
                    prob_up = float(model.predict(seq, verbose=0)[0][0])
                    predicted_direction = 1 if prob_up > 0.5 else 0
                    
                    # Get actual direction from target column
                    actual_direction = int(row['target']) if 'target' in row and not pd.isna(row['target']) else None
                    
                    # Calculate day offset from reference date
                    day_offset = (date.date() - REFERENCE_DATE.date()).days
                    
                    # Store prediction
                    pred_info = {
                        'date': date.strftime('%Y-%m-%d'),
                        'day_offset': day_offset,
                        'probability_up': prob_up,
                        'predicted_direction': predicted_direction,
                        'actual_direction': actual_direction
                    }
                    eval_results.append(pred_info)
                    
                    # Log prediction
                    actual_str = f"(actual: {actual_direction})" if actual_direction is not None else "(no actual)"
                    print(f"Prediction for {date.date()} (day {day_offset:+d}): {predicted_direction} {actual_str}", file=sys.stderr)
                    
                    # Calculate accuracy if we have actual direction
                    if actual_direction is not None:
                        is_correct = 1 if predicted_direction == actual_direction else 0
                        accuracy_scores.append(is_correct)
                        
                except Exception as e:
                    print(f"Error processing {date.date()}: {e}", file=sys.stderr)
            
            # Calculate overall accuracy
            accuracy = sum(accuracy_scores) / len(accuracy_scores) if accuracy_scores else 0.0
            print(f"\nAccuracy on evaluation set: {accuracy:.2f} ({sum(accuracy_scores)}/{len(accuracy_scores)})", file=sys.stderr)
        
        # Make prediction for traffic light (day +1)
        traffic_light_pred = None
        if not pred_df.empty:
            print("\nMaking traffic light prediction for day +1...", file=sys.stderr)
            pred_date = pred_df.index[0]
            try:
                # Prepare sequence for prediction
                seq = build_sequence(full_df, pred_df, scaler, pred_date)
                if seq is not None:
                    # Make prediction
                    prob_up = float(model.predict(seq, verbose=0)[0][0])
                    predicted_direction = 1 if prob_up > 0.5 else 0
                    
                    # Determine traffic light color based on probability
                    if prob_up > 0.525:
                        traffic_color = 'green'
                    elif prob_up < 0.475:
                        traffic_color = 'red'
                    else:
                        traffic_color = 'yellow'
                    
                    traffic_light_pred = {
                        'date': pred_date.strftime('%Y-%m-%d'),
                        'day_offset': 1,  # +1 day from reference
                        'probability_up': prob_up,
                        'predicted_direction': predicted_direction,
                        'traffic_color': traffic_color
                    }
                    
                    print(f"Traffic light prediction for {pred_date.date()} (day +1): {predicted_direction} (prob: {prob_up:.4f}, color: {traffic_color.upper()})", 
                          file=sys.stderr)
                else:
                    print("Could not prepare sequence for traffic light prediction", file=sys.stderr)
            except Exception as e:
                print(f"Error making traffic light prediction: {e}", file=sys.stderr)
        else:
            print("No data available for traffic light prediction", file=sys.stderr)

        # Prepare the final result
        result = {
            'ticker': ticker,
            'reference_date': REFERENCE_DATE.strftime('%Y-%m-%d'),
            'evaluation': {
                'dates': [r['date'] for r in eval_results],
                'day_offsets': [r['day_offset'] for r in eval_results],
                'probabilities': [r['probability_up'] for r in eval_results],
                'predictions': [r['predicted_direction'] for r in eval_results],
                'actuals': [r.get('actual_direction') for r in eval_results],
                'accuracy': accuracy
            },
            'traffic_light': None
        }
        
        # Add traffic light information if available
        if traffic_light_pred is not None:
            prob_up = traffic_light_pred['probability_up']
            result['traffic_light'] = {
                'date': traffic_light_pred['date'],
                'day_offset': 1,
                'probability_up': prob_up,
                'predicted_direction': traffic_light_pred['predicted_direction'],
                'color': traffic_light_pred['traffic_color'],
                'is_deactivated': False,
                'status': '활성화',
                'message': f"정확도 {sum(accuracy_scores)}/{len(accuracy_scores)} - {traffic_light_pred['traffic_color'].upper()}"
            }
        
        # Convert numpy types to native Python types for JSON serialization
        result_serializable = convert_to_serializable(result)
        print(json.dumps(result_serializable, ensure_ascii=False, default=str))

    except Exception as e:
        print(f"Error in main execution: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()