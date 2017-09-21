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
const {getYoutubeIdFromUrl, getYoutubeUrlFromId, YOUTUBE_MATCHER, getFirstSearchResultBySearchTerm} = require('./youtube-helper');


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
    redirectUri: 'http://localhost:3000/oauth',
    json_file_store: __dirname + '/.data/db/',
    scopes: ['bot']
};

const controller = Botkit.slackbot(slackConfig);
const bot = controller.spawn(slackConfig);

// controller.setupWebserver(process.env.port || 3002, function (err, webserver) {
//     // set up web endpoints for oauth, receiving webhooks, etc.
//     controller
//         .createHomepageEndpoint(controller.webserver)
//         .createOauthEndpoints(controller.webserver, function (err, req, res) {
//         })
//         .createWebhookEndpoints(controller.webserver);
// });

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
    bot.reply(message, 'Hello! Just send me a YouTube song URL and I will add it to the playlist!\n' +
        'Other commands:\n' +
        '- play\n' +
        '- pause\n' +
        '- volume 0..1\n' +
        '- next: skip to next song\n' +
        '- shuffle: shuffle the playlist\n' +
        '- current: display currently playing song\n' +
        '- search/find <search term> (not yet working)');
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
    songQueue.nextSong((song) => getSockets().emit('next', song));
    addReaction(bot, message, 'ok_hand');
});

controller.hears(/^shuffle$/i, ['direct_message'], (bot, message) => {
    songQueue.refreshPlaylist();
    addReaction(bot, message, 'ok_hand');
});

controller.hears(/^current/i, ['direct_message'], (bot, message) => {
    const song = songQueue.currentSong();
    bot.reply(message, song);
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
                        // since no further messages are queued after this,
                        // the conversation will end naturally with status == 'completed'
                        convo.next();
                    }
                },
                {
                    pattern: bot.utterances.no,
                    callback: (response, convo) => {
                        // stop the conversation. this will cause it to end with status == 'stopped'
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


        // const confirmationBox = {
        //     'text': `Found: ${data.title} (${getYoutubeUrlFromId(data.id)})`,
        //     attachments: [
        //         {
        //             title: 'Add this to playlist?',
        //             callback_id: '123',
        //             attachment_type: 'default',
        //             actions: [
        //                 {
        //                     "name": "yes",
        //                     "text": _.sample(["Yes", "Yea", "Yup", "Yep", "Ya", "Sure", "OK", "Yeah", "Yah"]),
        //                     "value": "yes",
        //                     "style": "primary",
        //                     "type": "button",
        //                 },
        //                 {
        //                     "name": "no",
        //                     "text": _.sample(["No", "Nah", "Nope"]),
        //                     "style": "danger",
        //                     "value": "no",
        //                     "type": "button",
        //                 }
        //             ]
        //         }
        //     ],
        // };
        //bot.reply(message, confirmationBox);
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
    const query = {_id: message.user};
    const update = {};
    const options = {upsert: true, new: true, setDefaultsOnInsert: true};
    User.findOneAndUpdate(query, update, options).then(savedUser => {
        const id = getYoutubeIdFromUrl(youtubeUrl);
        const newSong = new Song({
            _id: id,
            owner: savedUser
        });
        newSong.save().then(savedSong => {
            songQueue.addSong(getYoutubeUrlFromId(savedSong._id));
            bot.reply(message, 'Song added to playlist! :musical_note:');
        }).catch(err => {
            if (err.code === 11000) {
                Song.findById(id).populate('owner').then(song => {
                    bot.api.users.info({user: song.owner._id}, (err, res) => {
                        bot.reply(message, `Song is already added by ${res.user.name}`);
                    });
                });
            } else {
                bot.reply(message, `Sorry, something went wrong :disappointed:`);
            }
        });
    });
};

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
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
        songQueue.nextSong((song) => socket.emit('next', song));
    });
    songQueue.nextSong((song) => socket.emit('next', song));
    sockets.push(socket);
});
