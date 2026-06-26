FROM node:20-alpine

WORKDIR /usr/src/app

COPY app/package*.json ./

RUN npm install --omit=dev

COPY app/ ./

# Boa prática de segurança: nunca rodar como root em produção
USER node

EXPOSE 3000

CMD ["node", "index.js"]