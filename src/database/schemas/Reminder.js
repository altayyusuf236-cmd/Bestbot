const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  userId: { type: String, required: true },
  reason: { type: String, required: true },
  remindAt: { type: Date, required: true },
  triggered: { type: Boolean, default: false },
});

module.exports = mongoose.model("reminders", Schema);