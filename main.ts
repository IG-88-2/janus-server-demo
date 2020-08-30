import { Janus } from 'janus-gateway-node';
import express = require("express");
import cors = require("cors");
import bodyParser = require("body-parser");
import { exec } from 'child_process';
const pause = (n:number) => new Promise((resolve) => setTimeout(() => resolve(), n));
const path = require(`path`);
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream(__dirname + '/test.log', { flags : 'w' });
const transformError = (error: Object | string) => !error ?  `Unknown error` : typeof error === "string" ? error : util.inspect(error, {showHidden: false, depth: null});
const https = require('https');
const router = express.Router();
const app = express();

const setAllowed = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");

    res.header("Access-Control-Allow-Methods", "HEAD, PUT, POST, GET, OPTIONS, DELETE");

    res.header("Access-Control-Allow-Headers", "origin, content-type, Authorization, x-access-token");

    if (req.method === "OPTIONS") {
        return res
            .status(405)
            .send()
            .end();
    } else {
        next();
    }
};

router.get("/", (req, res) => {
    res.json({
        version: "1.1.2"
    });
});

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.use(express.static(path.resolve("development")));

app.use(setAllowed);

app.use("/v1", router);

let janus = null;

let enable = true;

const logger = {
	enable: () => {

        enable = true;
    
    },
    disable: () => {
    
        enable = false;
    
    },
	info: (message) => {

		if (enable) {
			console.log("\x1b[32m", `[test info] ${message}`);
			logFile.write(util.format(message) + '\n');
		}

	},
	browser: (...args) => {

		if (enable) {
			if (args) {
				const message = args.join(' ');
				console.log("\x1b[33m", `[test browser] ${message}`);
				if (message.includes("error")) {
					logFile.write(util.format(message) + '\n');
				}
			}
		}

	},
	error: (message) => {
		
		if (enable) {
			if (typeof message==="string") {
				console.log("\x1b[31m", `[test error] ${message}`);
				logFile.write(util.format(message) + '\n');
			} else {
				try {
					const string = transformError(message);
					console.log("\x1b[31m", `[test error] ${string}`);
					logFile.write(util.format(string) + '\n');
				} catch(error) {}
			}
		}

	},
	json: (object) => {

		if (enable) {
			const string = JSON.stringify(object, null, 2);
			console.log("\x1b[37m", `[test json] ${string}`);
			logFile.write(util.format(string) + '\n');
		}

	}
};



const retrieveContext = () => {

	try {

		const contextPath = path.resolve('context.json');

		const file = fs.readFileSync(contextPath, 'utf-8');

		const context = JSON.parse(file);

		return context;

	} catch(error) {

		logger.error(error);

		return {};

	}

};



const updateContext = async (rooms) => {

	try {
		
		const contextPath = path.resolve('context.json');

		const file = JSON.stringify(rooms);

		const fsp = fs.promises;

		await fsp.writeFile(contextPath, file, 'utf8');
		
	} catch(error) {

		logger.error(error);
		
	}

	return rooms;

}



const main = async () => {
	
	const nRooms = 5;

	const keys = { 
		key: fs.readFileSync("/etc/letsencrypt/live/kreiadesign.com/privkey.pem"),
		cert: fs.readFileSync("/etc/letsencrypt/live/kreiadesign.com/cert.pem")
	};
	
	const serverOptions = { 
		key: keys.key, 
		cert: keys.cert 
	};
	
	const server = https.createServer(serverOptions, app).listen(443); 
	
	await pause(3000);

	janus = new Janus({
		logger,
		keepAliveTimeout:10000,
		syncInterval:10000,
		instancesAmount:2,
		retrieveContext: retrieveContext,
		updateContext: updateContext,
		onError: (error) => {
			
			logger.error(error);

		}
	});

	await janus.initialize();

	await pause(3000);

	for(let i = 0; i < nRooms; i++) {
		const result = await janus.createRoom({
			load: {
				description: i%2 ? `Cool vp8 room (${i})` : `Cool vp9 room (${i})`,
				bitrate: 512000,
				bitrate_cap: false,
				fir_freq: undefined,
				videocodec:i===0 ? "vp8" : "vp9",
				vp9_profile:i===0 ? undefined : "1"
			}
		});
		logger.json(result);
	}
	
}


main();

