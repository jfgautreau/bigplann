# Image applicative - TEST SIMPLIFIE.
# Volontairement simple (node_modules complets, pas de sortie standalone).
# Sera optimisee (multi-stage + standalone) au vrai Lot 1.
FROM node:24-alpine

WORKDIR /app

# Dependances (cache de couche tant que package*.json ne change pas)
COPY package.json package-lock.json* ./
RUN npm install

# Code source
COPY . .

# Client Prisma + build Next
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Au demarrage : applique les migrations, seed l'admin, lance Next.
CMD ["npm", "run", "start:prod"]
