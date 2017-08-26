const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const songSchema = new Schema({
    _id: String,
    title: String,
    owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
});



module.exports = mongoose.model('Song', songSchema);