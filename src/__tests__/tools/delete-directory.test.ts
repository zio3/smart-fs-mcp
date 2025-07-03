
import * as fs from 'fs/promises';
import * as path from 'path';
import { deleteDirectory } from '../../tools/delete-directory';
import { initializeSecurityController } from '../../core/security-controller-v2';

describe('deleteDirectory', () => {
  const baseTestDir = path.resolve(__dirname, 'test-delete-dir-main');

  beforeAll(async () => {
    await initializeSecurityController([baseTestDir]);
  });

  beforeEach(async () => {
    await fs.rm(baseTestDir, { recursive: true, force: true });
    await fs.mkdir(baseTestDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(baseTestDir, { recursive: true, force: true });
  });

  it('should delete an empty directory', async () => {
    const dirPath = path.join(baseTestDir, 'empty-dir');
    await fs.mkdir(dirPath);

    const result = await deleteDirectory({ path: dirPath });
    expect(result.success).toBe(true);
    await expect(fs.access(dirPath)).rejects.toThrow();
  });

  it('should recursively delete a directory with contents', async () => {
    const dirPath = path.join(baseTestDir, 'full-dir');
    const filePath = path.join(dirPath, 'file.txt');
    await fs.mkdir(dirPath);
    await fs.writeFile(filePath, 'test');

    const result = await deleteDirectory({ path: dirPath, recursive: true });
    expect(result.success).toBe(true);
    await expect(fs.access(dirPath)).rejects.toThrow();
  });

  it('should fail if trying to delete a non-empty directory without recursive flag', async () => {
    const dirPath = path.join(baseTestDir, 'full-dir-no-recurse');
    const filePath = path.join(dirPath, 'file.txt');
    await fs.mkdir(dirPath);
    await fs.writeFile(filePath, 'test');

    const result = await deleteDirectory({ path: dirPath });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failedInfo.reason).toBe('not_empty');
    }
    await expect(fs.access(dirPath)).resolves.not.toThrow();
  });

  it('should return not_found for a non-existent directory', async () => {
    const dirPath = path.join(baseTestDir, 'non-existent-dir');
    const result = await deleteDirectory({ path: dirPath });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failedInfo.reason).toBe('not_found');
    }
  });

  it('should perform a dry run without deleting', async () => {
    const dirPath = path.join(baseTestDir, 'dry-run-dir');
    await fs.mkdir(dirPath);

    const result = await deleteDirectory({ path: dirPath, dry_run: true });
    expect(result.success).toBe(true);
    await expect(fs.access(dirPath)).resolves.not.toThrow();
  });

  it('should fail to delete a file', async () => {
    const filePath = path.join(baseTestDir, 'a-file.txt');
    await fs.writeFile(filePath, 'test');

    const result = await deleteDirectory({ path: filePath });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failedInfo.reason).toBe('invalid_target');
    }
  });
});
