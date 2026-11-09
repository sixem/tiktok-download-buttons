import { beforeEach, describe, expect, it } from 'vitest';
import { UTIL } from '@/content/core/state';
import { setupStringUtils } from '@/content/utils/data/strings';

describe('setupStringUtils', () => {
	beforeEach(() => {
		setupStringUtils();
	});

	it('truncates long strings without touching shorter ones', () => {
		expect(UTIL.truncateString('abcdef', 4)).toBe('abc');
		expect(UTIL.truncateString('abc', 4)).toBe('abc');
	});

	it('sanitizes unsafe filename characters and leading dots', () => {
		expect(UTIL.sanitizeFilename('..bad:/\\\\name?.mp4')).toBe('badname.mp4');
	});

	it('collapses repeated whitespace in filenames', () => {
		expect(UTIL.sanitizeFilename('video    name   here.mp4')).toBe('video name here.mp4');
	});

	it('preserves allowed punctuation such as brackets and hash characters', () => {
		expect(UTIL.sanitizeFilename('[draft] #1 clip.mp4')).toBe('[draft] #1 clip.mp4');
	});

	it('preserves creator captions and names in multiple languages', () => {
		expect(UTIL.sanitizeFilename('한글 مرحبا Привет café 日本語.mp4')).toBe('한글 مرحبا Привет café 日本語.mp4');
	});

	it('preserves the actual extension when an earlier part contains .mp4', () => {
		const filename = UTIL.sanitizeFilename(`clip.mp4 ${'a'.repeat(260)}.mp4`);
		expect(filename.startsWith('clip.mp4 ')).toBe(true);
		expect(filename.endsWith('.mp4')).toBe(true);
		expect(filename.length).toBeLessThanOrEqual(250);
	});

	it('limits multibyte names by UTF-8 bytes without splitting characters', () => {
		const filename = UTIL.sanitizeFilename(`${'한😀'.repeat(100)}.mp4`);
		expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(250);
		expect(filename.endsWith('.mp4')).toBe(true);
		expect(filename).not.toContain('\uFFFD');
	});

	it('keeps long names within the current mp4 length limit', () => {
		const filename = UTIL.sanitizeFilename(`${'a'.repeat(400)}.mp4`);
		expect(filename.endsWith('.mp4')).toBe(true);
		expect(filename).toHaveLength(250);
	});
});
