# ⚙️ Skill Tracker Backend API

> Powering the **AI Career Readiness Platform** with secure, scalable, and intelligent backend services.

---

## 🌐 Live API

🚀 **Deployed Backend:**
👉 [https://skill-tracker-up8x.onrender.com](https://skill-tracker-up8x.onrender.com)

> Handles AI processing, skill analysis, authentication, and secure data storage.

---

## ✨ Overview

A robust **Node.js + Express backend** built with **MongoDB Atlas** and **JWT Authentication** designed to:

* 🔐 Authenticate users securely with JWT and password hashing
* 🧠 Process AI-driven career insights via OpenRouter
* 📄 Parse resumes and extract structured skill data
* 🎯 Track skills and manage custom/global skill registries
* 🗺️ Generate personalized learning roadmaps based on target roles

---

## 🧩 Core Capabilities

### 🔐 JWT Authentication & Authorization
* Secure user registration and login
* Password hashing with bcrypt
* Protected routes via custom `authMiddleware`

### 🗄️ Database Management
* Cloud storage via **MongoDB Atlas**
* Mongoose schema validation for Users, Skills, Roadmaps, and Skill Registries
* Database seeding scripts (`seed.js`) for rapid setup

### 📄 Resume Parsing Engine
* Accepts resume uploads
* Extracts technical skills using AI
* Returns normalized, structured skill data

### 🎯 Career Readiness & Skill Tracking
* Compares user skills with role requirements
* Tracks skill proficiency, categories, and progress over time
* Standardizes skill entries using custom normalizers

### 🧠 AI Roadmap Generator
* Integrates with OpenRouter API
* Generates actionable learning paths, milestones, and resource recommendations

---

## 🛠️ Tech Stack

| Layer                | Technologies                          |
| -------------------- | ------------------------------------- |
| **Runtime**          | Node.js                               |
| **Framework**        | Express.js                            |
| **Database**         | MongoDB Atlas (Mongoose ODM)          |
| **Authentication**   | JSON Web Tokens (JWT), Bcrypt.js      |
| **AI Integration**   | OpenRouter API                        |
| **HTTP Client**      | Axios                                 |

---

## 🏗️ Folder Structure

```bash
backend/
├── app.js                          # Express application setup & middleware configuration
├── config/
│   └── db.js                       # MongoDB Atlas connection setup
├── controllers/                    # Business logic implementations
│   ├── authController.js           # Login, Register, Profile management
│   ├── openRouterController.js     # Direct OpenRouter AI calls
│   ├── resumeController.js         # Resume parsing logic
│   ├── roadmapController.js        # AI Roadmap generation logic
│   ├── skillController.js          # Skill CRUD & assessment logic
│   └── skillRegistryController.js  # Global & user skill registry management
├── index.js                        # Server entry point
├── middleware/                     # Custom request guards
│   ├── authMiddleware.js           # JWT verification middleware
│   └── errorMiddleware.js          # Centralized error handler
├── models/                         # Mongoose schemas
│   ├── Roadmap.js                  # Roadmap model
│   ├── Skill.js                    # User skill model
│   ├── SkillRegistry.js            # Standardized skill database model
│   └── User.js                     # User profile & credentials model
├── package.json                    # Project dependencies & scripts
├── routes/                         # Express route definitions
│   ├── aiRoutes.js                 # Resume & AI endpoints
│   ├── authRoutes.js               # Auth endpoints (login/register)
│   ├── roadmapRoutes.js            # Roadmap endpoints
│   ├── skillRegistryRoutes.js      # Skill registry lookup endpoints
│   └── skillRoutes.js              # Skill management endpoints
├── seed.js                         # Database seed script for initial data
├── tests/
│   └── setup.js                    # Test setup configuration
└── utils/                          # Helper functions & mocks
    ├── mockMongoose.js             # Testing mock utilities
    └── skillNormalizer.js          # Skill standardization utility

# Utility

## 🔌 API Endpoints Summary

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/auth/register` | Register a new user | ❌ No |
| POST | `/api/auth/login` | Authenticate user and receive a JWT token | ❌ No |
| GET | `/api/auth/profile` | Get logged-in user profile | ✅ Yes |

### 🧠 AI & Resume (`/api/ai` or `/api/resume`)

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/ai/parse-resume` | Extract skills and data from uploaded resume | ✅ Yes |
| POST | `/api/ai/analyze` | Evaluate career readiness and gap analysis | ✅ Yes |

### 🗺️ Roadmaps (`/api/roadmaps`)

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/roadmaps/generate` | Generate custom AI roadmap | ✅ Yes |
| GET | `/api/roadmaps` | Retrieve saved roadmaps | ✅ Yes |

### 🎯 Skill Management (`/api/skills` & `/api/skill-registry`)

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/skills` | Get user's active skills | ✅ Yes |
| POST | `/api/skills` | Add a new skill to user profile | ✅ Yes |
| GET | `/api/skill-registry` | Search global standardized skills | ❌ No |

---

## ⚡ Getting Started

### 1️⃣ Install Dependencies

```bash
npm install

# Setup & Configuration Guide

## 2️⃣ Setup Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
OPEN_ROUTER_API_KEY=your_openrouter_api_key
```

## 3️⃣ Seed the Database (Optional)
Populate initial skill registry or test data into MongoDB Atlas:

```bash
node seed.js
```

## 4️⃣ Run the Server
**Development Mode:**

```bash
npm run dev
```

**Production Mode:**

```bash
npm start
```

---

## 🔐 Security & Best Practices

- 🔑 **JWT Authorization:** Requests to protected endpoints require a valid `Bearer <token>` in the `Authorization` header.
- 🗄️ **Database Security:** MongoDB Atlas credentials and connection strings are managed securely via environment variables.
- 🔒 **API Keys:** Centralized server-side AI key management ensures keys are never exposed to the frontend.
- 🛡️ **Error Handling:** Centralized middleware handles server and validation errors cleanly.

---

## 🎯 Portfolio Value
This backend demonstrates:

- ✅ **Real-world API architecture**
- ✅ **AI integration in production workflows**
- ✅ **Clean separation of concerns** (routes, services, controllers)
- ✅ **Secure handling of sensitive data**
- ✅ **Scalable and maintainable structure**

---

## 📄 License
[MIT License](LICENSE)

---

## 🔗 Related Project
👉 **Frontend Repository:** [varunn15/skill-tracker-frontend-fullstack](https://github.com/varunn15/skill-tracker-frontend-fullstack)

---

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Contact
For any queries or support, please open an issue on the GitHub repository.

*Built with ❤️ for the AI Career Readiness Platform*


