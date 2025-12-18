import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    default: 'Untitled Document',
  },
  operations: [
    {
      type: {
        type: String,
        enum: ['insert', 'delete'],
        required: true,
      },
      vertexId: String,
      value: String,
      afterId: String,
      timestamp: Number,
      replicaId: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  rgaState: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  collaborators: [
    {
      userId: String,
      username: String,
      lastActive: Date,
    },
  ],
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: String,
  },
});

// Update the updatedAt timestamp before saving
documentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Document', documentSchema);
