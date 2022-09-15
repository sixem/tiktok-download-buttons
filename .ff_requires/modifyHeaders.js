/**
 * This method alters the user agent for API requests in FireFox.
 */

const USER_AGENT = 'com.ss.android.ugc.trill/2613 (Linux; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)';

browser.webRequest.onBeforeSendHeaders.addListener((request) =>
{
	for(let header of request.requestHeaders)
	{
		let headerName = header.name.toLowerCase();

		if(headerName === 'user-agent')
		{
			header.value = USER_AGENT;
		}
	}

	return {
		requestHeaders: request.requestHeaders
	}

}, {urls: ['*://api-h2.tiktokv.com/*']}, ['requestHeaders', 'blocking']);

