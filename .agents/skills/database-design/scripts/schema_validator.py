#!/usr/bin/env python3
"""
Schema Validator - Database schema heuristic checks (regex-based).

NOTE: This performs lightweight, regex-based heuristics ONLY. It does NOT run
`prisma validate` and is not a substitute for it. For authoritative Prisma
schema validation, run `npx prisma validate`.

Usage:
    python schema_validator.py <project_path>

Heuristic checks:
    - Model/enum naming conventions (PascalCase)
    - Missing @id / createdAt fields
    - @@index suggestions for foreign-key-like fields
      (skips fields already covered by @id / @unique / @@unique / @@index)
"""

import sys
import json
import re
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass


EXCLUDED_DIRS = {'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo'}


def _is_excluded(path: Path) -> bool:
    """True if any component of the path is a vendored/build directory."""
    return any(part in EXCLUDED_DIRS for part in path.parts)


def find_schema_files(project_path: Path) -> list:
    """Find database schema files, skipping vendored/build directories."""
    schemas = []
    
    # Prisma schema
    prisma_files = [f for f in project_path.glob('**/prisma/schema.prisma')
                    if not _is_excluded(f)]
    schemas.extend([('prisma', f) for f in prisma_files])
    
    # Drizzle schema files
    drizzle_files = list(project_path.glob('**/drizzle/*.ts'))
    drizzle_files.extend(project_path.glob('**/schema/*.ts'))
    for f in drizzle_files:
        if _is_excluded(f):
            continue
        if 'schema' in f.name.lower() or 'table' in f.name.lower():
            schemas.append(('drizzle', f))
    
    return schemas[:10]  # Limit


def validate_prisma_schema(file_path: Path) -> list:
    """Validate Prisma schema file."""
    issues = []
    
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        
        # Find all models
        models = re.findall(r'model\s+(\w+)\s*{([^}]+)}', content, re.DOTALL)
        
        for model_name, model_body in models:
            # Check naming convention (PascalCase)
            if not model_name[0].isupper():
                issues.append(f"Model '{model_name}' should be PascalCase")
            
            # Check for id field
            if '@id' not in model_body and 'id' not in model_body.lower():
                issues.append(f"Model '{model_name}' might be missing @id field")
            
            # Check for createdAt/updatedAt
            if 'createdAt' not in model_body and 'created_at' not in model_body:
                issues.append(f"Model '{model_name}' missing createdAt field (recommended)")
            
            # Check for @relation without fields
            relations = re.findall(r'@relation\([^)]*\)', model_body)
            for rel in relations:
                if 'fields:' not in rel and 'references:' not in rel:
                    pass  # Implicit relation, ok
            
            # Check for @@index suggestions on foreign-key-like fields.
            # Skip fields that are already indexed via @id, @unique, @@unique,
            # or @@index (avoids false positives for fields like managerId /
            # userId that already carry a unique constraint).
            foreign_keys = re.findall(r'(\w+Id)\s+\w+', model_body)
            for fk in set(foreign_keys):
                field_line_match = re.search(
                    rf'^\s*{re.escape(fk)}\s+\w+.*$', model_body, re.MULTILINE)
                field_line = field_line_match.group(0) if field_line_match else ''

                already_indexed = (
                    '@unique' in field_line
                    or '@id' in field_line
                    or f'@@index([{fk}])' in content
                    or f'@@index(["{fk}"])' in content
                    or re.search(rf'@@unique\(\[[^\]]*\b{re.escape(fk)}\b[^\]]*\]\)', content) is not None
                    or re.search(rf'@@index\(\[[^\]]*\b{re.escape(fk)}\b[^\]]*\]\)', content) is not None
                )
                if not already_indexed:
                    issues.append(f"Consider adding @@index([{fk}]) for better query performance in {model_name}")
        
        # Check for enum definitions
        enums = re.findall(r'enum\s+(\w+)\s*{', content)
        for enum_name in enums:
            if not enum_name[0].isupper():
                issues.append(f"Enum '{enum_name}' should be PascalCase")
        
    except Exception as e:
        issues.append(f"Error reading schema: {str(e)[:50]}")
    
    return issues


def main():
    project_path = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    
    print(f"\n{'='*60}")
    print(f"[SCHEMA VALIDATOR] Database Schema Heuristic Checks (regex-based, NOT 'prisma validate')")
    print(f"{'='*60}")
    print(f"Project: {project_path}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-"*60)
    
    # Find schema files
    schemas = find_schema_files(project_path)
    print(f"Found {len(schemas)} schema files")
    
    if not schemas:
        output = {
            "script": "schema_validator",
            "project": str(project_path),
            "schemas_checked": 0,
            "issues_found": 0,
            "passed": True,
            "message": "No schema files found"
        }
        print(json.dumps(output, indent=2))
        sys.exit(0)
    
    # Validate each schema
    all_issues = []
    
    for schema_type, file_path in schemas:
        print(f"\nValidating: {file_path.name} ({schema_type})")
        
        if schema_type == 'prisma':
            issues = validate_prisma_schema(file_path)
        else:
            issues = []  # Drizzle validation could be added
        
        if issues:
            all_issues.append({
                "file": str(file_path.name),
                "type": schema_type,
                "issues": issues
            })
    
    # Summary
    print("\n" + "="*60)
    print("SCHEMA ISSUES")
    print("="*60)
    
    if all_issues:
        for item in all_issues:
            print(f"\n{item['file']} ({item['type']}):")
            for issue in item["issues"][:5]:  # Limit per file
                print(f"  - {issue}")
            if len(item["issues"]) > 5:
                print(f"  ... and {len(item['issues']) - 5} more issues")
    else:
        print("No schema issues found!")
    
    total_issues = sum(len(item["issues"]) for item in all_issues)
    # Schema issues are warnings, not failures
    passed = True
    
    output = {
        "script": "schema_validator",
        "project": str(project_path),
        "schemas_checked": len(schemas),
        "issues_found": total_issues,
        "passed": passed,
        "issues": all_issues
    }
    
    print("\n" + json.dumps(output, indent=2))
    
    sys.exit(0)


if __name__ == "__main__":
    main()
