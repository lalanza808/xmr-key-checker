# Build and compile the Deno application
FROM denoland/deno:latest AS builder
WORKDIR /app
COPY deno.json deno.lock package.json ./
RUN deno install
COPY public public
COPY src src
COPY nodes.json nodes.json
CMD ["deno", "run", "--allow-all", "./src/app.ts"]
