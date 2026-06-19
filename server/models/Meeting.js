import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['instant', 'scheduled'],
    default: 'instant'
  },
  scheduledDate: {
    type: Date
  },
  scheduledTime: {
    type: String
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  password: {
    type: String
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingParticipant'
  }]
}, {
  timestamps: true
});

export default mongoose.model('Meeting', meetingSchema);
