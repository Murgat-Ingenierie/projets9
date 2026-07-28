FROM node:26-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Configuration OIDC : Vite l'inscrit dans le bundle AU BUILD, elle doit donc
# arriver ici et non au démarrage du conteneur. Vides par défaut = adossement
# inactif, l'application se comporte comme avant.
ARG VITE_OIDC_AUTHORITY=""
ARG VITE_OIDC_CLIENT_ID=""
ARG VITE_OIDC_API_CLIENT_ID="projets9-api"
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY     VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID     VITE_OIDC_API_CLIENT_ID=$VITE_OIDC_API_CLIENT_ID
RUN npm run build

FROM nginx:1.31-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
