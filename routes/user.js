const express = require('express');
const router = express.Router();
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();
const TravelAlbum = require('../models/travelAlbum');

// 注册接口
router.post('/register', upload.none(), async (req, res) => {
  try {
    const { username, phone, password, email, birthday, nickname } = req.body;

    // 验证必填字段
    if (!username || !phone || !password || !email || !birthday) {
      return res.status(200).json({
        code:200,
        message: '缺少必填字段',
        data:null,
        required: ['username', 'phone', 'password', 'email', 'birthday'],
        success:false,
      });
    }

    // 解析生日数据
    let birthdayData;
    try {
      birthdayData = typeof birthday === 'string' ? JSON.parse(birthday) : birthday;
    } catch (error) {
      return res.status(200).json({ 
        code:200,
        message:'生日格式错误',
        data:null,
        success:false,
      });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      $or: [{ username }, { phone }, { email }]
    });

    if (existingUser) {
      return res.status(200).json({ 
        code:200,
        message:'用户名、手机号或邮箱已被注册',
        data:null,
        success:false,
      });
    }

    // 创建新用户
    const user = new User({
      username,
      phone,
      password,
      email,
      birthday: birthdayData,
      nickname: nickname || username // 如果没有提供昵称，使用用户名作为默认昵称
    });

    await user.save();

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'my-travel-secret-key',
      { expiresIn: '24h' }
    );

    // 设置 cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24小时
    });

    res.status(200).json({
      code:200,
      message: '注册成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          phone: user.phone,
          email: user.email,
          birthday: user.birthday,
          avatar: user.avatar
        },
        token
      },
      success:true,
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      code:500,
      message: '服务器错误',
      data: error.message,
      success:false,
    });
  }
});

// 登录接口
router.post('/login', upload.none(), async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证用户是否存在
    const user = await User.findOne({ username });
    if (!user) {
      return res.json({
        code: 200,
        data: '用户不存在',
        success: false,
      });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.json({
        code: 200,
        data: '用户或密码错误',
        success: false,
      });
    }

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'my-travel-secret-key',
      { expiresIn: '24h' }
    );

    // 设置 cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24小时
    });

    res.json({
      code:200,
      message: '登录成功',
      data:{
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          phone: user.phone,
          email: user.email,
          birthday: user.birthday,
          avatar: user.avatar
        },
        token
      },
      success:true,
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登出接口
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    code: 200,
    message: '登出成功',
    data: null,
    success: true
  });
});

// 更新用户信息接口（需要认证）
router.put('/profile', auth, upload.none(), async (req, res) => {
  try {
    const { userId } = req.user;
    const updateData = req.body;

    // 不允许更新密码
    delete updateData.password;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      message: '更新成功',
      user: {
        id: user._id,
        username: user.username,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        birthday: user.birthday,
        avatar: user.avatar,
        extraFields: Object.fromEntries(user.extraFields)
      }
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户信息接口（需要认证）
router.get('/profile', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        birthday: user.birthday,
        avatar: user.avatar,
        extraFields: Object.fromEntries(user.extraFields)
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户昵称
router.put('/nickname', auth, async (req, res) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname) {
      return res.status(400).json({
        code: 400,
        message: '昵称不能为空'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { nickname },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '更新昵称失败',
      error: error.message
    });
  }
});

// 获取用户的所有图片
router.get('/my-photos', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 12, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
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
      .populate('travelRecord', 'title cityName')
      .select('imageUrl title cityName createdAt travelRecord');

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        list: photos,
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
    console.error('获取用户图片错误:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: error.message,
      success: false
    });
  }
});

module.exports = router; 