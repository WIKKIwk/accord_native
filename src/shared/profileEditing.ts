/** @v2 ProfileScreen._openProfileEditor */
export function profileNickname(input: string, previous: string): string {
  return input.trim() || previous;
}

/** @v2 ProfileScreen._saveProfileChanges */
export async function saveProfileChanges(
  nickname: (() => Promise<void>) | null, avatar: (() => Promise<void>) | null,
  active: () => boolean,
): Promise<'nickname' | 'avatar' | null> {
  let error: 'nickname' | 'avatar' | null = null;
  if (nickname) try { await nickname(); } catch { error = 'nickname'; }
  if (avatar && active()) {
    error = null;
    try { await avatar(); } catch { error = 'avatar'; }
  }
  return error;
}
