
import * as fs from 'fs/promises';
import * as path from 'path';
import { deleteFile } from '../../tools/delete-file';
import { getSecurityController, initializeSecurityController, SecurityControllerV2 } from '../../core/security-controller-v2';

describe('deleteFile', () => {
  const testDir = path.resolve(__dirname, 'test-delete-dir');
  let securityController: SecurityControllerV2;

  beforeAll(async () => {
    await initializeSecurityController([testDir]);
    securityController = getSecurityController();
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should successfully delete a file', async () => {
    const filePath = path.join(testDir, 'deletable.txt');
    await fs.writeFile(filePath, 'test');

    const result = await deleteFile({ path: filePath });

    expect(result.success).toBe(true);

    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('should return not_found for a non-existent file', async () => {
    const filePath = path.join(testDir, 'non-existent.txt');
    const result = await deleteFile({ path: filePath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failedInfo.reason).toBe('not_found');
    }
  });

  it('should handle permission errors', async () => {
    // This test is simplified because creating a file without delete permissions is complex.
    // We rely on the security controller mock to simulate this.
    const filePath = path.join(testDir, 'protected.txt');
    await fs.writeFile(filePath, 'test');

    // Mocking validateSecurePath to simulate permission denied
    const originalValidateSecurePath = securityController.validateSecurePath;
    securityController.validateSecurePath = jest.fn().mockReturnValue({
      allowed: false,
      reason: 'Permission denied by test mock',
      resolved_path: filePath
    });

    const result = await deleteFile({ path: filePath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failedInfo.reason).toBe('permission_denied');
    }

    securityController.validateSecurePath = originalValidateSecurePath; // Restore mock
    await fs.unlink(filePath);
  });
});
