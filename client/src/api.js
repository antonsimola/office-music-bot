import io from 'socket.io-client';

const socket = io();

setInterval(() => socket.emit('ping'), 10000);

const subscribePlayerStatus = (cb) => socket.on('playerStatus', (data) => cb(data));

const subscribeNextEvent = (cb) => socket.on('next', (data) => cb(data));

const subscribeVolume = (cb) => socket.on('volume', (data) => cb(data));

const emitGetNext = (cb) => socket.emit('getNext');

export default {subscribePlayerStatus, subscribeNextEvent, subscribeVolume, emitGetNext};