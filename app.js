const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const travelMapRoutes = require('./routes/travelMap');
const travelRecordRoutes = require('./routes/travelRecord');
const travelAlbumRoutes = require('./routes/travelAlbum');

// 加载环境变量
dotenv.config();

// 连接数据库
connectDB();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.get('/', (req, res) => {
  res.json({ message: '欢迎使用旅游后端 API' });
});

// 用户路由
app.use('/api/users', require('./routes/user'));

// 旅游地图路由
app.use('/api/travel-map', travelMapRoutes);

// 旅行记录路由
app.use('/api/travel-record', travelRecordRoutes);

// 旅行相册路由
app.use('/api/travel-album', travelAlbumRoutes);

// 测试路由
app.use('/api/test', require('./routes/test'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 