# Stage 1: Frontend build
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Backend build
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc -p tsconfig.server.json

# Stage 3: Production runner (Ubuntu + Node + Python)
FROM ubuntu:24.04 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		gnupg \
		python3 \
		python3-pip \
		python3-venv \
	&& mkdir -p /etc/apt/keyrings \
	&& curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
	&& echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends nodejs \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY py_engine ./py_engine
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r py_engine/requirements.txt

COPY public ./public
COPY --from=frontend-build /app/dist ./dist
COPY --from=backend-build /app/dist/server ./server/dist

EXPOSE 8080
CMD ["node", "server/dist/server/index.js"]
