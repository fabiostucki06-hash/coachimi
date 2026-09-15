import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';
const AVATAR_DIMENSION = 400;
const AVATAR_MAX_BYTES = 100 * 1024;
// Stepped down until the JPEG lands under AVATAR_MAX_BYTES, or the lowest step is
// reached (best-effort - a very busy/high-detail photo may still land slightly over).
const JPEG_QUALITY_STEPS = [0.8, 0.6, 0.45, 0.3, 0.2];

export class AvatarUploadError extends Error {}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.9,
  // Square crop up front - the frame ring (see UserAvatar.tsx) and every avatar
  // slot across the app assume a circular/square source image.
  allowsEditing: true,
  aspect: [1, 1],
};

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Manual base64 -> bytes decode for the Storage upload body - same reasoning as services/foodSearch.ts's manual `toBase64`: no `atob` guaranteed on Hermes/React Native. */
function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Resizes to at most 400x400 and re-encodes as JPEG, stepping quality down until the result is under 100KB. */
async function compressAvatar(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri).resize({ width: AVATAR_DIMENSION, height: AVATAR_DIMENSION });
  const rendered = await context.renderAsync();

  let base64: string | undefined;
  for (const quality of JPEG_QUALITY_STEPS) {
    const saved = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
    base64 = saved.base64;
    const approxBytes = ((base64?.length ?? 0) * 3) / 4;
    if (approxBytes <= AVATAR_MAX_BYTES) break;
  }
  if (!base64) throw new AvatarUploadError('Bild konnte nicht komprimiert werden.');
  return base64;
}

/**
 * Opens the gallery picker, square-crops/compresses the pick to <=400x400 and
 * <=100KB, and uploads it to the `avatars` Storage bucket at `${userId}/avatar.jpg`
 * (upsert - always overwrites this user's previous avatar, one file per user).
 * Returns the public URL (cache-busted, since the path never changes between
 * uploads), or null if the user cancelled the picker. Throws AvatarUploadError on a
 * permission refusal or an upload failure.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new AvatarUploadError('Zugriff auf die Fotomediathek wurde nicht erlaubt.');

  const picked = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (picked.canceled || !picked.assets[0]) return null;

  const base64 = await compressAvatar(picked.assets[0].uri);
  const path = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, decodeBase64(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new AvatarUploadError(error.message);

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
