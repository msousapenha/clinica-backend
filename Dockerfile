# ANTES ESTAVA ASSIM:
# FROM node:18-alpine

# MUDE PARA ISSO (Versão 22 é a recomendada atual):
FROM node:22-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Gera o cliente do Prisma
RUN npx prisma generate

# Copia o código fonte
COPY . .

# Expõe a porta
EXPOSE 3333

# Comando de inicialização
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm start"]