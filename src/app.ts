import nunjucks from "nunjucks";

import { WalletService } from "./services/WalletService.ts";

import { 
  getTxHtml, 
  getBlockHtml,
  getTxReceiptHtml,
  getSearchHtml,
  getLatestBlocks,
  getNetworkInfo,
  getMempool,
  serveStatic
} from "./routes.ts";

async function shutdown(): Promise<void> {
  await WalletService.shutdown();
  Deno.exit(0);
}

// Handle graceful shutdown
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Initialize wallet and start server
console.log("[.] Starting web server...");
try {
  if (! Deno.env.get("NODE")) {
    console.error("[!] You did not specify a node, using a list of remote nodes from nodes.json");
  }
  await WalletService.initialize();
} catch (_error) {
  console.error("[!] Failed to start server", _error);
  Deno.exit(1);
}

function returnHTML(rendered: string): Response {
  return new Response(rendered, {
    headers: { "content-type": "text/html" }
  });
}

const n = nunjucks.configure(`${Deno.cwd()}/src/templates`, {});
const nojs = Deno.env.get("NOJS") === "1";
const _theme = Deno.env.get("THEME");
const theme = _theme === "dark" ? "dark": "light"

n.addGlobal("theme", theme);

if (nojs) {
  console.log("[.] No JS mode detected");
  n.addGlobal("nojs", true);
}

Deno.serve({port: Deno.env.get("PORT")}, async (req) => {
  const url = new URL(req.url);


  // static files
  const staticResponse = await serveStatic(url.pathname);
  if (staticResponse) return staticResponse;

  // ------------------------------
  // Dynamic routes
  //
  // These routes will render HTML depending on if user provided NOJS variable or not.
  // If the variable is not specified, Javascript (HTMX) templates will be used,
  // otherwise RPC calls will be made and rendered into the template directory.

  // root
  const index_route = new URLPattern({ pathname: "/" }).exec(url)
  if (index_route) {
    if (nojs) {
      const blocks = await getLatestBlocks();
      const network = await getNetworkInfo();
      const mempool = await getMempool();
      const html = await nunjucks.render("nojs/home.html", {
        blocks: blocks,
        network: network,
        mempool: mempool
      })
      return returnHTML(html);
    }
    const html = await nunjucks.render("pages/home.html")
    return returnHTML(html);
  }

  // tx receipts
  const receipt_route = new URLPattern({ pathname: "/receipt/:id" }).exec(url)
  if (receipt_route) {
    const params = receipt_route.pathname.groups;
    const urlParams = new URLSearchParams(receipt_route.search.input);
    const address = urlParams.get("address");
    const txkey = urlParams.get("txkey");
    const details = urlParams.get("details");
    const html = await getTxReceiptHtml(params.id || '', address || '', txkey || '', details);
    return returnHTML(html);
  }

  // search
  const search_route = new URLPattern({ pathname: "/search" }).exec(url)
  if (search_route) {
    const urlParams = new URLSearchParams(search_route.search.input);
    const searchQuery: string|null = urlParams.get("q");
    const res: Response = await getSearchHtml(searchQuery);
    return res;
  }

  // tx
  const tx_route = new URLPattern({ pathname: "/tx/:id" }).exec(url)
  if (tx_route) {
    const params = tx_route.pathname.groups;
    if (nojs) {
      const html = await getTxHtml(params.id || '', "nojs/tx.html");
      return returnHTML(html);
    }
    const html = await nunjucks.render("pages/tx.html", {
      hash: params.id
    })
    return returnHTML(html);
  }

  // block
  const block_route = new URLPattern({ pathname: "/block/:id" }).exec(url)
  if (block_route) {
    const params = block_route.pathname.groups;
    if (nojs) {
      const html = await getBlockHtml(params.id || '', "nojs/block.html");
      return returnHTML(html);
    }
    const html = await nunjucks.render("pages/block.html", {
      id: params.id
    })
    return returnHTML(html);
  }

  // ------------------------------
  // HTMX routes
  //
  // These routes render fractional HTML snippets 
  // and load them into the page via HTMX javascript
  // They will not be available if user provides NOJS env var

  // htmx tx
  const htmx_tx_route = new URLPattern({ pathname: "/htmx/tx/:id" }).exec(url)
  if (htmx_tx_route && ! nojs) {
    const params = htmx_tx_route.pathname.groups;
     const html = await getTxHtml(params.id || '', "htmx/tx.html");
    return returnHTML(html);
  }

  // htmx block
  const htmx_block_route = new URLPattern({ pathname: "/htmx/block/:id" }).exec(url)
  if (htmx_block_route && ! nojs) {
    const params = htmx_block_route.pathname.groups;
     const html = await getBlockHtml(params.id || '', "htmx/block.html");
    return returnHTML(html);
  }

  // htmx network info
  const network_info = new URLPattern({ pathname: "/htmx/network_info" }).exec(url)
  if (network_info && ! nojs) {
    const network = await getNetworkInfo();
    const html = await nunjucks.render("htmx/network_info.html", {
      network: network
    });
    return returnHTML(html);
  }

  // htmx mempool
  const mempool_summary = new URLPattern({ pathname: "/htmx/mempool_summary" }).exec(url)
  if (mempool_summary && ! nojs) {
    const mempool = await getMempool();
    const html = await nunjucks.render("htmx/mempool_summary.html", {
      mempool: mempool
    })
    return returnHTML(html);
  }

  // htmx blocks
  const recent_blocks = new URLPattern({ pathname: "/htmx/recent_blocks" }).exec(url)
  if (recent_blocks && ! nojs) {
    const blocks = await getLatestBlocks();
    const html = await nunjucks.render("htmx/recent_blocks.html", {
      blocks: blocks
    })
    return returnHTML(html);
  }

  // 404 if no other hits
  const html = await nunjucks.render("error.html", {
    message: "404. There is no page here."
  })
  return returnHTML(html);
});
