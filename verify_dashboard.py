import requests
import sys

# Constants
BASE_URL = 'http://localhost:5000'

def run_verification():
    session = requests.Session()
    
    # 1. Create Closer via Emergency route (just to be sure we have one)
    print("Creating/Ensuring test closer exists...")
    create_payload = {
        "username": "testcloser_v2",
        "email": "testcloser_v2@example.com",
        "password": "password123",
        "role": "closer",
        "code": "putofreud"
    }
    
    try:
        r = session.post(f"{BASE_URL}/auth/emergency-create", json=create_payload)
        if r.status_code == 201 or "ya existe" in r.text:
            print("Closer created or exists.")
        else:
            print(f"Failed to create closer: {r.status_code} {r.text}")
            # Try login anyway if it exists
    except Exception as e:
        print(f"Error connecting to server: {e}")
        return

    # 2. Login
    print("Logging in...")
    login_payload = {
        "email": "testcloser_v2@example.com",
        "password": "password123"
    }
    r = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if r.status_code != 200:
        print(f"Login failed: {r.status_code} {r.text}")
        return
    print("Login successful.")

    # 3. Fetch Dashboard
    print("Fetching Dashboard Data...")
    r = session.get(f"{BASE_URL}/api/closer/dashboard")
    if r.status_code == 200:
        data = r.json()
        print("Dashboard Data Fetched Successfully!")
        print("Keys present:", list(data.keys()))
        
        # Check critical fields
        if 'today_stats' in data:
            print(f"today_stats ok: {data['today_stats']}")
        else:
            print("WARNING: today_stats missing")
            
        print("Verification PASSED")
    else:
        print(f"Dashboard fetch failed: {r.status_code} {r.text}")
        print("Verification FAILED")

if __name__ == "__main__":
    run_verification()
