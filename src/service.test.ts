import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('background download messages', () => {
	let listener: (data: unknown, sender: unknown, response: (value?: unknown) => void) => boolean;
	let download: ReturnType<typeof vi.fn>;
	let showFolder: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetModules();
		download = vi.fn((_options, callback) => callback(42));
		showFolder = vi.fn();
		vi.stubGlobal('chrome', {
			runtime: { onMessage: { addListener: (handler) => { listener = handler; } } },
			downloads: { download, showDefaultFolder: showFolder, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
			tabs: { sendMessage: vi.fn() }
		});
		delete (globalThis as any).downloadSessions;
		delete (globalThis as any).__ttdbDownloadChangeListener;
		delete (globalThis as any).__ttdbDownloadChangeListenerInstalled;
		await import('@/service');
	});

	it('keeps unknown messages and inherited object methods out of task routing', () => {
		const respond = vi.fn();
		expect(listener({ task: 'toString' }, {}, respond)).toBe(false);
		expect(listener({ task: 'downloadStatus' }, {}, respond)).toBe(false);
		expect(respond).not.toHaveBeenCalled();
	});

	it('starts valid downloads with sanitized names and one-character subfolders', () => {
		const respond = vi.fn();
		expect(listener({ task: 'fileDownload', url: 'https://example.com/video', filename: 'a:b/c?.mp4', subFolder: 'x' }, { tab: { id: 3 } }, respond)).toBe(true);
		expect(download).toHaveBeenCalledWith(expect.objectContaining({ filename: 'x/a-b-c-.mp4', url: 'https://example.com/video' }), expect.any(Function));
		expect(respond).toHaveBeenCalledWith({ success: true, itemId: 42 });
	});

	it('keeps relative folders inside Downloads and allows blob downloads', () => {
		listener({ task: 'fileDownload', url: 'blob:https://www.tiktok.com/abc', filename: 'CON.mp4', subFolder: '../folder\\nested' }, {}, vi.fn());
		expect(download).toHaveBeenCalledWith(expect.objectContaining({ filename: '_/folder/nested/_CON.mp4' }), expect.any(Function));
	});

	it('rejects invalid download requests without invoking the downloads API', () => {
		for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'not a URL', null]) {
			const respond = vi.fn();
			listener({ task: 'fileDownload', url, filename: 'video.mp4' }, {}, respond);
			expect(respond).toHaveBeenCalledWith({ success: false, error: 'Invalid download filename or URL.' });
		}
		expect(download).not.toHaveBeenCalled();
	});

	it('opens the download folder without leaving a response channel open', () => {
		expect(listener({ task: 'fileShow' }, {}, vi.fn())).toBe(false);
		expect(showFolder).toHaveBeenCalledOnce();
	});
});
