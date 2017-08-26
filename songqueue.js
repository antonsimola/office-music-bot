const Song = require('./song');
const _ = require('lodash');
const youtubeHelper = require('./youtube-helper');

let queue = [];

const refreshPlaylist = (cb) => {
    Song.find({}).then(songs => {
        queue = _.shuffle(songs.map(song => youtubeHelper.getYoutubeUrlFromId(song._id)));
        console.log('refreshed queue: ' + queue);
        if (cb) {
            cb(queue);
        }
    });
};

const moveFirstToLast = () => queue.push(queue.shift());


const nextSong = (cb) => {
    if (!queue || queue.length === 0) {
        refreshPlaylist(() => {
            console.log(queue);
            cb(queue[0]);
        });
    } else {
        moveFirstToLast();
        console.log(queue);
        cb(queue[0]);
    }
};

const addSong = (youtubeUrl) => {
    queue.push(youtubeUrl);
};

const currentSong = () => {
    return queue[0] || "No song";
};

module.exports = {addSong, refreshPlaylist, nextSong, currentSong};