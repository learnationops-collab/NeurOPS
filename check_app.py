from app import create_app
try:
    app = create_app()
    print("App created successfully")
except Exception as e:
    print(f"Failed to create app: {e}")
    import traceback
    traceback.print_exc()
