const dotenv = require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const lodash = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

mongoose.connect(MONGO_DB);

const itemSchema = {
  name: String,
};

const listSchema = {
  name: String,
  items: [itemSchema],
};

const userSchema = mongoose.Schema({
  name: String,
  email: String,
  password: String,
  lists: [listSchema],
});
userSchema.plugin(passportLocalMongoose, { usernameField: "email" });
const userModel = new mongoose.model("user", userSchema);

passport.use(userModel.createStrategy());
passport.serializeUser(userModel.serializeUser());
passport.deserializeUser(userModel.deserializeUser());

app.get("/", function (req, res) {
  res.redirect("/login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/login", function (req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/home");
  } else {
    res.render("login", { incorrectPassword: false });
  }
});

app.get("/:listTitle", function (req, res) {
  if (req.isAuthenticated()) {
    const userID = req.user._id;
    const listTitle = lodash.capitalize(req.params.listTitle);

    userModel
      .findOne({ _id: userID }, { _id: 0, lists: 1 })
      .then((listsFromDB) => {
        if (listsFromDB !== null) {
          const currentList = listsFromDB.lists.find(
            (list) => list.name === listTitle
          );

          if (currentList) {
            console.log("List found. Loading the list.");
            res.render("index", {
              listTitle: listTitle,
              listsArr: listsFromDB.lists,
              itemsArr: currentList.items,
            });
          } else {
            console.log("List not found. Making a new one with default items.");
            createDefaultList(userID, listTitle, res);
          }
        } else {
          console.log("Mah NIGGA");
          // console.log("List not found. Making a new one with default items.");
          // createDefaultList(userID, listTitle, res);
        }
      });
  } else {
    res.redirect("/login");
  }
});

app.post("/register", function (req, res) {
  userModel.register(
    new userModel({ name: req.body.name, email: req.body.email }),
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          const userID = req.user._id;
          createDefaultList(userID, "Home", res);
          res.redirect("/home");
        });
      }
    }
  );
});

app.post("/login", function (req, res, next) {
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      console.log(err);
      return next(err);
    }
    if (!user) {
      // Authentication failed
      console.log("Incorrect email or password");
      res.render("login", { incorrectPassword: true });
    } else {
      req.logIn(user, function (err) {
        if (err) {
          console.log(err);
        }
        res.redirect("/home");
      });
    }
  })(req, res, next);
});

app.post("/addItem", async function (req, res) {
  if (req.isAuthenticated()) {
    const userID = req.user._id;
    const listTitle = lodash.capitalize(req.body.listName);

    const newItem = { name: req.body.newItem };
    const listsFromDB = await userModel.findOneAndUpdate(
      { _id: userID, "lists.name": listTitle },
      { $push: { "lists.$.items": newItem } },
      { new: true }
    );
    const currentList = listsFromDB.lists.find(
      (list) => list.name === listTitle
    );

    res.redirect("/" + currentList.name);
  } else {
    res.redirect("/login");
  }
});

app.post("/delete", async function (req, res) {
  if (req.isAuthenticated()) {
    const userID = req.user._id;
    const checkedItem = req.body.checkedItem;
    const listTitle = lodash.capitalize(req.body.listName);

    const listsFromDB = await userModel.findOneAndUpdate(
      { _id: userID, "lists.name": listTitle },
      { $pull: { "lists.$.items": { _id: checkedItem } } },
      { new: true }
    );
    const currentList = listsFromDB.lists.find(
      (list) => list.name === listTitle
    );

    res.redirect("/" + currentList.name);
  } else {
    res.redirect("/login");
  }
});

function createDefaultList(userID, listTitle, res) {
  const item1 = { name: "Welcome to your ToDo List!" };
  const item2 = { name: "Click the '+' icon to add new items." };
  const item3 = { name: "<-- Hit this to delete an item." };
  const defaultItems = [item1, item2, item3];

  const list = {
    name: listTitle,
    items: defaultItems,
  };

  userModel
    .findOneAndUpdate(
      { _id: userID },
      { $push: { lists: list } },
      { new: true }
    )
    .then((listsFromDB) => {
      res.render("index", {
        listTitle: listTitle,
        listsArr: listsFromDB.lists,
        itemsArr: defaultItems,
      });
    });
}

const port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log(`Server listening on port ${port}`);
});
