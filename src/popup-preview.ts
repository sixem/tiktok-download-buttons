import { DEFAULT_NAMING_TEMPLATE, getFileNameTemplate, sanitizeFilename } from '@/content/download/filename?popup';

const example = {
	user: 'creator',
	description: 'A video caption',
	videoApiId: '7234567890123456789'
};

const exampleApi = {
	id: example.videoApiId,
	desc: example.description,
	createTime: 1700000000,
	author: { uniqueId: example.user, nickname: 'Creator', id: '12345', signature: 'Hello', language: 'en' },
	region: 'US'
};

export const getFilenamePreview = (value: string) => {
	const template = value.trim() || DEFAULT_NAMING_TEMPLATE;
	const fallback = `${example.user} - ${example.videoApiId}.mp4`;
	return sanitizeFilename(getFileNameTemplate(example, exampleApi, template) || fallback);
};
