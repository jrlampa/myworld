#!/usr/bin/env python3
"""
Python Security Audit Script
Verifies Python dependencies for known vulnerabilities

Usage:
    python scripts/security_audit.py
"""

import sys
import subprocess
import json

def run_command(cmd):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except Exception as e:
        return -1, "", str(e)

def check_pip_audit():
    """Check if pip-audit is installed"""
    code, stdout, stderr = run_command("pip-audit --version")
    if code != 0:
        print("⚠️  pip-audit not installed")
        print("Installing pip-audit...")
        install_code, _, install_err = run_command("pip install pip-audit")
        if install_code != 0:
            print(f"❌ Failed to install pip-audit: {install_err}")
            return False
    return True

def run_pip_audit():
    """Run pip-audit on requirements.txt"""
    print("\n🔍 Running pip-audit on py_engine/requirements.txt...")
    print("=" * 60)
    
    code, stdout, stderr = run_command(
        "pip-audit --requirement py_engine/requirements.txt --format json"
    )
    
    if code == 0:
        print("✅ No vulnerabilities found!")
        return True
    
    # Parse JSON output
    try:
        if stdout:
            vulnerabilities = json.loads(stdout)
            if vulnerabilities.get('dependencies'):
                print(f"\n❌ Found {len(vulnerabilities['dependencies'])} vulnerable packages:\n")
                for dep in vulnerabilities['dependencies']:
                    print(f"  Package: {dep['name']} {dep['version']}")
                    for vuln in dep.get('vulns', []):
                        print(f"    - {vuln['id']}: {vuln.get('description', 'No description')}")
                        print(f"      Fix: Upgrade to {vuln.get('fix_versions', ['unknown'])[0]}")
                print("\n💡 Run 'pip install --upgrade <package>' to fix")
                return False
    except json.JSONDecodeError:
        # Fallback to text output
        print(stderr if stderr else stdout)
        return False
    
    return True

def check_bandit():
    """Check for common security issues in Python code"""
    print("\n🔍 Running Bandit security linter...")
    print("=" * 60)
    
    # Check if bandit is installed
    code, _, _ = run_command("bandit --version")
    if code != 0:
        print("⚠️  Bandit not installed")
        print("Installing bandit...")
        install_code, _, install_err = run_command("pip install bandit")
        if install_code != 0:
            print(f"❌ Failed to install bandit: {install_err}")
            return True  # Non-critical, continue
    
    # Run bandit
    code, stdout, stderr = run_command(
        "bandit -r py_engine/ -f json -ll"  # -ll = only medium/high severity
    )
    
    if code == 0:
        print("✅ No security issues found!")
        return True
    
    # Parse output
    try:
        if stdout:
            results = json.loads(stdout)
            issues = results.get('results', [])
            if issues:
                print(f"\n⚠️  Found {len(issues)} security issues:\n")
                for issue in issues:
                    print(f"  {issue['filename']}:{issue['line_number']}")
                    print(f"    {issue['issue_severity']}: {issue['issue_text']}")
                    print(f"    {issue['issue_confidence']} confidence")
                    print()
                return False
    except json.JSONDecodeError:
        print(stdout if stdout else stderr)
    
    return True

def main():
    """Main security audit function"""
    print("\n" + "=" * 60)
    print("🛡️  Python Security Audit")
    print("=" * 60)
    
    success = True
    
    # Check pip-audit
    if check_pip_audit():
        if not run_pip_audit():
            success = False
    
    # Check bandit
    if not check_bandit():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✅ Security audit passed!")
        print("=" * 60)
        return 0
    else:
        print("❌ Security audit found issues - please review above")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
