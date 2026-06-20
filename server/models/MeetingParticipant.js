import mongoose from "mongoose";

const meetingParticipantSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    deviceFingerprint: {
      type: String,
      index: true,
    },
    browser: {
      type: String,
    },
    os: {
      type: String,
    },
    joinTime: {
      type: Date,
      default: Date.now,
    },
    leaveTime: {
      type: Date,
    },
    duration: {
      type: Number, // in seconds
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("MeetingParticipant", meetingParticipantSchema);
