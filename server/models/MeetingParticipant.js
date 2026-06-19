import mongoose from 'mongoose';

const meetingParticipantSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  joinTime: {
    type: Date,
    default: Date.now
  },
  leaveTime: {
    type: Date
  },
  duration: {
    type: Number // in seconds
  }
}, {
  timestamps: true
});

export default mongoose.model('MeetingParticipant', meetingParticipantSchema);
