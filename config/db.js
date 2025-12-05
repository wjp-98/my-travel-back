const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('正在连接 MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 超时时间
      socketTimeoutMS: 45000, // Socket 超时时间
      family: 4 // 强制使用 IPv4
    });
    
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
    console.log('数据库名称:', conn.connection.name);
    console.log('连接状态:', conn.connection.readyState === 1 ? '已连接' : '未连接');
    
    // 监听连接事件
    mongoose.connection.on('connected', () => {
      console.log('MongoDB 连接已建立');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB 连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB 连接已断开');
    });

    // 优雅关闭连接
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB 连接已关闭');
      process.exit(0);
    });

  } catch (error) {
    console.error('MongoDB 连接错误:', error.message);
    console.error('详细错误信息:', error);
    process.exit(1);
  }
};

module.exports = connectDB; 