import { isOwnerEmail, OWNER_EMAIL } from '@/utils/ownerAccess';

describe('isOwnerEmail', () => {
  it('matches the owner email, ignoring case and surrounding whitespace', () => {
    expect(isOwnerEmail(OWNER_EMAIL)).toBe(true);
    expect(isOwnerEmail('  Fabio.Stucki06@Gmail.com ')).toBe(true);
  });

  it.each([null, undefined, '', 'max.mustermann@example.com', 'xfabio.stucki06@gmail.com', 'fabio.stucki06@gmail.com.evil.io'])(
    'rejects %p',
    (email) => {
      expect(isOwnerEmail(email)).toBe(false);
    },
  );
});
