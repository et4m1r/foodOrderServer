const express = require("express");
var cors = require("cors");
const app = express();
const port = 3000;
const ObjectId = require("mongodb").ObjectId;

// These lines will be explained in detail later in the unit
app.use(express.json()); // process json
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// These lines will be explained in detail later in the unit

const MongoClient = require("mongodb").MongoClient;
const uri =
  "mongodb+srv://cqu:Qwer1234@cluster0.vc0wils.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// Global for general use
var userCollection;
var orderCollection;
var restaurantCollection;
var menuItemCollection;
var reviewsCollection;

client.connect((err) => {
  userCollection = client.db("foodOrder").collection("users");
  orderCollection = client.db("foodOrder").collection("orders");
  restaurantCollection = client.db("foodOrder").collection("restaurants");
  menuItemCollection = client.db("foodOrder").collection("menuItems");
  reviewsCollection = client.db("foodOrder").collection("reviews");

  // perform actions on the collection object
  console.log("Database up!\n");
});

app.get("/restaurants", async (req, res) => {
  restaurantCollection.find({}).toArray(function (err, docs) {
    if (err) {
      console.log("Some error.. " + err + "\n");
    } else {
      console.log(JSON.stringify(docs) + " have been retrieved.\n");
      var str = docs;
      res.send(str);
    }
  });
});

app.get("/menuItems/:restaurantId", async (req, res) => {
  const restaurantId = req.params.restaurantId;
  const restaurantObjectId = ObjectId(restaurantId);

  menuItemCollection
    .find({ restaurant_id: restaurantObjectId })
    .project({})
    .toArray(function (err, docs) {
      if (err) {
        console.error("Error fetching menu items:", error);
      } else {
        var str = docs;
        res.send(str);
      }
    });
});

app.post("/checkout", async (req, res) => {
  const { userId, orders } = req.body;

  const orderData = orders.map((item) => ({
    item_id: ObjectId(item.id),
    count: item.count,
  }));

  const param = {
    user_id: ObjectId(userId),
    items: orderData,
    date: new Date(),
  };
  // Save the orders to the database
  await orderCollection.insertOne(param, function (err, result) {
    if (err) {
      console.error("Error during checkout:", err);
      res.status(500).json({ message: "Error during checkout" });
    } else {
      res.status(201).json({ message: "Orders placed successfully" });
    }
  });
});

app.get("/orderList/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const userObjectId = ObjectId(userId);

    const orders = await orderCollection
      .find({ user_id: userObjectId })
      .toArray();

    const orderList = await Promise.all(
      orders.map(async (order) => {
        const items = await Promise.all(
          order.items.map(async (item) => {
            const menuItem = await menuItemCollection.findOne(
              { _id: ObjectId(item.item_id) },
              { projection: { name: 1, price: 1, _id: 0 } }
            );
            return { ...item, name: menuItem.name, price: menuItem.price };
          })
        );

        return { ...order, items };
      })
    );

    res.status(200).json(orderList);
  } catch (error) {
    console.error("Error retrieving order list:", error);
    res.status(500).json({ message: "Error retrieving order list" });
  }
});

app.post("/verifyUser", (req, res) => {
  loginData = req.body;
  console.log(loginData);

  userCollection
    .find(
      { email: loginData.email, password: loginData.password },
      { projection: {} }
    )
    .toArray(function (err, docs) {
      if (err) {
        console.log("Some error.. " + err + "\n");
      } else {
        console.log(JSON.stringify(docs) + " have been retrieved.\n");
        res.status(200).send(docs);
      }
    });
});

app.post("/postUserData", function (req, res) {
  console.log("POST request received : " + JSON.stringify(req.body));

  // Assume req.body contains a unique identifier like 'email'
  const userEmail = req.body.email;

  // Check if user already exists
  userCollection.findOne({ email: userEmail }, function (err, existingUser) {
    if (err) {
      console.log("Error checking user existence: " + err);
      res.status(500).send("Internal server error");
    } else if (existingUser) {
      console.log("User already exists: " + JSON.stringify(existingUser));
      res.status(400).send("User already exists");
    } else {
      // Insert the new user since they don't exist
      userCollection.insertOne(req.body, function (err, result) {
        if (err) {
          console.log("Some error.. " + err + "\n");
          res.status(500).send("Error inserting user data");
        } else {
          console.log(JSON.stringify(req.body) + " have been uploaded\n");
          res.send(JSON.stringify(req.body));
        }
      });
    }
  });
});

app.post("/submitReview", function (req, res) {
  const restaurantId = ObjectId(req.body.restaurant_id);
  const userId = ObjectId(req.body.user_id);

  const reviewData = {
    restaurant_id: restaurantId,
    review: req.body.review,
    user_id: userId,
    date: new Date(),
  };

  reviewsCollection.insertOne(reviewData, function (err, result) {
    if (err) {
      console.log("Some error.. " + err + "\n");
    } else {
      console.log(JSON.stringify(req.body) + " has been submitted\n");
      res.send(JSON.stringify(req.body));
    }
  });
});

app.get("/  ", async (req, res) => {
  try {
    const reviews = await reviewsCollection
      .aggregate([
        {
          $lookup: {
            from: "restaurants",
            localField: "restaurant_id",
            foreignField: "_id",
            as: "restaurant",
          },
        },
        {
          $unwind: "$restaurant",
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $project: {
            _id: 1,
            review: 1,
            date: 1,
            restaurantName: "$restaurant.name",
            userName: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          },
        },
      ])
      .toArray();

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
