// Prints console errors and uncaught exceptions of one page, with headless Chrome over CDP.
//   node scripts/console.mjs http://localhost:3889/
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const url = process.argv[2] ?? "http://localhost:3889/";
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
const PORT = 9348;
const proc = spawn(chrome, ["--headless=new", "--no-first-run", `--user-data-dir=${resolve(tmpdir(), "tape-console")}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
    } catch {
      /* not up */
    }
    await sleep(200);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      console.log(m.params.type, m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 60000));
    if (m.method === "Runtime.exceptionThrown") console.log("exception", m.params.exceptionDetails.exception?.description?.slice(0, 60000));
  });
  send("Runtime.enable");
  send("Page.enable");
  send("Page.navigate", { url });
  await sleep(Number(process.env.WAIT ?? 8000));
  ws.close();
} finally {
  proc.kill();
}
