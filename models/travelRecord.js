const mongoose = require('mongoose');

const travelRecordSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true
  },
  travelMap: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelMap',
    required: [true, '必须关联旅游地图']
  },
  startTime: {
    type: Date,
    required: [true, '开始时间不能为空']
  },
  endTime: {
    type: Date,
    required: [true, '结束时间不能为空']
  },
  description: {
    type: String,
    required: [true, '城市描述不能为空'],
    trim: true
  },
  cityImage: {
    type: String,
    required: [true, '城市图片不能为空']
  },
  article: {
    type: String,
    trim: true
  },
  isShared: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '创建人不能为空']
  }
});

// 添加索引以提高查询性能
travelRecordSchema.index({ travelMap: 1 });
travelRecordSchema.index({ createdAt: -1 });
travelRecordSchema.index({ title: 1 });
travelRecordSchema.index({ createdBy: 1 });

const TravelRecord = mongoose.model('TravelRecord', travelRecordSchema);

module.exports = TravelRecord; 