const jwt = require("jsonwebtoken");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const GroupResource = require("../models/GroupResource");
const GroupTask = require("../models/GroupTask");
const GroupPoll = require("../models/GroupPoll");
const GroupFile = require("../models/GroupFile");
const Course = require("../models/Course");
const StudentCourses = require("../models/StudentCourses");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const INVITE_TOKEN_SECRET = process.env.INVITE_TOKEN_SECRET || "INVITE_TOKEN_SECRET";

const generateJoinCode = async () => {
  const createCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // retry until unique
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const code = createCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Group.findOne({ joinCode: code });
    if (!exists) return code;
  }
};

const createInviteToken = (groupId) =>
  jwt.sign({ groupId }, INVITE_TOKEN_SECRET, { expiresIn: "7d" });

const verifyInviteToken = (token) => jwt.verify(token, INVITE_TOKEN_SECRET);

const findGroupAndEnsureMember = async (groupId, userId, res) => {
  const group = await Group.findById(groupId);

  if (!group) {
    res.status(404).json({ success: false, message: "Group not found" });
    return null;
  }

  const isMember = group.members.some((member) => member.userId.toString() === userId);
  if (!isMember) {
    res.status(403).json({ success: false, message: "You are not a member of this group" });
    return null;
  }

  return group;
};

const createGroup = async (req, res) => {
  try {
    const { name, description = "" } = req.body;
    const userId = req.user._id;

    if (!name) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const joinCode = await generateJoinCode();
    const newGroup = new Group({
      name,
      description,
      joinCode,
      createdBy: userId,
      members: [{ userId, role: "admin" }],
    });

    await newGroup.save();

    newGroup.inviteToken = createInviteToken(newGroup._id.toString());
    await newGroup.save();

    return res.status(201).json({
      success: true,
      message: "Group created",
      data: newGroup,
    });
  } catch (error) {
    console.error("createGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Instructor creates a group tied to a course; if one already exists, return existing
const createCourseGroup = async (req, res) => {
  try {
    const { courseId, name, description = "" } = req.body;
    const userId = req.user._id?.toString();

    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId is required" });
    }

    const course = await Course.findOne({ _id: courseId, instructorId: userId });
    if (!course) {
      return res
        .status(403)
        .json({ success: false, message: "You can only create groups for your own course" });
    }

    const existing = await Group.findOne({ courseId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Group already exists for this course",
        data: existing,
      });
    }

    const joinCode = await generateJoinCode();
    const newGroup = new Group({
      name: name || `${course.title || "Course"} Group`,
      description,
      joinCode,
      createdBy: userId,
      members: [{ userId, role: "admin" }],
      courseId,
      active: true,
    });

    await newGroup.save();
    newGroup.inviteToken = createInviteToken(newGroup._id.toString());
    await newGroup.save();

    return res.status(201).json({
      success: true,
      message: "Course group created",
      data: newGroup,
    });
  } catch (error) {
    console.error("createCourseGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Student or instructor joins course group via join code; validates enrollment or course ownership
const joinCourseGroup = async (req, res) => {
  try {
    const { joinCode } = req.body;
    const userId = req.user._id?.toString();

    if (!joinCode) {
      return res.status(400).json({ success: false, message: "joinCode is required" });
    }

    const group = await Group.findOne({ joinCode, active: true });
    if (!group || !group.courseId) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const course = await Course.findById(group.courseId).lean();
    const isInstructor = course && course.instructorId?.toString() === userId;

    // Students must be enrolled; instructors can always join their own course group
    if (!isInstructor) {
      const enrolled = await StudentCourses.findOne({
        userId,
        "courses.courseId": group.courseId.toString(),
      });

      if (!enrolled) {
        return res.status(403).json({
          success: false,
          message: "You must be enrolled in this course to join its group",
        });
      }
    }

    const alreadyMember = group.members.some((m) => m.userId.toString() === userId);
    if (!alreadyMember) {
      group.members.push({ userId, role: isInstructor ? "admin" : "member" });
      await group.save();
    }

    return res.status(200).json({
      success: true,
      message: "Joined course group successfully",
      data: group,
    });
  } catch (error) {
    console.error("joinCourseGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Fetch existing course group by courseId (used by instructor to view/join with same code students receive)
const getCourseGroupByCourseId = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({ success: false, message: "courseId is required" });
    }

    const group = await Group.findOne({ courseId });
    if (!group) {
      return res.status(404).json({ success: false, message: "No group found for this course" });
    }

    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error("getCourseGroupByCourseId error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ "members.userId": userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error("getMyGroups error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { joinCode, inviteToken } = req.body;
    const userId = req.user._id;

    if (!joinCode && !inviteToken) {
      return res.status(400).json({
        success: false,
        message: "joinCode or inviteToken is required",
      });
    }

    let group;
    if (joinCode) {
      group = await Group.findOne({ joinCode });
    } else if (inviteToken) {
      const payload = verifyInviteToken(inviteToken);
      group = await Group.findById(payload.groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const alreadyMember = group.members.some(
      (member) => member.userId.toString() === userId
    );

    if (!alreadyMember) {
      group.members.push({ userId, role: "member" });
      await group.save();
    }

    return res.status(200).json({
      success: true,
      message: "Joined group successfully",
      data: group,
    });
  } catch (error) {
    console.error("joinGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error("getGroupDetails error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const badWords = ["badword", "spam", "abuse"];

const hasProfanity = (text) => {
  const lower = text.toLowerCase();
  return badWords.some((w) => lower.includes(w));
};

const isSpammy = (text) => {
  if (!text) return false;
  if (text.length > 2000) return true;
  const repeated = /(.)\1{10,}/; // long repeated chars
  return repeated.test(text);
};

const postMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    if (group.chatDisabled) {
      return res.status(403).json({ success: false, message: "Chat is temporarily disabled by admin" });
    }

    const muted = group.mutedUsers.find((m) => m.userId.toString() === userId.toString());
    if (muted) {
      const now = new Date();
      if (!muted.mutedUntil || new Date(muted.mutedUntil) > now) {
        return res.status(403).json({ success: false, message: "You are muted in this group" });
      }
    }

    const cleanText = text.trim();
    if (group.profanityFilterEnabled && hasProfanity(cleanText)) {
      return res.status(400).json({ success: false, message: "Message blocked by profanity filter" });
    }

    if (group.spamFilterEnabled && isSpammy(cleanText)) {
      return res.status(400).json({ success: false, message: "Message flagged as spam" });
    }

    const message = await GroupMessage.create({
      groupId,
      senderId: userId,
      text: cleanText,
    });

    return res
      .status(201)
      .json({ success: true, message: "Message sent", data: message });
  } catch (error) {
    console.error("postMessage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 30 } = req.query;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    // Get latest messages then reverse to show oldest → newest
    const messagesDesc = await GroupMessage.find({ groupId })
      .populate("senderId", "userName userEmail")
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 30);

    const messages = [...messagesDesc].reverse();

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addResource = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type = "link", title, url } = req.body;
    const userId = req.user._id;

    if (!title || !url) {
      return res.status(400).json({
        success: false,
        message: "title and url are required",
      });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const resource = await GroupResource.create({
      groupId,
      addedBy: userId,
      type,
      title,
      url,
    });

    return res
      .status(201)
      .json({ success: true, message: "Resource added", data: resource });
  } catch (error) {
    console.error("addResource error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getResources = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const resources = await GroupResource.find({ groupId })
      .populate("addedBy", "userName userEmail")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: resources });
  } catch (error) {
    console.error("getResources error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addTask = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, description = "", assignees = [], dueDate } = req.body;
    const userId = req.user._id;

    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const task = await GroupTask.create({
      groupId,
      title,
      description,
      assignees,
      dueDate,
      assignedBy: userId,
    });

    return res.status(201).json({ success: true, message: "Task added", data: task });
  } catch (error) {
    console.error("addTask error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getTasks = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const tasks = await GroupTask.find({ groupId })
      .populate("assignedBy", "userName userEmail")
      .populate("assignees", "userName userEmail")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error("getTasks error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { groupId, taskId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!["pending", "completed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const task = await GroupTask.findOne({ _id: taskId, groupId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.status = status;
    task.completedAt = status === "completed" ? new Date() : null;
    await task.save();

    return res.status(200).json({ success: true, message: "Task updated", data: task });
  } catch (error) {
    console.error("updateTaskStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// File upload configuration
const uploadsDir = path.join(__dirname, "../uploads/groups");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  },
});

const uploadFile = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const groupFile = await GroupFile.create({
      groupId,
      uploadedBy: userId,
      fileName: file.filename,
      originalName: file.originalname,
      filePath: `/uploads/groups/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
      description: req.body.description || "",
    });

    await groupFile.populate("uploadedBy", "userName userEmail");

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: groupFile,
    });
  } catch (error) {
    console.error("uploadFile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getFiles = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const files = await GroupFile.find({ groupId })
      .populate("uploadedBy", "userName userEmail")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error("getFiles error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const createPoll = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { question, options, expiresAt } = req.body;
    const userId = req.user._id;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Question and at least 2 options are required",
      });
    }

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const poll = await GroupPoll.create({
      groupId,
      createdBy: userId,
      question,
      options: options.map((opt) => ({ text: opt, votes: [] })),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await poll.populate("createdBy", "userName userEmail");

    return res.status(201).json({ success: true, message: "Poll created", data: poll });
  } catch (error) {
    console.error("createPoll error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getPolls = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const polls = await GroupPoll.find({ groupId })
      .populate("createdBy", "userName userEmail")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: polls });
  } catch (error) {
    console.error("getPolls error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const votePoll = async (req, res) => {
  try {
    const { groupId, pollId } = req.params;
    const { optionIndex } = req.body;
    const userId = req.user._id;

    const group = await findGroupAndEnsureMember(groupId, userId, res);
    if (!group) return;

    const poll = await GroupPoll.findOne({ _id: pollId, groupId });
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    if (!poll.isActive) {
      return res.status(400).json({ success: false, message: "Poll is not active" });
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      poll.isActive = false;
      await poll.save();
      return res.status(400).json({ success: false, message: "Poll has expired" });
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ success: false, message: "Invalid option" });
    }

    // Remove user's vote from all options
    poll.options.forEach((option) => {
      option.votes = option.votes.filter(
        (voteId) => voteId.toString() !== userId
      );
    });

    // Add vote to selected option
    poll.options[optionIndex].votes.push(userId);
    await poll.save();

    await poll.populate("createdBy", "userName userEmail");

    return res.status(200).json({ success: true, message: "Vote recorded", data: poll });
  } catch (error) {
    console.error("votePoll error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Leave group
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    // Prevent owner from leaving without deleting/transferring ownership
    if (group.createdBy.toString() === userId) {
      return res.status(403).json({
        success: false,
        message: "Group owner cannot leave the group. Delete the group or transfer ownership first.",
      });
    }

    group.members = group.members.filter((m) => m.userId.toString() !== userId);
    await group.save();

    // If no members remain, remove the group and associated data
    if (!group.members || group.members.length === 0) {
      // delete related data
      await GroupMessage.deleteMany({ groupId });
      await GroupResource.deleteMany({ groupId });
      await GroupTask.deleteMany({ groupId });
      await GroupPoll.deleteMany({ groupId });

      const files = await GroupFile.find({ groupId });
      for (const f of files) {
        try {
          const fullPath = path.join(uploadsDir, f.fileName || "");
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (err) {
          console.error("Error deleting group file from disk:", err);
        }
      }
      await GroupFile.deleteMany({ groupId });

      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ success: true, message: "Left and removed empty group" });
    }

    return res.status(200).json({ success: true, message: "Left group successfully" });
  } catch (error) {
    console.error("leaveGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete group (owner only)
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Only the group owner can delete the group" });
    }

    // delete related data
    await GroupMessage.deleteMany({ groupId });
    await GroupResource.deleteMany({ groupId });
    await GroupTask.deleteMany({ groupId });
    await GroupPoll.deleteMany({ groupId });

    const files = await GroupFile.find({ groupId });
    for (const f of files) {
      try {
        const fullPath = path.join(uploadsDir, f.fileName || "");
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) {
        console.error("Error deleting group file from disk:", err);
      }
    }
    await GroupFile.deleteMany({ groupId });

    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({ success: true, message: "Group deleted successfully" });
  } catch (error) {
    console.error("deleteGroup error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createGroup,
  getMyGroups,
  joinGroup,
  getGroupDetails,
  postMessage,
  getMessages,
  addResource,
  getResources,
  addTask,
  getTasks,
  updateTaskStatus,
  uploadFile,
  getFiles,
  createPoll,
  getPolls,
  votePoll,
  leaveGroup,
  deleteGroup,
  upload, // Export multer middleware
  createCourseGroup,
  joinCourseGroup,
  getCourseGroupByCourseId,
};

