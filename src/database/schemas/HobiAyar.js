const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    kanalId: { type: String },
    hobiler: { type: Map, of: String, default: {} } // Buraya "Cinema": "ROL_ID" şeklinde kaydedeceğiz
});
module.exports = mongoose.model('HobiAyar', schema);
