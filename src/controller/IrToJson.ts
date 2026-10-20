import { mkdir, writeFile } from "fs/promises";
import api from "../config/axios_config.js";
import path from "path";

export async function getIr(id: string) {
  // console.log(`/projects/${id}/parser`)
  // const resp = await api.get(`/projects/${id}/parser`);

  const dir = path.resolve("temp_ir_store");
  const filename = path.join(dir, `${id}.json`);
  
  await mkdir(dir, { recursive: true });
  await writeFile(filename, JSON.stringify({"Hello":"json creation"}, null, 2), "utf-8");

  console.log("IR Retrieved successfully");
}