/**
 * Normalize a raw group display string scraped from Facebook to just the group's
 * title. FB appends dynamic metadata to group labels in various UI surfaces:
 *
 *   "My Group Name Last active about a minute ago"
 *   "My Group · 12,345 members"
 *   "My Group\n\nActive 2 hours ago"
 *
 * Those suffixes break lookup selectors (e.g. role=checkbox[name=...]) and will
 * rot over time because the "last active" text changes between scans. Strip
 * everything after the known trailing markers so the stored name is stable.
 */
export function cleanGroupName(raw: string): string {
  if (!raw) return '';
  let name = raw.replace(/\s+/g, ' ').trim();
  // "Last active <anything>" / "Active <anything> ago" trailing text
  name = name.replace(/\s+(Last active|Active)\b.*$/i, '');
  // Thai equivalents
  name = name.replace(/\s+(ใช้งานล่าสุด|ใช้งาน).*$/i, '');
  // "· N members" trailing
  name = name.replace(/\s*·\s*[\d,]+\s*members?.*$/i, '');
  name = name.replace(/\s*·\s*[\d,]+\s*สมาชิก.*$/i, '');
  return name.trim().slice(0, 200);
}
