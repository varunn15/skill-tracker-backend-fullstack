const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Safe fallback for secret to prevent startup crashes
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_access_key_123456';

// Helper to generate access token
const generateToken = (user) => {
  const payload = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role || 'user'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Please provide username, email, and password.'
      });
    }

    // Check if user already exists (simulating unique key validation)
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate registration',
        message: 'User with this email already exists.'
      });
    }

    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate registration',
        message: 'Username is already taken.'
      });
    }

    // HASH PASSWORD using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save user
    const newUser = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'user'
    });

    // Generate JWT
    const accessToken = generateToken(newUser);

    // Securely set token in HttpOnly cookies (Optional but recommended)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      },
      token: accessToken,
      accessToken
    });

  } catch (error) {
    console.error('Error in register:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * @route   POST /auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Please provide email and password.'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid email or password.'
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT
    const accessToken = generateToken(user);

    // Set secure HttpOnly cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token: accessToken,
      accessToken
    });

  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * @route   POST /auth/logout
 * @desc    Clear cookies & logout
 * @access  Public
 */
exports.logout = (req, res) => {
  res.clearCookie('accessToken');
  return res.json({
    success: true,
    message: 'Logged out successfully!'
  });
};

/**
 * @route   GET /auth/me
 * @desc    Get currently authenticated user details
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'No active user session found.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The authenticated user could not be found.'
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user'
      },
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || 'user'
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

