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

module.exports = router;

