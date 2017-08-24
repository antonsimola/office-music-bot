const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');
const SlackBot = require('slackbots');
const _ = require('lodash');
const enableWs = require('express-ws');

const app = express();
enableWs(app);

const BOT_NAME = 'musicbot';

const bot = new SlackBot({
    token: process.env.SLACK_BOT_TOKEN, // Add a bot https://my.slack.com/services/new/bot and put the token
    name: BOT_NAME
});


let getWs = null;

bot.on('start', () => {
    let myUser = bot.users.filter(user => user.name === BOT_NAME)[0];
    bot.on('message', event => {
        if (isChatMessage(event) && isPrivateMessage(event) && !isSentByMe(event, myUser)) {
            console.log('it was for me!');
            console.log(event.text);
            if (_.includes(event.text, 'play')) {
                getWs().send(JSON.stringify({playing: true}));
                sendMessageToUser(event.user, "Playing...");
            } else if(_.includes(event.text, 'stop')) {
                getWs().send(JSON.stringify({playing: false}));
                sendMessageToUser(event.user, "Stopping...");
            } else {
                sendMessageToUser(event.user, 'meow! :cat:')
            }
        }

    });
});

const sendMessageToUser = (user, message) => {
    bot.getUserById(user).then(user => {
        bot.postMessageToUser(user.name, message);
    })


};

app.ws('/', (ws, req) => {
    console.log('WS OPEN');
    ws.on('close', () => {
        console.log('WebSocket was closed');
    });
    getWs = () => ws;
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'client/build')));


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname+'/client/build/index.html'));
});



const isChatMessage = (event) => event.type === 'message' && Boolean(event.text);

const isPrivateMessage = (event) => typeof event.channel === 'string' && event.channel[0] === 'D';

const isSentByMe = (event, myUser) => event.user === myUser.id;

app.listen((process.env.PORT || 3001), () => console.log("Running"));
module.exports = app;
