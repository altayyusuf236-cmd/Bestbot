const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roller: { type: Map, of: String }
});
module.exports = mongoose.model('RenkAyar', schema);
