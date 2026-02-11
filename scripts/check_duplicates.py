import re

filepath = r"c:\Users\coros\Downloads\Trabajo\Learnation Workers\NeurOPS\app\api\admin.py"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    functions = ["manage_questions", "manage_programs", "delete_pipeline_stage"]
    
    for func in functions:
        pattern = rf"def\s+{func}\s*\("
        matches = list(re.finditer(pattern, content))
        print(f"Function '{func}' found {len(matches)} times.")
        for m in matches:
            line_no = content[:m.start()].count('\n') + 1
            print(f"  - Line {line_no}")
            
except Exception as e:
    print(f"Error: {e}")
