const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 测试数据库连接状态
router.get('/db-status', (req, res) => {
  const status = {
    connectionState: mongoose.connection.readyState,
    connectionStateText: getConnectionStateText(mongoose.connection.readyState),
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.models),
    isConnected: mongoose.connection.readyState === 1
  };

  res.json(status);
});

// 测试数据库操作
router.get('/db-test', async (req, res) => {
  try {
    // 获取所有集合名称
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    res.json({
      message: '数据库操作测试成功',
      collections: collectionNames,
      connectionState: mongoose.connection.readyState,
      isConnected: mongoose.connection.readyState === 1
    });
  } catch (error) {
    res.status(500).json({
      message: '数据库操作测试失败',
      error: error.message
    });
  }
});

// 获取连接状态文本
function getConnectionStateText(state) {
  const states = {
    0: '已断开',
    1: '已连接',
    2: '正在连接',
    3: '正在断开'
  };
  return states[state] || '未知状态';
}

module.exports = router; 