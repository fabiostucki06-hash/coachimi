// Project owner - the only account that sees the Settings backup tools.
// This is a UI gate, not a security boundary: the backup feature only ever reads
// and writes the signed-in user's own data, which Supabase RLS already scopes to
// `auth.uid()`. Compare against the AUTH session's email (verified by Supabase),
// never the editable `user.email` in store/userStore.ts.
export const OWNER_EMAIL = 'fabio.stucki06@gmail.com';

export function isOwnerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === OWNER_EMAIL;
}
