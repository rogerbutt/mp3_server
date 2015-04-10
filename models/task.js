// Load required packages
var mongoose = require('mongoose');

// Define our beer schema
var TaskSchema   = new mongoose.Schema({
  name: String,
  description: String,
  deadline: Date,
  completed: Boolean,
  assignedUser: {type: String, default: 'default'},
  assignedUserName: {type: String, default: 'unassigned'},
  date: {type: Date, default: Date.now}
});

TaskSchema.options.toJSON = {
    transform: function(doc, ret, options) {
        delete ret.__v;
        return ret;
    }
};

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
