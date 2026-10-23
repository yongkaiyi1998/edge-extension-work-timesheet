import { api, $, message } from "./client.js";
import { editor } from "./editor.js";
async function load() {
  editor($("#editor"), await api("get"), null, load);
}
load().catch((e) => message(e.message, true));
