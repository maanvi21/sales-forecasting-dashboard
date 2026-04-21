import pandas as pd
import sys

try:
    df = pd.read_csv('Global_Superstore2.csv', encoding='iso-8859-1')
    print("--- INFO ---")
    df.info()
    print("\n--- COLUMNS ---")
    print(df.columns.tolist())
    print("\n--- SAMPLE ---")
    print(df.head(2).to_string())
    print("\n--- MISSING VALUES ---")
    print(df.isnull().sum())
except Exception as e:
    print("Error:", e)
