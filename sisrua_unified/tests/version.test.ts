import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Version consistency tests
 * Ensures all version declarations across the project are synchronized
 */
describe('Version Consistency', () => {
  const projectRoot = join(__dirname, '..');
  
  // Read VERSION file (source of truth)
  const versionFilePath = join(projectRoot, 'VERSION');
  const expectedVersion = readFileSync(versionFilePath, 'utf-8').trim();

  it('VERSION file should contain a valid semantic version', () => {
    expect(expectedVersion).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/);
  });

  it('package.json version should match VERSION file', () => {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    expect(packageJson.version).toBe(expectedVersion);
  });

  it('package-lock.json version should match VERSION file', () => {
    const packageLockPath = join(projectRoot, 'package-lock.json');
    const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf-8'));
    
    expect(packageLock.version).toBe(expectedVersion);
    
    // Also check nested package version
    if (packageLock.packages && packageLock.packages['']) {
      expect(packageLock.packages[''].version).toBe(expectedVersion);
    }
  });

  it('py_engine/constants.py should have matching PROJECT_VERSION', () => {
    const constantsPath = join(projectRoot, 'py_engine', 'constants.py');
    const constantsContent = readFileSync(constantsPath, 'utf-8');
    
    // Extract PROJECT_VERSION value
    const match = constantsContent.match(/PROJECT_VERSION\s*=\s*['"]([^'"]+)['"]/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(expectedVersion);
  });

  it('src/hooks/useFileOperations.ts should have matching PROJECT_VERSION', () => {
    const useFileOpsPath = join(projectRoot, 'src', 'hooks', 'useFileOperations.ts');
    const useFileOpsContent = readFileSync(useFileOpsPath, 'utf-8');
    
    // Extract PROJECT_VERSION value
    const match = useFileOpsContent.match(/const\s+PROJECT_VERSION\s*=\s*['"]([^'"]+)['"]/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(expectedVersion);
  });

  it('src/constants.ts should have matching APP_VERSION', () => {
    const srcConstantsPath = join(projectRoot, 'src', 'constants.ts');
    const srcConstantsContent = readFileSync(srcConstantsPath, 'utf-8');
    
    const match = srcConstantsContent.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(expectedVersion);
  });

  it('server/version.ts should have matching SERVER_VERSION', () => {
    const serverVersionPath = join(projectRoot, 'server', 'version.ts');
    const serverVersionContent = readFileSync(serverVersionPath, 'utf-8');
    
    const match = serverVersionContent.match(/SERVER_VERSION\s*=\s*['"]([^'"]+)['"]/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(expectedVersion);
  });

  it('all version declarations should be identical', () => {
    // This is a meta-test that ensures all the above tests are in sync
    const packageJsonPath = join(projectRoot, 'package.json');
    const constantsPath = join(projectRoot, 'py_engine', 'constants.py');
    const useFileOpsPath = join(projectRoot, 'src', 'hooks', 'useFileOperations.ts');
    const srcConstantsPath = join(projectRoot, 'src', 'constants.ts');
    const serverVersionPath = join(projectRoot, 'server', 'version.ts');
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const constantsContent = readFileSync(constantsPath, 'utf-8');
    const useFileOpsContent = readFileSync(useFileOpsPath, 'utf-8');
    const srcConstantsContent = readFileSync(srcConstantsPath, 'utf-8');
    const serverVersionContent = readFileSync(serverVersionPath, 'utf-8');
    
    const pyMatch = constantsContent.match(/PROJECT_VERSION\s*=\s*['"]([^'"]+)['"]/);
    const tsMatch = useFileOpsContent.match(/const\s+PROJECT_VERSION\s*=\s*['"]([^'"]+)['"]/);
    const appVerMatch = srcConstantsContent.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
    const serverVerMatch = serverVersionContent.match(/SERVER_VERSION\s*=\s*['"]([^'"]+)['"]/);
    
    const versions = [
      expectedVersion,
      packageJson.version,
      pyMatch![1],
      tsMatch![1],
      appVerMatch![1],
      serverVerMatch![1],
    ];
    
    // All versions should be identical
    const uniqueVersions = [...new Set(versions)];
    expect(uniqueVersions.length).toBe(1);
    expect(uniqueVersions[0]).toBe(expectedVersion);
  });
});
