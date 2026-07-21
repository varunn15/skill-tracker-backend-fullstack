# ⚙️ Skill Tracker Backend API

> Powering the **AI Career Readiness Platform** with secure, scalable, and intelligent backend services.

---

## 🌐 Live API

🚀 **Deployed Backend:**
👉 [https://skill-tracker-up8x.onrender.com](https://skill-tracker-up8x.onrender.com)

> Handles AI processing, skill analysis, and secure data flow between client and services.

---

## ✨ Overview

A robust **Node.js + Express backend** designed to:

* 🧠 Process AI-driven career insights
* 📄 Parse resumes and extract structured skill data
* 🎯 Evaluate skill readiness against target roles
* 🔐 Securely manage API requests and sensitive data

---

## 🧩 Core Capabilities

### 📄 Resume Parsing Engine

* Accepts resume uploads
* Extracts technical skills using AI
* Returns structured, usable data

---

### 🎯 Career Readiness Analysis

* Compares user skills with role requirements
* Calculates:

  * 📊 Match percentage
  * ⚠️ Missing skills
  * ✅ Strength areas

---

### 🧠 AI Roadmap Generator

* Integrates with AI (Gemini API)
* Generates:

  * Learning paths
  * Course recommendations
  * Actionable steps

---

### 🔐 Secure API Layer

* Server-side API key protection
* No client-side exposure of secrets
* Centralized request handling

---

## 🛠️ Tech Stack

| Layer              | Technologies |
| ------------------ | ------------ |
| **Runtime**        | Node.js      |
| **Framework**      | Express.js   |
| **AI Integration** | Gemini API   |
| **Build Tooling**  | ESBuild      |
| **HTTP Client**    | Axios        |

---

## 🏗️ Architecture

```bash
├── server.ts / server.js      # Main Express server
├── routes/                   # API route handlers
├── controllers/              # Business logic
├── services/                 # AI & external integrations
├── utils/                    # Helper functions
├── middleware/               # Auth & request guards
└── config/                   # Environment & setup
```

---

## 🔌 API Endpoints

### 📄 Resume Processing

```http
POST /api/resume/upload
Content-Type: multipart/form-data
```

**Request:**
```json
{
  "file": "<resume.pdf>"
}
```

**Response:**
```json
{
  "success": true,
  "skills": ["React", "Node.js", "MongoDB", "TypeScript"],
  "experience": "3 years"
}
```

---

### 🎯 Career Readiness

```http
POST /api/career/analyze
Content-Type: application/json
```

**Request:**
```json
{
  "userSkills": ["React", "Node.js", "MongoDB"],
  "targetRole": "Full Stack Developer"
}
```

**Response:**
```json
{
  "success": true,
  "matchPercentage": 72,
  "strengths": ["React", "Node.js"],
  "gaps": ["Docker", "AWS", "GraphQL"],
  "recommendations": ["Learn Docker basics", "Explore AWS services"]
}
```

---

### 🧠 AI Roadmap

```http
POST /api/roadmap/generate
Content-Type: application/json
```

**Request:**
```json
{
  "missingSkills": ["Docker", "AWS", "GraphQL"],
  "targetRole": "Full Stack Developer",
  "timeline": "3 months"
}
```

**Response:**
```json
{
  "success": true,
  "roadmap": [
    {
      "week": 1,
      "focus": "Docker Fundamentals",
      "resources": ["Docker Docs", "Docker Compose Tutorial"],
      "project": "Containerize a Node.js app"
    },
    {
      "week": 2,
      "focus": "AWS Basics",
      "resources": ["AWS Free Tier", "EC2 Tutorial"],
      "project": "Deploy app to AWS"
    }
  ]
}
```

---

## ⚡ Getting Started

### 1️⃣ Install dependencies

```bash
npm install
```

---

### 2️⃣ Setup environment variables

Create `.env` file:

```env
PORT=3000
GEMINI_API_KEY=your_api_key_here
```

---

### 3️⃣ Run development server

```bash
npm run dev
```

---

### 4️⃣ Production build

```bash
npm run build
npm start
```

---

## 🔐 Security & Best Practices

* 🔒 API keys stored server-side only
* 🚫 No exposure to frontend
* 🛡️ Middleware-based request validation
* 🔁 Controlled AI request handling

---

## 🎯 Portfolio Value

> This backend demonstrates:

* ✅ Real-world API architecture
* ✅ AI integration in production workflows
* ✅ Clean separation of concerns (routes, services, controllers)
* ✅ Secure handling of sensitive data
* ✅ Scalable and maintainable structure

---

## 🚀 Future Improvements

* 🔑 Authentication system (JWT / OAuth)
* 🗄️ Database integration (PostgreSQL / MongoDB)
* 📊 Usage analytics & logging
* ⚡ Rate limiting & caching

---

## 📄 License

MIT License

---

## 🔗 Related Project

👉 Frontend Repository: [varunn15/skill-tracker-frontend-fullstack](https://github.com/varunn15/skill-tracker-frontend-fullstack)

---

## 🙌 Final Note

> "A strong backend doesn't just serve data — it **drives intelligence and decisions.**"

---

<p align="center">
  <sub>Built with ⚡ and 🔒</sub>
</p>
