from app.services.two_chat_service import TwoChatService

test_cases = [
    ("+54 9 2346 459264", "5492346459264"),
    ("+52 1 5620 873819", "5215620873819"),
    (" (54) 2346-459264 ", "542346459264"),
    ("5492346459264", "5492346459264"),
    (None, ""),
    ("", ""),
]

print("--- Testing Phone Normalization ---")
success_count = 0
for raw, expected in test_cases:
    result = TwoChatService.normalize_phone(raw)
    if result == expected:
        print(f"PASSED: '{raw}' -> '{result}'")
        success_count += 1
    else:
        print(f"FAILED: '{raw}' -> Expected '{expected}', Got '{result}'")

print(f"\nSummary: {success_count}/{len(test_cases)} tests passed.")
