FROM node:18-alpine

WORKDIR /app

# 1. Встановлення інструментів компіляції для нативних модулів (наприклад, bcrypt)
RUN apk add --no-cache python3 g++ make && \
    ln -sf python3 /usr/bin/python

COPY package.json ./

# 2. Встановлення залежностей
RUN npm install

# 3. Видалення інструментів компіляції, щоб зменшити розмір образу
RUN apk del python3 g++ make

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]