
import * as fs from 'fs/promises';
import * as path from 'path';
import { mkdir } from '../../tools/mkdir';
import { initializeSecurityController, getSecurityController, SecurityControllerV2 } from '../../core/security-controller-v2';

describe('mkdir tool', () => {
  const testDir = path.resolve(__dirname, 'mkdir-test-dir');
  let securityController: SecurityControllerV2;

  beforeAll(async () => {
    await initializeSecurityController([testDir]);
    securityController = getSecurityController();
  });

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create a single directory successfully', async () => {
    const newDirPath = path.join(testDir, 'new-dir');
    const result = await mkdir({ path: newDirPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('success');
      expect(result.directory_info.resolved_path).toBe(newDirPath);
      expect(result.directory_info.created_new).toBe(true);
      expect(result.directory_info.parent_directories_created).toEqual([]);
    }
    await expect(fs.access(newDirPath)).resolves.toBeUndefined();
  });

  it('should create nested directories recursively by default', async () => {
    const nestedDirPath = path.join(testDir, 'level1', 'level2', 'level3');
    const result = await mkdir({ path: nestedDirPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('success');
      expect(result.directory_info.resolved_path).toBe(nestedDirPath);
      expect(result.directory_info.created_new).toBe(true);
      expect(result.directory_info.parent_directories_created).toEqual([
        path.join(testDir, 'level1'),
        path.join(testDir, 'level1', 'level2'),
      ]);
    }
    await expect(fs.access(nestedDirPath)).resolves.toBeUndefined();
  });

  it('should fail to create nested directories if recursive is false and parent does not exist', async () => {
    const nestedDirPath = path.join(testDir, 'level1', 'level2');
    const result = await mkdir({ path: nestedDirPath, recursive: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toContain('operation_failed');
    }
    await expect(fs.access(nestedDirPath)).rejects.toThrow();
  });

  it('should return an error if directory already exists', async () => {
    const existingDirPath = path.join(testDir, 'existing-dir');
    await fs.mkdir(existingDirPath);

    const result = await mkdir({ path: existingDirPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('warning');
      expect(result.warnings).toContain('Directory already exists');
    }
    await expect(fs.access(existingDirPath)).resolves.toBeUndefined();
  });

  it('should return an error for invalid path', async () => {
    // Use a path that's guaranteed to be invalid (null byte is always invalid)
    const invalidPath = path.join(testDir, 'invalid\0dir');
    const result = await mkdir({ path: invalidPath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied'); // Security validation happens first
    }
  });

  it('should return permission_denied for restricted access', async () => {
    const restrictedPath = path.join('/restricted', 'new-dir'); // Outside allowed testDir

    // Temporarily mock security controller to deny access
    const originalValidateSecurePath = securityController.validateSecurePath;
    securityController.validateSecurePath = jest.fn().mockReturnValue({
      allowed: false,
      reason: 'Access denied by mock',
      resolved_path: restrictedPath
    });

    const result = await mkdir({ path: restrictedPath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied');
    }

    securityController.validateSecurePath = originalValidateSecurePath; // Restore original
  });
});
