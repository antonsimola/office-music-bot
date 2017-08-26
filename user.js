const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    _id: String,
    teamId: String,
});

module.exports = mongoose.model('User', userSchema);
