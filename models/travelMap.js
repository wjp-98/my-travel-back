const mongoose = require('mongoose');

const travelMapSchema = new mongoose.Schema({
  cityName: {
    type: String,
    required: [true, '城市名不能为空'],
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, '经纬度不能为空']
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 添加索引以提高查询性能
travelMapSchema.index({ cityName: 1 });
travelMapSchema.index({ createdAt: -1 });
travelMapSchema.index({ location: '2dsphere' }); // 添加地理空间索引

const TravelMap = mongoose.model('TravelMap', travelMapSchema);

module.exports = TravelMap; 