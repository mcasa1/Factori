# 🚀 Quick Start Guide

Get your Intelligent Agent Platform up and running in minutes!

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Docker & Docker Compose** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download here](https://git-scm.com/)

## 🎯 One-Command Setup

Run the automated setup script:

```bash
./setup.sh
```

This script will:
- ✅ Check your system requirements
- 📦 Install all dependencies
- 🔨 Build all packages
- 🐳 Start database services
- 🗄️ Run database migrations
- 🌱 Seed initial data

## 🔧 Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Build Packages
```bash
npm run build
```

### 3. Start Services
```bash
# Start database services
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### 4. Start Development Servers
```bash
npm run dev
```

## 🌐 Access Your Platform

Once everything is running:

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database Admin**: http://localhost:5050

## 🔑 Default Login

- **Email**: admin@agentplatform.com
- **Password**: admin123

## ⚙️ Configuration

Update your `.env` file with your API keys:

```bash
# Required for AI agents
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional: Customize other settings
JWT_SECRET=your-custom-jwt-secret
PORT=3001
```

## 🎮 First Steps

1. **Login** with the default credentials
2. **Create a Project** - Start your first agent team
3. **Add Agents** - Create specialized agents for your project
4. **Start Chatting** - Communicate with your agent team
5. **Monitor Workflows** - Track agent progress and tasks

## 🛠️ Development Commands

```bash
# Start development servers
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format

# Database operations
npm run db:migrate
npm run db:seed
npm run db:studio
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild containers
docker-compose build
```

## 📁 Project Structure

```
intelligent-agent-platform/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── agents/         # Agent implementations
│   │   ├── api/            # API routes
│   │   ├── services/       # Business logic
│   │   └── websocket/      # Real-time communication
│   └── prisma/             # Database schema
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   └── stores/         # State management
├── shared/                 # Shared types and utilities
└── docker-compose.yml      # Development environment
```

## 🆘 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Kill processes on ports 3000, 3001, 5432, 6379
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:5432 | xargs kill -9
lsof -ti:6379 | xargs kill -9
```

**Database connection issues:**
```bash
# Restart database services
docker-compose restart postgres redis
```

**Node modules issues:**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm run install:all
```

**Build errors:**
```bash
# Clean and rebuild
npm run clean
npm run build
```

## 📚 Next Steps

- 📖 Read the [Full Documentation](README.md)
- 🎯 Explore [Agent Types](docs/agents.md)
- 💬 Learn about [Workflows](docs/workflows.md)
- 🔧 Check [API Reference](docs/api.md)
- 🚀 Deploy to [Production](docs/deployment.md)

## 🤝 Need Help?

- 📧 Email: support@agentplatform.com
- 💬 Discord: [Join our community](https://discord.gg/agentplatform)
- 📖 Docs: [Full documentation](https://docs.agentplatform.com)
- 🐛 Issues: [GitHub Issues](https://github.com/agentplatform/issues)

---

**Happy building! 🚀**