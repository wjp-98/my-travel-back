const express = require('express');
const router = express.Router();
const TravelRecord = require('../models/travelRecord');
const TravelMap = require('../models/travelMap');
const TravelAlbum = require('../models/travelAlbum');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();
const mongoose = require('mongoose');
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

// 验证 ObjectId 是否有效的辅助函数
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// 测试地理编码接口
router.get('/test', async (req, res) => {
  try {
    const result = await getCoordinatesFromAddress('武汉');
    res.json({
      code: 200,
      message: '测试成功',
      data: result,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '测试失败',
      data: {
        error: error.message,
        response: error.response ? error.response.data : null
      },
      success: false
    });
  }
});

// 获取所有旅行记录列表（按时间排序）
router.get('/getNewTravelRecord', async (req, res) => {
  try {
    const { title, cityName, page = 1, pageSize = 6, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = { isShared: true }; // 只查询已分享的记录
    if (title) {
      query.title = { $regex: title, $options: 'i' };
    }
    if (cityName) {
      const maps = await TravelMap.find({ 
        cityName: { $regex: cityName, $options: 'i' }
      });
      query.travelMap = { $in: maps.map(m => m._id) };
    }

    // 计算分页
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // 获取总记录数
    const total = await TravelRecord.countDocuments(query);

    // 构建排序对象
    const sortOptions = {};
    if (sortBy === 'startTime' || sortBy === 'endTime' || sortBy === 'createdAt') {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // 默认按创建时间倒序
    }

    const travelRecords = await TravelRecord.find(query)
      .populate({
        path: 'travelMap',
        select: 'cityName'
      })
      .populate({
        path: 'createdBy',
        select: 'username avatar',
        model: 'User'
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        list: travelRecords,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize))
        }
      },
      success: true,
    });
  } catch (error) {
    console.error('获取旅行记录错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取我的旅行记录列表
router.get('/getMyTravelRecord', auth, async (req, res) => {
  try {
    const { title, cityName, page = 1, pageSize = 6 } = req.query;
    const userId = req.user.userId;
    
    const query = { createdBy: userId };
    if (title) {
      query.title = { $regex: title, $options: 'i' };
    }
    if (cityName) {
      const maps = await TravelMap.find({ 
        cityName: { $regex: cityName, $options: 'i' }
      });
      query.travelMap = { $in: maps.map(m => m._id) };
    }

    // 计算分页
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // 获取总记录数
    const total = await TravelRecord.countDocuments(query);

    const travelRecords = await TravelRecord.find(query)
      .populate({
        path: 'travelMap',
        select: 'cityName'
      })
      .populate({
        path: 'createdBy',
        select: 'username avatar',
        model: 'User'
      })
      .sort({ createdAt: -1 }) // 默认按创建时间倒序
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        list: travelRecords,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize))
        }
      },
      success: true,
    });
  } catch (error) {
    console.error('获取我的旅行记录错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取单个旅行记录详情
router.get('/getTravelRecordDetail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证 ID 是否有效
    if (!isValidObjectId(id)) {
      return res.status(200).json({
        code: 200,
        message: '无效的记录ID',
        data: null,
        success: false,
      });
    }

    const travelRecord = await TravelRecord.findById(id)
      .populate({
        path: 'travelMap',
        select: 'cityName'
      })
      .populate({
        path: 'createdBy',
        select: 'username avatar',
        model: 'User'
      });

    if (!travelRecord) {
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
      data: travelRecord,
      success: true,
    });
  } catch (error) {
    console.error('获取旅行记录详情错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 创建旅行记录
router.post('/', auth, upload.none(), async (req, res) => {
  try {
    const { title, cityName, startTime, endTime, description, cityImage, article, photos, isShared } = req.body;
    const userId = req.user.userId;

    // 验证必填字段
    if (!cityName || !startTime || !endTime || !description || !cityImage) {
      return res.status(200).json({
        code: 200,
        message: '缺少必填字段',
        data: null,
        required: ['cityName', 'startTime', 'endTime', 'description', 'cityImage'],
        success: false,
      });
    }

    // 验证时间逻辑
    if (new Date(startTime) > new Date(endTime)) {
      return res.status(200).json({
        code: 200,
        message: '开始时间不能晚于结束时间',
        data: null,
        success: false,
      });
    }

    // 查找或创建旅游地图记录
    let travelMap;
    const existingMap = await TravelMap.findOne({ cityName: cityName });

    if (existingMap) {
      travelMap = existingMap;
    } else {
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

      // 创建新的旅游地图记录
      travelMap = new TravelMap({
        cityName,
        location: {
          type: 'Point',
          coordinates: coordinates
        }
      });
      await travelMap.save();
    }

    // 创建旅行记录
    const travelRecord = new TravelRecord({
      title,
      travelMap: travelMap._id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      description,
      cityImage,
      article,
      isShared: isShared || true,
      createdBy: userId
    });

    await travelRecord.save();

    // 如果有照片，创建相册记录
    if (photos && photos.length > 0) {
      const albumPromises = photos.map(photoUrl => {
        const travelAlbum = new TravelAlbum({
          imageUrl: photoUrl,
          cityName,
          title: title || `在${cityName}的旅行照片`,
          createdBy: userId
        });
        return travelAlbum.save();
      });

      await Promise.all(albumPromises);
    }

    // 返回完整的记录信息
    const result = await TravelRecord.findById(travelRecord._id)
      .populate({
        path: 'travelMap',
        select: 'cityName location'
      })
      .populate({
        path: 'createdBy',
        select: 'username avatar',
        model: 'User'
      });

    res.status(200).json({
      code: 200,
      message: '创建成功',
      data: result,
      success: true,
    });
  } catch (error) {
    console.error('创建旅行记录错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 更新旅行记录
router.post('/updateTravelRecord/:id', auth, upload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证 ID 是否有效
    if (!isValidObjectId(id)) {
      return res.status(200).json({
        code: 200,
        message: '无效的记录ID',
        data: null,
        success: false,
      });
    }

    const { title, cityName, startTime, endTime, description, cityImage, article, isShared } = req.body;
    const userId = req.user.userId;

    // 查找记录并验证权限
    const existingRecord = await TravelRecord.findById(id);
    if (!existingRecord) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    if (existingRecord.createdBy.toString() !== userId) {
      return res.status(200).json({
        code: 200,
        message: '没有权限修改此记录',
        data: null,
        success: false,
      });
    }

    // 查找或创建旅游地图记录
    let travelMap;
    if (cityName) {
      const existingMap = await TravelMap.findOne({ cityName: cityName });

      if (existingMap) {
        travelMap = existingMap;
      } else {
        // 创建新的旅游地图记录
        travelMap = new TravelMap({
          cityName
        });
        await travelMap.save();
      }
    }

    // 验证时间逻辑
    if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
      return res.status(200).json({
        code: 200,
        message: '开始时间不能晚于结束时间',
        data: null,
        success: false,
      });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (travelMap) updateData.travelMap = travelMap._id;
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime);
    if (description) updateData.description = description;
    if (cityImage) updateData.cityImage = cityImage;
    if (article !== undefined) updateData.article = article;
    if (isShared !== undefined) updateData.isShared = isShared;

    const travelRecord = await TravelRecord.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate({
      path: 'travelMap',
      select: 'cityName'
    })
    .populate({
      path: 'createdBy',
      select: 'username avatar',
      model: 'User'
    });

    res.status(200).json({
      code: 200,
      message: '更新成功',
      data: travelRecord,
      success: true,
    });
  } catch (error) {
    console.error('更新旅行记录错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 删除旅行记录
router.post('/deleteTravelRecord/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证 ID 是否有效
    if (!isValidObjectId(id)) {
      return res.status(200).json({
        code: 200,
        message: '无效的记录ID',
        data: null,
        success: false,
      });
    }

    const userId = req.user.userId;

    // 查找记录并验证权限
    const existingRecord = await TravelRecord.findById(id);
    if (!existingRecord) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    if (existingRecord.createdBy.toString() !== userId) {
      return res.status(200).json({
        code: 200,
        message: '没有权限删除此记录',
        data: null,
        success: false,
      });
    }

    await TravelRecord.findByIdAndDelete(id);

    res.status(200).json({
      code: 200,
      message: '删除成功',
      data: null,
      success: true,
    });
  } catch (error) {
    console.error('删除旅行记录错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取我的旅行时间轴
router.get('/getMyTimeline', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const travelRecords = await TravelRecord.find({ createdBy: userId })
      .populate({
        path: 'travelMap',
        select: 'cityName _id'
      })
      .select('cityImage description startTime endTime travelMap title _id') // 添加 _id 字段
      .sort({ startTime: -1 }); // 按出发时间倒序排列

    // 格式化返回数据
    const timeline = travelRecords.map(record => ({
      id: record._id.toString(), // 将 _id 转换为 id
      cityId: record.travelMap._id.toString(), // 添加城市ID
      cityName: record.travelMap.cityName,
      cityImage: record.cityImage,
      description: record.description,
      title: record.title || `在${record.travelMap.cityName}的旅行`,
      startTime: record.startTime,
      endTime: record.endTime,
      duration: Math.ceil((record.endTime - record.startTime) / (1000 * 60 * 60 * 24))
    }));

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: timeline,
      success: true,
    });
  } catch (error) {
    console.error('获取旅行时间轴错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

module.exports = router; 