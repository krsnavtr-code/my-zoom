import express from "express";
import MeetingParticipant from "../models/MeetingParticipant.js";
import Meeting from "../models/Meeting.js";

const router = express.Router();

// Save meeting participant
router.post("/participant", async (req, res) => {
  try {
    const { meetingId, name, email, phone, deviceFingerprint, browser, os } =
      req.body;

    // Get IP address from request
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    const participant = new MeetingParticipant({
      meetingId,
      name,
      email,
      phone,
      ipAddress,
      userAgent: req.headers["user-agent"],
      deviceFingerprint,
      browser,
      os,
    });

    await participant.save();

    res.status(201).json({
      success: true,
      participantId: participant._id,
      message: "Participant saved successfully",
    });
  } catch (error) {
    console.error("Error saving participant:", error);
    res.status(500).json({
      success: false,
      message: "Error saving participant",
    });
  }
});

// Check if participant exists by email or device fingerprint
router.post("/participant/check", async (req, res) => {
  try {
    const { email, deviceFingerprint } = req.body;

    // First check by device fingerprint (more reliable for returning users)
    let participant = null;
    if (deviceFingerprint) {
      participant = await MeetingParticipant.findOne({
        deviceFingerprint,
      }).sort({ createdAt: -1 });
    }

    // If not found by fingerprint, check by email
    if (!participant && email) {
      participant = await MeetingParticipant.findOne({ email }).sort({
        createdAt: -1,
      });
    }

    if (participant) {
      res.json({
        success: true,
        exists: true,
        participant: {
          name: participant.name,
          email: participant.email,
          phone: participant.phone,
        },
      });
    } else {
      res.json({
        success: true,
        exists: false,
      });
    }
  } catch (error) {
    console.error("Error checking participant:", error);
    res.status(500).json({
      success: false,
      message: "Error checking participant",
    });
  }
});

// Update participant leave time
router.put("/participant/:id/leave", async (req, res) => {
  try {
    const participant = await MeetingParticipant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    participant.leaveTime = new Date();
    participant.duration = Math.floor(
      (participant.leaveTime - participant.joinTime) / 1000,
    );

    await participant.save();

    res.json({
      success: true,
      message: "Leave time updated successfully",
    });
  } catch (error) {
    console.error("Error updating leave time:", error);
    res.status(500).json({
      success: false,
      message: "Error updating leave time",
    });
  }
});

// Get meeting participants
router.get("/participants/:meetingId", async (req, res) => {
  try {
    const participants = await MeetingParticipant.find({
      meetingId: req.params.meetingId,
    }).sort({ joinTime: -1 });

    res.json({
      success: true,
      participants,
    });
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching participants",
    });
  }
});

// Create/save meeting
router.post("/create", async (req, res) => {
  try {
    const {
      meetingId,
      userId,
      type,
      scheduledDate,
      scheduledTime,
      duration,
      password,
    } = req.body;

    const meeting = new Meeting({
      meetingId,
      userId,
      type,
      scheduledDate: type === "scheduled" ? new Date(scheduledDate) : null,
      scheduledTime: type === "scheduled" ? scheduledTime : null,
      duration,
      password,
      status: type === "instant" ? "active" : "scheduled",
      startTime: type === "instant" ? new Date() : null,
    });

    await meeting.save();

    res.status(201).json({
      success: true,
      meetingId: meeting._id,
      message: "Meeting saved successfully",
    });
  } catch (error) {
    console.error("Error saving meeting:", error);
    res.status(500).json({
      success: false,
      message: "Error saving meeting",
    });
  }
});

// Get user's meetings
router.get("/user/:userId", async (req, res) => {
  try {
    const meetings = await Meeting.find({
      userId: req.params.userId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      meetings,
    });
  } catch (error) {
    console.error("Error fetching user meetings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user meetings",
    });
  }
});

// End meeting
router.put("/end/:meetingId", async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    meeting.status = "ended";
    meeting.endTime = new Date();
    if (!meeting.startTime) {
      meeting.startTime = meeting.createdAt;
    }
    await meeting.save();

    res.json({
      success: true,
      message: "Meeting ended successfully",
    });
  } catch (error) {
    console.error("Error ending meeting:", error);
    res.status(500).json({
      success: false,
      message: "Error ending meeting",
    });
  }
});

// Update meeting schedule (for starting scheduled meetings early)
router.put("/update-schedule/:meetingId", async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    const now = new Date();
    meeting.scheduledDate = now.toISOString().split("T")[0];
    meeting.scheduledTime = now.toTimeString().slice(0, 5);
    meeting.status = "active";
    meeting.startTime = now;
    await meeting.save();

    res.json({
      success: true,
      message: "Meeting schedule updated successfully",
      meeting: {
        scheduledDate: meeting.scheduledDate,
        scheduledTime: meeting.scheduledTime,
        status: meeting.status,
      },
    });
  } catch (error) {
    console.error("Error updating meeting schedule:", error);
    res.status(500).json({
      success: false,
      message: "Error updating meeting schedule",
    });
  }
});

// Get meeting details with participant count
router.get("/details/:meetingId", async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Get unique participant count by email
    const uniqueParticipants = await MeetingParticipant.distinct("email", {
      meetingId: req.params.meetingId,
    });
    const participantCount = uniqueParticipants.length;

    // Calculate duration if meeting has ended
    let actualDuration = null;
    if (meeting.startTime && meeting.endTime) {
      const durationMs = meeting.endTime - meeting.startTime;
      actualDuration = Math.floor(durationMs / 60000); // Convert to minutes
    }

    res.json({
      success: true,
      meeting: {
        ...meeting.toObject(),
        participantCount,
        actualDuration,
      },
    });
  } catch (error) {
    console.error("Error fetching meeting details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching meeting details",
    });
  }
});

// Get meeting status
router.get("/status/:meetingId", async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.meetingId,
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    res.json({
      success: true,
      status: meeting.status,
    });
  } catch (error) {
    console.error("Error fetching meeting status:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching meeting status",
    });
  }
});

export default router;
