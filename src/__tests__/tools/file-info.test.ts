
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileInfo } from '../../tools/file-info';
import { initializeSecurityController, getSecurityController, SecurityControllerV2 } from '../../core/security-controller-v2';

describe('fileInfo tool', () => {
  const testDir = path.resolve(__dirname, 'file-info-test-dir');
  let securityController: SecurityControllerV2;

  beforeAll(async () => {
    await initializeSecurityController([testDir]);
    securityController = getSecurityController();
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return info for an existing file', async () => {
    const filePath = path.join(testDir, 'test-file.txt');
    await fs.writeFile(filePath, 'hello world');

    const result = await fileInfo({ path: filePath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exists).toBe(true);
      expect(result.type).toBe('file');
      expect(result.size).toBe(11); // "hello world".length
      expect(result.is_binary).toBe(false);
      expect(result.modified).toBeDefined();
    }
  });

  it('should return info for an existing directory', async () => {
    const dirPath = path.join(testDir, 'test-dir');
    await fs.mkdir(dirPath);

    const result = await fileInfo({ path: dirPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exists).toBe(true);
      expect(result.type).toBe('directory');
      expect(result.size).toBeDefined(); // Size of directory can vary
      expect(result.is_binary).toBe(false); // Directories are not binary
      expect(result.modified).toBeDefined();
    }
  });

  it('should return not_found for a non-existent path', async () => {
    const nonExistentPath = path.join(testDir, 'non-existent.txt');
    const result = await fileInfo({ path: nonExistentPath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('file_not_found');
    }
  });

  it('should return permission_denied for restricted access', async () => {
    const restrictedPath = path.join(testDir, 'restricted.txt');
    await fs.writeFile(restrictedPath, 'test');

    // Temporarily mock security controller to deny access
    const originalValidateAccess = securityController.validateAccess;
    securityController.validateAccess = jest.fn().mockResolvedValue({
      allowed: false,
      reason: 'Access denied by mock'
    });

    const result = await fileInfo({ path: restrictedPath });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('access_denied');
    }

    securityController.validateAccess = originalValidateAccess; // Restore original
    await fs.unlink(restrictedPath);
  });

  it('should correctly identify binary files by extension', async () => {
    const binaryPath = path.join(testDir, 'image.jpg');
    await fs.writeFile(binaryPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])); // JPEG magic number

    const result = await fileInfo({ path: binaryPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.is_binary).toBe(true);
    }
  });

  it('should correctly identify binary files by content', async () => {
    const binaryPath = path.join(testDir, 'binary-content.bin');
    await fs.writeFile(binaryPath, Buffer.from([0x00, 0x01, 0x02, 0x03])); // Null bytes

    const result = await fileInfo({ path: binaryPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.is_binary).toBe(true);
    }
  });

  it('should correctly identify text files', async () => {
    const textPath = path.join(testDir, 'script.js');
    await fs.writeFile(textPath, 'console.log("hello");');

    const result = await fileInfo({ path: textPath });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.is_binary).toBe(false);
    }
  });
});
