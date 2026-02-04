import sys

print(f"Python Executable: {sys.executable}")
print(f"Python Version: {sys.version}")

try:
    import jwt
    print(f"SUCCESS: 'jwt' module imported. Version: {getattr(jwt, '__version__', 'unknown')}")
except ImportError as e:
    print(f"ERROR: Could not import 'jwt': {e}")
    sys.exit(1)

try:
    from app.models import User
    print("SUCCESS: 'app.models.User' imported.")
except ImportError as e:
    print(f"ERROR: Could not import 'app.models': {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"ERROR: Exception importing 'app.models': {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
