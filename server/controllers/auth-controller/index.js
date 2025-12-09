const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const validateEmail = (email) => {
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(String(email).toLowerCase());
};

const registerUser = async (req, res) => {
  try {
    const { userName, userEmail, password, role } = req.body;

    // Basic validation
    if (!userName || !userEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "userName, userEmail and password are required",
      });
    }

    if (!validateEmail(userEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ userEmail }, { userName }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User name or user email already exists",
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      userName,
      userEmail,
      role,
      password: hashPassword,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
    });
  } catch (error) {
    console.error("registerUser error:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Server error",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { userEmail, password } = req.body;

    if (!userEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "userEmail and password are required",
      });
    }

    const checkUser = await User.findOne({ userEmail });

    if (!checkUser || !(await bcrypt.compare(password, checkUser.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const accessToken = jwt.sign(
      {
        _id: checkUser._id,
        userName: checkUser.userName,
        userEmail: checkUser.userEmail,
        role: checkUser.role,
      },
      process.env.JWT_SECRET || "JWT_SECRET",
      { expiresIn: "120m" }
    );

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        accessToken,
        user: {
          _id: checkUser._id,
          userName: checkUser.userName,
          userEmail: checkUser.userEmail,
          role: checkUser.role,
        },
      },
    });
  } catch (error) {
    console.error("loginUser error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Simple forgot-password handler (placeholder)
const forgotPassword = async (req, res) => {
  try {
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "userEmail is required" });
    }

    const user = await User.findOne({ userEmail });
    if (!user) {
      // avoid revealing whether email exists in production
      return res.status(200).json({ success: true, message: "If the email exists, a reset link has been sent" });
    }

    // TODO: generate reset token, send email. For now, respond with success message.
    return res.status(200).json({ success: true, message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { registerUser, loginUser, forgotPassword };
