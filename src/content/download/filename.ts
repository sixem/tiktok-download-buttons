export const DEFAULT_NAMING_TEMPLATE = '{uploader} - {id}';

export const sanitizeFilename = (value: unknown) => {
	let filename = Array.from(String(value))
		.filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
		.join('').replace(/[<>:"/\\|?*]/g, '').replace(/\s\s+/g, ' ').trim()
		.replace(/^\.+/, '').replace(/[. ]+$/, '');

	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename)) {
		filename = `_${filename}`;
	}

	const encoder = new TextEncoder();
	if (encoder.encode(filename).length <= 250) return filename;
	const extension = /\.mp4$/i.test(filename) ? filename.slice(-4) : '';
	const basename = extension ? filename.slice(0, -extension.length) : filename;
	const budget = 250 - encoder.encode(extension).length;
	let prefix = '';
	let bytes = 0;
	for (const character of basename) {
		const size = encoder.encode(character).length;
		if (bytes + size > budget) break;
		prefix += character;
		bytes += size;
	}
	return `${prefix.trimEnd()}${extension}`;
};

const get = (object, path: string[]) => path.reduce((value, key) => value?.[key], object);

export const getTikTokPostDetails = (pageUrl: unknown) => {
	if (typeof pageUrl !== 'string') return null;
	try {
		const url = new URL(pageUrl, 'https://www.tiktok.com');
		if (url.hostname !== 'tiktok.com' && !url.hostname.endsWith('.tiktok.com')) return null;
		const match = /^\/@([^/]+)\/video\/(\d+)(?:\/|$)/.exec(url.pathname);
		return match ? {
			user: decodeURIComponent(match[1]),
			id: match[2],
			pageUrl: `https://www.tiktok.com/@${match[1]}/video/${match[2]}`
		} : null;
	} catch (_) {
		return null;
	}
};

export const getFileNameTemplate = (data: any = {}, apiData: any = {}, template = DEFAULT_NAMING_TEMPLATE) => {
	const page = getTikTokPostDetails(data.pageUrl);
	const localId = typeof data.id === 'string' && /^\d+$/.test(data.id) ? data.id : null;
	const templateValues: Record<string, string | number> = {};
	const templateKeys = {
		uploader: [['author', 'uniqueId'], ['author', 'unique_id'], ['aweme_detail', 'author', 'unique_id'], page?.user, data.user],
		nickname: [['author', 'nickname'], ['aweme_detail', 'author', 'nickname'], data.nickname, page?.user, data.user],
		desc: [['desc'], data.description, ['aweme_detail', 'desc']],
		uid: [['author', 'id'], ['aweme_detail', 'author', 'uid'], ['aweme_detail', 'author_user_id']],
		id: [['id'], ['aweme_id'], ['aweme_detail', 'aweme_id'], data.videoApiId, data.videoId, page?.id, localId],
		region: [['region'], ['aweme_detail', 'region']],
		language: [['author', 'language'], ['aweme_detail', 'author', 'language']],
		signature: [['author', 'signature'], ['aweme_detail', 'author', 'signature']],
		uploaded: [['createTime'], ['aweme_detail', 'create_time']],
		timestamp: [Math.round(Date.now() / 1000)]
	};

	for (const [key, candidates] of Object.entries(templateKeys)) {
		const resolved = candidates.map((candidate) => Array.isArray(candidate) ? get(apiData, candidate) : candidate)
			.find((value) => (typeof value === 'string' && value.trim()) || (typeof value === 'number' && Number.isFinite(value)));
		templateValues[key] = typeof resolved === 'string' ? resolved.trim() : (resolved ?? '');
	}

	for (const key of ['uploaded', 'timestamp']) {
		const seconds = Number.parseInt(String(templateValues[key]), 10);
		const date = new Date(seconds * 1000);
		if (!Number.isInteger(seconds) || seconds <= 0 || Number.isNaN(date.getTime())) {
			templateValues[key] = '';
			continue;
		}
		templateValues[key] = seconds;
		const pad = (value: number) => String(value).padStart(2, '0');
		templateValues[`${key}_s`] = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	}

	let missing = false;
	let filename = template.replace(/\{([^{}]+)\}/g, (_token, key: string) => {
		const value = templateValues[key];
		if (value === undefined || value === '') {
			missing = true;
			return '';
		}
		return String(value);
	});

	const extension = /\.mp4$/i.test(filename) ? filename.slice(-4) : '.mp4';
	if (/\.mp4$/i.test(filename)) filename = filename.slice(0, -4);
	if (missing) {
		filename = filename.replace(/^[\s._\-–—]+|[\s._\-–—]+$/g, '')
			.replace(/\s+([-–—])\s+(?:[-–—]\s+)+/g, ' $1 ');
	}

	const safeBasename = sanitizeFilename(filename);
	if (!safeBasename.replace(/[\s._\-–—()[\]{}]+/g, '')) return null;
	return `${filename}${extension}`;
};
