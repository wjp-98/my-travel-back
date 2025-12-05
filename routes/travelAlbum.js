const express = require('express');
const router = express.Router();
const TravelAlbum = require('../models/travelAlbum');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

// 创建旅行相册
router.post('/', auth, upload.none(), async (req, res) => {
  try {
    const { imageUrl, cityName, title } = req.body;
    const userId = req.user.userId;

    // 验证必填字段
    if (!imageUrl || !cityName || !title) {
      return res.status(200).json({
        code: 200,
        message: '缺少必填字段',
        data: null,
        required: ['imageUrl', 'cityName', 'title'],
        success: false,
      });
    }

    // 创建相册记录
    const travelAlbum = new TravelAlbum({
      imageUrl,
      cityName,
      title,
      createdBy: userId
    });

    await travelAlbum.save();

    res.status(200).json({
      code: 200,
      message: '创建成功',
      data: travelAlbum,
      success: true,
    });
  } catch (error) {
    console.error('创建旅行相册错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 删除旅行相册
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 查找记录并验证权限
    const existingAlbum = await TravelAlbum.findById(id);
    if (!existingAlbum) {
      return res.status(200).json({
        code: 200,
        message: '记录不存在',
        data: null,
        success: false,
      });
    }

    if (existingAlbum.createdBy.toString() !== userId) {
      return res.status(200).json({
        code: 200,
        message: '没有权限删除此记录',
        data: null,
        success: false,
      });
    }

    await TravelAlbum.findByIdAndDelete(id);

    res.status(200).json({
      code: 200,
      message: '删除成功',
      data: null,
      success: true,
    });
  } catch (error) {
    console.error('删除旅行相册错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false,
    });
  }
});

// 获取我的图片列表
router.get('/my-photos', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 6, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.user.userId;

    // 计算分页
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // 构建排序对象
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // 获取总记录数
    const total = await TravelAlbum.countDocuments({ createdBy: userId });

    // 获取图片列表
    const photos = await TravelAlbum.find({ createdBy: userId })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .select('imageUrl title cityName createdAt');

    // 转换 _id 为 id
    const result = photos.map(photo => {
      const obj = photo.toObject();
      obj.id = obj._id;
      delete obj._id;
      return obj;
    });

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        list: result,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize))
        }
      },
      success: true
    });
  } catch (error) {
    console.error('获取图片列表错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false
    });
  }
});

module.exports = router; 