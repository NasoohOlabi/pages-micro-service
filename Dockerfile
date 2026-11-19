FROM oven/bun:1.4.0 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.0
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/config.ts ./src/config.ts
COPY --from=build /app/src/sheets ./src/sheets
COPY --from=build /app/node_modules/zod ./node_modules/zod
CMD ["bun","server/index.js"]
