import { useSyncStore } from '@/store/syncStore';
import { isOwnerEmail } from '@/utils/ownerAccess';

/** True only while signed in as the project owner (utils/ownerAccess.ts). */
export function useIsOwner(): boolean {
  return useSyncStore((state) => isOwnerEmail(state.session?.user.email));
}
