/**
 * This method alters the user agent for API requests in FireFox.
 */

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; SM-G973F Build/QQ3A.200805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/85.0.4183.101 Mobile Safari/537.36 trill_2021806060 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/18.6.6 ByteLocale/fr ByteFullLocale/fr Region/FR';

browser.webRequest.onBeforeSendHeaders.addListener((request) => {
	for(let header of request.requestHeaders) {
		let headerName = header.name.toLowerCase();
		if(headerName === 'user-agent') {
			header.value = USER_AGENT;
		}
	}

	return { requestHeaders: request.requestHeaders };
}, {
	urls: ['*://api22-normal-c-alisg.tiktokv.com/*']
}, ['requestHeaders', 'blocking']);

