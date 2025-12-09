require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth-routes/index");
const mediaRoutes = require("./routes/instructor-routes/media-routes");
const instructorCourseRoutes = require("./routes/instructor-routes/course-routes");
const studentViewCourseRoutes = require("./routes/student-routes/course-routes");
const studentViewOrderRoutes = require("./routes/student-routes/order-routes");
const studentCoursesRoutes = require("./routes/student-routes/student-courses-routes");
const studentCourseProgressRoutes = require("./routes/student-routes/course-progress-routes");
const groupRoutes = require("./routes/group-routes");
const { setupSocketIO } = require("./socket/socket-handler");

const app = express();
const server = http.createServer(app);
const io = setupSocketIO(
  new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  })
);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.static("uploads")); // Serve uploaded files

//database connection
if (!MONGO_URI || MONGO_URI === "your_mongodb_cluster_uri_here") {
  console.error("ERROR: MONGO_URI is not set in .env file!");
  console.error("Please update MERN-LMS-2024-master/server/.env with your MongoDB connection string");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB is connected successfully"))
    .catch((e) => {
      console.error("❌ MongoDB connection error:", e.message);
      console.error("Please check your MONGO_URI in .env file");
    });
}

//routes configuration
app.use("/auth", authRoutes);
app.use("/media", mediaRoutes);
app.use("/instructor/course", instructorCourseRoutes);
app.use("/student/course", studentViewCourseRoutes);
app.use("/student/order", studentViewOrderRoutes);
app.use("/student/courses-bought", studentCoursesRoutes);
app.use("/student/course-progress", studentCourseProgressRoutes);
app.use("/groups", groupRoutes);

app.use((err, req, res, next) => {
  console.log(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server is now running on port ${PORT}`);
  console.log(`📡 Socket.io is ready for real-time connections`);
});
