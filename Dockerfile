# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Gera o cliente do Prisma (essencial)
RUN npx prisma generate

# Copia o código fonte
COPY . .

# Expõe a porta
EXPOSE 3333

# O CMD faz: Deploy das migrations + Seed do Admin + Inicia o Server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm start"]