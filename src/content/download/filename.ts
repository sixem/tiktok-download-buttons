import { pipe } from '@/content/core/logging';

const _get = (obj, path, defValue) => {
	if (!path) {
		return undefined;
	}

	const pathArray = Array.isArray(path) ? path : path.match(/([^.[\]])+/g);
	const result = pathArray.reduce(
		(prevObj, key) => prevObj?.[key],
		obj
	);

	return result === undefined ? defValue : result;
};

export const getFileNameTemplate = (data, apiData, template = '{uploader} - {desc}') => {
	const templateValues = {};

	const templateKeys = {
		uploader: [['author', 'uniqueId'], data.user, ['aweme_detail', 'author', 'unique_id']],
		nickname: [['author', 'nickname'], ['aweme_detail', 'author', 'nickname']],
		// `desc` is the post caption/description. (The previous fallback path accidentally pointed at the author.)
		desc: [['desc'], data.description, ['aweme_detail', 'desc']],
		uid: [['author', 'id'], ['aweme_detail', 'author', 'uid'], ['aweme_detail', 'author_user_id']],
		id: [['id'], data.videoApiId, data.videoId],
		region: [['aweme_detail', 'region']],
		language: [['aweme_detail', 'author', 'language']],
		signature: [['author', 'signature'], ['aweme_detail', 'author', 'signature']],
		uploaded: [['createTime'], ['aweme_detail', 'create_time']],
		timestamp: [Math.round(Date.now() / 1000)]
	};

	for (const [key, value] of Object.entries(templateKeys)) {
		if (!Object.hasOwn(templateValues, key)) {
			let keyData = null;
			for (const item of value) {
				if (!Array.isArray(item) && item) {
					keyData = item; break;
				} else if (Array.isArray(item)) {
					const resolvedValue = _get(apiData, item, undefined);
					if (resolvedValue !== undefined) {
						keyData = resolvedValue; break;
					}
				}
			}

			templateValues[key] = keyData || '';
		}
	}

	for (const timestamp of ['uploaded', 'timestamp']) {
		templateValues[timestamp] = parseInt(templateValues[timestamp], 10);

		if (Number.isInteger(templateValues[timestamp]) && templateValues[timestamp] > 0) {
			const ts = new Date(templateValues[timestamp] * 1000);
			const tsData = {
				year: ts.getFullYear(),
				month: ts.getMonth() + 1,
				day: ts.getDate(),
				hour: ts.getHours(),
				minute: ts.getMinutes(),
				second: ts.getSeconds()
			};

			for (const [key, value] of Object.entries(tsData)) {
				if (value < 10) tsData[key] = `0${value}`;
			}

			const tsDate = `${tsData.year}${tsData.month}${tsData.day}`;
			const tsTime = `${tsData.hour}${tsData.minute}${tsData.second}`;

			templateValues[`${timestamp}_s`] = `${tsDate}_${tsTime}`;
		}
	}

	pipe('Template values', templateValues);

	let filename = template;

	for (const [key, value] of Object.entries(templateValues)) {
		// Replace *all* occurrences of the token; `.replace()` only handles the first one.
		const token = `{${key}}`;
		filename = filename.split(token).join(String(value ?? ''));
	}

	filename = filename.replace(/({[^}]+})/g, '');

	if (!filename.endsWith('.mp4')) {
		filename = `${filename}.mp4`;
	}

	return filename.length >= 5 ? filename : null;
};

