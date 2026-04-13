import requests
import json

BASE_URL = "https://script.google.com/macros/s/AKfycbx5Dedw8MTavNQbzgpdWLmRyFPIVeDiuaKIB-j6NsaIS1wbegR4xpHq8BXs-QR2_Fr_/exec"

def check_agendas():
    print("Checking 10 agendas from Llamadas_DB...")
    try:
        response = requests.get(BASE_URL, params={"tabla": "Llamadas_DB"}, timeout=30)
        data = response.json()
        print(f"Total rows: {len(data)}")
        for i in range(min(10, len(data))):
            print(f"\nRow {i}:")
            print(json.dumps(data[i], indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_agendas()
