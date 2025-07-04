
import * as fs from 'fs/promises';
import * as path from 'path';
import { moveDirectory } from '../../tools/move-directory';
import { initializeSecurityController, getSecurityController, SecurityControllerV2 } from '../../core/security-controller-v2';

describe('moveDirectory tool', () => {
  const testDir = path.resolve(__dirname, 'move-directory-test-dir');
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

  it('should move a directory successfully', async () => {
    const sourcePath = path.join(testDir, 'source-dir');
    const destinationPath = path.join(testDir, 'subdir', 'destination-dir'); // Different parent directory
    await fs.mkdir(sourcePath);
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(sourcePath, 'file.txt'), 'test');

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.operation_info?.source).toBe(sourcePath);
      expect(result.operation_info?.destination).toBe(destinationPath);
      expect(result.operation_info?.operation_type).toBe('move');
    }
    await expect(fs.access(sourcePath)).rejects.toThrow(); // Source should not exist
    await expect(fs.access(destinationPath)).resolves.toBeUndefined(); // Destination should exist
    await expect(fs.access(path.join(destinationPath, 'file.txt'))).resolves.toBeUndefined(); // Content should be moved
  });

  it('should rename a directory successfully', async () => {
    const sourcePath = path.join(testDir, 'old-dir');
    const destinationPath = path.join(testDir, 'new-dir');
    await fs.mkdir(sourcePath);

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.operation_info?.source).toBe(sourcePath);
      expect(result.operation_info?.destination).toBe(destinationPath);
      expect(result.operation_info?.operation_type).toBe('rename');
    }
    await expect(fs.access(sourcePath)).rejects.toThrow();
    await expect(fs.access(destinationPath)).resolves.toBeUndefined();
  });

  it('should return an error if source directory does not exist', async () => {
    const sourcePath = path.join(testDir, 'non-existent-source-dir');
    const destinationPath = path.join(testDir, 'destination-dir');

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.alternatives?.suggestions).toBeDefined();
      expect(result.alternatives?.suggestions[0]).toContain('Move failed');
    }
  });

  it('should return an error if destination already exists and overwrite_existing is false', async () => {
    const sourcePath = path.join(testDir, 'source-exists-dir');
    const destinationPath = path.join(testDir, 'existing-destination-dir');
    await fs.mkdir(sourcePath);
    await fs.mkdir(destinationPath);

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath, overwrite_existing: false });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.issue_details?.reason).toContain('Destination directory already exists');
    }
    await expect(fs.access(sourcePath)).resolves.toBeUndefined(); // Source should still exist
    await expect(fs.access(destinationPath)).resolves.toBeUndefined(); // Destination should still exist
  });

  it('should overwrite destination if overwrite_existing is true', async () => {
    const sourcePath = path.join(testDir, 'source-overwrite-dir');
    const destinationPath = path.join(testDir, 'overwrite-destination-dir');
    await fs.mkdir(sourcePath);
    await fs.writeFile(path.join(sourcePath, 'file.txt'), 'source content');
    await fs.mkdir(destinationPath);
    await fs.writeFile(path.join(destinationPath, 'old-file.txt'), 'old content');

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath, overwrite_existing: true });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.operation_info?.operation_type).toBe('rename'); // Same directory = rename
    }
    await expect(fs.access(sourcePath)).rejects.toThrow();
    await expect(fs.access(path.join(destinationPath, 'file.txt'))).resolves.toBeUndefined(); // New content should be there
    await expect(fs.access(path.join(destinationPath, 'old-file.txt'))).rejects.toThrow(); // Old content should be gone
  });

  it('should return permission_denied for restricted source access', async () => {
    const sourcePath = path.join('/restricted', 'source-dir');
    const destinationPath = path.join(testDir, 'dest-dir');

    // Temporarily mock security controller to deny access for source
    const originalValidateAccess = securityController.validateAccess;
    securityController.validateAccess = jest.fn().mockImplementation(async (p, op) => {
      if (p === sourcePath) {
        return { allowed: false, reason: 'Access denied by mock', resolved_path: p };
      }
      return originalValidateAccess(p, op);
    });

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.alternatives?.suggestions).toBeDefined();
    }

    securityController.validateAccess = originalValidateAccess; // Restore original
  });

  it('should return permission_denied for restricted destination access', async () => {
    const sourcePath = path.join(testDir, 'source-for-restricted-dir');
    const destinationPath = path.join('/restricted', 'dest-dir');
    await fs.mkdir(sourcePath);

    // Temporarily mock security controller to deny access for destination
    const originalValidateAccess = securityController.validateAccess;
    securityController.validateAccess = jest.fn().mockImplementation(async (p, op) => {
      if (p === destinationPath) {
        return { allowed: false, reason: 'Access denied by mock', resolved_path: p };
      }
      return originalValidateAccess(p, op);
    });

    const result = await moveDirectory({ source: sourcePath, destination: destinationPath });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.alternatives?.suggestions).toBeDefined();
    }

    securityController.validateAccess = originalValidateAccess; // Restore original
    await fs.rm(sourcePath, { recursive: true, force: true });
  });
});
