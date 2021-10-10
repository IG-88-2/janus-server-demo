import { createDummyRoomsForFun } from './utils/createDummyRoomsForFun';
import { runLaunchInstancesScript } from './utils/runLaunchInstancesScript';
import { terminateInstances } from './utils/terminateInstances';
import { setAllowed } from './utils/setAllowed';
import { Janus } from './janus-gateway-node/dist';
import { pause } from './utils/pause';
import { spawnProcess } from './utils/spawnProcess';
import { logger } from './utils/logger';
const { argv } = require('yargs');
import * as express from 'express';
import cors = require("cors");
const path = require(`path`);
const fs = require('fs');
const https = require('https');
const http = require('http');
const router = express.Router();
const app = express();
const p = path.join(__dirname, "development");

let janus = null;



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
        version: "0.0.42"
    });
});

router.post("/room", postNewRoom);

app.use(cors());

app.use(express.urlencoded({extended: true}));

app.use(express.json())

app.use(setAllowed);

app.use("/v1", router);



const launchHttpsServer = () => {

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



const launchHttpServer = () => {
	
	const server = http.createServer(
		app
	).listen(3000);
	
	return server;

};



const main = async () => {
	
	const { n, mode } = argv;

	let server = null;

	if (mode == "local") {
		server = launchHttpServer();
	} else {
		server = launchHttpsServer();
	}

	try {
		terminateInstances();
	} catch(error) {
		console.error(error);
	}

	const instances : any = await runLaunchInstancesScript(n, {
		image: "herbert1947/janus-gateway-videoroom",
		n
	});
	
	janus = new Janus({
		instances,
		logger,
		onError:(error) => logger.error(error),
		webSocketOptions:{
			server
		}
	});

	await janus.initialize();
	
	await createDummyRoomsForFun(janus, 5);
	
};

main();

