import { describe, expect, it } from 'vitest';
import { IMAGE_BATCH } from '@/content/download/constants';
import { imageBatchFilenameHelpers } from '@/content/download/batch/image-batch-coordinator';

describe('imageBatchFilenameHelpers', () => {
	it('replaces ASCII control characters before filename cleanup', () => {
		expect(imageBatchFilenameHelpers.replaceControlCharacters('ab\u0000c\u001fd')).toBe('ab c d');
	});

	it('sanitizes invalid filename punctuation and leading dots', () => {
		expect(imageBatchFilenameHelpers.sanitizeFilenamePart('..bad:/\\\\name?*')).toBe('bad name');
	});

	it('falls back to the default basename when cleanup removes everything', () => {
		expect(imageBatchFilenameHelpers.sanitizeFilenamePart('...<>:"/\\\\|?*')).toBe(IMAGE_BATCH.defaultBasename);
	});

	it('normalizes jpeg extensions and decodes URL path names', () => {
		expect(
			imageBatchFilenameHelpers.getFilenamePartsFromUrl('https://cdn.example.com/photo%20name.jpeg')
		).toEqual({
			baseName: 'photo name',
			extension: 'jpg'
		});
	});

	it('uses the default basename when the decoded filename is emptied by sanitization', () => {
		expect(
			imageBatchFilenameHelpers.getFilenamePartsFromUrl('https://cdn.example.com/%3C%3E.jpeg')
		).toEqual({
			baseName: IMAGE_BATCH.defaultBasename,
			extension: 'jpg'
		});
	});

	it('adds padded sequence numbers for multi-file batches', () => {
		expect(
			imageBatchFilenameHelpers.buildFilename(2, 12, 'https://cdn.example.com/frame.png')
		).toBe('frame-03.png');
	});

	it('keeps single-file downloads unsuffixed', () => {
		expect(
			imageBatchFilenameHelpers.buildFilename(0, 1, 'https://cdn.example.com/frame.png')
		).toBe('frame.png');
	});
});
