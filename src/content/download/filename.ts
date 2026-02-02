import { UTIL } from '../state';
import { pipe } from '../logging';

const _get = (obj, path, defValue) => {
	if (!path) {
		return undefined;
	}

	const pathArray = Array.isArray(path) ? path : path.match(/([^.[\]])+/g);
	const result = pathArray.reduce(
		(prevObj, key) => prevObj && prevObj[key],
		obj
	);

	return result === undefined ? defValue : result;
};

export const getFileNameTemplate = (data, apiData, template = '{uploader} - {desc}') => {
	const templateValues = {};

	const templateKeys = {
		uploader: [['author', 'uniqueId'], data.user, ['aweme_detail', 'author', 'unique_id']],
		nickname: [['author', 'nickname'], ['aweme_detail', 'author', 'nickname']],
		desc: [['desc'], data.description, ['aweme_detail', 'author', 'unique_id']],
		uid: [['author', 'id'], ['aweme_detail', 'author', 'uid'], ['aweme_detail', 'author_user_id']],
		id: [['id'], data.videoApiId, data.videoId],
		region: [['aweme_detail', 'region']],
		language: [['aweme_detail', 'author', 'language']],
		signature: [['author', 'signature'], ['aweme_detail', 'author', 'signature']],
		uploaded: [['createTime'], ['aweme_detail', 'create_time']],
		timestamp: [Math.round(Date.now() / 1000)]
	};

	for (const [key, value] of Object.entries(templateKeys)) {
		if (!templateValues.hasOwnProperty(key)) {
			let keyData = null;
			for (const item of value) {
				if (!Array.isArray(item) && item) {
					keyData = item; break;
				} else if (Array.isArray(item) && UTIL.checkNested(apiData, ...item)) {
					keyData = _get(apiData, item.join('.')); break;
				}
			}

			templateValues[key] = keyData || '';
		}
	}

	for (const timestamp of ['uploaded', 'timestamp']) {
		templateValues[timestamp] = parseInt(templateValues[timestamp]);

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
		filename = filename.replace(`{${key}}`, value);
	}

	filename = filename.replace(/({[^}]+})/g, '');

	if (!filename.endsWith('.mp4')) {
		filename = `${filename}.mp4`;
	}

	return filename.length >= 5 ? filename : null;
};

