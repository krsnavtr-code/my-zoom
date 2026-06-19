import express from 'express';
import MeetingParticipant from '../models/MeetingParticipant.js';

const router = express.Router();

// Save meeting participant
router.post('/participant', async (req, res) => {
  try {
    const { meetingId, name, email, phone } = req.body;
    
    const participant = new MeetingParticipant({
      meetingId,
      name,
      email,
      phone
    });
    
    await participant.save();
    
    res.status(201).json({
      success: true,
      participantId: participant._id,
      message: 'Participant saved successfully'
    });
  } catch (error) {
    console.error('Error saving participant:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving participant'
    });
  }
});

// Update participant leave time
router.put('/participant/:id/leave', async (req, res) => {
  try {
    const participant = await MeetingParticipant.findById(req.params.id);
    
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }
    
    participant.leaveTime = new Date();
    participant.duration = Math.floor((participant.leaveTime - participant.joinTime) / 1000);
    
    await participant.save();
    
    res.json({
      success: true,
      message: 'Leave time updated successfully'
    });
  } catch (error) {
    console.error('Error updating leave time:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating leave time'
    });
  }
});

// Get meeting participants
router.get('/participants/:meetingId', async (req, res) => {
  try {
    const participants = await MeetingParticipant.find({ 
      meetingId: req.params.meetingId 
    }).sort({ joinTime: -1 });
    
    res.json({
      success: true,
      participants
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participants'
    });
  }
});

export default router;
