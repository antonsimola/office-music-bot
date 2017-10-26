const _ = require('lodash');
const googleapis = require('googleapis');
const youtube = googleapis.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});
const request = require('request');

/**
 * Thanks to https://gist.github.com/takien/4077195
 */
const getYoutubeIdFromUrl = (url) => {
    let ID = '';
    url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    if (url[2] !== undefined) {
        ID = url[2].split(/[^0-9a-z_\-]/i);
        ID = ID[0];
    }
    else {
        ID = url;
    }
    return ID;
};

const getYoutubeUrlFromId = (id) => `https://www.youtube.com/watch?v=${id}`;

const YOUTUBE_MATCHER = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?/;

const getFirstSearchResultBySearchTerm = (searchTerm, cb) => {
    youtube.search.list({
        part: 'id,snippet',
        q: searchTerm,
    }, (err, data) => {
        if (err) {
            console.error('Error: ' + err);
        }
        if (!data || !data.items) {
            return cb();
        }

        const firstResult = _.head(data.items);
        console.log(firstResult);
        cb({id: firstResult.id.videoId, title: firstResult.snippet.title});
    });
};

const sanitizeYoutubeUrl = (youtubeUrl) => {
    return getYoutubeUrlFromId(getYoutubeIdFromUrl(youtubeUrl));
};

const getTitleForYoutubeId = (id, cb) => {
    const params = {part: 'snippet', id: id, key: process.env.YOUTUBE_API_KEY};
    request({url: 'https://www.googleapis.com/youtube/v3/videos', qs: params}, (err, resp) => {
        if (err) {
            console.error('Error: ' + err);
        }
        const data = resp.body;
        console.log(data);
        const firstResult = _.head(data.items);
        console.log(firstResult.snippet.title);
        cb(firstResult.snippet.title);
    });
};


module.exports = {
    getYoutubeIdFromUrl,
    getYoutubeUrlFromId,
    YOUTUBE_MATCHER,
    getTitleForYoutubeId,
    sanitizeYoutubeUrl,
    getFirstSearchResultBySearchTerm
};