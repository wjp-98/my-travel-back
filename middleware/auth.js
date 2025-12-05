const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        code:401,
        message:'请先登录',
        data:null,
        success:false,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      code:401,
      message:'认证失败',
      data:null,
      success:false,
    });
  }
};

module.exports = auth; 