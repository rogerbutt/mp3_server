// Load required packages
var mongoose = require('mongoose');

// Define our beer schema
var UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  pendingTasks: [String],
  //completedTasks: [String],
  dateCreated: {type: Date, default: Date.now}
});

UserSchema.options.toJSON = {
    transform: function(doc, ret, options) {
        delete ret.__v;
        return ret;
    }
};

// Export the Mongoose model
module.exports = mongoose.model('User', UserSchema);
