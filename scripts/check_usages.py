import re

filepath = r"c:\Users\coros\Downloads\Trabajo\Learnation Workers\NeurOPS\app\api\admin.py"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    models_to_check = ["Program", "DailyReportQuestion"]
    
    current_function = None
    local_imports = {} # func_name -> set of imported models
    
    usage_map = {} # func_name -> set of used models
    
    for i, line in enumerate(lines):
        line_no = i + 1
        stripped = line.strip()
        
        # Detect function start
        match_def = re.match(r"def\s+(\w+)\s*\(", stripped)
        if match_def:
            current_function = match_def.group(1)
            local_imports[current_function] = set()
            usage_map[current_function] = set()
            continue
            
        if not current_function:
            continue
            
        # Detect local imports
        # from app.models import Program, ...
        match_import = re.match(r"from\s+app\.models\s+import\s+(.+)", stripped)
        if match_import:
            imports = [x.strip() for x in match_import.group(1).split(',')]
            local_imports[current_function].update(imports)
            
        # Detect usage
        for model in models_to_check:
            # Simple regex: word boundries
            if re.search(r"\b" + model + r"\b", stripped):
                # Ignore if it's the import line itself
                if not match_import or model not in imports:
                     usage_map[current_function].add(model)
                     
    # Analyze
    print("Analysis Results:")
    for func, used_models in usage_map.items():
        for model in used_models:
            imported = local_imports.get(func, set())
            if model not in imported:
                # Check if imported at top level?
                # We assume top level import is REMOVED for these models.
                print(f"WARNING: '{model}' used in '{func}' but NOT imported locally.")
                
except Exception as e:
    print(f"Error: {e}")
