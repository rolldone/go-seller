#!/usr/bin/env node
import { Command } from "commander";
import { runImportCategories } from "./commands/import-categories.js";

const program = new Command();

program
  .name("store-importer")
  .description("CLI to seed GoSeller backend with marketplace data")
  .version("1.0.0");

program
  .command("import:categories")
  .description("Import categories from store_data/categories.json into the backend")
  .option("--dry-run", "Print requests without calling the API", false)
  .option("--delay <ms>", "Delay in ms between requests (overrides .env BATCH_DELAY_MS)")
  .action((opts) => runImportCategories(opts));

program.parse(process.argv);
