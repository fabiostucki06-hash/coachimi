import { Image, Text, View } from 'react-native';

import type { BorderId } from '@/types';

/** Coin Shop "Avatar Frame" (formerly "Social Highlight Border") ring classes - the single canonical map every avatar rendering (Dashboard header, Profile, Friends Feed) draws from, so a frame never looks different across screens. High-contrast, built for the app's OLED-black surfaces. */
export const AVATAR_FRAME_CLASSES: Record<BorderId, string> = {
  none: '',
  indigo_glow: 'border-2 border-primary shadow-md shadow-primary/40',
  gold_frame: 'border-2 border-amber-500 shadow-md shadow-amber-500/40',
  oled_gold_glow: 'border-2 border-amber-300 shadow-lg shadow-amber-300/60',
  cyber_neon_border: 'border-2 border-cyan-400 shadow-lg shadow-cyan-400/60',
  minimal_white_ring: 'border-2 border-white/90',
  swiss_red_accent: 'border-2 border-red-600 shadow-md shadow-red-600/40',
};

function initialsOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : '?';
}

export interface UserAvatarProps {
  /** Used for the initials fallback shown while no photo is set. */
  name: string;
  avatarUrl?: string | null;
  /** Equipped Coin Shop avatar frame - "none" (default) renders no ring. */
  frameId?: BorderId;
  /** Diameter in px. */
  size?: number;
}

/** Reusable profile-picture renderer: the uploaded photo (services/profile.ts) if one is set, otherwise a two-letter initials circle, wrapped in the user's equipped Coin Shop frame. */
export function UserAvatar({ name, avatarUrl, frameId = 'none', size = 44 }: UserAvatarProps) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center overflow-hidden bg-primary/10 ${AVATAR_FRAME_CLASSES[frameId] ?? ''}`}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: size * 0.36 }} className="font-bold text-primary">
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
