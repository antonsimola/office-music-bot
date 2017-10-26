const Song = require('./song');
const _ = require('lodash');
const youtubeHelper = require('./youtube-helper');

let queue = [];
let currentSong = {};
const nextSong = (cb) => {
    if (!queue || queue.length === 0) {
        currentSong = {};
        cb(currentSong);
    } else {
        currentSong = queue.pop();
        cb(currentSong);
    }
};

const addSong = (song) => {
    queue.push(song);
};

const getCurrentSong = () => {
    return currentSong;
};

module.exports = {addSong, nextSong, getCurrentSong};