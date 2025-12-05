const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nickname: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  avatar: {
    type: String,
    default: ''
  },
  birthday: {
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 扩展字段
  extraFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  // 启用虚拟字段
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 保存前加密密码
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  // 如果没有设置昵称，使用用户名作为默认昵称
  if (!this.nickname) {
    this.nickname = this.username;
  }
  next();
});

// 验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 添加扩展字段的方法
userSchema.methods.addExtraField = function(key, value) {
  this.extraFields.set(key, value);
  return this.save();
};

// 获取扩展字段的方法
userSchema.methods.getExtraField = function(key) {
  return this.extraFields.get(key);
};

// 删除扩展字段的方法
userSchema.methods.removeExtraField = function(key) {
  this.extraFields.delete(key);
  return this.save();
};

module.exports = mongoose.model('User', userSchema); 