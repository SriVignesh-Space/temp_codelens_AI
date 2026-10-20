import express, { type Request, type Response } from 'express';
import { getIr } from './controller/IrToJson.js';
import { readFile } from "node:fs/promises";
import path from "node:path";
import run from './run_ingest.js';

const app = express();

app.get('/', async (req, res) => {

  await run();
  res.json("json retrieved");
})

app.listen(3030, () => {
  console.log("Server on 3030")
})