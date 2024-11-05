import * as path from 'path';
import * as fs from 'fs-extra';

export const ensureDirectoryExists = async (dir: string): Promise<void> => {
  await fs.ensureDir(dir);
};

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  const dir = path.dirname(filePath);
  await ensureDirectoryExists(dir);
  await fs.writeFile(filePath, content, 'utf8');
};

export const readFile = async (filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf8');
};
