import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, "dist", "index.js");

let requestId = 1;

function sendRequest(proc, method, params = {}) {
  const id = requestId++;
  const request = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
  proc.stdin.write(JSON.stringify(request) + "\n");
  return id;
}

function runTest() {
  const proc = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  let buffer = "";

  proc.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();

    lines.forEach((line) => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log("\n=== RESPONSE ===");
          console.log(JSON.stringify(response, null, 2));

          // if (response.result?.content?.[0]?.text) {
          //   writeFileSync('./html/response.csv', response.result.content[0].text, 'utf-8');
          //   console.log("\n=== Written to html/response.csv ===");
          // }
        } catch (e) {
          console.log("Raw:", line);
        }
      }
    });
  });

  proc.on("close", (code) => {
    console.log(`\nServer exited with code ${code}`);
  });

  setTimeout(() => {
    console.log("\n=== TEST: Initialize ===");
    sendRequest(proc, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
  }, 100);

  // setTimeout(() => {
  //   console.log("\n=== TEST: List Tools ===");
  //   sendRequest(proc, "tools/list");
  // }, 500);
  //
  //
  // setTimeout(() => {
  //   console.log("\n=== TEST: Get Company (USDOT) ===");
  //   sendRequest(proc, "tools/call", {
  //     name: "getCompany",
  //     arguments: { number: "1560953" },
  //   });
  // }, 2000);
  //
  // setTimeout(() => {
  //   console.log("\n=== TEST: Get Company (MC) ===");
  //   sendRequest(proc, "tools/call", {
  //     name: "getCompany",
  //     arguments: { number: "MC-1617151" },
  //   });
  // }, 4000);

  // setTimeout(() => {
  //   console.log("\n=== TEST: Find Company By Name ===");
  //   sendRequest(proc, "tools/call", {
  //     name: "findCompanyByName",
  //     arguments: { name: "AMAX EXPRESS LLC" },
  //   });
  // }, 6000);

  setTimeout(() => {
    console.log("\n=== TEST: Get Company History ===");
    sendRequest(proc, "tools/call", {
      name: "getCompanyHistory",
      arguments: { number: "MC00161715", token: "40231E0E58195469E0630100007F8B85" },
    });
  }, 8000);

  setTimeout(() => {
    console.log("\n=== Closing server ===");
    proc.kill();
  }, 12000);
}

runTest();
