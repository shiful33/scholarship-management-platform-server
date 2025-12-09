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
    const usersCollection = db.collection("users");
    const applicationsCollection = db.collection("applications");

    // All Scholarship Api
    app.get("/scholarships/all", async (req, res) => {
      try {
        const { search, category, subject, location } = req.query;
        let query = {};

        if (search) {
          const searchRegex = new RegExp(search, "i"); 
          query.$or = [
            { scholarshipName: searchRegex },
            { universityName: searchRegex },
            { degree: searchRegex },
          ];
        }

        if (category) {
          query.scholarshipCategory = category;
        }
        if (subject) {
          query.subjectCategory = subject;
        }
        if (location) {
          query.location = location;
        }

        const scholarships = await addScholarCollection.find(query).toArray();
        res.send(scholarships);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch scholarships." });
      }
    });

    // addScholars api Start -----------------------
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

    // ------------------------------------------------
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

    // ------------------------------------------------
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
        res.status(500).send({
          message: "Failed to update scholarship due to server issue.",
          error: error.message,
        });
      }
    });

    // ------------------------------------------------
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
    // addScholars api End

    // Users api Start ----------------------------
    app.get("/users", async (req, res) => {
      try {
        const role = req.query.role;
        const query = role ? { role: role } : {};

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users." });
      }
    });

    // Get --------------------------------------------
    app.get("/", (req, res) => {
      res.send("scholarship-management-platform-server!");
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });

    // Patch ---------------------------------------------
    app.patch("/users/role/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { role: role },
        };

        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update user role." });
      }
    });

    // Delete ------------------------------------------
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await usersCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete user." });
      }
    });
    // Users api End

    // Analytics api Start
    app.get("/analytics/platform-stats", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();

        const totalScholarships = await addScholarCollection.countDocuments();

        const aggregationResult = await applicationsCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalFeesCollected: { $sum: "$applicationFee" },
              },
            },

            {
              $lookup: {
                from: "scholarships",
                localField: "scholarshipId",
                foreignField: "_id",
                as: "scholarshipInfo",
              },
            },
            { $unwind: "$scholarshipInfo" },
            {
              $group: {
                _id: "$scholarshipInfo.scholarshipCategory",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                count: 1,
              },
            },
          ])
          .toArray();

        const totalFeesCollected =
          aggregationResult.find(
            (item) => item.totalFeesCollected !== undefined
          )?.totalFeesCollected || 0;
        const applicationsByCategory = aggregationResult.filter(
          (item) => item.category
        );

        res.send({
          totalUsers,
          totalFeesCollected,
          totalScholarships,
          applicationsByCategory,
        });
      } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).send({ message: "Failed to fetch analytics data." });
      }
    });
    // Analytics api End

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
