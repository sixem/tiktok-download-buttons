<h1 align="center">Templating</h1>
<p align="center">This page contains the current available templating options.</p>

## Usage:
You can edit the naming template in the options menu of the addon (*pin it, then click on it*).

This only works when utilizing the API because the available data from non-API requests isn't sufficient enough to cover templating.

Example usage:

* `video_{uploader}_{uploaded_s}` → `video_randomusername_20230101_000000.mp4`
* `tiktokVideo_{nickname}_{desc}-{id}` → `tiktokVideo_Random Username_This is a description-7217247845525540139.mp4`

## Options:

### `{uploader}`
* Uploader username (their `tiktok.com/@ID`)

### `{nickname}`
* Uploader display name

### `{signature}`
* Uploader signature (usually their profile description)

### `{uid}`
* Uploader ID

### `{desc}`
* Video description

### `{id}`
* Video ID

### `{region}`
* Video region

### `{language}`
* Video language

### `{uploaded}`
* A unix timestamp of when the video was uploaded

### `{uploaded_s}`
* A **readable** timestamp of when the video was uploaded

### `{timestamp}`
* A unix timestamp of when the video was downloaded

### `{timestamp_s}`
* A **readable** timestamp of when the video was downloaded