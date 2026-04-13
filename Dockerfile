FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY client/ ./client/

ENV PORT=3000
ENV TICK_RATE=60
ENV WIN_SCORE=11
ENV BALL_SPEED_INIT=4.0
ENV BALL_SPEED_MAX=12.0
ENV CANVAS_WIDTH=800
ENV CANVAS_HEIGHT=600

EXPOSE 3000

CMD ["node", "server/ws-server.js"]
