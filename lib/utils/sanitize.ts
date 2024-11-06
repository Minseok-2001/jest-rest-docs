export const sanitizePath = (path: string): string => {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-|-$/g, '');
};
