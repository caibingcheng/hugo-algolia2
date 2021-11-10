#!/usr/bin/env node

let indexer = require("commander");

indexer
  .version("1.0.7")
  .option("-i, --input [value]", "Input files", function (arg) { return arg; }, "content/**")
  .option("-o, --output [value]", "Output files", "public/algolia.json")
  .option("-t, --toml", "Parse with TOML", false)
  .option("-A, --all", `Turn off "other" category`, false)
  .option("-s, --send", "Send to Algolia", false)
  .option("-m, --multiple-indices [value]", "Multiple categories")
  .option("-p, --custom-index", "Custom index")
  .option("-b, --baseurl", "Base Url", "")
  .option("-u, --uri", "URI", "")
  .option("-x, --index", "Index", "")
  .option("-k, --key", "Key", "")
  .option("-a, --appid", "App ID", "")
  .option("--config [value]", "Config file", "./config.yaml")
  .option("--extname [value]", "File extnames", ".md,.html")
  .option(
    "-c, --content-size [value]",
    "Content size to send to Algolia",
    "20Kb"
  )
  .parse(process.argv);

var HugoAlgolia = require("../");
new HugoAlgolia(indexer).index();
