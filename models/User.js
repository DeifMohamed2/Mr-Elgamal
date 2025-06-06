const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    Username: {
      type: String,
      required: true,
    },

    Password: {
      type: String,
      required: true,
      unique: false,
    },
    PasswordWithOutHash: {
      type: String,
      required: true,
      unique: false,
    },
    gov: {
      type: String,
      required: true,
    },
    Markez: {
      type: String,
      required: true,
    },
    Grade: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },

    parentPhone: {
      type: String,
      required: true,
      unique: false,
    },
    place: {
      type: String,
      required: true,
    },
    Code: {
      type: Number,
      required: true,
      unique: true,
    },
    userPhoto: {
      type: String,
      required: false,
    },
    subscribe: {
      type: Boolean,
      required: true,
    },

    totalBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    pendingBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    transactions: {
      type: Array,
      default: [],
      required: false,
    },

    quizesInfo: {
      type: Array,
      required: true,
    },
    videosInfo: {
      type: Array,
      required: true,
    },
    chaptersPaid: {
      type: Array,
      required: false,
    },
    videosPaid: {
      type: Array,
      required: false,
    },
    examsPaid: {
      type: Array,
      required: false,
    },
    PDFsPaid: {
      type: Array,
      required: false,
    },
    isTeacher: {
      type: Boolean,
      required: true,
    },
    totalScore: {
      type: Number,
      required: true,
    },
    examsEnterd: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    totalSubscribed: {
      type: Number,
      required: true,
    },
    ARorEN: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
