const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ahmedtpro.4kxy1cz.mongodb.net/?appName=AhmedTPro`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("scholarship_db");
    const addScholarCollection = db.collection("addScholars");

    // addScholars api
    app.get("/addScholars", async (req, res) => {
      const query = {};
      const { email } = req.query;

      if (email) {
        query.userEmail = email;
      }

      const options = { sort: { createdId: -1 } };

      const cursor = addScholarCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/addScholars", async (req, res) => {
      const addScholar = req.body;
      // addScholar created time
      addScholar.createdAt = new Date();

      const result = await addScholarCollection.insertOne(addScholar);
      res.send(result);
    });

    app.delete("/addScholars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await addScholarCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/addScholars/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedScholarship = req.body;

        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            ...updatedScholarship,
          },
        };

        const { userEmail, _id, postDate, ...fieldsToUpdate } =
          updatedScholarship;

        const finalUpdateDoc = {
          $set: fieldsToUpdate,
        };

        const result = await addScholarCollection.updateOne(
          query,
          finalUpdateDoc
        );

        res.send(result);
      } catch (error) {
        console.error("MongoDB Update Error:", error);
        res
          .status(500)
          .send({
            message: "Failed to update scholarship due to server issue.",
            error: error.message,
          });
      }
    });

    const { ObjectId } = require("mongodb"); 
    app.get("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };

        const scholarship = await addScholarCollection.findOne(query);

        if (scholarship) {
          res.send(scholarship);
        } else {
          res
            .status(404)
            .send({ message: "Scholarship not found with this ID." });
        }
      } catch (error) {
        console.error("Error fetching scholarship details:", error);
        res.status(500).send({ message: "Invalid ID format or server error." });
      }
    });






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("scholarship-management-platform-server!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
