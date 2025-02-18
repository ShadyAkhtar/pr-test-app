const express = require("express");
const meeting = require("./meeting");
const auth = require("../../middelwares/auth");

const router = express.Router();

// List all the Meetings
router.get("/", auth, meeting.index);

// Add a new Meeting
router.post("/add", auth, meeting.add);

// View a specific Meeting
router.get("/view/:id", auth, meeting.view);

// Delete Meeting by ID
router.delete("/delete/:id", auth, meeting.deleteData);

// Delete multiple Meetings
router.post("/deleteMany", auth, meeting.deleteMany);

module.exports = router;
