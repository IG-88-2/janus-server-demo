import { Janus } from 'janus-gateway-node';
import express = require("express");
import cors = require("cors");
import bodyParser = require("body-parser");
const pause = (n:number) => new Promise((resolve) => setTimeout(() => resolve(), n));
const path = require(`path`);
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream(__dirname + '/test.log', { flags : 'w' });
//const roomsFile = fs.createWriteStream(__dirname + '/rooms.log', { flags : 'a' });
const { argv } = require('yargs');
const transformError = (error: Object | string) => !error ?  `Unknown error` : typeof error === "string" ? error : util.inspect(error, {showHidden: false, depth: null});
const https = require('https');
const router = express.Router();
const app = express();
const p = path.join(__dirname, "development");
let janus = null;



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

app.use(express.static(p));

router.get("/", (req, res) => {
    res.json({
        version: "0.0.3"
    });
});

router.post("/room", async (req, res, next) => {

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

		if (result && result.load && result.load.context) {
			const id = result.load.context.room_id;
			//roomsFile.write(`${id}\n`);
		}

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

});

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json());

app.use(setAllowed);

app.use("/v1", router);


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

	const coy = argv.coy;

	console.log('start', argv, coy);

	const paths = {
		key:coy ? "/home/vmadmin/ssl/blipiq.key" : "/etc/letsencrypt/live/kreiadesign.com/privkey.pem", //STAR_blipiq_com.ca-bundle
		cert:coy ? "/home/vmadmin/ssl/STAR_blipiq_com.crt" : "/etc/letsencrypt/live/kreiadesign.com/cert.pem"
	};

	const keys = {
		key:fs.readFileSync(paths.key),
		cert:fs.readFileSync(paths.cert)
	};
	
	console.log(keys);

	const serverOptions = { 
		key: keys.key,
		cert: keys.cert 
	};
	
	const server = https.createServer(serverOptions, app).listen(443); 
	
	await pause(3000);
	
	let instances = null;

	try {
		const instancesPath = path.resolve('instances.json');
		const result = fs.readFileSync(instancesPath, 'utf-8');
		instances = JSON.parse(result);
	} catch(e) {}
	
	const generateInstances = instances ? () => instances : undefined;
	
	janus = new Janus({
		generateInstances,
		logger,
		onError:(error) => {
			
			logger.error(error);

		},
		publicIp:coy ? '40.87.103.74' : '18.158.159.40',
		webSocketOptions:{
			server
		}
	});

	await janus.initialize();

	let list : string[] = [];
	
	try {

		const rooms = fs.readFileSync(__dirname + '/rooms.log');

		list = rooms.toString().split('\n').filter((s) => s.length > 0);

	} catch(error) {
		
		console.error(error);
	
	}
	
	/*
	console.log('rooms loaded', list);
	
	for(let i = 0; i < list.length; i++) {
		const id = list[i].trim();
		console.log(`recreating room ${id}...`);
		try {
			const result = await janus.createRoom({
				load: {
					id,
					description: i%2 ? `Restore cool vp8 room (${i})` : `Restore cool vp9 room (${i})`,
					bitrate: 512000,
					bitrate_cap: false,
					fir_freq: undefined,
					videocodec: i===0 ? "vp8" : "vp9",
					vp9_profile: i===0 ? undefined : "1",
					permanent: true
				}
			});
			console.log(`recreating room ${id} result...`, result.load);
		} catch(error) {
			console.error(error);
		}
	}
	*/
	
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
		const id = result.load.context.room_id;
		//roomsFile.write(`${id}\n`);
		logger.info(`room ${i + 1} created...`);
		logger.json(result);
	}
	
}

main();
