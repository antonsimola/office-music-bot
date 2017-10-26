const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');
const Botkit = require('botkit');
const _ = require('lodash');
const mongoose = require('mongoose');
const Song = require('./song');
const User = require('./user');
const {getYoutubeIdFromUrl, getTitleForYoutubeId, getYoutubeUrlFromId, YOUTUBE_MATCHER, getFirstSearchResultBySearchTerm, sanitizeYoutubeUrl} = require('./youtube-helper');


mongoose.Promise = require('bluebird');
mongoose.connect(process.env.MONGODB_URI, {useMongoClient: true});

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);


const slackConfig = {
    interactive_replies: true,
    token: process.env.SLACK_BOT_TOKEN,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scopes: ['bot']
};

const controller = Botkit.slackbot(slackConfig);
const bot = controller.spawn(slackConfig);

bot.startRTM((err, bot, payload) => {
});


let sockets = [];
let getSockets = () => {
    return {
        emit: (id, obj) => {
            _.each(sockets, socket => socket.emit(id, obj));
        }
    }
};

const songQueue = require('./songqueue');

controller.hears(/^(hi|hello|hey|yo|help)$/i, ['direct_message'], (bot, message) => {
    bot.reply(message, `Hello! Just send me a YouTube song URL and I will add it to the playlist! 
Other commands:
- search/find <search term>: to search a song from YouTube.
- play
- pause
- volume 0..1
- next: skip to next song
- current: display currently playing song`
    );
});

controller.hears(/^play$/i, ['direct_message'], (bot, message) => {
    getSockets().emit('playerStatus', true);
    addReaction(bot, message, 'ok_hand');
});

controller.hears(/^(stop|pause)$/i, ['direct_message'], (bot, message) => {
    getSockets().emit('playerStatus', false);
    addReaction(bot, message, 'ok_hand');
});

controller.hears(/^next$/i, ['direct_message'], (bot, message) => {
    songQueue.nextSong((song) => getSockets().emit('next', song.url));
    getSockets().emit('playerStatus', true);
    addReaction(bot, message, 'ok_hand');
});

// controller.hears(/^shuffle$/i, ['direct_message'], (bot, message) => {
//     songQueue.refreshPlaylist();
//     addReaction(bot, message, 'ok_hand');
// });

controller.hears(/^current/i, ['direct_message'], (bot, message) => {
    const song = songQueue.getCurrentSong();
    const title = song && song.url ? song.url : "No song playing right now :disappointed: Send me some songs to play!";
    bot.reply(message, title);
});

controller.hears(/^queue/i, ['direct_message'], (bot, message) => {
    const queue = songQueue.getQueue();
    bot.reply(message, "TODO....");
});

controller.hears(/^volume (\d+([.,]\d+)?$)/i, ['direct_message'], (bot, message) => {
    getSockets().emit('volume', Number(message.match[1]));
    addReaction(bot, message, 'ok_hand');
});

controller.hears(/^(search|find) (.+)/i, ['direct_message'], (bot, message) => {
    const searchTerm = message.match[2];
    console.log(searchTerm);

    getFirstSearchResultBySearchTerm(searchTerm, (data) => {
        console.log(data);
        bot.startConversation(message, (err, convo) => {
            if (err) return;
            convo.say(`Found: ${data.title} (${getYoutubeUrlFromId(data.id)})`);
            convo.ask('Add this song?', [
                {
                    pattern: bot.utterances.yes,
                    callback: (response, convo) => {
                        convo.next();
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: (response, convo) => {
                        convo.stop();
                    }
                },
                {
                    default: true,
                    callback: (response, convo) => {
                        convo.repeat();
                        convo.next();
                    }
                }
            ]);
            convo.on('end', (convo) => {
                if (convo.status === 'completed') {
                    addSongToUser(bot, message, getYoutubeUrlFromId(data.id));
                } else {
                    bot.reply(message, 'OK, nevermind!');
                }
            });
        });
    });
});

const addReaction = (bot, message, reaction) => {
    bot.api.reactions.add({
        token: process.env.SLACK_API_TOKEN,
        timestamp: message.ts,
        channel: message.channel,
        name: reaction
    });
};

controller.hears(YOUTUBE_MATCHER, ['direct_message'], (bot, message) => {
    addSongToUser(bot, message, message.match[0]);
});

const addSongToUser = (bot, message, youtubeUrl) => {
    bot.api.users.info({user: message.user}, (error, response) => {
        let {name, real_name} = response.user;
        createSong(message.user, name, youtubeUrl, (song) => {
            songQueue.addSong(song);
            if (!songQueue.getCurrentSong().url) {
                songQueue.nextSong((song) => getSockets().emit('next', song.url));
                getSockets().emit('playerStatus', true);
            }
        });
    });
    bot.reply(message, 'Song added to playlist! :musical_note:');
};

const createSong = (userId, name, youtubeUrl, cb) => {
    const id = getYoutubeIdFromUrl(youtubeUrl);
    const youtubeUrlSanitized = sanitizeYoutubeUrl(youtubeUrl);
    cb({
        name: name,
        userId: userId,
        id: id,
        url: youtubeUrlSanitized,
    });
};


app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'client/build')));


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

server.listen((process.env.PORT || 3001), (err, res) => console.log(`Server started.`));

io.on('connection', (socket) => {
    console.log('Socket.io connection established.' + socket.id);
    socket.on('disconnect', (disconnectedSocket) => sockets = _.reject(sockets, (soc) => soc.id === socket.id));
    socket.on('ping', () => socket.emit('pong'));
    socket.emit('playerStatus', true);
    socket.on('getNext', () => {
        songQueue.nextSong((song) => socket.emit('next', song.url));
        getSockets().emit('playerStatus', true);
    });
    songQueue.nextSong((song) => socket.emit('next', song.url));
    sockets.push(socket);
});
