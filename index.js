require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET;

// Global Collection Variable
let addScholarsCollection;
let scholarshipsCollection;
let usersCollection;
let applicationsCollection;
let reviewsCollection;

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
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("Error: Authorization header missing.");
    return res
      .status(401)
      .send({ message: "Unauthorized access: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log("Error: JWT Verification Failed.", err);
      return res
        .status(401)
        .send({ message: "Unauthorized access: Invalid token" });
    }

    req.user = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.user.email;
  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "admin") {
    return res
      .status(403)
      .send({ message: "Forbidden access: Admin required" });
  }
  next();
};

// verifyModerator
const verifyModerator = async (req, res, next) => {
  const email = req.user.email;
  // Global Variable uses
  const user = await usersCollection.findOne({ email });

  if (!user || (user.role !== "moderator" && user.role !== "admin")) {
    return res
      .status(403)
      .send({ message: "Forbidden access: Moderator or Admin required" });
  }
  next();
};

// verifyModeratorOrAdmin
const verifyModeratorOrAdmin = async (req, res, next) => {
  const email = req.user.email;
  const query = { email: email };

  const user = await usersCollection.findOne(query);
  const role = user?.role;

  if (role !== "moderator" && role !== "admin") {
    return res
      .status(403)
      .send({ message: "Forbidden access: Requires Moderator or Admin role." });
  }
  next();
};

// JWT Functionality
app.post("/jwt", async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  console.log(token);
  res.send({ token });
});

app.get("/", (req, res) => {
  res.send("Your Server is running successfully!");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("scholarship_db");

    const addScholarsCollection = db.collection("addScholars");
    const scholarshipCollection = client
      .db("scholarship_db")
      .collection("addScholars");
    const scholarshipsCollection = db.collection("scholarships");
    const usersCollection = db.collection("users");
    const applicationsCollection = db.collection("applications");
    const reviewsCollection = db.collection("reviews");
    // (End of Assignments)

    console.log("Connected to MongoDB and collections initialized!");

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

    // Role base new root create
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;

      console.log("Fetching role for email:", email);

      if (!email) {
        return res.status(400).send({ message: "Email parameter is missing." });
      }

      try {
        const usersCollection = client.db("scholarship_db").collection("users");

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
      const usersCollection = client.db("scholarship_db").collection("users");

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

    app.get("/user/profile", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const jwtEmail = req.user.email;

        if (email !== jwtEmail) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const user = await usersCollection.findOne({ email: email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // usersCollection api Start ----------------------------
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {});

    app.patch(
      "/users/role/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {}
    );

    // POST User Review
    app.post("/reviews", verifyToken, async (req, res) => {
      try {
        const reviewData = req.body;

        if (
          !reviewData.reviewerEmail ||
          !reviewData.scholarshipId ||
          !reviewData.rating
        ) {
          return res.status(400).send({
            message:
              "Missing required review fields (email, scholarship ID, or rating).",
          });
        }

        const reviewToInsert = {
          ...reviewData,
          createdAt: new Date(),
        };

        const result = await reviewsCollection.insertOne(reviewToInsert);
        res.status(201).send({
          message: "Review submitted successfully!",
          reviewId: result.insertedId,
        });
      } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).send({ message: "Failed to submit review." });
      }
    });
    // Users api End

    // GET Pending Applications for Moderator Review
    app.get(
      "/applications/pending",
      verifyToken,
      verifyModerator,
      async (req, res) => {
        try {
          const query = {
            status: "Pending",
          };

          const pendingApplications = await applicationsCollection
            .find(query)
            .sort({ appliedDate: 1 })
            .toArray();

          res.send(pendingApplications);
        } catch (error) {
          console.error("Error fetching pending applications:", error);
          res
            .status(500)
            .send({ message: "Failed to retrieve pending applications." });
        }
      }
    );

    // PATCH Application Status Update (Approve/Reject)
    app.patch(
      "/applications/status/:id",
      verifyToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const { status, feedback } = req.body;

        if (
          !ObjectId.isValid(id) ||
          !["Approved", "Rejected"].includes(status)
        ) {
          return res
            .status(400)
            .send({ message: "Invalid application ID or status." });
        }

        try {
          const updateDoc = {
            $set: {
              status: status,
              moderationDate: new Date(),
              feedback: feedback || null,
            },
          };

          const result = await applicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            updateDoc
          );

          if (result.modifiedCount === 0) {
            return res.status(404).send({
              message: "Application not found or status already set.",
            });
          }

          res.send({ message: `Application ${status} successfully`, result });
        } catch (error) {
          console.error("Error updating application status:", error);
          res.status(500).send({ message: "Failed to update status." });
        }
      }
    );

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
    app.get("/all-scholarships", async (req, res) => {
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
          query.country = location;
        }

        const scholarships = await addScholarsCollection.find(query).toArray();

        res.json(scholarships);
      } catch (error) {
        console.error("Error fetching scholarships:", error);

        res.status(500).json([]);
      }
    });

    app.delete("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await scholarshipsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Not deleted" });
      }
    });

    // Get single scholarship by ID
    app.get("/all-scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid Scholarship ID format." });
        }

        const query = { _id: new ObjectId(id) };
        const scholarship = await addScholarsCollection.findOne(query);

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

    // GET User's Own Applications
    app.get("/applications/my-applications", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;

        if (req.query.email !== userEmail) {
          return res
            .status(403)
            .send({ message: "Forbidden access: Email mismatch." });
        }

        const query = { applicantEmail: userEmail };

        const myApplications = await applicationsCollection
          .aggregate([
            { $match: query },
            {
              $lookup: {
                from: "scholarships",
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
                appliedDate: 1,
                scholarshipTitle: "$scholarshipDetails.scholarshipName",
                universityName: "$scholarshipDetails.universityName",
                deadline: "$scholarshipDetails.applicationDeadline",
                feedback: 1,
              },
            },
            { $sort: { appliedDate: -1 } },
          ])
          .toArray();

        res.send(myApplications);
      } catch (error) {
        console.error("User Application Fetch Error:", error);
        res
          .status(500)
          .send({ message: "Failed to retrieve user applications." });
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
    app.delete(
      "/applications/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

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

    // ADD Scholarship  API
    app.post("/addScholars", async (req, res) => {
      const addScholar = req.body;
      addScholar.createdAt = new Date();

      const result = await addScholarsCollection.insertOne(addScholar);
      res.send(result);
    });

    // Get Scholarships filtered by user email
    app.get("/addScholars", async (req, res) => {
      const { email } = req.query;
      const query = email ? { userEmail: email } : {};

      const options = { sort: { createdAt: -1 } }; // Assuming field name is 'createdAt'

      const cursor = addScholarsCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    // POST Add New Scholarship (Moderator or Admin Only)
    app.post(
      "/add-scholarships",
      verifyToken,
      verifyModeratorOrAdmin,
      async (req, res) => {
        try {
          const scholarshipData = req.body;

          if (scholarshipData.postedBy.email !== req.user.email) {
            return res
              .status(403)
              .send({ message: "Forbidden: Poster email mismatch." });
          }

          const docToInsert = {
            ...scholarshipData,
            worldRank: parseInt(scholarshipData.worldRank),
            tuitionFee: parseFloat(scholarshipData.tuitionFee),
            serviceFee: parseFloat(scholarshipData.serviceFee),
            applicationCount: 0,
            reviewCount: 0,
            averageRating: 0,
          };

          const result = await addScholarsCollection.insertOne(docToInsert);
          res.status(201).send({
            insertedId: result.insertedId,
            message: "Scholarship posted successfully.",
          });
        } catch (error) {
          console.error("Error adding scholarship:", error);
          res.status(500).send({
            message: "Failed to add scholarship due to server error.",
          });
        }
      }
    );

    // Delete a scholarship
    app.delete("/addScholars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await addScholarsCollection.deleteOne(query);
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

        const result = await addScholarsCollection.updateOne(
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

    // Analytics api Start
    app.get("/analytics/platform-stats", async (req, res) => {
      try {
        const totalUsers = await usersCollection.estimatedDocumentCount();

        const totalScholarships =
          await scholarshipCollection.estimatedDocumentCount();

        const applications = await applicationsCollection.find().toArray();

        const totalFeesCollected = applications.reduce((sum, app) => {
          return sum + (parseFloat(app.paidFees) || 0);
        }, 0);

        const applicationsByCategory = await applicationsCollection
          .aggregate([
            {
              $group: {
                _id: "$scholarshipCategory",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                category: { $ifNull: ["$_id", "Not Specified"] },
                count: 1,
              },
            },
          ])
          .toArray();

        res.send({
          totalUsers,
          totalScholarships,
          totalFeesCollected,
          applicationsByCategory,
        });
      } catch (error) {
        res.status(500).send({ message: "Error", error: error.message });
      }
    });
    // Analytics api End

    // GET All Scholarships for Moderator/Admin
    app.get(
      "/moderator/all-scholarships",
      verifyToken,
      verifyModeratorOrAdmin,
      async (req, res) => {
        try {
          const result = await addScholarsCollection
            .find({})
            .sort({ postDate: -1 })
            .toArray();

          res.send(result);
        } catch (error) {
          console.error("Moderator/Admin All Scholarships Fetch Error:", error);
          res
            .status(500)
            .send({ message: "Failed to retrieve all scholarships." });
        }
      }
    );

    // Get Pending Applications for Moderator Review
    app.get(
      "/moderator/pending-applications",
      verifyToken,
      verifyModeratorOrAdmin,
      async (req, res) => {
        try {
          const query = { status: "Pending" };

          const pendingApplications = await applicationsCollection
            .aggregate([
              { $match: query },
              {
                $lookup: {
                  from: "addScholars",
                  localField: "scholarshipId",
                  foreignField: "_id",
                  as: "scholarshipInfo",
                },
              },
              {
                $unwind: {
                  path: "$scholarshipInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  appliedDate: 1,
                  applicantName: 1,
                  applicantEmail: 1,
                  applicantAddress: 1,
                  scholarshipTitle: "$scholarshipInfo.scholarshipName",
                  universityName: "$scholarshipInfo.universityName",
                },
              },
              { $sort: { appliedDate: 1 } },
            ])
            .toArray();

          res.send(pendingApplications);
        } catch (error) {
          console.error("Moderator Pending Applications Fetch Error:", error);
          res
            .status(500)
            .send({ message: "Failed to retrieve pending applications." });
        }
      }
    );

    // Patch Update Application Status (Approve/Reject)
    app.get("/all-applications", verifyToken, async (req, res) => {
      try {
        const result = await applicationsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch applications" });
      }
    });

    app.patch("/application-status/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: { status: status },
        };
        const result = await applicationsCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Status update failed" });
      }
    });

    app.patch("/application-feedback/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { feedback } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: { feedback: feedback },
        };
        const result = await applicationsCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Feedback submission failed" });
      }
    });

    // Get Single Scholarship Details (For Moderator/Admin Editing)
    app.get("/scholarship/details/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid scholarship ID format." });
        }

        const query = { _id: new ObjectId(id) };
        const scholarship = await addScholarsCollection.findOne(query);

        if (!scholarship) {
          return res.status(404).send({ message: "Scholarship not found." });
        }

        res.send(scholarship);
      } catch (error) {
        console.error("Fetch Single Scholarship Error:", error);
        res
          .status(500)
          .send({ message: "Failed to retrieve scholarship details." });
      }
    });

    // Patch Update Scholarship Data (Moderator/Admin Only)
    app.patch("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid scholarship ID format." });
        }

        const docToUpdate = {
          ...updatedData,
          worldRank: parseInt(updatedData.worldRank),
          tuitionFee: parseFloat(updatedData.tuitionFee),
          serviceFee: parseFloat(updatedData.serviceFee),
        };

        const updateDoc = {
          $set: docToUpdate,
        };

        const result = await addScholarsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Scholarship not found." });
        }

        res.send({
          success: true,
          message: "Scholarship updated successfully.",
        });
      } catch (error) {
        console.error("Scholarship Update Error:", error);
        res.status(500).send({ message: "Failed to update scholarship." });
      }
    });

    // Get User Profile Data from DB
    app.get("/users/profile", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        if (req.query.email !== userEmail) {
          return res
            .status(403)
            .send({ message: "Forbidden access: Email mismatch." });
        }

        const user = await usersCollection.findOne(
          { email: userEmail },
          { projection: { _id: 0, address: 1, phoneNumber: 1, role: 1 } }
        );

        if (!user) {
          return res.status(404).send({ message: "User not found in DB." });
        }

        res.send(user);
      } catch (error) {
        console.error("Fetch DB Profile Error:", error);
        res.status(500).send({ message: "Failed to fetch user data." });
      }
    });

    // Patch Update User Profile Data
    app.patch("/users/profile", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const updatedProfile = req.body;

        if (updatedProfile.email && updatedProfile.email !== userEmail) {
          return res
            .status(403)
            .send({ message: "Forbidden: User email cannot be changed." });
        }

        const query = { email: userEmail };

        const updateDoc = {
          $set: {
            name: updatedProfile.name,
            photoURL: updatedProfile.photoURL,
            address: updatedProfile.address,
            phoneNumber: updatedProfile.phoneNumber,
          },
        };

        const result = await usersCollection.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found." });
        }

        if (result.modifiedCount === 0) {
          return res.send({
            success: true,
            message: "Profile data is already up to date.",
          });
        }

        res.send({ success: true, message: "Profile updated successfully." });
      } catch (error) {
        console.error("User Profile Update Error:", error);
        res.status(500).send({ message: "Failed to update profile." });
      }
    });

    // Get User's Own Reviews
    app.get("/user/my-reviews", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const emailFromQuery = req.query.email;

        if (emailFromQuery !== userEmail) {
          console.warn(
            `Access attempt blocked for email: ${emailFromQuery} (JWT: ${userEmail})`
          );
          return res
            .status(403)
            .send({ message: "Forbidden access: Email mismatch." });
        }

        const query = { reviewerEmail: userEmail };

        const myReviews = await reviewsCollection.find(query).toArray();

        res.send(myReviews);
      } catch (error) {
        console.error("Fetch My Reviews Error:", error);
        res.status(500).send({ message: "Failed to fetch user reviews." });
      }
    });

    // Get User Role by Email
    app.get("/user/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (!usersCollection) {
        return res.status(500).send({ message: "Database not initialized" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (!user) {
        return res
          .status(404)
          .send({ role: "student", message: "User not in DB" });
      }

      res.send({ role: user.role, status: user.status });
    });

    // Get reviews for a specific scholarship ID
    app.get("/reviews/scholarship/:id", async (req, res) => {});

    // Scholarship Delete API
    app.delete("/all-scholarship/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        console.log(
          "Attempting to delete from addScholars collection with ID:",
          id
        );

        const query = { _id: new ObjectId(id) };
        const result = await addScholarsCollection.deleteOne(query);

        console.log("Final DB Result:", result);
        res.send(result);
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Extra Review for see
    app.get("/reviews/:scholarshipId", async (req, res) => {
      try {
        const scholarshipId = req.params.scholarshipId;

        const reviews = await reviewsCollection
          .find({ scholarshipId: scholarshipId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Failed to retrieve reviews." });
      }
    });

    // POST Add a new review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;

        const result = await reviewsCollection.insertOne(review);

        if (result.insertedId) {
          res.status(201).send(result);
        } else {
          res.status(400).send({ message: "Failed to add review" });
        }
      } catch (error) {
        console.error("Review Error:", error);
        res.status(500).send({
          message: "Internal Server Error",
          error: error.message,
        });
      }
    });

    // Get Single Review by ID
    app.get("/reviews/single/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Review ID." });
        }

        const query = { _id: new ObjectId(id) };
        const review = await reviewsCollection.findOne(query);

        if (!review) {
          return res.status(404).send({ message: "Review not found." });
        }

        res.send(review);
      } catch (error) {
        console.error("Fetch Review Error:", error);
        res.status(500).send({ message: "Failed to fetch review data." });
      }
    });

    // DELETE a Review (Admin only)
    app.delete("/reviews/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };

        const result = await reviewsCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ message: "Review not found" });
        }
      } catch (error) {
        console.error("Review Delete Error:", error);
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // Patch Update Review by ID
    app.patch("/reviews/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const userEmail = req.user.email;
        const updatedReview = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Review ID." });
        }

        const existingReview = await reviewsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!existingReview || existingReview.reviewerEmail !== userEmail) {
          return res.status(403).send({
            message: "Forbidden: You can only edit your own reviews.",
          });
        }

        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            rating: updatedReview.rating,
            comment: updatedReview.comment,
          },
        };

        const result = await reviewsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ message: "Review not found for update." });
        }
        if (result.modifiedCount === 0) {
          return res.send({
            success: true,
            message: "Review data is already up to date.",
          });
        }

        res.send({ success: true, message: "Review updated successfully." });
      } catch (error) {
        console.error("Review Update Error:", error);
        res.status(500).send({ message: "Failed to update review." });
      }
    });

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
