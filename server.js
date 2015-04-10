// Get the packages we need
var express = require('express');
var mongoose = require('mongoose');
var User = require('./models/user');
var Task = require('./models/task');
var bodyParser = require('body-parser');
var router = express.Router();

//replace this with your Mongolab URL
mongoose.connect('mongodb://server_connect:hobohobo@ds031098.mongolab.com:31098/cs498rk_mp3');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

// Create our Express application
var app = express();

// Use environment defined port or 4000
var port = process.env.PORT || 4000;

//Allow CORS so that backend and frontend could pe put on different servers
var allowCrossDomain = function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
  next();
};
app.use(bodyParser.json());
app.use(allowCrossDomain);

// Use the body-parser package in our application
app.use(bodyParser.urlencoded({
  extended: true
}));

// All our routes will start with /api
app.use('/api', router);

//Default route here
var homeRoute = router.route('/');

homeRoute.get(function(req, res) {
  res.json({ message: 'Hello World!' });
});

// Helpers
function constructResponse(data) {
  return { "message": "OK", "data": data };
}

function constructError(err) {
  var errMessage = err || "";
  return { "message": err, "data": errMessage };
}

function checkError(data) {
  if(data === undefined)
    return 404;
  return 500;
}

//Add more routes here
var usersRoute = router.route('/users');

usersRoute.get(function(req, res) {
  var where   = JSON.parse(req.query.where || "{}");
  var fields  = JSON.parse(req.query.select || "{}");
  var options = {
    sort: JSON.parse(req.query.sort || "{}"),
    skip: JSON.parse(req.query.skip || "{}"),
    limit: JSON.parse(req.query.limit || "{}")
  };

  User.find(where, fields, options, function(err, users) {
    if (err) {
      res.status(checkError(users)).json(constructError("Users not found"));
      return;
    }
    res.status(200).json(constructResponse(users));
  });
});

usersRoute.post(function(req, res) {
  var data = req.body;
  data.pendingTasks = [];

  if(!data.name || !data.email) {
    res.json(constructError());
    return;
  }

  User.find({email: data.email}, function(err, user) {
    if(user.length === 0) {
      var newUser = new User(data);
      newUser.save();
      res.status(201).json(constructResponse(newUser.toJSON()));
    }
    else {
      if(err) res.status(500).json(constructError("Server error"));
      else {
        res.status(409).json(constructError("Conflicting email"));
      }
    }
  });
});

usersRoute.options(function(req, res) {
  res.writeHead(200);
  res.end();
});

var usersIdRoute = router.route('/users/:id');

usersIdRoute.get(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (err) {
      res.status(checkError(user)).json(constructError("User not found"));
    }

    res.status(200).json(constructResponse(user.toJSON()));
  });
});

usersIdRoute.put(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (err) {
      res.status(404).json(constructError("User not found"));
    }
    else {
      var data = req.body;
      user.update(data, function() {
        user.save();
        res.status(200).send(constructResponse(user.toJSON()));
      });
    }
  });
});

usersIdRoute.delete(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if(err) {
      res.status(404).json(constructError("User not found"));
    }
    else {
      for(var i = 0; i < user.pendingTasks.length; i++) {
        Task.findById(user.pendingTasks[i], function(err, task) {
          task.update({ assignedUser: 'default', assignedUserName: 'unassigned'});
        });
      }

      user.remove();
      res.status(200).send();
    }
  });
});

var tasksRoute = router.route('/tasks');

tasksRoute.get(function(req, res) {

  var where   = JSON.parse(req.query.where || "{}");
  var fields  = JSON.parse(req.query.select || "{}");
  var columns = [ 'name', '_id', 'description', 'dateline', 'completed', 'assignedUser', 'assignedUserName', 'dateCreated' ];
  var options = {
    sort: JSON.parse(req.query.sort || "{}"),
    skip: JSON.parse(req.query.skip || "{}"),
    limit: JSON.parse(req.query.limit || "{}")
  };

  Task.find(where, fields, options, function(err, tasks) {
    if (err) {
      res.status(404).json(constructError("Tasks not found"));
      return;
    }
    res.status(200).json(constructResponse(tasks));
  });
});

tasksRoute.post(function(req, res) {
  var data = req.body;

  if(!data.name || !data.deadline) {
    res.status(409).json(constructError("Requires name and deadline"));
    return;
  }

  var newTask = new Task(data);
  newTask.save();

  if(newTask.assignedUser === '') {
    res.status(200).json(constructResponse(newTask.toJSON()));
    return;
  }

  User.findById(newTask.assignedUser, function(err, user) {
    if (err) {
      res.status(404).json(constructError("User not found"));
      return;
    }

    console.log(newTask);

    res.status(200).json(constructResponse(newTask.toJSON()));

    if(!newTask.completed) {
      var pTasks = user.pendingTasks;
      pTasks.push(newTask._id);
      user.update({pendingTasks: pTasks}, function() {
      });
    }
  });
});

tasksRoute.options(function(req, res) {
  res.writeHead(200);
  res.end();
});

var tasksIdRoute = router.route('/tasks/:id');

tasksIdRoute.get(function(req, res) {
  Task.findById(req.params.id, function(err, task) {
    if (err) {
      res.status(404).json(constructError("Task not found"));
    }
    else {
      res.status(200).json(constructResponse(task.toJSON()));
    }
  });
});

tasksIdRoute.put(function(req, res) {
  Task.findById(req.params.id, function(err, task) {

    if (err) {
      res.status(404).json(constructError("Task not found"));
    }
    else {
      var data = req.body;

      data.assignedUser = data.assignedUser || task.assignedUser;

      // If the task belongs to someone else
      if(data.assignedUser !== task.assignedUser) {
        User.findById(data.assignedUser, function(err, user) {
          if (err) {
            res.status(404).json(constructError("User not found"));
          }
          user.pendingTasks.push(data._id);
        });
      }

      // If the task is completed
      if(data.completed) {
        User.findById(data.assignedUser, function(err, user) {
          if (err) res.status(404).json(constructError("User not found"));
          //user.completedTasks.push(user.pendingTasks.indexOf(data._id));
          user.pendingTasks.splice(user.pendingTasks.indexOf(data._id), 1);
          user.save();
        });
      }

      // Update the task
      task.update(data, function() {
        task.save();
        res.status(200).json(constructResponse("Updated task"));
      });
    }
  });
});

tasksIdRoute.delete(function(req, res) {
  Task.findByIdAndRemove(req.params.id , function(err, task) {
    User.findById(task.assignedUser, function(err, user) {
      if (err) {
        res.status(404).json(constructError("User not found"));
        return;
      }

      if(user !== undefined && user !== null) {
        user.pendingTasks.splice(user.pendingTasks.indexOf(task._id), 1);
        user.save();
      }

      res.status(200).json(constructResponse("Deleted task"));
    });
  });
});

// Wait for db before starting the server
db.once('open', function(cb) {
  console.log('MongoLab connection open');

  // Start the server
  app.listen(port);
  console.log('Server running on port ' + port);
});
