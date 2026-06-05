const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    kanalId: { type: String, required: true, unique: true },
    sonVideoId: String
});
module.exports = mongoose.model('VideoKontrol', schema);
