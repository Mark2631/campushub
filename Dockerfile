FROM node:20-alpine

WORKDIR /app

# install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --silent

# copy rest
COPY . .

# lint, type-check, build
RUN npm run lint || true
RUN npm run type-check || true
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
