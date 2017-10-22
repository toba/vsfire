import { FileLogger, StdioLogger } from "./logging";
import { ServeOptions, serve } from "./server";
import { SolidityService, SolidityServiceOptions } from "./solidityService";

const program = require("commander");

const numCPUs = require("os").cpus().length;
const packageJson = require("../package.json");
const defaultLspPort = 2089;

program
    .version(packageJson.version)
    .option("-p, --port [port]', 'specifies LSP port to use (" + defaultLspPort + ")", parseInt)
    .option("-c, --cluster [num]", "number of concurrent cluster workers (defaults to number of CPUs, " + numCPUs + ")", parseInt)
    .option("-l, --logfile [file]", "log to this file")
    .parse(process.argv);

const options: ServeOptions & SolidityServiceOptions = {
    clusterSize: program.cluster || numCPUs,
    lspPort: program.port || defaultLspPort,
    logger: program.logfile ? new FileLogger(program.logfile) : new StdioLogger(),
};

serve(options, client => new SolidityService(client, options));
