import requests
import json

BASE_URL = "http://localhost:5000/api"
# Assuming we can login or use a token. 
# Since I cannot easily get a token without login, I might need to simulate it or ask user.
# However, I can try to access the health check first.

def test_api():
    try:
        # 1. Health Check
        resp = requests.get(f"{BASE_URL}/health")
        print(f"Health: {resp.status_code}")
        
        # 2. Check if comments endpoint exists (even if 401)
        resp = requests.get(f"{BASE_URL}/comments/")
        print(f"Comments Endpoint Status: {resp.status_code}")
        
        if resp.status_code == 404:
            print("ERROR: Comments endpoint not found. Server might need restart.")
        elif resp.status_code == 401:
             print("SUCCESS: Comments endpoint exists (Unauthorized as expected).")
        else:
             print(f"Unexpected status: {resp.status_code}")

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_api()
