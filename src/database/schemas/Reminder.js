const mongoose = require("mongoose");

const reqString = {
  type: String,
  required: true,
};

const Schema = new mongoose.Schema({
  userId: reqString,
  reason: reqString,
  remindAt: {
    type: Date,
    required: true,
  },
  triggered: {
    type: Boolean,
    default: false,
  }
});

module.exports = mongoose.model("Reminder", Schema);