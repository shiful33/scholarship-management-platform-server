require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ahmedtpro.4kxy1cz.mongodb.net/?appName=AhmedTPro`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verifyToken
const verifyToken = (req, res, next) => {
    // 1. Authorization Header থেকে টোকেন নিন
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access: No token provided' });
    }
    
    // Header Format: Bearer <token>
    const token = authHeader.split(' ')[1]; 
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
           
            console.error("Token verification error:", err);
            return res.status(401).send({ message: 'Unauthorized access: Invalid token' });
        }

        req.user = decoded;
        next();
    });
};


const verifyAdmin = async (req, res, next) => {
    const email = req.user.email; // verifyToken থেকে পাওয়া
    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access: Admin required' });
    }
    next();
};

const verifyModerator = async (req, res, next) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    
    if (!user || (user.role !== 'moderator' && user.role !== 'admin')) { 
        return res.status(403).send({ message: 'Forbidden access: Moderator or Admin required' });
    }
    next();
};

// JWT Functionality
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET; 

app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
});


async function run() {
  try {
    await client.connect();

    const db = client.db("scholarship_db");
    const addScholarCollection = db.collection("addScholars");
    const scholarshipsCollection = db.collection("scholarships");
    const usersCollection = db.collection("users");
    const applicationsCollection = db.collection("applications");
    const reviewsCollection = db.collection("reviews");

    console.log("Connected to MongoDB!");

    // ROOT
    app.get("/", (req, res) => {
      res.send("Scholarship Platform Server is Running!");
    });

    // Role base new root create
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;

      console.log("Fetching role for email:", email);

      if (!email) {
        return res.status(400).send({ message: "Email parameter is missing." });
      }

      try {
        const usersCollection = client.db("ScholarshipDB").collection("users");

        const user = await usersCollection.findOne({ email: email });

        if (user) {
          res.send({ role: user.role, email: user.email });
        } else {
          res.send({
            role: "user",
            email: email,
            message: "User not found, returning default role.",
          });
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        res
          .status(500)
          .send({ message: "Failed to fetch user role due to server error." });
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const usersCollection = client.db("ScholarshipDB").collection("users");

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      
      const result = await usersCollection.insertOne({
        email: user.email,
        name: user.name,
        role: user.role || "user",
      });

      res.send(result);
    });

    // Stripe API Start ( First Method )
    /* app.post("/create-payment-intent", async (req, res) => {
      const { fees } = req.body;

      const amount = parseInt(fees * 100);

      if (amount < 1) {
        return res.send({ clientSecret: "requires_no_payment" });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ message: "Failed to create payment intent." });
      }
    });

    app.post("/applications", async (req, res) => {
      const applicationData = req.body;

      try {
        if (applicationData.scholarshipId) {
          applicationData.scholarshipId = new ObjectId(
            applicationData.scholarshipId
          );
        } else {
          return res
            .status(400)
            .send({ message: "Scholarship ID is missing." });
        }

        if (!applicationData.status) {
          applicationData.status = "Pending";
        }

        const result = await applicationsCollection.insertOne(applicationData);

        if (result.insertedId) {
        }

        res.send(result);
      } catch (error) {
        if (error.name === "BSONTypeError") {
          console.error(
            "Invalid Scholarship ID Format:",
            applicationData.scholarshipId
          );
          return res
            .status(400)
            .send({ message: "Invalid Scholarship ID format." });
        }

        console.error("Application Submission Error:", error);
        res.status(500).send({ message: "Failed to submit application." });
      }
    }); */

    // Stripe API Start ( Second Method )
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      if (!price || price < 1) {
        return res.status(400).send({ error: "Invalid price amount." });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: "usd",
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({
          error: "Failed to create payment intent.",
          details: error.message,
        });
      }
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const scholarshipId = application.scholarshipId;

      try {
        const result = await applicationsCollection.insertOne(application);

        if (result.insertedId && scholarshipId) {
          let objectIdScholarshipId;
          try {
            objectIdScholarshipId = new ObjectId(scholarshipId);
          } catch (err) {
            console.warn(
              `Invalid scholarship ID format received: ${scholarshipId}`
            );

            objectIdScholarshipId = null;
          }

          if (objectIdScholarshipId) {
            const updateResult = await scholarshipsCollection.updateOne(
              { _id: objectIdScholarshipId },
              {
                $inc: {
                  applicationCount: 1,
                },
              }
            );
            if (updateResult.modifiedCount === 0) {
              console.log(
                `Scholarship update warning: ID ${scholarshipId} not found.`
              );
            }
          }
        }

        res.status(201).send(result);
      } catch (error) {
        console.error("Error processing application:", error);

        if (error.code === 11000) {
          return res.status(400).send({
            message: "You have already applied for this scholarship.",
          });
        }

        res.status(500).send({
          message: "Failed to save application due to server error.",
          error: error.message,
        });
      }
    });

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

    // Get single scholarship by ID
    app.get("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const scholarship = await addScholarCollection.findOne(query);

        if (!scholarship) {
          return res
            .status(404)
            .send({ message: "Scholarship not found with this ID." });
        }
        res.send(scholarship);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID format or server error." });
      }
    });

    // POST Add a new review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;

        review.scholarshipId = new ObjectId(review.scholarshipId);

        if (!review.reviewDate) {
          review.reviewDate = new Date();
        }

        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error("Error inserting review:", error);
        res
          .status(500)
          .send({ message: "Failed to submit review due to server error." });
      }
    });

    app.get("/dashboard/my-applications", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res
          .status(400)
          .send({ message: "Email parameter is required." });
      }

      try {
        const query = { applicantEmail: email };

        const myApplications = await applicationsCollection
          .aggregate([
            { $match: query },
            {
              $lookup: {
                from: "addScholars",
                localField: "scholarshipId",
                foreignField: "_id",
                as: "scholarshipDetails",
              },
            },
            {
              $unwind: {
                path: "$scholarshipDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                transactionId: 1,
                paymentDate: 1,
                appliedDate: 1,
                scholarshipId: 1,
                scholarshipTitle: "$scholarshipDetails.scholarshipName",
                scholarshipCategory: "$scholarshipDetails.scholarshipCategory",
                paidFees: 1,
              },
            },
          ])
          .toArray();

        res.send(myApplications);
      } catch (error) {
        console.error("Failed to fetch user applications:", error);
        res
          .status(500)
          .send({ message: "Failed to retrieve applications from database." });
      }
    });

    // DELETE single application
    app.delete("/applications/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid application ID" });
        }

        const query = { _id: new ObjectId(id) };

        const result = await applicationsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Application deleted successfully",
          });
        } else {
          res.status(404).send({ message: "Application not found" });
        }
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).send({ message: "Server error during deletion" });
      }
    });

    // Get Fetch latest reviews for the homepage
    app.get("/latest-reviews", async (req, res) => {
      try {
        const latestReviews = await reviewsCollection
          .find({})
          .sort({ reviewDate: -1 })
          .limit(3)
          .toArray();
        res.send(latestReviews);
      } catch (error) {
        console.error("Error fetching latest reviews:", error);
        res.status(500).send({ message: "Failed to fetch latest reviews." });
      }
    });

    // Get reviews for a specific scholarship ID
    app.get("/reviews/scholarship/:id", async (req, res) => {});

    // ADD Scholarship  API
    app.post("/addScholars", async (req, res) => {
      const addScholar = req.body;
      addScholar.createdAt = new Date();

      const result = await addScholarCollection.insertOne(addScholar);
      res.send(result);
    });

    // Get Scholarships filtered by user email
    app.get("/addScholars", async (req, res) => {
      const { email } = req.query;
      const query = email ? { userEmail: email } : {};

      const options = { sort: { createdAt: -1 } }; // Assuming field name is 'createdAt'

      const cursor = addScholarCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Delete a scholarship
    app.delete("/addScholars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await addScholarCollection.deleteOne(query);
      res.send(result);
    });

    // Update/Edit a scholarship
    app.put("/addScholars/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedScholarship = req.body;

        const query = { _id: new ObjectId(id) };

        // Exclude unnecessary fields before setting
        const { userEmail, _id, postDate, createdAt, ...fieldsToUpdate } =
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

    // Update user role (Patch)
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

    // Delete a user
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
            // Calculate Total Fees Collected
            {
              $group: {
                _id: null,
                totalFeesCollected: { $sum: "$applicationFee" },
                applicationData: { $push: "$$ROOT" },
              },
            },
            { $unwind: "$applicationData" },

            // Lookup Scholarship Info
            {
              $lookup: {
                from: "addScholars",
                localField: "applicationData.scholarshipId",
                foreignField: "_id",
                as: "scholarshipInfo",
              },
            },
            { $unwind: "$scholarshipInfo" },

            // Group by Category to get application count
            {
              $group: {
                _id: "$scholarshipInfo.scholarshipCategory",
                count: { $sum: 1 },
                totalFeesCollected: { $first: "$totalFeesCollected" },
              },
            },

            // Final Projection
            {
              $project: {
                _id: 0,
                category: "$_id",
                count: 1,
                totalFeesCollected: 1,
              },
            },
          ])
          .toArray();

        const totalFeesCollected =
          aggregationResult[0]?.totalFeesCollected || 0;

        const applicationsByCategory = aggregationResult.map((item) => ({
          category: item.category,
          count: item.count,
        }));

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});



// Second Example

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ahmedtpro.4kxy1cz.mongodb.net/?appName=AhmedTPro`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verifyToken
const verifyToken = (req, res, next) => {
    // 1. Authorization Header থেকে টোকেন নিন
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access: No token provided' });
    }
    
    // Header Format: Bearer <token>
    const token = authHeader.split(' ')[1]; 
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
           
            console.error("Token verification error:", err);
            return res.status(401).send({ message: 'Unauthorized access: Invalid token' });
        }

        req.user = decoded;
        next();
    });
};


const verifyAdmin = async (req, res, next) => {
    const email = req.user.email; // verifyToken থেকে পাওয়া
    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access: Admin required' });
    }
    next();
};

const verifyModerator = async (req, res, next) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    
    if (!user || (user.role !== 'moderator' && user.role !== 'admin')) { 
        return res.status(403).send({ message: 'Forbidden access: Moderator or Admin required' });
    }
    next();
};

// JWT Functionality
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET; 

app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
});


async function run() {
  try {
    await client.connect();

    const db = client.db("scholarship_db");
    const addScholarCollection = db.collection("addScholars");
    const scholarshipsCollection = db.collection("scholarships");
    const usersCollection = db.collection("users");
    const applicationsCollection = db.collection("applications");
    const reviewsCollection = db.collection("reviews");

    console.log("Connected to MongoDB!");

    // ROOT
    app.get("/", (req, res) => {
      res.send("Scholarship Platform Server is Running!");
    });

    // Role base new root create
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;

      console.log("Fetching role for email:", email);

      if (!email) {
        return res.status(400).send({ message: "Email parameter is missing." });
      }

      try {
        const usersCollection = client.db("ScholarshipDB").collection("users");

        const user = await usersCollection.findOne({ email: email });

        if (user) {
          res.send({ role: user.role, email: user.email });
        } else {
          res.send({
            role: "user",
            email: email,
            message: "User not found, returning default role.",
          });
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        res
          .status(500)
          .send({ message: "Failed to fetch user role due to server error." });
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const usersCollection = client.db("ScholarshipDB").collection("users");

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      
      const result = await usersCollection.insertOne({
        email: user.email,
        name: user.name,
        role: user.role || "user",
      });

      res.send(result);
    });

    // Stripe API Start ( First Method )
    /* app.post("/create-payment-intent", async (req, res) => {
      const { fees } = req.body;

      const amount = parseInt(fees * 100);

      if (amount < 1) {
        return res.send({ clientSecret: "requires_no_payment" });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ message: "Failed to create payment intent." });
      }
    });

    app.post("/applications", async (req, res) => {
      const applicationData = req.body;

      try {
        if (applicationData.scholarshipId) {
          applicationData.scholarshipId = new ObjectId(
            applicationData.scholarshipId
          );
        } else {
          return res
            .status(400)
            .send({ message: "Scholarship ID is missing." });
        }

        if (!applicationData.status) {
          applicationData.status = "Pending";
        }

        const result = await applicationsCollection.insertOne(applicationData);

        if (result.insertedId) {
        }

        res.send(result);
      } catch (error) {
        if (error.name === "BSONTypeError") {
          console.error(
            "Invalid Scholarship ID Format:",
            applicationData.scholarshipId
          );
          return res
            .status(400)
            .send({ message: "Invalid Scholarship ID format." });
        }

        console.error("Application Submission Error:", error);
        res.status(500).send({ message: "Failed to submit application." });
      }
    }); */

    // Stripe API Start ( Second Method )
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      if (!price || price < 1) {
        return res.status(400).send({ error: "Invalid price amount." });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: "usd",
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({
          error: "Failed to create payment intent.",
          details: error.message,
        });
      }
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const scholarshipId = application.scholarshipId;

      try {
        const result = await applicationsCollection.insertOne(application);

        if (result.insertedId && scholarshipId) {
          let objectIdScholarshipId;
          try {
            objectIdScholarshipId = new ObjectId(scholarshipId);
          } catch (err) {
            console.warn(
              `Invalid scholarship ID format received: ${scholarshipId}`
            );

            objectIdScholarshipId = null;
          }

          if (objectIdScholarshipId) {
            const updateResult = await scholarshipsCollection.updateOne(
              { _id: objectIdScholarshipId },
              {
                $inc: {
                  applicationCount: 1,
                },
              }
            );
            if (updateResult.modifiedCount === 0) {
              console.log(
                `Scholarship update warning: ID ${scholarshipId} not found.`
              );
            }
          }
        }

        res.status(201).send(result);
      } catch (error) {
        console.error("Error processing application:", error);

        if (error.code === 11000) {
          return res.status(400).send({
            message: "You have already applied for this scholarship.",
          });
        }

        res.status(500).send({
          message: "Failed to save application due to server error.",
          error: error.message,
        });
      }
    });

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

    // Get single scholarship by ID
    app.get("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const scholarship = await addScholarCollection.findOne(query);

        if (!scholarship) {
          return res
            .status(404)
            .send({ message: "Scholarship not found with this ID." });
        }
        res.send(scholarship);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID format or server error." });
      }
    });

    // POST Add a new review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;

        review.scholarshipId = new ObjectId(review.scholarshipId);

        if (!review.reviewDate) {
          review.reviewDate = new Date();
        }

        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error("Error inserting review:", error);
        res
          .status(500)
          .send({ message: "Failed to submit review due to server error." });
      }
    });

    app.get("/dashboard/my-applications", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res
          .status(403)
          .send({ message: 'Forbidden: Email mismatch.' });
      }

      try {
        const query = { applicantEmail: email };

        const myApplications = await applicationsCollection
          .aggregate([
            { $match: query },
            {
              $lookup: {
                from: "addScholars",
                localField: "scholarshipId",
                foreignField: "_id",
                as: "scholarshipDetails",
              },
            },
            {
              $unwind: {
                path: "$scholarshipDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                transactionId: 1,
                paymentDate: 1,
                appliedDate: 1,
                scholarshipId: 1,
                scholarshipTitle: "$scholarshipDetails.scholarshipName",
                scholarshipCategory: "$scholarshipDetails.scholarshipCategory",
                paidFees: 1,
              },
            },
          ])
          .toArray();

        res.send(myApplications);
      } catch (error) {
        console.error("Failed to fetch user applications:", error);
        res
          .status(500)
          .send({ message: "Failed to retrieve applications from database." });
      }
    });

    // DELETE single application
    app.delete("/applications/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid application ID" });
        }

        const query = { _id: new ObjectId(id) };

        const result = await applicationsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Application deleted successfully",
          });
        } else {
          res.status(404).send({ message: "Application not found" });
        }
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).send({ message: "Server error during deletion" });
      }
    });

    // Get Fetch latest reviews for the homepage
    app.get("/latest-reviews", async (req, res) => {
      try {
        const latestReviews = await reviewsCollection
          .find({})
          .sort({ reviewDate: -1 })
          .limit(3)
          .toArray();
        res.send(latestReviews);
      } catch (error) {
        console.error("Error fetching latest reviews:", error);
        res.status(500).send({ message: "Failed to fetch latest reviews." });
      }
    });

    // Get reviews for a specific scholarship ID
    app.get("/reviews/scholarship/:id", async (req, res) => {});

    // ADD Scholarship  API
    app.post("/addScholars",verifyToken, verifyModerator, async (req, res) => {
      const addScholar = req.body;
      addScholar.createdAt = new Date();
      addScholar.userEmail = req.user.email;

      const result = await addScholarCollection.insertOne(addScholar);
      res.send(result);
    });

    // Get Scholarships filtered by user email
    app.get("/addScholars", async (req, res) => {
      const { email } = req.query;
      const query = email ? { userEmail: email } : {};

      const options = { sort: { createdAt: -1 } };

      const cursor = addScholarCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Delete a scholarship
    app.delete("/addScholars/:id", verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await addScholarCollection.deleteOne(query);
      res.send(result);
    });

    // Update/Edit a scholarship
    app.put("/addScholars/:id", verifyToken, verifyModerator, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedScholarship = req.body;

        const query = { _id: new ObjectId(id) };

        const { userEmail, _id, postDate, createdAt, ...fieldsToUpdate } =
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

    // addScholars api End

    // Users api Start ----------------------------
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const role = req.query.role;
        const query = role ? { role: role } : {};

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users." });
      }
    });

    // Update user role (Patch)
    app.patch("/users/role/:id",verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;
        const query = { _id: new ObjectId(id) };

        if (!role || !['admin', 'moderator', 'user'].includes(role)) {
            return res.status(400).send({ message: 'Invalid role specified' });
        }

        const updateDoc = {
          $set: { role: role },
        };

        const result = await usersCollection.updateOne(query, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "User not found or role already set." });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update user role." });
      }
    });

    // Delete a user
    app.delete("/users/:id",verifyToken, verifyAdmin, async (req, res) => {
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
            // Calculate Total Fees Collected
            {
              $group: {
                _id: null,
                totalFeesCollected: { $sum: "$applicationFee" },
                applicationData: { $push: "$$ROOT" },
              },
            },
            { $unwind: "$applicationData" },

            // Lookup Scholarship Info
            {
              $lookup: {
                from: "addScholars",
                localField: "applicationData.scholarshipId",
                foreignField: "_id",
                as: "scholarshipInfo",
              },
            },
            { $unwind: "$scholarshipInfo" },

            // Group by Category to get application count
            {
              $group: {
                _id: "$scholarshipInfo.scholarshipCategory",
                count: { $sum: 1 },
                totalFeesCollected: { $first: "$totalFeesCollected" },
              },
            },

            // Final Projection
            {
              $project: {
                _id: 0,
                category: "$_id",
                count: 1,
                totalFeesCollected: 1,
              },
            },
          ])
          .toArray();

        const totalFeesCollected =
          aggregationResult[0]?.totalFeesCollected || 0;

        const applicationsByCategory = aggregationResult.map((item) => ({
          category: item.category,
          count: item.count,
        }));

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
