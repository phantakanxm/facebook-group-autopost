import { describe, it, expect } from 'vitest';
import { cleanGroupName } from './groupName.js';

describe('cleanGroupName', () => {
  it('returns empty for falsy/whitespace input', () => {
    expect(cleanGroupName('')).toBe('');
    expect(cleanGroupName('   ')).toBe('');
  });

  it('passes through bare names unchanged', () => {
    expect(cleanGroupName('My Group')).toBe('My Group');
    expect(cleanGroupName('ขายบ้าน อุดร')).toBe('ขายบ้าน อุดร');
  });

  it('collapses whitespace', () => {
    expect(cleanGroupName('  Foo   Bar\n\n  Baz  ')).toBe('Foo Bar Baz');
  });

  it('strips English last-active suffix', () => {
    expect(cleanGroupName('My Group Last active 2 hours ago')).toBe('My Group');
    expect(cleanGroupName('My Group Active a minute ago')).toBe('My Group');
  });

  it('strips Thai last-active suffix', () => {
    expect(cleanGroupName('กลุ่มของฉัน ใช้งานล่าสุด 2 ชั่วโมงที่แล้ว')).toBe('กลุ่มของฉัน');
  });

  it('strips number-first member count', () => {
    expect(cleanGroupName('My Group · 12,345 members')).toBe('My Group');
    expect(cleanGroupName('กลุ่มฉัน · 12,345 สมาชิก')).toBe('กลุ่มฉัน');
  });

  it('strips word-first Thai member count with magnitude word', () => {
    expect(cleanGroupName('บ้านเช่า อุดร · สมาชิก 5.6 หมื่น คน')).toBe('บ้านเช่า อุดร');
    expect(cleanGroupName('ขายที่ดิน · สมาชิก 1.2 ล้าน คน')).toBe('ขายที่ดิน');
    expect(cleanGroupName('Foo สมาชิก 950 คน')).toBe('Foo');
  });

  it('strips privacy markers', () => {
    expect(cleanGroupName('My Group · Public')).toBe('My Group');
    expect(cleanGroupName('กลุ่มของฉัน · สาธารณะ')).toBe('กลุ่มของฉัน');
    expect(cleanGroupName('กลุ่มลับ · ส่วนตัว')).toBe('กลุ่มลับ');
  });

  it('strips compound suffixes (member-count + privacy)', () => {
    expect(
      cleanGroupName('บ้านเช่า อุดรธานี อุดร108 · สมาชิก 5.6 หมื่น คน · สาธารณะ'),
    ).toBe('บ้านเช่า อุดรธานี อุดร108');
  });

  it('preserves group name parens/punctuation', () => {
    expect(cleanGroupName('บ้านเช่า อุดร (เฉพาะบ้านเช่า)')).toBe('บ้านเช่า อุดร (เฉพาะบ้านเช่า)');
  });

  it('caps absurdly long names', () => {
    const long = 'a'.repeat(500);
    expect(cleanGroupName(long).length).toBe(200);
  });
});
