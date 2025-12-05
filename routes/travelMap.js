const express = require('express');
const router = express.Router();
const TravelMap = require('../models/travelMap');
const TravelRecord = require('../models/travelRecord');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();
const axios = require('axios');

// 地址转经纬度的辅助函数
async function getCoordinatesFromAddress(address) {
  try {
    // 使用高德地图 API
    const response = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
      params: {
        key: process.env.AMAP_KEY || '392bcff2c90d015cf3fd379e74cfedc6',
        address: address,
        output: 'JSON'
      }
    });

    if (response.data.status === '0') {
      if (response.data.infocode === '10009') {
        throw new Error('API key 的 IP 白名单设置有问题，请在高德地图控制台添加当前服务器 IP 到白名单中');
      }
      throw new Error(`高德地图 API 错误: ${response.data.info}`);
    }

    if (response.data.status === '1' && response.data.geocodes && response.data.geocodes.length > 0) {
      const location = response.data.geocodes[0].location.split(',');
      return {
        longitude: parseFloat(location[0]),
        latitude: parseFloat(location[1])
      };
    }
    throw new Error(`无法获取地址的经纬度: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('地理编码错误:', error.message);
    if (error.response) {
      console.error('API 响应错误:', error.response.data);
    }
    throw error;
  }
}

// 创建旅游地图
router.post('/', auth, upload.none(), async (req, res) => {
  try {
    const { cityName } = req.body;

    // 验证必填字段
    if (!cityName) {
      return res.status(200).json({
        code: 200,
        message: '缺少必填字段',
        data: null,
        required: ['cityName'],
        success: false,
      });
    }

    // 检查城市是否已存在
    const existingMap = await TravelMap.findOne({ cityName });
    if (existingMap) {
      return res.status(200).json({
        code: 200,
        message: '该城市已存在',
        data: existingMap,
        success: false,
      });
    }

    // 获取城市名的经纬度
    let coordinates;
    try {
      const geoResult = await getCoordinatesFromAddress(cityName);
      coordinates = [geoResult.longitude, geoResult.latitude];
    } catch (error) {
      console.error('获取经纬度失败:', error);
      return res.status(200).json({
        code: 200,
        message: '无法获取城市的经纬度信息',
        data: null,
        success: false,
      });
    }

    // 创建旅游地图
    const travelMap = new TravelMap({
      cityName,
      location: {
        type: 'Point',
        coordinates: coordinates
      }
    });

    await travelMap.save();

    res.status(200).json({
      code: 200,
      message: '创建成功',
      data: travelMap,
      success: true,
    });
  } catch (error) {
    console.error('创建旅游地图错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取旅游地图列表
router.get('/', async (req, res) => {
  try {
    const { cityName } = req.query;
    
    const query = {};
    if (cityName) {
      query.cityName = { $regex: cityName, $options: 'i' };
    }

    const travelMaps = await TravelMap.find(query)
      .sort({ createdAt: -1 });

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: travelMaps,
      success: true,
    });
  } catch (error) {
    console.error('获取旅游地图错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取用户的足迹城市
router.get('/my-footprints', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取用户的所有旅游记录
    const travelRecords = await TravelRecord.find({ createdBy: userId })
      .populate({
        path: 'travelMap',
        select: 'cityName location'
      })
      .select('travelMap');

    // 提取所有不重复的城市信息
    const cityMap = new Map();
    travelRecords.forEach(record => {
      if (record.travelMap && !cityMap.has(record.travelMap.cityName)) {
        cityMap.set(record.travelMap.cityName, {
          cityName: record.travelMap.cityName,
          location: record.travelMap.location
        });
      }
    });

    // 转换为数组并排序
    const cities = Array.from(cityMap.values()).sort((a, b) => 
      a.cityName.localeCompare(b.cityName, 'zh-CN')
    );

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: cities,
      success: true,
    });
  } catch (error) {
    console.error('获取用户足迹城市错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取用户的所有旅游城市
router.get('/my-cities', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取用户的所有旅游记录
    const travelRecords = await TravelRecord.find({ createdBy: userId })
      .populate('travelMap', 'cityName')
      .select('travelMap');

    // 提取所有不重复的城市ID
    const cityIds = [...new Set(travelRecords.map(record => record.travelMap._id))];

    // 获取这些城市的信息
    const cities = await TravelMap.find({ _id: { $in: cityIds } })
      .select('cityName')
      .sort({ cityName: 1 });

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: cities,
      success: true,
    });
  } catch (error) {
    console.error('获取用户旅游城市错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取单个旅游地图详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const travelMap = await TravelMap.findById(id);

    if (!travelMap) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: travelMap,
      success: true,
    });
  } catch (error) {
    console.error('获取旅游地图详情错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 更新旅游地图
router.put('/:id', auth, upload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    const { cityName } = req.body;

    // 查找记录
    const existingMap = await TravelMap.findById(id);
    if (!existingMap) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    // 检查新城市名是否已存在
    if (cityName && cityName !== existingMap.cityName) {
      const duplicateMap = await TravelMap.findOne({ cityName });
      if (duplicateMap) {
        return res.status(200).json({
          code: 200,
          message: '该城市名已存在',
          data: null,
          success: false,
        });
      }
    }

    const updateData = {};
    if (cityName) updateData.cityName = cityName;

    const travelMap = await TravelMap.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      code: 200,
      message: '更新成功',
      data: travelMap,
      success: true,
    });
  } catch (error) {
    console.error('更新旅游地图错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 删除旅游地图
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // 查找记录
    const existingMap = await TravelMap.findById(id);
    if (!existingMap) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    await TravelMap.findByIdAndDelete(id);

    res.status(200).json({
      code: 200,
      message: '删除成功',
      data: null,
      success: true,
    });
  } catch (error) {
    console.error('删除旅游地图错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

module.exports = router; 