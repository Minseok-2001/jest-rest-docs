import { sanitizePath, sanitizeFileName } from '../../../src/utils';

describe('Sanitize Utils', () => {
  describe('sanitizePath', () => {
    it('converts spaces to hyphens', () => {
      expect(sanitizePath('Create User API')).toBe('create-user-api');
    });

    it('removes special characters', () => {
      expect(sanitizePath('User@API#Test')).toBe('user-api-test');
    });
  });
});
