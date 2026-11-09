import { describe, expect, it } from 'vitest';
import { UTIL } from '@/content/core/state';
import { setupNetworkUtils } from '@/content/utils/network/network';

describe('video response validation', () => {
	it('accepts a successful video stream without a Content-Length header', () => {
		setupNetworkUtils();
		expect(UTIL.validateVideoRequest(new Response('body', { headers: { 'Content-Type': 'video/mp4' } }))).toBe(true);
	});

	it('still rejects failed, non-video and explicitly tiny responses', () => {
		setupNetworkUtils();
		expect(UTIL.validateVideoRequest(new Response('', { status: 403, headers: { 'Content-Type': 'video/mp4' } }))).toBe(false);
		expect(UTIL.validateVideoRequest(new Response('', { headers: { 'Content-Type': 'text/html' } }))).toBe(false);
		expect(UTIL.validateVideoRequest(new Response('', { headers: { 'Content-Type': 'video/mp4', 'Content-Length': '100' } }))).toBe(false);
	});
});
