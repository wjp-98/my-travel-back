const mongoose = require('mongoose');

const travelAlbumSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: [true, '图片链接不能为空']
  },
  cityName: {
    type: String,
    required: [true, '城市名称不能为空']
  },
  title: {
    type: String,
    required: [true, '标题不能为空']
  },
  travelRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelRecord'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '创建人不能为空']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 添加索引以提高查询性能
travelAlbumSchema.index({ createdBy: 1 });
travelAlbumSchema.index({ cityName: 1 });
travelAlbumSchema.index({ createdAt: -1 });

const TravelAlbum = mongoose.model('TravelAlbum', travelAlbumSchema);

module.exports = TravelAlbum; 