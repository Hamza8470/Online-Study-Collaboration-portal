const express = require("express");
const authenticate = require("../middleware/auth-middleware");
const {
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
  upload,
} = require("../controllers/group-controller");

const router = express.Router();

router.post("/create", authenticate, createGroup);
router.get("/my", authenticate, getMyGroups);
router.post("/join", authenticate, joinGroup);
router.get("/:groupId", authenticate, getGroupDetails);

router.get("/:groupId/messages", authenticate, getMessages);
router.post("/:groupId/messages", authenticate, postMessage);

router.get("/:groupId/resources", authenticate, getResources);
router.post("/:groupId/resources", authenticate, addResource);

router.get("/:groupId/tasks", authenticate, getTasks);
router.post("/:groupId/tasks", authenticate, addTask);
router.patch("/:groupId/tasks/:taskId", authenticate, updateTaskStatus);

router.get("/:groupId/files", authenticate, getFiles);
router.post("/:groupId/files", authenticate, upload.single("file"), uploadFile);

router.get("/:groupId/polls", authenticate, getPolls);
router.post("/:groupId/polls", authenticate, createPoll);
router.post("/:groupId/polls/:pollId/vote", authenticate, votePoll);

module.exports = router;

