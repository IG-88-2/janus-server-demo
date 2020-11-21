import { Janus } from 'janus-gateway-node';
const { argv } = require('yargs');
import express = require("express");
import cors = require("cors");
import bodyParser = require("body-parser");
const pause = (n:number) => new Promise((resolve) => setTimeout(() => resolve(), n));
const path = require(`path`);
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream(__dirname + '/test.log', { flags: 'w' });
const transformError = (error: Object | string) => !error ?  `Unknown error` : typeof error === "string" ? error : util.inspect(error, { showHidden: false, depth: null });
const https = require('https');
const router = express.Router();
const app = express();

const p = path.join(__dirname, "development");

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
			//logFile.write(util.format(message) + '\n');
		}

	},
	browser: (...args) => {

		if (enable) {
			if (args) {
				const message = args.join(' ');
				console.log("\x1b[33m", `[test browser] ${message}`);
				if (message.includes("error")) {
					//logFile.write(util.format(message) + '\n');
				}
			}
		}

	},
	error: (message) => {
		
		if (enable) {
			if (typeof message==="string") {
				console.log("\x1b[31m", `[test error] ${message}`);
				//logFile.write(util.format(message) + '\n');
			} else {
				try {
					const string = transformError(message);
					console.log("\x1b[31m", `[test error] ${string}`);
					//logFile.write(util.format(string) + '\n');
				} catch(error) {}
			}
		}

	},
	json: (object) => {

		if (enable) {
			const string = JSON.stringify(object, null, 2);
			console.log("\x1b[37m", `[test json] ${string}`);
			//logFile.write(util.format(string) + '\n');
		}

	}
};

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

/**
 * when request to server is made - use janus.createRoom method from janus instance
 * to create new room and send its info back in response
 */
const postNewRoom = async (req, res) => {

	try {

		const { description, videocodec, vp9_profile } = req.body;

		const load = {
			description: `room ${Math.round(Math.random() * 1000)}`,
			bitrate: 512000,
			bitrate_cap: false,
			fir_freq: undefined,
			videocodec: "vp9",
			permanent: true,
			vp9_profile: "1"
		};

		if (description) {
			load.description = String(description);
		}

		if (videocodec) {
			load.videocodec = String(videocodec);
		}

		if (vp9_profile) {
			load.vp9_profile = String(vp9_profile);
		}

		logger.info(`creating room... ${description}`);

		const result = await janus.createRoom({ load });

		//if (result && result.load && result.load.context) {
		//	const id = result.load.context.room_id;
		//}

		const response = {
			success: true,
			code: 200,
			data: result
		};

		return res.json(response);

	} catch(error) {

		logger.info(`creating room error...`);

		logger.error(error);

		const response = {
			success: false,
			code: 500,
			data: error
		};

		return res.json(response);

	}

};

app.use(express.static(p));

router.get("/", (req, res) => {
    res.json({
        version: "0.0.41"
    });
});

router.post("/room", postNewRoom);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.use(setAllowed);

app.use("/v1", router);

const launchServer = () => {

	const paths = {
		key:"/etc/letsencrypt/live/kreiadesign.com/privkey.pem",
		cert:"/etc/letsencrypt/live/kreiadesign.com/cert.pem"
	};

	const keys = {
		key:fs.readFileSync(paths.key),
		cert:fs.readFileSync(paths.cert)
	};

	const serverOptions = { 
		key: keys.key,
		cert: keys.cert 
	};
	
	const server = https.createServer(serverOptions, app).listen(443); 
	
	return server;

};

const grabRunningInstances = () => {
	
	let instances = undefined;
	//if local file exist with instances descriptions - use it to retrieve instances configuration
	//otherwise pass undefined to constructor and it will generate instances by itself 
	try {
		const instancesPath = path.resolve('instances.json');
		const result = fs.readFileSync(instancesPath, 'utf-8');
		instances = JSON.parse(result);
	} catch(e) {}

	return instances;

};

const createDummyRoomsForFun = async (nRooms) => {

	for(let i = 0; i < nRooms; i++) {
		logger.info(`creating room ${i + 1}...`);
		const result = await janus.createRoom({
			load: {
				description: i%2 ? `Cool vp8 room (${i})` : `Cool vp9 room (${i})`,
				bitrate: 512000,
				bitrate_cap: false,
				fir_freq: undefined,
				videocodec: i===0 ? "vp8" : "vp9",
				vp9_profile: i===0 ? undefined : "1",
				permanent: true
			}
		});
		logger.info(`creating room ${i + 1} result...`);
		console.log(result.load);
		//const id = result.load.context.room_id;
		logger.info(`room ${i + 1} created...`);
		logger.json(result);
	}

};

/**
 * janus gateway node usage example
 */
const main = async () => {
	
	const nRooms = 5;

	const publicIp = argv.ip;

	const server = launchServer();
	
	await pause(3000);
	
	//we need to get dockerized janus instances up and running
	let instances = grabRunningInstances();
	
	const generateInstances = instances ? () => instances : undefined;
	
	janus = new Janus({
		generateInstances,
		logger,
		onError:(error) => logger.error(error),
		publicIp,
		webSocketOptions:{
			server
		}
	});

	await janus.initialize();
	
	await createDummyRoomsForFun(nRooms);
	
};

main();
