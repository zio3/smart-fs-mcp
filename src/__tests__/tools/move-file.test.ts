
import * as fs from 'fs/promises';
import * as path from 'path';
import { moveFile } from '../../tools/move-file';
import { SafetyController } from '../../core/safety-controller';
import { initializeSecurityController, getSecurityController, SecurityControllerV2 } from '../../core/security-controller-v2';

describe('moveFile tool', () => {
  const testDir = path.resolve(__dirname, 'move-file-test-dir');
  let securityController: SecurityControllerV2;
  let safety: SafetyController;

  beforeAll(async () => {
    await initializeSecurityController([testDir]);
    securityController = getSecurityController();
    safety = new SafetyController();
  });

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should move a file successfully', async () => {
    const sourcePath = path.join(testDir, 'source.txt');
    const destinationPath = path.join(testDir, 'destination.txt');
    await fs.writeFile(sourcePath, 'test content');

    const result = await moveFile({ source: sourcePath, destination: destinationPath }, safety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('success');
      expect(result.operation_info.source).toBe(sourcePath);
      expect(result.operation_info.destination).toBe(destinationPath);
      expect(result.operation_info.operation_type).toBe('rename'); // Same directory = rename
    }
    await expect(fs.access(sourcePath)).rejects.toThrow(); // Source should not exist
    await expect(fs.access(destinationPath)).resolves.toBeUndefined(); // Destination should exist
  });

  it('should rename a file successfully', async () => {
    const sourcePath = path.join(testDir, 'old-name.txt');
    const destinationPath = path.join(testDir, 'new-name.txt');
    await fs.writeFile(sourcePath, 'test content');

    const result = await moveFile({ source: sourcePath, destination: destinationPath }, safety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('success');
      expect(result.operation_info.source).toBe(sourcePath);
      expect(result.operation_info.destination).toBe(destinationPath);
      expect(result.operation_info.operation_type).toBe('rename');
    }
    await expect(fs.access(sourcePath)).rejects.toThrow();
    await expect(fs.access(destinationPath)).resolves.toBeUndefined();
  });

  it('should return an error if source file does not exist', async () => {
    const sourcePath = path.join(testDir, 'non-existent-source.txt');
    const destinationPath = path.join(testDir, 'destination.txt');

    const result = await moveFile({ source: sourcePath, destination: destinationPath }, safety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied'); // Security validation happens first
    }
  });

  it('should return an error if destination already exists and overwrite_existing is false', async () => {
    const sourcePath = path.join(testDir, 'source-exists.txt');
    const destinationPath = path.join(testDir, 'existing-destination.txt');
    await fs.writeFile(sourcePath, 'source content');
    await fs.writeFile(destinationPath, 'existing content');

    const result = await moveFile({ source: sourcePath, destination: destinationPath, overwrite_existing: false }, safety);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('destination_exists');
    }
    await expect(fs.access(sourcePath)).resolves.toBeUndefined(); // Source should still exist
    const destContent = await fs.readFile(destinationPath, 'utf8');
    expect(destContent).toBe('existing content'); // Destination content should be unchanged
  });

  it('should overwrite destination if overwrite_existing is true', async () => {
    const sourcePath = path.join(testDir, 'source-overwrite.txt');
    const destinationPath = path.join(testDir, 'overwrite-destination.txt');
    await fs.writeFile(sourcePath, 'new content');
    await fs.writeFile(destinationPath, 'old content');

    const result = await moveFile({ source: sourcePath, destination: destinationPath, overwrite_existing: true }, safety);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('success');
      expect(result.operation_info.operation_type).toBe('rename'); // Same directory = rename
    }
    await expect(fs.access(sourcePath)).rejects.toThrow();
    const destContent = await fs.readFile(destinationPath, 'utf8');
    expect(destContent).toBe('new content');
  });

  it('should return permission_denied for restricted source access', async () => {
    const sourcePath = path.join('/restricted', 'source.txt');
    const destinationPath = path.join(testDir, 'dest.txt');

    // Temporarily mock security controller to deny access for source
    const originalValidateAccess = securityController.validateAccess;
    securityController.validateAccess = jest.fn().mockImplementation(async (p, op) => {
      if (p === sourcePath) {
        return { allowed: false, reason: 'Access denied by mock', resolved_path: p };
      }
      return originalValidateAccess(p, op);
    });

    const result = await moveFile({ source: sourcePath, destination: destinationPath }, safety);

    expect(result.success).toBe(false);
    if (!result.success && 'error' in result) {
      expect(result.error.code).toBe('access_denied');
    }

    securityController.validateAccess = originalValidateAccess; // Restore original
  });

  it('should return permission_denied for restricted destination access', async () => {
    const sourcePath = path.join(testDir, 'source-for-restricted.txt');
    const destinationPath = path.join('/restricted', 'dest.txt');
    await fs.writeFile(sourcePath, 'test');

    // Temporarily mock security controller to deny access for destination
    const originalValidateAccess = securityController.validateAccess;
    securityController.validateAccess = jest.fn().mockImplementation(async (p, op) => {
      if (p === destinationPath) {
        return { allowed: false, reason: 'Access denied by mock', resolved_path: p };
      }
      return originalValidateAccess(p, op);
    });

    const result = await moveFile({ source: sourcePath, destination: destinationPath }, safety);

    expect(result.success).toBe(false);
    if (!result.success && 'error' in result) {
      expect(result.error.code).toBe('access_denied');
    }

    securityController.validateAccess = originalValidateAccess; // Restore original
    await fs.unlink(sourcePath);
  });
});
