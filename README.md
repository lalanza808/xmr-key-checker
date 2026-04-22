# Monero Explorer

Lightweight Monero Explorer service. Supports checking Monero transaction receipts.

![](public/images/preview.png)

## Running

This is a Typescript application written with the [Deno](https://deno.com/) runtime. You can either run it with Deno or as a Docker container.

For best performance you will want to utilize a local Monero node, but remote nodes are supported. There are a few configuration options you can utilize, but otherwise it will work out of the box.

There is a pre-made container image available at [lalanza808/moneroexplorer](https://hub.docker.com/r/lalanza808/moneroexplorer)

### Configuration

The below environment variables can be set to change some functionality.

| Variable | Description | Example | Default Functionality |
|-|-|-|-|
| `NODE` | URL of a local or remote node to use. A local node is recommended for performance and security. | `NODE=http://localhost:18081` | A list of nodes at [nodes.json](./nodes.json) will be used and picked from randomly on each request. This config option overrides that to use just one. |
| `NOJS` | Disable JavaScript in the browser. Page loads will be slower as nodes are queried for data first. | `NOJS=1` | Javascript will be used to update pages with data from the backend. Set to any other value to disregard.  |
| `THEME` | Specify light or dark mode themes. Mainly set when NOJS is enabled. | `THEME=light` / `THEME=dark` | The default theme is light mode. If JavaScript is enabled (the default) then visitors can specify their own theme preference. |
| `BASE_URL` | Specify a base URL path if you are running this behind a reverse proxy with a subpath. | `BASE_URL=/explorer` | The application will be served from the root path. |

Examples:

```bash
# deno
NODE=http://127.0.0.1:18081 THEME=light deno run start # js, local node, light theme
NOJS=1 NODE=https://node.sethforprivacy.com deno run start # no js, remote node

# docker
docker run --rm -it -p 8000:8000 --env NODE=http://monerod:18081 lalanza808/moneroexplorer # js, local docker node
docker run --rm -it -p 8000:8000 --env NODE=https://xmr.hexide.com --env NOJS=1 --env THEME=dark lalanza808/moneroexplorer # no js, remote node, dark theme
docker run --rm -it -p 8000:8000 --env BASE_URL=/explorer lalanza808/moneroexplorer # run with a base url
```
### With Deno

Make sure you've installed the [Deno](https://deno.com/) runtime from the site and it is available in your CLI.

```bash
deno install
deno run start
```

### With Docker

Make sure you've installed the [Docker Engine](https://get.docker.com/), the service is running, you have permission to use the engine, and it is available in your CLI.

```bash
# run pre-made image
docker run --rm -it -p 8000:8000 lalanza808/moneroexplorer

# or build it yourself
docker build -t moneroexplorer .
docker run --rm -it -p 8000:8000 moneroexplorer
```
