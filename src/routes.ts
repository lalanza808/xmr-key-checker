import moneroTs from "monero-ts";
import nunjucks from "nunjucks";

import { NodeService } from "./services/NodeService.ts"
import { WalletService } from "./services/WalletService.ts";
import {
  Mempool,
  MempoolTx,
  Block,
  Network,
  Transaction,
  CheckTxKey
} from "./types.ts";

export async function getTxHtml(id: string, template: string): Promise<string> {
    const currentInfo = NodeService.getCache("get_info");
    const res = await NodeService.make_rpc_request("get_transactions", {
      txs_hashes: [id], "decode_as_json": true
    });
    if (res.txs && res.txs.length > 0) {
      const tx = res.txs[0];
      const tx_json = JSON.parse(tx.as_json)
      const data: Transaction = {
        height: tx.block_height,
        hash: tx.tx_hash,
        timestamp: tx.block_timestamp,
        date: new Date(tx.block_timestamp * 1_000).toString(),
        confirmations: tx.confirmations,
        tx_json: tx_json,
        current_height: currentInfo.result.height
      }
      const html = await nunjucks.render(template, data)
      return html;
    } else {
      const html = await nunjucks.render("error.html", {
        message: "This is not a valid transaction."
      })
      return html;
    }
}

export async function getBlockHtml(id: string, template: string): Promise<string> {
    const currentInfo = NodeService.getCache("get_info");
    const res = await NodeService.make_json_rpc_request("get_block", {
        height: id
    });
    const data = res.result;
    const block_json = JSON.parse(data.json);
    const html = await nunjucks.render(template, {
        block: data,
        block_json: block_json,
        date: new Date(data.block_header.timestamp * 1_000).toString(),
        current_height: currentInfo.result.height
    })
    return html;
}

export async function getTxReceiptHtml(id: string, address: string, txkey: string, details: string|null): Promise<string> {
    const checkKey: CheckTxKey = await WalletService.checkTxKey(id, txkey, address);
    if (checkKey.status === "success") {
        const html = await nunjucks.render("pages/receipt.html", {
            confirmations: checkKey.data?.confirmations,
            hash: id,
            address: address,
            amount: checkKey.data?.amount,
            details: details
        })
        return html;
    } else {
        const html = await nunjucks.render("error.html", {
          message: "Your recipient address and secret key are invalid for this transaction."
        })
        return html;
    }
}

export async function getSearchHtml(searchQuery: string|null): Promise<Response> {
    const currentInfo = NodeService.getCache("get_info");
    if (Number.isFinite(Number(searchQuery))) {
        if (Number(searchQuery) >= Number(currentInfo.result.height)) {
            const html = await nunjucks.render("error.html", {
                message: "That block has not been mined yet."
            })
            return new Response(html, {
                headers: { "content-type": "text/html" }
            });
        }
        if (Number(searchQuery) >= 0) {
            return new Response(null, {
                status: 302,
                headers: {
                    Location: `/block/${searchQuery}`
                }
            })
        }
    }
    if (searchQuery?.length == 64) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `/tx/${searchQuery}`
            }
        })
    }
    const html = await nunjucks.render("error.html", {
        message: "No results found. Not sure what you are searching for."
    })
    return new Response(html, {
        headers: { "content-type": "text/html" }
    });
}

export async function getLatestBlocks(): Promise<Block[]> {
    const endHeight = NodeService.getCache("get_info").result.height - 1;
    const startHeight = endHeight - 10;
    const params = {"start_height": startHeight, "end_height": endHeight}
    const data = await NodeService.make_json_rpc_request("get_block_headers_range", params)
    const blockHeaders = data.result.headers
    const blocks: Block[] = [];
    for (let i = 0; i < blockHeaders.length; i++) {
        const ageSeconds = NodeService.getAge(blockHeaders[i].timestamp)
        const ageMinutes = Math.round(ageSeconds / 60);
        const new_block: Block = {
            age: ageMinutes,
            height: blockHeaders[i].height,
            num_txes: blockHeaders[i].num_txes,
            size: (blockHeaders[i].block_size / 1_000).toFixed(2)
        }
        blocks.unshift(new_block)
    }
    return blocks;
}

export async function getNetworkInfo(): Promise<Network> {
    const data = await NodeService.make_json_rpc_request("get_info")
    const network: Network = {
        height: data.result.height.toLocaleString(),
        difficulty: (data.result.difficulty / 1_000_000_000).toFixed(2),
        hash_rate: (data.result.difficulty / data.result.target / 1_000_000_000).toFixed(2),
        tx_count: data.result.tx_count.toLocaleString()
    }
    return network;
}

export async function getMempool(): Promise<Mempool> {
    const data = await NodeService.make_rpc_request("get_transaction_pool")
    const limit = 10;
    const txes: MempoolTx[] = [];
    if (!data.transactions) data.transactions = []
    for (let i = 0; (i < data.transactions.length && i < limit); i++) {
      const tx = data.transactions[i];
      const tx_json = JSON.parse(tx.tx_json)
      const diffSeconds = NodeService.getAge(tx.receive_time)
      const new_tx: MempoolTx = {
        tx_hash: tx.id_hash,
        tx_hash_clean: tx.id_hash.slice(0, 8) + "..." + tx.id_hash.slice(-8),
        tx_size: tx.blob_size / 1_000,
        age: diffSeconds,
        timestamp: tx.receive_time,
        fee: 0
      }
      if ("rct_signatures" in tx_json) {
        new_tx.fee = moneroTs.MoneroUtils.atomicUnitsToXmr(tx_json.rct_signatures.txnFee)
      }
      if (tx.receive_time === 0) {
        new_tx.age = "?";
      }
      txes.push(new_tx)
    }
    txes.sort((a, b) => {
      return b.timestamp - a.timestamp;
    })
    const mempool: Mempool = {
      total_count: data.transactions.length,
      tx_count: txes.length,
      txes: txes
    }
    return mempool;
}

export async function serveStatic(pathname: string): Promise<Response | null> {
  try {
    // Handle public static files
    if (pathname.startsWith("/css/") ||
        pathname.startsWith("/js/") ||
        pathname.startsWith("/images/") ||
        pathname.startsWith("/fonts/") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt") {

      const filePath = `./public${pathname}`;

      // Determine content type
      let contentType = "text/plain";
      if (pathname.endsWith(".css")) contentType = "text/css";
      else if (pathname.endsWith(".js")) contentType = "application/javascript";
      else if (pathname.endsWith(".png")) contentType = "image/png";
      else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (pathname.endsWith(".gif")) contentType = "image/gif";
      else if (pathname.endsWith(".svg")) contentType = "image/svg+xml";
      else if (pathname.endsWith(".webp")) contentType = "image/webp";
      else if (pathname.endsWith(".ico")) contentType = "image/x-icon";
      else if (pathname.endsWith(".woff")) contentType = "font/woff";
      else if (pathname.endsWith(".woff2")) contentType = "font/woff2";
      else if (pathname.endsWith(".ttf")) contentType = "font/ttf";
      else if (pathname.endsWith(".eot")) contentType = "application/vnd.ms-fontobject";
      else if (pathname.endsWith(".txt")) contentType = "text/plain";
      else if (pathname.endsWith(".json")) contentType = "application/json";

      // For binary files (images, fonts), read as binary
      if (contentType.startsWith("image/") || contentType.startsWith("font/") || contentType === "application/vnd.ms-fontobject") {
        const file = await Deno.readFile(filePath);
        return new Response(file, {
          headers: { "content-type": contentType }
        });
      } else {
        // For text files, read as text
        const file = await Deno.readTextFile(filePath);
        return new Response(file, {
          headers: { "content-type": contentType }
        });
      }
    }
  } catch (_error) {
    return null;
  }
  return null;
}
