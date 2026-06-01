FROM node:18-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production

COPY backend/ ./backend/
COPY frontend/ ./frontend/

EXPOSE 3001
CMD ["node", "backend/server.js"]